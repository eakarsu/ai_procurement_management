import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
import models  # noqa: F401 — ensures models are registered before create_all
import auth
from middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware
from routers import workflows, tasks, automations, ai, analytics, templates, webhooks
# Apply pass 5 — additive routes (task dependencies + approvals).
from routers import extras as extras_router

# ── Startup validation ────────────────────────────────────────────────────────
_JWT_SECRET = os.getenv("JWT_SECRET", "")
if not _JWT_SECRET or _JWT_SECRET == "change-me-in-production":
    if os.getenv("ENV", "development") == "production":
        print("FATAL: JWT_SECRET environment variable must be set in production.", file=sys.stderr)
        sys.exit(1)
    else:
        print("WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET before deploying.")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Business Process Automation Platform",
    description="AI-powered business process automation with workflow management, task tracking, and intelligent analysis.",
    version="2.0.0",
)

# Security headers (helmet-equivalent)
app.add_middleware(SecurityHeadersMiddleware)

# Request logging
app.add_middleware(RequestLoggingMiddleware)

# CORS — restrict to known origin in production
_CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_CLIENT_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(workflows.router)
app.include_router(tasks.router)
app.include_router(automations.router)
app.include_router(ai.router)
app.include_router(analytics.router)
app.include_router(templates.router)
app.include_router(webhooks.router)
app.include_router(extras_router.router)
# Batch 00 audit additive routes
from routers import process_mining, nl_workflow, streaming_anomalies, rpa_bridge, mobile_companion  # noqa: E402
app.include_router(process_mining.router)
app.include_router(nl_workflow.router)
app.include_router(streaming_anomalies.router)
app.include_router(rpa_bridge.router)
app.include_router(mobile_companion.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # Seed default workflow templates
    from database import SessionLocal
    from models import WorkflowTemplate
    db = SessionLocal()
    try:
        if db.query(WorkflowTemplate).count() == 0:
            _seed_templates(db)
    finally:
        db.close()


def _seed_templates(db):
    from models import WorkflowTemplate
    templates_data = [
        {
            "name": "Customer Onboarding",
            "description": "End-to-end customer onboarding including KYC, account setup, and welcome communication.",
            "category": "customer",
            "trigger_type": "event",
            "trigger_config": {"event": "customer.registered"},
            "steps": [
                {"name": "verify_identity", "type": "action", "description": "Run KYC verification", "config": {"service": "kyc_provider"}, "on_success": "create_account", "on_failure": "notify_compliance"},
                {"name": "create_account", "type": "action", "description": "Provision customer account", "config": {}, "on_success": "send_welcome", "on_failure": None},
                {"name": "send_welcome", "type": "notification", "description": "Send welcome email", "config": {"template": "welcome_email"}, "on_success": None, "on_failure": None},
            ],
            "tags": ["customer", "onboarding", "kyc"],
        },
        {
            "name": "Invoice Approval",
            "description": "Route invoices for approval based on amount thresholds.",
            "category": "finance",
            "trigger_type": "event",
            "trigger_config": {"event": "invoice.received"},
            "steps": [
                {"name": "check_amount", "type": "condition", "description": "Check invoice amount", "config": {"field": "amount", "operator": "gt", "value": 10000}, "on_success": "manager_approval", "on_failure": "auto_approve"},
                {"name": "manager_approval", "type": "action", "description": "Request manager approval", "config": {"notify": "manager"}, "on_success": "process_payment", "on_failure": "reject_invoice"},
                {"name": "auto_approve", "type": "action", "description": "Auto-approve small invoices", "config": {}, "on_success": "process_payment", "on_failure": None},
                {"name": "process_payment", "type": "action", "description": "Initiate payment", "config": {}, "on_success": None, "on_failure": None},
            ],
            "tags": ["finance", "invoice", "approval"],
        },
        {
            "name": "Employee Offboarding",
            "description": "Systematic employee offboarding checklist.",
            "category": "hr",
            "trigger_type": "manual",
            "trigger_config": {},
            "steps": [
                {"name": "revoke_access", "type": "action", "description": "Revoke all system access", "config": {}, "on_success": "collect_equipment", "on_failure": None},
                {"name": "collect_equipment", "type": "action", "description": "Schedule equipment return", "config": {}, "on_success": "process_payroll", "on_failure": None},
                {"name": "process_payroll", "type": "action", "description": "Process final payroll", "config": {}, "on_success": "send_exit_survey", "on_failure": None},
                {"name": "send_exit_survey", "type": "notification", "description": "Send exit survey", "config": {"template": "exit_survey"}, "on_success": None, "on_failure": None},
            ],
            "tags": ["hr", "offboarding"],
        },
    ]
    for t in templates_data:
        template = WorkflowTemplate(**t)
        db.add(template)
    db.commit()


@app.get("/health", tags=["health"])
def health():
    from database import SessionLocal
    db_ok = True
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
    except Exception:
        db_ok = False

    api_key_set = bool(os.getenv("ANTHROPIC_API_KEY"))
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "business-automation-platform",
        "database": "connected" if db_ok else "error",
        "anthropic_api_key_configured": api_key_set,
    }
# === Batch 00 Gaps & Frontend Mounts ===
from routers import gap_limited_ai_workflow_recommendation_tied
from routers import gap_conversational_workflow_builder_text_workflow
from routers import gap_ai_sla_breach_prediction
from routers import gap_ai_auto_routing_tasks_skill
from routers import gap_workflow_versioning_rollback_semantics
from routers import gap_limited_conditional_branching_dsl
from routers import gap_sla_timer_escalation_policy_primitives
from routers import gap_webhook_delivery_retry_dead_letter
from routers import gap_marketplace_shared_workflow_templates
app.include_router(gap_limited_ai_workflow_recommendation_tied.router)
app.include_router(gap_conversational_workflow_builder_text_workflow.router)
app.include_router(gap_ai_sla_breach_prediction.router)
app.include_router(gap_ai_auto_routing_tasks_skill.router)
app.include_router(gap_workflow_versioning_rollback_semantics.router)
app.include_router(gap_limited_conditional_branching_dsl.router)
app.include_router(gap_sla_timer_escalation_policy_primitives.router)
app.include_router(gap_webhook_delivery_retry_dead_letter.router)
app.include_router(gap_marketplace_shared_workflow_templates.router)
