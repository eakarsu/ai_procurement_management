from datetime import date, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/workflow-sla-calendar", tags=["workflow-sla-calendar"])


class EscalationRequest(BaseModel):
    workflow_id: str
    owner: str
    due_in_hours: int
    blocked_steps: list[str] = []


@router.get("/")
def workflow_sla_calendar():
    today = date.today()
    workflows = [
        {"id": "wf-invoice-approval", "name": "Invoice Approval", "owner": "Finance Ops", "due": str(today + timedelta(days=1)), "risk": "high", "blocked_steps": 2},
        {"id": "wf-customer-onboarding", "name": "Customer Onboarding", "owner": "CX Ops", "due": str(today + timedelta(days=2)), "risk": "medium", "blocked_steps": 1},
        {"id": "wf-offboarding", "name": "Employee Offboarding", "owner": "People Ops", "due": str(today + timedelta(days=4)), "risk": "low", "blocked_steps": 0},
    ]
    return {
        "summary": {"open_slas": len(workflows), "at_risk": 2, "next_breach_hours": 18, "auto_escalations": 3},
        "workflows": workflows,
        "calendar": [
            {"date": str(today + timedelta(days=1)), "label": "Invoice approval cutoff", "severity": "high"},
            {"date": str(today + timedelta(days=2)), "label": "Customer onboarding review", "severity": "medium"},
            {"date": str(today + timedelta(days=4)), "label": "Offboarding access audit", "severity": "low"},
        ],
    }


@router.post("/escalate")
def create_escalation(req: EscalationRequest):
    priority = "urgent" if req.due_in_hours <= 24 or len(req.blocked_steps) > 1 else "standard"
    return {
        "workflow_id": req.workflow_id,
        "priority": priority,
        "owner": req.owner,
        "actions": [
            "Notify workflow owner",
            "Assign blocked steps to backup approver",
            "Schedule SLA review checkpoint",
        ],
    }
