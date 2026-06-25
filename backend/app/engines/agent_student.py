"""
Agent Student — Gemini-powered Student Simulator for Assessment Testing

Uses Gemini 3 Flash Preview as a "student brain" that:
1. Receives a detailed persona prompt (1-shot) defining knowledge state + behavior
2. Reads actual MCQ questions and answers IN CHARACTER
3. Returns answer choice + thinking process (as the child would think)

Design principles:
- Multi-turn conversation maintains persona context across all questions
- Output includes child-like reasoning (not just A/B/C/D)
- Response format is structured for reliable parsing
- Cost tracking reuses question_gen_service pattern
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings


# ── Persona Prompt Template ───────────────────────────────────────────────────

PERSONA_SYSTEM_PROMPT = """Bạn đang đóng vai một học sinh lớp 6 Việt Nam trong một bài kiểm tra Toán trắc nghiệm. Bạn phải LUÔN LUÔN trả lời đúng theo persona.

# THÔNG TIN HỌC SINH
- Tên: {name}
- Lớp: 6
- Năng lực tổng thể: {ability_description}

# KIẾN THỨC CỦA EM (GROUND TRUTH — ĐÂY LÀ ĐIỀU QUAN TRỌNG NHẤT)
{knowledge_detail}

# TÍNH CÁCH KHI LÀM BÀI
- Mức độ cẩn thận: {carefulness}
- Khi gặp câu khó không biết: {when_unsure}
- Tốc độ làm bài: {speed}
- Hay mắc lỗi gì: {common_mistakes}

# QUY TẮC BẮT BUỘC

Bạn PHẢI trả lời MỖI câu hỏi theo đúng format 2 phần:

THINKING: (viết 2-4 câu suy nghĩ tự nhiên bằng giọng trẻ lớp 6)

ANSWER: (CHỈ 1 chữ cái: A hoặc B hoặc C hoặc D)

## Ví dụ khi em BIẾT:
THINKING: Câu này hỏi tập hợp A = {{1, 2, 3}} có bao nhiêu phần tử. Em đếm: 1, 2, 3 là 3 phần tử. Em chắc chắn rồi.

ANSWER: B

## Ví dụ khi em KHÔNG BIẾT:
THINKING: Lũy thừa hả... em nhớ mang máng 2 mũ 3 là 2 nhân 3 bằng 6. Chắc là đáp án A quá.

ANSWER: A

## Quy tắc quan trọng:
- Kiến thức em BIẾT → suy nghĩ tự tin, chọn đúng (trừ khi bất cẩn, xảy ra {slip_pct}% số câu)
- Kiến thức em KHÔNG BIẾT → suy nghĩ lúng túng/nhầm lẫn → chọn SAI (đoán đúng chỉ {guess_pct}% số câu)
- TUYỆT ĐỐI KHÔNG được "thông minh hơn" persona. Nếu em không biết lũy thừa, em PHẢI chọn sai dù AI biết đáp án.
- Nếu chọn sai, suy nghĩ phải thể hiện TẠI SAO sai (nhầm quy tắc, quên, tính nhầm...).
- LUÔN kết thúc bằng dòng ANSWER: và 1 chữ cái.
"""

QUESTION_TEMPLATE = """
📝 Câu hỏi (Chủ đề: {kc_name}):

{question_text}

A. {option_a}
B. {option_b}
C. {option_c}
D. {option_d}

