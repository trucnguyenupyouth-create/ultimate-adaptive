"""
Question Generation API Routes — MCQ AI Seeding with Human Review

Endpoints:
  POST /question-gen/run          — trigger batch generation job
  GET  /question-gen/status       — job stats + draft counts
  GET  /question-gen/drafts       — list drafts (filterable)
  GET  /question-gen/drafts/{id}  — single draft detail
  PATCH /question-gen/drafts/{id} — update draft (human edit)
  POST /question-gen/drafts/{id}/approve — approve → import to items
  POST /question-gen/drafts/{id}/reject  — reject draft
  POST /question-gen/drafts/bulk-approve — bulk approve for a KC
  GET  /question-gen/kcs          — list KCs with edges (for sidebar)
"""

import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import assessment_v2_review_service as v2_review
from app.services import question_gen_service as qg
from app.services.question_gen_service import get_cost_summary

router = APIRouter(prefix="/question-gen", tags=["Question Generation"])


# ── In-memory job state (single-process; fine for CMS use) ────────────────────
_current_job: Dict[str, Any] = {
    "running":   False,
    "job_id":    None,
    "progress":  0,
    "total":     0,
    "generated": 0,
    "skipped":   0,
    "errors":    0,
    "cost_usd":  0.0,
    "last_kc":   None,
    "result":    None,
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class RunJobRequest(BaseModel):
    skip_threshold: int = 6          # skip KC if already has this many active items
    rate_limit_seconds: float = 2.0  # seconds between Gemini API calls
    dry_run: bool = False            # if True, only list KCs without calling Gemini
    target_grade: int = 6           # which grade to generate for
    target_semester: int = 1        # which semester (kì) to generate for


class UpdateDraftRequest(BaseModel):
    content: Optional[Dict[str, Any]] = None
    difficulty_label: Optional[str] = None
    kst_irt_tag: Optional[str] = None


class BulkApproveRequest(BaseModel):
    kc_id: str
    draft_ids: List[str]


class FlagDraftRequest(BaseModel):
    flagged: bool
    flag_note: Optional[str] = None


class CreateDraftRequest(BaseModel):
    kc_id: str
    content: Dict[str, Any]        # {"question": str, "answers": [...]}
    difficulty_label: str          # "easy" | "medium" | "hard"
    is_diagnostic_anchor: bool = False
    kst_irt_tag: Optional[str] = None


class V2ReviewPatchRequest(BaseModel):
    review_decision: Optional[str] = None  # needs_review | accepted | rejected | revise
    flagged_for_review: Optional[bool] = None
    review_comment: Optional[str] = None
    note: Optional[str] = None


# ── Background Job Runner ─────────────────────────────────────────────────────

async def _run_job_background(
    skip_threshold: int,
    rate_limit_seconds: float,
    target_grade: int = 6,
    target_semester: int = 1,
):
    """Background task: runs generation, updates _current_job state."""
    from app.core.database import AsyncSessionLocal

    _current_job["running"] = True
    _current_job["generated"] = 0
    _current_job["skipped"] = 0
    _current_job["errors"] = 0
    _current_job["progress"] = 0
    _current_job["result"] = None

    async def progress_cb(kc_code: str, result: dict):
        _current_job["last_kc"] = kc_code
        _current_job["progress"] += 1
        if result["status"] == "generated":
            _current_job["generated"] += 1
            _current_job["cost_usd"] = round(
                _current_job["cost_usd"] + result.get("cost_usd", 0.0), 6
            )
        elif result["status"] == "skipped":
            _current_job["skipped"] += 1
        else:
            _current_job["errors"] += 1

    try:
        async with AsyncSessionLocal() as db:
            # Pre-populate total using the same filter logic as the service
            all_kcs = await qg.get_kcs_with_edges(db)
            kcs = [
                kc for kc in all_kcs
                if kc.get("grade") == target_grade
                and qg.chapter_info_matches_semester(
                    kc.get("chapter_info"), target_semester, target_grade
                )
            ]
            _current_job["total"] = len(kcs)

            result = await qg.run_generation_job(
                db=db,
                skip_threshold=skip_threshold,
                rate_limit_seconds=rate_limit_seconds,
                progress_callback=progress_cb,
                target_grade=target_grade,
                target_semester=target_semester,
            )
            _current_job["job_id"] = result["job_id"]
            _current_job["result"] = result
    except Exception as e:
        _current_job["result"] = {"error": str(e)}
    finally:
        _current_job["running"] = False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/run", summary="Trigger batch MCQ generation job")
async def run_generation(
    body: RunJobRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a background job to generate 6 MCQ questions for every KC with edges.
    Only one job can run at a time.
    """
    if _current_job["running"]:
        raise HTTPException(
            status_code=409,
            detail="A generation job is already running. Check /question-gen/status.",
        )

    if body.dry_run:
        # Dry run: just count KCs, don't call Gemini
        all_kcs = await qg.get_kcs_with_edges(db)
        kcs = [
            kc for kc in all_kcs
            if kc.get("grade") == body.target_grade
            and qg.chapter_info_matches_semester(
                kc.get("chapter_info"), body.target_semester, body.target_grade
            )
        ]
        return {
            "dry_run": True,
            "target_grade": body.target_grade,
            "target_semester": body.target_semester,
            "kcs_to_process": len(kcs),
            "kcs": [{"id": k["id"], "code": k["code"], "name": k["name"], "chapter_info": k["chapter_info"]} for k in kcs],
        }

    # Reset state and launch background job
    _current_job.update({
        "running":   True,
        "job_id":    None,
        "progress":  0,
        "total":     0,
        "generated": 0,
        "skipped":   0,
        "errors":    0,
        "cost_usd":  0.0,
        "last_kc":   None,
        "result":    None,
    })

    background_tasks.add_task(
        _run_job_background,
        skip_threshold=body.skip_threshold,
        rate_limit_seconds=body.rate_limit_seconds,
        target_grade=body.target_grade,
        target_semester=body.target_semester,
    )

    return {
        "ok": True,
        "message": "Generation job started in background. Poll /question-gen/status for progress.",
    }


@router.get("/status", summary="Get current job status and draft summary stats")
async def get_status(db: AsyncSession = Depends(get_db)):
    """Returns live job progress + aggregate draft stats + cumulative cost."""
    stats = await qg.get_draft_stats(db)
    return {
        "job": {
            "running":   _current_job["running"],
            "job_id":    _current_job["job_id"],
            "progress":  _current_job["progress"],
            "total":     _current_job["total"],
            "generated": _current_job["generated"],
            "skipped":   _current_job["skipped"],
            "errors":    _current_job["errors"],
            "cost_usd":  _current_job["cost_usd"],
            "last_kc":   _current_job["last_kc"],
        },
        "drafts": stats,
        "cost":   get_cost_summary(),
    }


@router.get("/cost", summary="OpenAI token usage and cumulative cost ($USD)")
async def get_cost():
    """
    Returns per-call token counts and cumulative USD spend for this server session.
    Resets to zero on server restart (in-memory ledger).
    """
    return get_cost_summary()


@router.get("/v2-review/items", summary="List Assessment V2 open diagnostic review items")
async def list_v2_review_items():
    """
    Return file-backed Assessment V2 review items plus persisted academic review state.

    This is separate from ItemDraft approval: accepting/rejecting here does not
    import anything into the production item bank.
    """
    return v2_review.list_review_items()


@router.patch("/v2-review/items/{review_id}", summary="Update Assessment V2 item review state")
async def update_v2_review_item(review_id: str, body: V2ReviewPatchRequest):
    """
    Persist academic review state for one V2 item.

    Supported actions:
      - accept/reject/revise via review_decision
      - flag/unflag via flagged_for_review
      - add/update reviewer comment
    """
    try:
        return v2_review.update_review_item(review_id, body.model_dump(exclude_unset=True))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/kcs", summary="List KCs with edges (candidates for generation)")
async def list_kcs_with_edges(db: AsyncSession = Depends(get_db)):
    """Returns all KC nodes that have at least one prerequisite edge."""
    kcs = await qg.get_kcs_with_edges(db)
    return {"kcs": kcs, "total": len(kcs)}


@router.get("/sgk/{chapter_info}", summary="Get SGK textbook content for a chapter section")
async def get_sgk_content(
    chapter_info: str,
    grade: int = 6,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the raw SGK markdown text for the given chapter_info (e.g. B8K1, B23K2).
    Pass ?grade=7 for Grade 7 content. Defaults to Grade 6.
    Used by the review UI to show textbook context alongside MCQ drafts.
    """
    sgk_by_tap = qg._load_sgk_for_grade(grade)
    section = qg.extract_sgk_section(chapter_info, sgk_by_tap, grade=grade)

    # If not found in requested grade, try the other grade as fallback
    if not section or section.startswith("["):
        other_grade = 7 if grade == 6 else 6
        sgk_other = qg._load_sgk_for_grade(other_grade)
        fallback = qg.extract_sgk_section(chapter_info, sgk_other, grade=other_grade)
        if fallback and not fallback.startswith("["):
            section = fallback
            grade = other_grade  # report which grade actually served content

    return {
        "chapter_info": chapter_info,
        "grade_served": grade,
        "content": section,
        "found": bool(section and not section.startswith("[")),
    }


@router.get("/drafts", summary="List question drafts")
async def list_drafts(
    kc_id: Optional[str] = Query(None, description="Filter by KC UUID"),
    status: Optional[str] = Query(None, description="Filter by status: pending|approved|rejected|edited_approved"),
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    drafts = await qg.get_drafts(db, kc_id=kc_id, status=status, limit=limit, offset=offset)
    return {"drafts": drafts, "count": len(drafts)}


@router.get("/drafts/{draft_id}", summary="Get a single draft")
async def get_draft(draft_id: str, db: AsyncSession = Depends(get_db)):
    draft = await qg.get_draft(db, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")
    return draft

@router.post("/drafts", status_code=status.HTTP_201_CREATED, summary="Create a manual draft (human-authored)")
async def create_draft(
    body: CreateDraftRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Insert a manually written MCQ directly into the item_drafts queue with
    status='pending'. Appears in the review list alongside AI-generated drafts.
    """
    draft = await qg.create_draft(
        db,
        kc_id=body.kc_id,
        content=body.content,
        difficulty_label=body.difficulty_label,
        is_diagnostic_anchor=body.is_diagnostic_anchor,
        kst_irt_tag=body.kst_irt_tag,
    )
    if not draft:
        raise HTTPException(status_code=404, detail=f"KC {body.kc_id} not found")
    return draft



@router.patch("/drafts/{draft_id}", summary="Update draft content (human edit)")
async def update_draft(
    draft_id: str,
    body: UpdateDraftRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Update draft fields. The reviewer can:
    - Edit the question text / answer choices via `content`
    - Change the difficulty label
    - Annotate the KST/IRT tag
    Status is NOT changed here — use /approve or /reject for that.
    """
    draft = await qg.update_draft(
        db,
        draft_id=draft_id,
        content=body.content,
        difficulty_label=body.difficulty_label,
        kst_irt_tag=body.kst_irt_tag,
    )
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")
    return draft


@router.post(
    "/drafts/{draft_id}/approve",
    status_code=status.HTTP_201_CREATED,
    summary="Approve draft → import to items table",
)
async def approve_draft(draft_id: str, db: AsyncSession = Depends(get_db)):
    """
    Approves the draft:
    1. Creates an Item record from the draft content
    2. Sets is_diagnostic_anchor if applicable
    3. Marks draft as approved with imported_item_id
    """
    try:
        return await qg.approve_draft(db, draft_id)
    except ValueError as e:
        msg = str(e)
        # Already approved/rejected — return 409 so frontend can handle gracefully
        code = 409 if "already" in msg else 422
        raise HTTPException(status_code=code, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/drafts/{draft_id}/reject", summary="Reject a draft")
async def reject_draft(draft_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await qg.reject_draft(db, draft_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/drafts/{draft_id}/revert", summary="Undo approve/reject → revert draft to pending")
async def revert_draft(draft_id: str, db: AsyncSession = Depends(get_db)):
    """
    Revert a draft back to 'pending':
    - Approved draft: deletes the linked Item from items table, clears imported_item_id
    - Rejected draft: just resets status to pending
    """
    try:
        return await qg.revert_draft(db, draft_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/drafts/bulk-approve", summary="Bulk approve all selected drafts")
async def bulk_approve(
    body: BulkApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Approve multiple drafts for a KC in sequence.
    Returns per-draft results (some may fail if already approved/rejected).
    """
    results = []
    success = 0
    failed = 0

    for draft_id in body.draft_ids:
        try:
            result = await qg.approve_draft(db, draft_id)
            results.append({"draft_id": draft_id, "ok": True, "item_id": result["item_id"]})
            success += 1
        except Exception as e:
            results.append({"draft_id": draft_id, "ok": False, "error": str(e)})
            failed += 1

    return {
        "ok": True,
        "success": success,
        "failed": failed,
        "results": results,
    }


@router.get(
    "/drafts/flagged/export",
    summary="Export all flagged drafts as a Markdown file",
    response_class=Response,
)
async def export_flagged_drafts(db: AsyncSession = Depends(get_db)):
    """
    Returns all flagged question drafts (across all KCs) as a formatted
    Markdown file, grouped by Knowledge Component with flag notes included.
    The response triggers a browser download.
    """
    md_content = await qg.export_flagged_as_markdown(db)
    from datetime import datetime, timezone
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"flagged_questions_{timestamp}.md"
    return Response(
        content=md_content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/drafts/{draft_id}/flag", summary="Flag a draft as 'considering' with optional note")
async def flag_draft(
    draft_id: str,
    body: FlagDraftRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Toggle the flagged state of a draft.
    - flagged=true  → marks as 'considering', saves optional note
    - flagged=false → clears flag and note
    """
    result = await qg.flag_draft(
        db,
        draft_id=draft_id,
        flagged=body.flagged,
        flag_note=body.flag_note,
    )
    if not result:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")
    return result
