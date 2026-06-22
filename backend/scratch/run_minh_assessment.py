"""
Full Assessment Simulation for Student "Minh" — Agent Mode
Exports complete step-by-step log with thinking
"""
import asyncio, sys, json
from datetime import datetime
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal
from app.models.models import Item, KnowledgeComponent
from app.engines.knowledge_graph import KnowledgeGraph
from app.services.graph_service import get_graph
from app.engines.agent_student import StudentPersona, create_agent_session, get_correct_answer, format_question
from app.engines.assessment import CATController

# ── Persona: Minh ─────────────────────────────────────────────────────────────
MINH_PERSONA = StudentPersona(
    name="Minh",
    true_theta=0.3,
    true_mastery={},  # sẽ build từ danh sách KC thật
    ability_description="Học sinh trung bình khá lớp 6 — có nền tảng cơ bản nhưng hổng một số chủ đề",
    knowledge_detail="""Em BIẾT và làm được:
- Tập hợp: liệt kê, đếm phần tử, ký hiệu thuộc/không thuộc
- Số tự nhiên: đọc viết, so sánh, thứ tự
- Phép cộng trừ nhân chia số tự nhiên cơ bản
- Số nguyên: nhận biết số nguyên âm/dương, so sánh, cộng trừ (biết quy tắc dấu)
- Bảng chia hết cơ bản (chia hết cho 2, 5)
- Tia số, điểm, đoạn thẳng

Em KHÔNG BIẾT hoặc rất mơ hồ:
- Lũy thừa: em nghĩ 2³ = 2×3 = 6 (nhầm thành phép nhân)
- Phân tích thừa số nguyên tố (chưa học kỹ)
- UCLN, BCNN: em hay lẫn hai khái niệm này
- Phân số: chưa vững, hay nhầm quy tắc cộng khác mẫu
- Hình học nâng cao: hình thoi, bình hành (chưa học)
- Thống kê: biểu đồ cột chưa biết vẽ""",
    carefulness="trung bình — đọc đề cẩn thận nhưng đôi khi bất cẩn bấm nhầm",
    when_unsure="đoán đại, thường chọn đáp án trông quen nhất hoặc số nhỏ nhất",
    speed="nhanh vừa phải — không nghĩ quá lâu",
    common_mistakes="nhầm lũy thừa thành nhân, lẫn UCLN/BCNN, hay nhầm dấu khi cộng số nguyên âm",
    p_slip=0.08,
    p_guess=0.25,
)

# KC codes mà Minh BIẾT (match với graph thật)
MINH_KNOWS_CODES = {
    "G6-MATH-NHAN-BIET-TAP",   # nhận biết tập hợp
    "G6-MATH-BIEU-DIEN-TAP",   # biểu diễn tập hợp
    "G6-MATH-SO-TU-NHIEN",     # số tự nhiên
    "G6-MATH-SO-SANH-SO",      # so sánh số tự nhiên
    "G6-MATH-CONG-SO-TU",      # cộng số tự nhiên
    "G6-MATH-TRU-SO-TU",       # trừ số tự nhiên
    "G6-MATH-NHAN-SO-TU",      # nhân số tự nhiên
    "G6-MATH-CHIA-SO-TU",      # chia số tự nhiên
    "G6-MATH-SO-NGUYEN",       # nhận biết số nguyên
    "G6-MATH-SO-SANH-HAI",     # so sánh số nguyên
    "G6-MATH-CONG-HAI-SO",     # cộng hai số nguyên
    "G6-MATH-TRU-HAI-SO",      # trừ số nguyên
    "G6-MATH-TIA",              # tia số
    "G6-MATH-DOAN-THANG",      # đoạn thẳng
}

async def load_data():
    async with AsyncSessionLocal() as db:
        # Load graph
        kg = await get_graph(db)
        
        # Load items
        result = await db.execute(select(Item).where(Item.is_active == True))
        items = result.scalars().all()
        available = {}
        for item in items:
            kc_str = str(item.kc_id)
            available.setdefault(kc_str, []).append({
                "id": str(item.id),
                "kc_id": kc_str,
                "content": item.content,
                "irt_a": float(item.irt_a or 1.0),
                "irt_b": float(item.irt_b or 0.0),
                "irt_c": float(item.irt_c or 0.25),
                "is_diagnostic_anchor": bool(item.is_diagnostic_anchor),
            })
        
        # Load KC names + codes
        kc_result = await db.execute(select(KnowledgeComponent))
        kcs = kc_result.scalars().all()
        kc_names = {str(kc.id): kc.name for kc in kcs}
        kc_codes = {str(kc.id): kc.code for kc in kcs}
        kc_by_code = {kc.code: str(kc.id) for kc in kcs}
        
        return kg, available, kc_names, kc_codes, kc_by_code

