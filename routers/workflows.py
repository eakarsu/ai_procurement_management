import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, Workflow, WorkflowRun, WorkflowRunStatus, WorkflowVersion
from rate_limiter import general_limiter, get_client_ip
from schemas import (
    WorkflowCreate, WorkflowUpdate, WorkflowOut,
    WorkflowExecuteRequest, WorkflowRunOut,
    PaginatedWorkflows, PaginatedRuns,
    WorkflowVersionOut,
)
from fastapi import Request

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _get_workflow_or_404(workflow_id: str, user: User, db: Session) -> Workflow:
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id, Workflow.user_id == user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


def _save_version(wf: Workflow, user_id: str, db: Session) -> None:
    """Snapshot current steps to workflow_versions table."""
    last_version = (
        db.query(func.max(WorkflowVersion.version_number))
        .filter(WorkflowVersion.workflow_id == wf.id)
        .scalar()
    ) or 0
    version = WorkflowVersion(
        workflow_id=wf.id,
        version_number=last_version + 1,
        steps_snapshot=wf.steps or [],
        changed_by=user_id,
    )
    db.add(version)


def _execute_steps(steps: list, input_data: dict) -> tuple[dict, Optional[str]]:
    """
    Execute workflow steps with branching logic.
    Returns (output_data, error_message).
    Supports step types: action, condition, delay, notification, integration.
    """
    output = {}
    context = dict(input_data)  # mutable execution context

    if not steps:
        return {"message": "No steps to execute"}, None

    # Build step lookup by name
    step_map = {s.get("name"): s for s in steps if s.get("name")}
    current_step = steps[0] if steps else None
    visited = set()

    while current_step is not None:
        step_name = current_step.get("name", "unnamed")
        step_type = current_step.get("type", "action")
        config = current_step.get("config", {})

        if step_name in visited:
            output[step_name] = {"status": "skipped", "reason": "cycle detected"}
            break
        visited.add(step_name)

        try:
            result, next_step_name = _run_step(step_type, step_name, config, context)
            output[step_name] = {"status": "completed", "type": step_type, "result": result}
            context.update(result if isinstance(result, dict) else {})

            # Determine next step
            if next_step_name is None:
                # Use on_success from step definition
                next_step_name = current_step.get("on_success")

            if next_step_name and next_step_name in step_map:
                current_step = step_map[next_step_name]
            else:
                current_step = None  # end of workflow

        except StepExecutionError as exc:
            output[step_name] = {"status": "failed", "error": str(exc)}
            on_failure = current_step.get("on_failure")
            if on_failure and on_failure in step_map:
                current_step = step_map[on_failure]
            else:
                return output, f"Step '{step_name}' failed: {exc}"

    return output, None


class StepExecutionError(Exception):
    pass


def _run_step(step_type: str, step_name: str, config: dict, context: dict):
    """Execute a single step. Returns (result_dict, next_step_name_override)."""
    if step_type == "action":
        return {"executed": True, "config_applied": config}, None

    elif step_type == "condition":
        field = config.get("field")
        operator = config.get("operator", "eq")
        value = config.get("value")
        actual = context.get(field)

        met = False
        if operator == "eq":
            met = actual == value
        elif operator == "neq":
            met = actual != value
        elif operator == "gt":
            met = actual is not None and actual > value
        elif operator == "lt":
            met = actual is not None and actual < value
        elif operator == "gte":
            met = actual is not None and actual >= value
        elif operator == "lte":
            met = actual is not None and actual <= value
        elif operator == "contains":
            met = value in str(actual) if actual is not None else False
        elif operator == "exists":
            met = actual is not None

        return {"condition_met": met, "field": field, "operator": operator}, None

    elif step_type == "delay":
        seconds = config.get("seconds", 0)
        # In a real system this would use Celery; here we log it
        return {"delay_seconds": seconds, "simulated": True}, None

    elif step_type == "notification":
        channel = config.get("channel", "email")
        template = config.get("template", "default")
        return {"channel": channel, "template": template, "sent": True}, None

    elif step_type == "integration":
        service = config.get("service", "unknown")
        operation = config.get("operation", "call")
        return {"service": service, "operation": operation, "simulated": True}, None

    else:
        return {"type": step_type, "executed": True}, None