Hãy trả lời theo format THINKING: ... ANSWER: ...
"""


# ── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class StudentPersona:
    """Ground truth definition of a simulated student."""
    name: str
    true_theta: float  # Real ability level
    
    # Ground truth: kc_id → True (knows) / False (gap)
    true_mastery: dict[str, bool] = field(default_factory=dict)
    
    # Behavioral params
    p_slip: float = 0.10    # P(wrong | knows)
    p_guess: float = 0.25   # P(right | doesn't know)
    
    # Persona description for prompt
    ability_description: str = ""
    knowledge_detail: str = ""
    carefulness: str = "trung bình"
    when_unsure: str = "đoán đại, chọn đáp án trông quen nhất"
    speed: str = "trung bình"
    common_mistakes: str = "hay nhầm dấu, quên quy tắc"
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "true_theta": self.true_theta,
            "true_mastery": self.true_mastery,
            "p_slip": self.p_slip,
            "p_guess": self.p_guess,
            "ability_description": self.ability_description,
        }


@dataclass
class AgentResponse:
    """Parsed response from the student agent."""
    answer: str          # A, B, C, or D
    thinking: str        # Child's reasoning text
    raw_text: str        # Full raw response
    correct: bool = False  # Set after comparing with correct answer


# ── Agent Session ─────────────────────────────────────────────────────────────

# Cost tracking
_AGENT_COST_LEDGER: list[dict] = []

def _record_agent_cost(step: int, input_tokens: int, output_tokens: int) -> float:
    """Track cost per API call. gemini-3-flash-preview pricing."""
    cost = (
        input_tokens  / 1_000_000 * 0.500 +  # $0.50/1M input
        output_tokens / 1_000_000 * 3.000     # $3.00/1M output
    )
    _AGENT_COST_LEDGER.append({
        "step": step,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost, 6),
    })
    return cost


def get_agent_cost_summary() -> dict:
    """Return aggregate cost for agent simulations."""
    if not _AGENT_COST_LEDGER:
        return {"calls": 0, "total_cost_usd": 0.0}
    return {
        "calls": len(_AGENT_COST_LEDGER),
        "total_input_tokens": sum(e["input_tokens"] for e in _AGENT_COST_LEDGER),
        "total_output_tokens": sum(e["output_tokens"] for e in _AGENT_COST_LEDGER),
        "total_cost_usd": round(sum(e["cost_usd"] for e in _AGENT_COST_LEDGER), 6),
    }


def build_persona_prompt(persona: StudentPersona) -> str:
    """Build the system prompt for the Gemini conversation."""
    return PERSONA_SYSTEM_PROMPT.format(
        name=persona.name,
        ability_description=persona.ability_description,
        knowledge_detail=persona.knowledge_detail,
        carefulness=persona.carefulness,
        when_unsure=persona.when_unsure,
        speed=persona.speed,
        common_mistakes=persona.common_mistakes,
        slip_pct=int(persona.p_slip * 100),
        guess_pct=int(persona.p_guess * 100),
    )


def _wrong_answer_labels(item: dict) -> list[str]:
    correct = get_correct_answer(item)
    return [label for label in ("A", "B", "C", "D") if label != correct]


def format_question(
    item: dict,
    kc_name: str = "",
    persona_knows_kc: bool | None = None,
) -> str:
    """Format an item dict into the question prompt for the agent."""
    content = item.get("content", {})
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            content = {"question": content, "answers": []}
    
    question_text = content.get("question", "")
    answers = content.get("answers", [])
    
    options = {"A": "", "B": "", "C": "", "D": ""}
    for ans in answers:
        label = ans.get("label", "")
        text = ans.get("text", "")
        if label in options:
            options[label] = text
    
    prompt = QUESTION_TEMPLATE.format(
        kc_name=kc_name,
        question_text=question_text,
        option_a=options["A"],
        option_b=options["B"],
        option_c=options["C"],
        option_d=options["D"],
    )

    if persona_knows_kc is True:
        prompt += (
            "\n\nGROUND TRUTH FOR THIS KC: Em BIẾT chủ đề này. "
            "Hãy giải như học sinh biết bài; chỉ sai nếu thật sự bất cẩn theo persona."
        )
    elif persona_knows_kc is False:
        wrong_labels = ", ".join(_wrong_answer_labels(item))
        prompt += (
            "\n\nGROUND TRUTH FOR THIS KC: Em KHÔNG BIẾT chủ đề này. "
            "Đây là rule kiểm thử bắt buộc: em phải chọn một đáp án SAI "
            f"trong các lựa chọn {wrong_labels}, không được chọn đáp án đúng. "
            "Phần THINKING phải thể hiện nhầm lẫn tự nhiên của học sinh."
        )

    return prompt


def get_correct_answer(item: dict) -> str:
    """Extract the correct answer label from an item."""
    content = item.get("content", {})
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return "A"
    
    answers = content.get("answers", [])
    for ans in answers:
        if ans.get("is_correct", False):
            return ans.get("label", "A")
    return "A"


def parse_agent_response(raw_text: str) -> AgentResponse:
    """Parse the agent's response to extract thinking and answer."""
    raw = raw_text.strip()
    
    # Extract THINKING
    thinking = ""
    thinking_match = re.search(
        r"THINKING:\s*(.*?)(?=\nANSWER:|\Z)",
        raw,
        re.DOTALL | re.IGNORECASE,
    )
    if thinking_match:
        thinking = thinking_match.group(1).strip()
    
    # Extract ANSWER
    answer = ""
    answer_match = re.search(
        r"ANSWER:\s*([A-Da-d])",
        raw,
        re.IGNORECASE,
    )
    if answer_match:
        answer = answer_match.group(1).upper()
    else:
        # Fallback: look for standalone A/B/C/D at end
        fallback = re.search(r"\b([A-D])\s*\.?\s*$", raw)
        if fallback:
            answer = fallback.group(1).upper()
        else:
            answer = "A"  # ultimate fallback
    
    return AgentResponse(
        answer=answer,
        thinking=thinking,
        raw_text=raw,
    )


