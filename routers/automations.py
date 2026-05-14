import math
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AutomationRule, AutomationLog, User
from rate_limiter import general_limiter, get_client_ip
from schemas import (
    AutomationCreate, AutomationUpdate, AutomationOut,
    AutomationTestRequest, PaginatedAutomations,
)

router = APIRouter(prefix="/api/automations", tags=["automations"])


def _get_rule_or_404(rule_id: str, user: User, db: Session) -> AutomationRule:
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id, AutomationRule.user_id == user.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return rule


def _evaluate_conditions(conditions: list, test_data: Dict[str, Any]) -> tuple[bool, list]:
    """Evaluate all conditions against test_data. Returns (all_met, evaluation_details)."""
    conditions_met = True
    evaluation_details = []
    for cond in (conditions or []):
        field = cond.get("field")
        operator = cond.get("operator", "eq")
        expected = cond.get("value")
        actual = test_data.get(field) if test_data else None

        met = False
        if operator == "eq":
            met = actual == expected
        elif operator == "neq":
            met = actual != expected
        elif operator == "gt":
            met = actual is not None and actual > expected
        elif operator == "lt":
            met = actual is not None and actual < expected
        elif operator == "gte":
            met = actual is not None and actual >= expected
        elif operator == "lte":
            met = actual is not None and actual <= expected
        elif operator == "contains":
            met = expected in str(actual) if actual is not None else False
        elif operator == "exists":
            met = actual is not None

        evaluation_details.append({"condition": cond, "met": met, "actual_value": actual})
        if not met:
            conditions_met = False

    return conditions_met, evaluation_details


def _dispatch_actions(actions: list, context: Dict[str, Any]) -> list:
    """
    Dispatch automation actions.
    Supports: notify, webhook, create_task (simulated in this implementation).
    Returns list of action results.
    """
    results = []
    for action in (actions or []):
        action_type = action.get("type", "unknown")
        result = {"type": action_type, "status": "executed"}

        if action_type == "notify":
            channel = action.get("channel", "email")
            result["channel"] = channel
            result["message"] = action.get("message", "Automation triggered")

        elif action_type == "webhook":
            url = action.get("url", "")
            result["url"] = url
            result["note"] = "Webhook dispatch simulated (no HTTP call in dry-run)"

        elif action_type == "create_task":
            result["task_title"] = action.get("title", "Auto-generated task")
            result["note"] = "Task creation simulated"

        elif action_type == "log":
            result["log_message"] = action.get("message", "Action triggered")

        else:
            result["status"] = "skipped"
            result["reason"] = f"Unknown action type: {action_type}"

        results.append(result)
    return results


def fire_automation_event(event_name: str, event_data: Dict[str, Any], db: Session) -> list:
    """
    Called by other routers to fire automation events.
    Evaluates all active rules matching the event and dispatches actions.
    Returns list of rule IDs that fired.
    """
    rules = db.query(AutomationRule).filter(
        AutomationRule.trigger_event == event_name,
        AutomationRule.is_active.is_(True),
    ).all()

    fired_rule_ids = []
    for rule in rules:
        conditions_met, _ = _evaluate_conditions(rule.conditions or [], event_data)
        actions_executed = []
        error_message = None

        if conditions_met:
            try:
                actions_executed = _dispatch_actions(rule.actions or [], event_data)
                rule.last_triggered_at = datetime.utcnow()
                fired_rule_ids.append(rule.id)
            except Exception as e:
                error_message = str(e)

        log = AutomationLog(
            automation_rule_id=rule.id,
            trigger_event=event_name,
            trigger_data=event_data,
            conditions_met=conditions_met,
            actions_executed=actions_executed,
            error_message=error_message,
        )
        db.add(log)

    if rules:
        db.commit()

    return fired_rule_ids


@router.get("", response_model=PaginatedAutomations)
def list_automations(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    q = db.query(AutomationRule).filter(AutomationRule.user_id == current_user.id)
    if is_active is not None:
        q = q.filter(AutomationRule.is_active == is_active)
    total = q.count()
    items = q.order_by(AutomationRule.name).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedAutomations(
        items=[AutomationOut.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=AutomationOut, status_code=status.HTTP_201_CREATED)
def create_automation(
    request: Request,
    payload: AutomationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    rule = AutomationRule(user_id=current_user.id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return AutomationOut.model_validate(rule)


@router.get("/{rule_id}", response_model=AutomationOut)
def get_automation(
    request: Request,
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    return AutomationOut.model_validate(_get_rule_or_404(rule_id, current_user, db))


@router.put("/{rule_id}", response_model=AutomationOut)
def update_automation(
    request: Request,
    rule_id: str,
    payload: AutomationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    rule = _get_rule_or_404(rule_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return AutomationOut.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_automation(
    request: Request,
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    rule = _get_rule_or_404(rule_id, current_user, db)
    db.delete(rule)
    db.commit()


@router.patch("/{rule_id}/toggle", response_model=AutomationOut)
def toggle_automation(
    request: Request,
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    rule = _get_rule_or_404(rule_id, current_user, db)
    rule.is_active = not rule.is_active
    db.commit()
    db.refresh(rule)
    return AutomationOut.model_validate(rule)


@router.post("/{rule_id}/test")
def test_automation(
    request: Request,
    rule_id: str,
    payload: AutomationTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    rule = _get_rule_or_404(rule_id, current_user, db)

    conditions_met, evaluation_details = _evaluate_conditions(
        rule.conditions or [], payload.test_data or {}
    )
    actions_that_would_run = []
    if conditions_met:
        actions_that_would_run = _dispatch_actions(rule.actions or [], payload.test_data or {})

    return {
        "rule_id": rule.id,
        "rule_name": rule.name,
        "trigger_event": rule.trigger_event,
        "conditions_met": conditions_met,
        "evaluation_details": evaluation_details,
        "actions_that_would_run": actions_that_would_run,
        "dry_run": True,
    }


@router.get("/{rule_id}/logs", response_model=list)
def get_automation_logs(
    request: Request,
    rule_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    _get_rule_or_404(rule_id, current_user, db)
    logs = (
        db.query(AutomationLog)
        .filter(AutomationLog.automation_rule_id == rule_id)
        .order_by(AutomationLog.executed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [
        {
            "id": log.id,
            "trigger_event": log.trigger_event,
            "trigger_data": log.trigger_data,
            "conditions_met": log.conditions_met,
            "actions_executed": log.actions_executed,
            "executed_at": log.executed_at.isoformat(),
            "error_message": log.error_message,
        }
        for log in logs
    ]