@router.get("", response_model=PaginatedWorkflows)
def list_workflows(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Filter by name (case-insensitive)"),
    status: Optional[str] = Query(None, description="Filter by status: draft|active|paused"),
    trigger_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))

    q = db.query(Workflow).filter(Workflow.user_id == current_user.id)
    if search:
        q = q.filter(Workflow.name.ilike(f"%{search}%"))
    if status:
        q = q.filter(Workflow.status == status)
    if trigger_type:
        q = q.filter(Workflow.trigger_type == trigger_type)

    total = q.count()
    items = q.order_by(Workflow.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedWorkflows(
        items=[WorkflowOut.model_validate(w) for w in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def create_workflow(
    request: Request,
    payload: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    wf = Workflow(user_id=current_user.id, **payload.model_dump())
    db.add(wf)
    db.flush()  # get ID before versioning
    _save_version(wf, current_user.id, db)
    db.commit()
    db.refresh(wf)
    return WorkflowOut.model_validate(wf)


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    return WorkflowOut.model_validate(_get_workflow_or_404(workflow_id, current_user, db))


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(
    request: Request,
    workflow_id: str,
    payload: WorkflowUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    wf = _get_workflow_or_404(workflow_id, current_user, db)
    updates = payload.model_dump(exclude_unset=True)
    steps_changed = "steps" in updates

    for field, value in updates.items():
        setattr(wf, field, value)
    wf.updated_at = datetime.utcnow()

    if steps_changed:
        _save_version(wf, current_user.id, db)

    db.commit()
    db.refresh(wf)
    return WorkflowOut.model_validate(wf)


@router.patch("/{workflow_id}/status", response_model=WorkflowOut)
def set_workflow_status(
    request: Request,
    workflow_id: str,
    new_status: str = Query(..., description="draft|active|paused"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    if new_status not in ("draft", "active", "paused"):
        raise HTTPException(status_code=422, detail="status must be draft, active, or paused")
    wf = _get_workflow_or_404(workflow_id, current_user, db)
    wf.status = new_status
    wf.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wf)
    return WorkflowOut.model_validate(wf)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    wf = _get_workflow_or_404(workflow_id, current_user, db)
    db.delete(wf)
    db.commit()


@router.post("/{workflow_id}/execute", response_model=WorkflowRunOut, status_code=status.HTTP_201_CREATED)
def execute_workflow(
    request: Request,
    workflow_id: str,
    payload: WorkflowExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    wf = _get_workflow_or_404(workflow_id, current_user, db)

    run = WorkflowRun(
        workflow_id=wf.id,
        status=WorkflowRunStatus.running,
        input_data=payload.input_data or {},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    output, error = _execute_steps(wf.steps or [], payload.input_data or {})
    run.output_data = output
    run.completed_at = datetime.utcnow()

    if error:
        run.status = WorkflowRunStatus.failed
        run.error_message = error
    else:
        run.status = WorkflowRunStatus.completed

    db.commit()
    db.refresh(run)
    return WorkflowRunOut.model_validate(run)


@router.get("/{workflow_id}/runs", response_model=PaginatedRuns)
def list_runs(
    request: Request,
    workflow_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    _get_workflow_or_404(workflow_id, current_user, db)
    q = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == workflow_id)
    total = q.count()
    runs = q.order_by(WorkflowRun.started_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedRuns(
        items=[WorkflowRunOut.model_validate(r) for r in runs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{workflow_id}/runs/{run_id}", response_model=WorkflowRunOut)
def get_run(
    request: Request,
    workflow_id: str,
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    _get_workflow_or_404(workflow_id, current_user, db)
    run = db.query(WorkflowRun).filter(
        WorkflowRun.id == run_id,
        WorkflowRun.workflow_id == workflow_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return WorkflowRunOut.model_validate(run)


@router.post("/{workflow_id}/runs/{run_id}/retry", response_model=WorkflowRunOut, status_code=status.HTTP_201_CREATED)
def retry_run(
    request: Request,
    workflow_id: str,
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-execute a failed workflow run with its original input data."""
    general_limiter.check(get_client_ip(request))
    wf = _get_workflow_or_404(workflow_id, current_user, db)
    original_run = db.query(WorkflowRun).filter(
        WorkflowRun.id == run_id,
        WorkflowRun.workflow_id == workflow_id,
    ).first()
    if not original_run:
        raise HTTPException(status_code=404, detail="Run not found")
    if original_run.status != WorkflowRunStatus.failed:
        raise HTTPException(status_code=400, detail="Only failed runs can be retried")

    new_run = WorkflowRun(
        workflow_id=wf.id,
        status=WorkflowRunStatus.running,
        input_data=original_run.input_data or {},
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)

    output, error = _execute_steps(wf.steps or [], original_run.input_data or {})
    new_run.output_data = output
    new_run.completed_at = datetime.utcnow()
    new_run.status = WorkflowRunStatus.failed if error else WorkflowRunStatus.completed
    new_run.error_message = error

    db.commit()
    db.refresh(new_run)
    return WorkflowRunOut.model_validate(new_run)


@router.get("/{workflow_id}/versions", response_model=list[WorkflowVersionOut])
def list_versions(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    _get_workflow_or_404(workflow_id, current_user, db)
    versions = (
        db.query(WorkflowVersion)
        .filter(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.version_number.desc())
        .all()
    )
    return [WorkflowVersionOut.model_validate(v) for v in versions]


@router.post("/{workflow_id}/versions/{version_number}/restore", response_model=WorkflowOut)
def restore_version(
    request: Request,
    workflow_id: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    wf = _get_workflow_or_404(workflow_id, current_user, db)
    version = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow_id,
        WorkflowVersion.version_number == version_number,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Save current as new version before restoring
    _save_version(wf, current_user.id, db)
    wf.steps = version.steps_snapshot
    wf.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wf)
    return WorkflowOut.model_validate(wf)