async def main():
    print("Loading data from database...")
    kg, available, kc_names, kc_codes, kc_by_code = await load_data()
    
    # Build true_mastery from MINH_KNOWS_CODES
    true_mastery = {}
    all_kc_ids = list(kc_names.keys())
    for kc_id in all_kc_ids:
        code = kc_codes.get(kc_id, "")
        true_mastery[kc_id] = code in MINH_KNOWS_CODES
    
    MINH_PERSONA.true_mastery = true_mastery
    
    knows_count = sum(1 for v in true_mastery.values() if v)
    print(f"Loaded {len(all_kc_ids)} KCs. Minh knows {knows_count} of them.")
    print(f"Available items: {sum(len(v) for v in available.values())} across {len(available)} KCs")
    
    # Create agent session
    print("\nCreating Gemini agent session...")
    agent = await create_agent_session(MINH_PERSONA)
    print("✅ Agent session created\n")
    
    # Run CATController
    cat = CATController(kg, use_irt=True)
    result = cat.start(
        student_id="minh_test",
        known_kcs=set(),
        theta=0.0,
        available_items=available,
    )
    
    if result["status"] == "no_kcs_available":
        print("❌ No KCs available for assessment")
        return
    
    steps = []
    item_count = 0
    MAX_ITEMS = 50
    
    print("=" * 70)
    print("BẮT ĐẦU ASSESSMENT — MINH LỚP 6")
    print("=" * 70)
    
    while result["status"] != "done" and item_count < MAX_ITEMS:
        item = result.get("item")
        if item is None:
            break
        
        session = result["session"]
        kc_id = session["kc"]
        kc_name = kc_names.get(kc_id, kc_id)
        kc_code = kc_codes.get(kc_id, "")
        persona_knows = MINH_PERSONA.true_mastery.get(kc_id, False)
        
        item_count += 1
        print(f"\n{'─'*70}")
        print(f"📝 Câu {item_count:02d} | KC: {kc_name}")
        print(f"   Code: {kc_code} | Difficulty: b={item.get('irt_b', 0.0):.2f} | Minh biết: {'✅' if persona_knows else '❌'}")
        
        # Format question for display
        content = item.get("content", {})
        if isinstance(content, str):
            import json as _json
            try: content = _json.loads(content)
            except: content = {}
        q_text = content.get("question", "")
        answers = content.get("answers", [])
        print(f"\n   Q: {q_text}")
        for ans in answers:
            marker = "✓" if ans.get("is_correct") else " "
            print(f"   {marker} {ans.get('label','?')}. {ans.get('text','')}")
        
        # Agent answers
        agent_resp = await agent.answer_question(item, kc_name)
        correct_ans = get_correct_answer(item)
        
        print(f"\n   💭 THINKING: {agent_resp.thinking}")
        print(f"   📌 ANSWER: {agent_resp.answer} | Correct: {correct_ans} | {'✅ RIGHT' if agent_resp.correct else '❌ WRONG'}")
        print(f"   θ hiện tại: {session.get('theta', 0.0):.3f} | Streak ✅: {session.get('streak_correct',0)} | Streak ❌: {session.get('streak_wrong',0)}")
        
        item_count_real = item_count
        steps.append({
            "step": item_count_real,
            "kc_id": kc_id,
            "kc_name": kc_name,
            "kc_code": kc_code,
            "question": q_text,
            "correct_answer": correct_ans,
            "agent_answer": agent_resp.answer,
            "correct": agent_resp.correct,
            "thinking": agent_resp.thinking,
            "persona_knows_kc": persona_knows,
            "irt_b": item.get("irt_b", 0.0),
            "theta_before": session.get("theta", 0.0),
            "streak_correct": session.get("streak_correct", 0),
            "streak_wrong": session.get("streak_wrong", 0),
        })
        
        result = cat.respond(result["session"], item, agent_resp.correct, available)
    
    # Final results
    session = result.get("session", {})
    assessed = session.get("kc_results", {})
    final_theta = session.get("theta", 0.0)
    
    print(f"\n{'='*70}")
    print("KẾT QUẢ ASSESSMENT")
    print(f"{'='*70}")
    print(f"Total items: {item_count}")
    print(f"Final θ (IRT ability): {final_theta:.3f}")
    print(f"KCs visited: {len(assessed)}")
    
    passed = [k for k, v in assessed.items() if v == "pass"]
    failed = [k for k, v in assessed.items() if v != "pass"]
    
    print(f"\nPASSED ({len(passed)} KCs):")
    for kc_id in passed:
        name = kc_names.get(kc_id, kc_id)
        print(f"  ✅ {name}")
    
    print(f"\nFAILED/GAP ({len(failed)} KCs):")
    for kc_id in failed:
        name = kc_names.get(kc_id, kc_id)
        status = assessed[kc_id]
        print(f"  ❌ {name} [{status}]")
    
    # Diagnostic comparison
    print(f"\n{'='*70}")
    print("SO SÁNH: GROUND TRUTH vs ASSESSMENT")
    print(f"{'='*70}")
    
    tp = tn = fp = fn = not_tested = 0
    comparisons = []
    
    for kc_id in all_kc_ids:
        if kc_id not in true_mastery:
            continue
        true_knows = true_mastery[kc_id]
        assessed_status = assessed.get(kc_id)
        
        if assessed_status is None:
            not_tested += 1
            if true_knows:
                tn += 1
                category = "TN-inferred"
            else:
                fn += 1
                category = "FN ⚠️ MISS"
        elif assessed_status == "pass":
            if true_knows:
                tn += 1
                category = "TN ✓"
            else:
                fn += 1
                category = "FN ⚠️ MISS"
        else:
            if true_knows:
                fp += 1
                category = "FP"
            else:
                tp += 1
                category = "TP ✓"
        
        if assessed_status is not None or not true_knows:
            comparisons.append({
                "kc": kc_names.get(kc_id, kc_id),
                "truth": "biết" if true_knows else "gap",
                "assessed": assessed_status or "not_tested",
                "cat": category,
            })
    
    gap_prec = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    gap_rec  = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    f1 = 2 * gap_prec * gap_rec / (gap_prec + gap_rec) if (gap_prec + gap_rec) > 0 else 0.0
    
    print(f"\nConfusion Matrix:")
    print(f"  True Positive  (gap found correctly):  {tp}")
    print(f"  True Negative  (mastered, passed):      {tn}")
    print(f"  False Positive (mastered, but failed):  {fp}")
    print(f"  False Negative (gap MISSED):             {fn} ⚠️")
    print(f"  Not tested (KST inferred):              {not_tested}")
    
    print(f"\nMetrics:")
    print(f"  Gap Precision:  {gap_prec:.1%}")
    print(f"  Gap Recall:     {gap_rec:.1%}  ← tìm được bao nhiêu % lỗ hổng")
    print(f"  F1 Score:       {f1:.1%}")
    print(f"  Theta Error:    {abs(final_theta - MINH_PERSONA.true_theta):.3f}  (true={MINH_PERSONA.true_theta})")
    
    print(f"\nAgent cost: ${agent.total_cost:.6f} | {agent.step_count} API calls")
    
    # Export to JSON
    export = {
        "persona": {
            "name": "Minh",
            "true_theta": MINH_PERSONA.true_theta,
            "knows_kc_count": knows_count,
            "total_kc_count": len(all_kc_ids),
        },
        "assessment_result": {
            "total_items": item_count,
            "final_theta": round(final_theta, 3),
            "kcs_visited": len(assessed),
            "passed": [kc_names.get(k, k) for k in passed],
            "failed": {kc_names.get(k, k): v for k, v in assessed.items() if v != "pass"},
        },
        "diagnostic": {
            "true_positive": tp,
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "not_tested": not_tested,
            "gap_precision": round(gap_prec, 4),
            "gap_recall": round(gap_rec, 4),
            "f1_score": round(f1, 4),
            "theta_error": round(abs(final_theta - MINH_PERSONA.true_theta), 3),
        },
        "cost": {
            "total_usd": round(agent.total_cost, 6),
            "api_calls": agent.step_count,
        },
        "steps": steps,
    }
    
    out_path = "/Users/admin/ultimate-adaptive/docs/minh_assessment_result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Full result exported to: {out_path}")

asyncio.run(main())