# ── Gemini Client ─────────────────────────────────────────────────────────────

_gemini_client = None

def _get_client():
    """Return cached Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini_client


async def create_agent_session(persona: StudentPersona) -> "AgentSession":
    """Create a new multi-turn agent session with the given persona."""
    from google.genai import types as genai_types
    
    client = _get_client()
    system_prompt = build_persona_prompt(persona)
    
    # Create chat session with persona as system instruction
    chat = await asyncio.to_thread(
        client.chats.create,
        model="gemini-3-flash-preview",
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.5,  # Moderate — allow personality + varied responses
            max_output_tokens=800,  # Vietnamese thinking needs headroom; 500 caused truncation before ANSWER line
        ),
    )
    
    return AgentSession(chat=chat, persona=persona)


@dataclass
class AgentSession:
    """Wraps a Gemini multi-turn chat with a student persona."""
    chat: object  # google.genai Chat object
    persona: StudentPersona
    step_count: int = 0
    total_cost: float = 0.0
    
    async def answer_question(
        self,
        item: dict,
        kc_name: str = "",
        force_persona_truth: bool = True,
    ) -> AgentResponse:
        """Send a question to the agent and get structured response."""
        self.step_count += 1
        
        persona_knows_kc = None
        if force_persona_truth:
            kc_id = item.get("kc_id")
            if kc_id in self.persona.true_mastery:
                persona_knows_kc = self.persona.true_mastery[kc_id]

        question_prompt = format_question(item, kc_name, persona_knows_kc)
        
        # Send to Gemini
        response = await asyncio.to_thread(
            self.chat.send_message,
            question_prompt,
        )
        
        # Track cost
        usage = getattr(response, "usage_metadata", None)
        if usage:
            input_t = getattr(usage, "prompt_token_count", 0) or 0
            output_t = getattr(usage, "candidates_token_count", 0) or 0
            self.total_cost += _record_agent_cost(self.step_count, input_t, output_t)
        
        # Parse response
        parsed = parse_agent_response(response.text)
        
        # Determine correctness
        correct_answer = get_correct_answer(item)
        parsed.correct = (parsed.answer == correct_answer)
        
        return parsed
