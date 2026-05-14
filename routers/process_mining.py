"""Process-mining engine that learns from execution logs and recommends
optimization paths.

v0 scaffold: aggregates WorkflowRun records and surfaces top bottlenecks +
LLM-driven recommendations. Real implementation would use PM4Py or similar.
"""
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, Workflow, WorkflowRun

router = APIRouter(prefix="/api/process-mining", tags=["process-mining"])


@router.get("/bottlenecks")
def bottlenecks(workflow_id: Optional[str] = None,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    q = db.query(WorkflowRun)
    if workflow_id:
        q = q.filter(WorkflowRun.workflow_id == workflow_id)
    runs = q.limit(2000).all()

    durations: list[float] = []
    step_counts = Counter()
    for r in runs:
        try:
            if r.started_at and r.completed_at:
                durations.append((r.completed_at - r.started_at).total_seconds())
        except Exception:
            pass
        if getattr(r, "current_step", None):
            step_counts[r.current_step] += 1

    durations.sort()
    p50 = durations[len(durations) // 2] if durations else None
    p95 = durations[int(len(durations) * 0.95)] if durations else None

    return {
        "runs_analyzed": len(runs),
        "duration_p50_sec": p50,
        "duration_p95_sec": p95,
        "top_stuck_steps": step_counts.most_common(10),
        "recommendation": "Inspect p95 steps for queue saturation or upstream blockers.",
        # TODO: invoke LLM (see routers/ai.py) for richer narrative recommendations
    }


@router.get("/path-frequency")
def path_frequency(workflow_id: str,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="workflow not found")
    runs = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == workflow_id).limit(1000).all()
    paths: Counter = Counter()
    for r in runs:
        steps = getattr(r, "step_path", None) or []
        if isinstance(steps, list):
            paths[tuple(steps)] += 1
    return {
        "workflow_id": workflow_id,
        "total_runs": len(runs),
        "top_paths": [{"path": list(k), "count": v} for k, v in paths.most_common(10)],
    }
