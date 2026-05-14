"""
Inbound webhook receiver for external automation triggers.
Validates HMAC signature from X-Webhook-Signature header.
"""
import hashlib
import hmac
import json
import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import AutomationRule, WebhookEvent
from routers.automations import fire_automation_event

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "webhook-secret-change-me")


def _verify_signature(body: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature of request body."""
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    provided = signature.lstrip("sha256=")
    return hmac.compare_digest(expected, provided)


@router.post("/inbound/{rule_id}", status_code=status.HTTP_200_OK)
async def inbound_webhook(
    rule_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receive an inbound webhook and fire the matching AutomationRule.
    Expects X-Webhook-Signature header with sha256=<hex> value.
    """
    body = await request.body()
    signature = request.headers.get("X-Webhook-Signature", "")
    source_ip = request.client.host if request.client else "unknown"

    sig_valid = _verify_signature(body, signature)

    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError:
        payload = {"raw": body.decode("utf-8", errors="replace")}

    # Look up the automation rule (no auth required — webhook uses signature)
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()

    event_log = WebhookEvent(
        automation_rule_id=rule_id if rule else None,
        source_ip=source_ip,
        payload=payload,
        signature_valid=sig_valid,
        conditions_met=False,
        actions_fired=[],
    )
    db.add(event_log)
    db.flush()

    if not sig_valid:
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if not rule:
        db.commit()
        raise HTTPException(status_code=404, detail="Automation rule not found")

    if not rule.is_active:
        db.commit()
        return {"status": "skipped", "reason": "Automation rule is inactive"}

    # Fire the automation
    fired_ids = fire_automation_event(rule.trigger_event, payload, db)
    conditions_met = rule.id in fired_ids

    event_log.conditions_met = conditions_met
    event_log.actions_fired = rule.actions if conditions_met else []
    db.commit()

    return {
        "status": "processed",
        "rule_id": rule_id,
        "conditions_met": conditions_met,
        "event_id": event_log.id,
    }


@router.get("/events", response_model=list)
def list_webhook_events(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """List recent webhook events (admin use — no user filtering for simplicity)."""
    from auth import get_current_user, bearer_scheme
    # Require auth header manually for this endpoint
    events = (
        db.query(WebhookEvent)
        .order_by(WebhookEvent.processed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [
        {
            "id": e.id,
            "automation_rule_id": e.automation_rule_id,
            "source_ip": e.source_ip,
            "signature_valid": e.signature_valid,
            "conditions_met": e.conditions_met,
            "processed_at": e.processed_at.isoformat(),
            "payload_keys": list(e.payload.keys()) if e.payload else [],
        }
        for e in events
    ]
