"""
Analytics endpoint providing aggregate statistics and recent activity.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    AIAnalysis, AutomationRule, Task, User,
    Workflow, WorkflowRun, WorkflowRunStatus,
)
from rate_limiter import general_limiter, get_client_ip
from schemas import AnalyticsOut

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut)
def get_analytics(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    uid = current_user.id

    # Workflow stats
    workflows_total = db.query(func.count(Workflow.id)).filter(Workflow.user_id == uid).scalar() or 0
    workflows_active = db.query(func.count(Workflow.id)).filter(Workflow.user_id == uid, Workflow.status == "active").scalar() or 0

    # Task stats
    tasks_total = db.query(func.count(Task.id)).filter(Task.user_id == uid).scalar() or 0
    tasks_pending = db.query(func.count(Task.id)).filter(Task.user_id == uid, Task.status == "pending").scalar() or 0
    tasks_completed = db.query(func.count(Task.id)).filter(Task.user_id == uid, Task.status == "completed").scalar() or 0

    # Automation stats
    automations_total = db.query(func.count(AutomationRule.id)).filter(AutomationRule.user_id == uid).scalar() or 0
    automations_active = db.query(func.count(AutomationRule.id)).filter(AutomationRule.user_id == uid, AutomationRule.is_active.is_(True)).scalar() or 0

    # AI stats
    ai_analyses_total = db.query(func.count(AIAnalysis.id)).filter(AIAnalysis.user_id == uid).scalar() or 0
    ai_tokens_total = db.query(func.sum(AIAnalysis.tokens_used)).filter(AIAnalysis.user_id == uid).scalar() or 0

    # Workflow run stats — join through workflows owned by user
    user_workflow_ids = [r[0] for r in db.query(Workflow.id).filter(Workflow.user_id == uid).all()]
    if user_workflow_ids:
        runs_total = db.query(func.count(WorkflowRun.id)).filter(WorkflowRun.workflow_id.in_(user_workflow_ids)).scalar() or 0
        runs_succeeded = db.query(func.count(WorkflowRun.id)).filter(
            WorkflowRun.workflow_id.in_(user_workflow_ids),
            WorkflowRun.status == WorkflowRunStatus.completed,
        ).scalar() or 0
        runs_failed = db.query(func.count(WorkflowRun.id)).filter(
            WorkflowRun.workflow_id.in_(user_workflow_ids),
            WorkflowRun.status == WorkflowRunStatus.failed,
        ).scalar() or 0
    else:
        runs_total = runs_succeeded = runs_failed = 0

    # Recent activity (last 10 events across all entity types)
    recent_activity = []

    # Recent workflow runs
    recent_runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id.in_(user_workflow_ids))
        .order_by(WorkflowRun.started_at.desc())
        .limit(5)
        .all()
    ) if user_workflow_ids else []

    for r in recent_runs:
        wf = db.query(Workflow).filter(Workflow.id == r.workflow_id).first()
        recent_activity.append({
            "type": "workflow_run",
            "entity_id": r.id,
            "description": f"Workflow '{wf.name if wf else r.workflow_id}' run {r.status}",
            "status": r.status,
            "timestamp": r.started_at.isoformat(),
        })

    # Recent AI analyses
    recent_ai = (
        db.query(AIAnalysis)
        .filter(AIAnalysis.user_id == uid)
        .order_by(AIAnalysis.created_at.desc())
        .limit(5)
        .all()
    )
    for a in recent_ai:
        recent_activity.append({
            "type": "ai_analysis",
            "entity_id": a.id,
            "description": f"AI analysis: {a.analysis_type}",
            "status": "completed",
            "timestamp": a.created_at.isoformat(),
        })

    # Sort by timestamp descending and take top 10
    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_activity = recent_activity[:10]

    return AnalyticsOut(
        workflows_total=workflows_total,
        workflows_active=workflows_active,
        tasks_total=tasks_total,
        tasks_pending=tasks_pending,
        tasks_completed=tasks_completed,
        automations_total=automations_total,
        automations_active=automations_active,
        ai_analyses_total=ai_analyses_total,
        ai_tokens_total=int(ai_tokens_total),
        workflow_runs_total=runs_total,
        workflow_runs_succeeded=runs_succeeded,
        workflow_runs_failed=runs_failed,
        recent_activity=recent_activity,
    )
