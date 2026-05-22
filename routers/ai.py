import asyncio
import json
import os
from typing import AsyncGenerator, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AIAnalysis, Task, User, Workflow, WorkflowRun
from rate_limiter import ai_limiter, get_client_ip
from schemas import (
    AIAnalysisOut,
    AnalyzeProcessRequest,
    GenerateWorkflowRequest,
    PaginatedAIAnalyses,
    PrioritizeTasksRequest,
)

import math

router = APIRouter(prefix="/api/ai", tags=["ai"])

MODEL = os.getenv("OPENROUTER_MODEL") or os.getenv("ANTHROPIC_MODEL") or "claude-3-5-sonnet-20241022"

SYSTEM_PROMPT = (
    "You are an expert business process automation architect and analyst. "
    "You help organizations identify inefficiencies, design workflows, and optimize operations. "
    "Always respond with valid JSON when instructed to. Be precise, structured, and actionable."
)


def _get_anthropic_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    if not base_url and os.getenv("OPENROUTER_API_KEY"):
        base_url = "https://openrouter.ai/api"
    if base_url:
        return anthropic.Anthropic(api_key=api_key, base_url=base_url)
    return anthropic.Anthropic(api_key=api_key)


def _save_analysis(
    db: Session,
    user_id: str,
    analysis_type: str,
    input_data: dict,
    result: dict,
    tokens: int,
) -> AIAnalysis:
    record = AIAnalysis(
        user_id=user_id,
        analysis_type=analysis_type,
        input_data=input_data,
        result=result,
        tokens_used=tokens,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def parse_ai_json(text: str) -> dict:
    """Robustly extract JSON from Claude response."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown code fences
    stripped = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Find first { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"raw_response": text}


@router.post("/analyze-process", response_model=AIAnalysisOut)
def analyze_process(
    request: Request,
    payload: AnalyzeProcessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_limiter.check(f"user:{current_user.id}")
    client = _get_anthropic_client()

    prompt = f"""Analyze the following business process and identify inefficiencies, bottlenecks, and automation opportunities.

Process Description:
{payload.process_description}

Goals:
{json.dumps(payload.goals, indent=2)}

Respond ONLY with a JSON object (no markdown, no explanation outside JSON) containing:
{{
  "inefficiencies": ["list of identified inefficiencies"],
  "bottlenecks": ["list of bottlenecks"],
  "automation_opportunities": ["list of automation suggestions"],
  "priority_recommendations": ["top 3 recommendations ordered by impact"],
  "estimated_time_savings_percent": 0,
  "complexity_score": "low|medium|high",
  "implementation_effort": "low|medium|high",
  "roi_timeline_months": 0,
  "key_metrics_to_track": ["metric1", "metric2"]
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="analyze_process",
        input_data={"process_description": payload.process_description, "goals": payload.goals},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.post("/generate-workflow", response_model=AIAnalysisOut)
def generate_workflow(
    request: Request,
    payload: GenerateWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_limiter.check(f"user:{current_user.id}")
    client = _get_anthropic_client()

    prompt = f"""Generate a detailed workflow definition for the following business goal.

Business Goal:
{payload.business_goal}

Constraints:
{json.dumps(payload.constraints, indent=2)}

Respond ONLY with a JSON object (no markdown, no explanation outside JSON) containing:
{{
  "workflow_name": "string",
  "description": "string",
  "trigger_type": "manual|scheduled|event",
  "trigger_config": {{}},
  "steps": [
    {{
      "name": "step_name",
      "type": "action|condition|delay|notification|integration",
      "description": "what this step does",
      "config": {{}},
      "on_success": "next_step_name or null",
      "on_failure": "step_name or null"
    }}
  ],
  "estimated_duration_minutes": 0,
  "required_integrations": [],
  "success_criteria": [],
  "risks": []
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=3000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="generate_workflow",
        input_data={"business_goal": payload.business_goal, "constraints": payload.constraints},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.post("/optimize-workflow/{workflow_id}", response_model=AIAnalysisOut)
def optimize_workflow(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_limiter.check(f"user:{current_user.id}")
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id, Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(20)
        .all()
    )

    total_runs = db.query(func.count(WorkflowRun.id)).filter(WorkflowRun.workflow_id == workflow_id).scalar()
    success_count = sum(1 for r in runs if r.status == "completed")
    avg_duration = None
    durations = [
        (r.completed_at - r.started_at).total_seconds()
        for r in runs if r.completed_at and r.started_at
    ]
    if durations:
        avg_duration = sum(durations) / len(durations)

    run_summary = [
        {
            "status": r.status,
            "started_at": r.started_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "duration_seconds": (r.completed_at - r.started_at).total_seconds() if r.completed_at else None,
            "error_message": r.error_message,
        }
        for r in runs
    ]

    client = _get_anthropic_client()
    prompt = f"""Analyze the following workflow and its execution history to suggest improvements.

Workflow:
Name: {wf.name}
Description: {wf.description}
Status: {wf.status}
Trigger Type: {wf.trigger_type}
Steps: {json.dumps(wf.steps, indent=2)}

Execution Statistics:
- Total runs: {total_runs}
- Recent sample: {len(runs)} runs
- Success rate (sample): {round(success_count/len(runs)*100, 1) if runs else 0}%
- Average duration seconds: {round(avg_duration, 1) if avg_duration else "unknown"}

Recent Execution History:
{json.dumps(run_summary, indent=2)}

Respond ONLY with a JSON object (no markdown, no explanation outside JSON) containing:
{{
  "overall_assessment": "string",
  "success_rate_percent": 0,
  "performance_issues": ["issue1"],
  "step_recommendations": [
    {{"step": "step name", "issue": "description", "suggestion": "improvement"}}
  ],
  "structural_improvements": ["improvement1"],
  "estimated_improvement_percent": 0,
  "optimized_steps": [],
  "risk_factors": [],
  "priority_action": "the single most impactful change to make"
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="optimize_workflow",
        input_data={"workflow_id": workflow_id, "run_count": len(runs), "total_runs": total_runs},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.post("/prioritize-tasks", response_model=AIAnalysisOut)
def prioritize_tasks(
    request: Request,
    payload: PrioritizeTasksRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-powered task prioritization based on current backlog."""
    ai_limiter.check(f"user:{current_user.id}")

    pending_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status.in_(["pending", "in_progress"]),
        )
        .limit(50)
        .all()
    )

    if not pending_tasks:
        raise HTTPException(status_code=400, detail="No pending or in-progress tasks to prioritize")

    task_list = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "current_priority": t.priority,
            "status": t.status,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "assigned_to": t.assigned_to,
        }
        for t in pending_tasks
    ]

    client = _get_anthropic_client()
    prompt = f"""You are a productivity and project management expert. Analyze these tasks and recommend an optimized priority order.

Business Context: {payload.context or "General business operations"}

Current Tasks ({len(task_list)} tasks):
{json.dumps(task_list, indent=2)}

Today's date: {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d')}

Respond ONLY with a JSON object (no markdown, no explanation outside JSON) containing:
{{
  "prioritized_tasks": [
    {{
      "task_id": "id",
      "title": "task title",
      "recommended_priority": "critical|high|medium|low",
      "rank": 1,
      "reasoning": "why this rank",
      "urgency": "high|medium|low",
      "impact": "high|medium|low"
    }}
  ],
  "summary": "Brief summary of prioritization rationale",
  "critical_path_tasks": ["task_id1"],
  "quick_wins": ["task_id1"],
  "blockers_identified": ["description of any blocking issues noticed"]
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=3000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="prioritize_tasks",
        input_data={"task_count": len(task_list), "context": payload.context},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.get("/summarize-runs/{workflow_id}", response_model=AIAnalysisOut)
def summarize_runs(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI summary and insights from workflow run history."""
    ai_limiter.check(f"user:{current_user.id}")

    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id, Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(50)
        .all()
    )

    if not runs:
        raise HTTPException(status_code=400, detail="No runs found for this workflow")

    run_data = [
        {
            "status": r.status,
            "started_at": r.started_at.isoformat(),
            "duration_seconds": (r.completed_at - r.started_at).total_seconds() if r.completed_at else None,
            "error_message": r.error_message,
        }
        for r in runs
    ]

    client = _get_anthropic_client()
    prompt = f"""Analyze the execution history of this workflow and provide actionable insights.

Workflow: {wf.name}
Description: {wf.description}
Total runs analyzed: {len(runs)}

Run History:
{json.dumps(run_data, indent=2)}

Respond ONLY with a JSON object (no markdown, no explanation outside JSON) containing:
{{
  "summary": "Prose summary of overall workflow health",
  "success_rate_percent": 0,
  "average_duration_seconds": 0,
  "trend": "improving|stable|degrading",
  "most_common_failure_reason": "string or null",
  "peak_execution_times": ["observation about timing patterns"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "health_score": 0,
  "reliability_rating": "excellent|good|fair|poor"
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="summarize_runs",
        input_data={"workflow_id": workflow_id, "run_count": len(runs)},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.get("/history", response_model=PaginatedAIAnalyses)
def list_ai_history(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    analysis_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all past AI analyses for the current user."""
    ai_limiter.check(f"user:{current_user.id}")

    q = db.query(AIAnalysis).filter(AIAnalysis.user_id == current_user.id)
    if analysis_type:
        q = q.filter(AIAnalysis.analysis_type == analysis_type)

    total = q.count()
    items = q.order_by(AIAnalysis.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedAIAnalyses(
        items=[AIAnalysisOut.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/history/{analysis_id}", response_model=AIAnalysisOut)
def get_ai_analysis(
    request: Request,
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_limiter.check(f"user:{current_user.id}")
    record = db.query(AIAnalysis).filter(
        AIAnalysis.id == analysis_id, AIAnalysis.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return AIAnalysisOut.model_validate(record)


@router.get("/detect-anomalies/{workflow_id}", response_model=AIAnalysisOut)
def detect_anomalies(
    request: Request,
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI anomaly detection over a workflow's recent run history.

    Looks at status, durations and error patterns; flags outliers and likely
    causes. Read-only on WorkflowRun. Persists result via _save_analysis.
    """
    ai_limiter.check(f"user:{current_user.id}")

    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id, Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(100)
        .all()
    )
    if not runs:
        raise HTTPException(status_code=400, detail="No runs found for this workflow")

    run_data = [
        {
            "status": r.status,
            "started_at": r.started_at.isoformat(),
            "duration_seconds": (r.completed_at - r.started_at).total_seconds() if r.completed_at else None,
            "error_message": r.error_message,
        }
        for r in runs
    ]

    durations = [d["duration_seconds"] for d in run_data if d["duration_seconds"] is not None]
    avg_duration = sum(durations) / len(durations) if durations else None

    client = _get_anthropic_client()
    prompt = f"""Detect anomalies in this workflow's recent execution history.

Workflow: {wf.name}
Description: {wf.description}
Average duration (sample): {round(avg_duration, 1) if avg_duration else "unknown"}s
Sample size: {len(runs)}

Recent runs:
{json.dumps(run_data, indent=2)}

Respond ONLY with a JSON object (no markdown) containing:
{{
  "anomalies_detected": true,
  "summary": "high level finding",
  "anomalies": [
    {{
      "type": "duration|failure_burst|status_pattern|error_spike",
      "severity": "low|medium|high|critical",
      "description": "what was observed",
      "first_seen_at": "ISO timestamp or null",
      "evidence_count": 0,
      "likely_causes": ["cause1"],
      "recommended_actions": ["action1"]
    }}
  ],
  "baseline_metrics": {{
    "avg_duration_seconds": 0,
    "p95_duration_seconds": 0,
    "failure_rate_percent": 0
  }},
  "confidence": "low|medium|high"
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="detect_anomalies",
        input_data={"workflow_id": workflow_id, "run_count": len(runs)},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.post("/suggest-automation-rules", response_model=AIAnalysisOut)
def suggest_automation_rules(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI suggests automation rules based on the user's existing workflows
    and tasks. Read-only over Workflow / Task / AutomationRule. The output
    is a list of proposed rules; the user creates them via /api/automations.
    """
    ai_limiter.check(f"user:{current_user.id}")

    wfs = (
        db.query(Workflow)
        .filter(Workflow.user_id == current_user.id)
        .limit(30)
        .all()
    )
    tasks_sample = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.id.desc())
        .limit(50)
        .all()
    )
    existing_rules = (
        db.query(AutomationRule)
        .filter(AutomationRule.user_id == current_user.id)
        .limit(30)
        .all()
    )

    if not wfs and not tasks_sample:
        raise HTTPException(
            status_code=400,
            detail="Need at least one workflow or task to suggest automation rules",
        )

    workflow_summary = [
        {"name": w.name, "description": w.description, "trigger_type": w.trigger_type}
        for w in wfs
    ]
    task_summary = [
        {"title": t.title, "status": t.status, "priority": t.priority}
        for t in tasks_sample
    ]
    rule_summary = [
        {"name": r.name, "trigger_event": r.trigger_event, "is_active": r.is_active}
        for r in existing_rules
    ]

    client = _get_anthropic_client()
    prompt = f"""Suggest concrete automation rules for this user.

Existing workflows ({len(workflow_summary)}):
{json.dumps(workflow_summary, indent=2)}

Recent tasks ({len(task_summary)}):
{json.dumps(task_summary, indent=2)}

Existing automation rules ({len(rule_summary)}):
{json.dumps(rule_summary, indent=2)}

Respond ONLY with a JSON object (no markdown) containing:
{{
  "summary": "headline summary of opportunities",
  "suggested_rules": [
    {{
      "name": "concise rule name",
      "trigger_event": "event identifier (e.g. task.overdue, workflow.failed)",
      "conditions": [{{"field": "string", "operator": "eq|gt|lt|contains", "value": "string"}}],
      "actions": [{{"type": "notify|create_task|run_workflow|webhook", "config": {{}}}}],
      "rationale": "why this rule helps",
      "estimated_time_saved_hours_per_week": 0,
      "priority": "high|medium|low"
    }}
  ],
  "duplicates_with_existing": ["names of existing rules covered by suggestions"],
  "anti_patterns_observed": ["pattern1"]
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="suggest_automation_rules",
        input_data={
            "workflow_count": len(workflow_summary),
            "task_count": len(task_summary),
            "existing_rule_count": len(rule_summary),
        },
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


# ── Apply pass 5 — additive endpoints ────────────────────────────────────────
#
# Required env vars (gated at request time):
#   ANTHROPIC_API_KEY        — already required by every existing endpoint
#   ZAPIER_HOOK_URL          — for /rpa/zapier/dispatch (NEEDS-CREDS)
#   MAKE_HOOK_URL            — for /rpa/make/dispatch   (NEEDS-CREDS)


@router.post("/process-mining/{workflow_id}", response_model=AIAnalysisOut)
def process_mining(
    workflow_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Process mining over WorkflowRun history: discovers common paths, slow
    steps, and rework loops. Read-only — no schema changes.
    """
    ai_limiter.check(f"user:{current_user.id}")

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(200)
        .all()
    )
    if len(runs) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 runs to mine")

    run_summary = [
        {
            "id": r.id,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "duration_s": (r.completed_at - r.started_at).total_seconds() if r.completed_at else None,
            "input_keys": list((r.input_data or {}).keys()),
            "output_keys": list((r.output_data or {}).keys()),
            "had_error": bool(r.error_message),
        }
        for r in runs
    ]

    client = _get_anthropic_client()
    prompt = f"""Mine the process from these {len(run_summary)} runs of workflow "{workflow.name}".
Steps definition:
{json.dumps(workflow.steps or [], indent=2)}

Run history (most recent first):
{json.dumps(run_summary, indent=2)}

Respond ONLY with JSON:
{{
  "common_paths": [{{"path": ["step1", "step2"], "frequency_pct": 0, "avg_duration_s": 0}}],
  "slow_steps": [{{"step": "string", "avg_duration_s": 0, "p95_duration_s": 0}}],
  "rework_loops": [{{"description": "string", "frequency_pct": 0}}],
  "bottlenecks": ["string"],
  "recommendations": ["string"],
  "summary": "string"
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="process_mining",
        input_data={"workflow_id": workflow_id, "run_count": len(run_summary)},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.post("/refine-workflow", response_model=AIAnalysisOut)
async def refine_workflow(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Multi-turn natural-language workflow creator (single-call refinement).

    Body: {
      "previous_steps": [...],         # the current draft steps
      "user_message": "...",            # the next instruction
      "history": [{"role": "user|assistant", "content": "..."}]?
    }
    PRODUCT-DECISION: full multi-turn dialog state would require a Conversation
    model + WS streaming. We expose a single refinement call where the FE owns
    history; the BE remains stateless. This satisfies the "follow-up dialog"
    use case without new schema.
    """
    ai_limiter.check(f"user:{current_user.id}")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON body required")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON body required")
    user_message = body.get("user_message")
    if not user_message:
        raise HTTPException(status_code=400, detail="user_message is required")
    previous_steps = body.get("previous_steps", [])
    history = body.get("history", [])

    client = _get_anthropic_client()
    convo = []
    for turn in history[-10:]:
        if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and turn.get("content"):
            convo.append({"role": turn["role"], "content": str(turn["content"])})
    convo.append({
        "role": "user",
        "content": (
            f"Current draft steps:\n{json.dumps(previous_steps, indent=2)}\n\n"
            f"My next instruction: {user_message}\n\n"
            "Respond ONLY with JSON: "
            "{\"steps\": [...], \"explanation\": \"string\", \"open_questions\": [\"string\"]}"
        ),
    })

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            messages=convo,
        )
        content = response.content[0].text
        result = parse_ai_json(content)
        tokens = response.usage.input_tokens + response.usage.output_tokens
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic API rate limit reached. Try again later.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    record = _save_analysis(
        db,
        user_id=current_user.id,
        analysis_type="refine_workflow",
        input_data={"user_message": user_message, "history_turns": len(convo)},
        result=result,
        tokens=tokens,
    )
    return AIAnalysisOut.model_validate(record)


@router.get("/rpa/status")
def rpa_status(current_user: User = Depends(get_current_user)):
    """Report which RPA hook URLs are configured. NEEDS-CREDS gated."""
    return {
        "providers": {
            "zapier": {
                "configured": bool(os.getenv("ZAPIER_HOOK_URL")),
                "missing": [] if os.getenv("ZAPIER_HOOK_URL") else ["ZAPIER_HOOK_URL"],
            },
            "make": {
                "configured": bool(os.getenv("MAKE_HOOK_URL")),
                "missing": [] if os.getenv("MAKE_HOOK_URL") else ["MAKE_HOOK_URL"],
            },
        }
    }


@router.post("/rpa/{provider}/dispatch")
def rpa_dispatch(
    provider: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Dispatch an event to the configured RPA provider. NEEDS-CREDS gated."""
    p = provider.lower()
    env_map = {"zapier": "ZAPIER_HOOK_URL", "make": "MAKE_HOOK_URL"}
    if p not in env_map:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    env = env_map[p]
    if not os.getenv(env):
        raise HTTPException(status_code=503, detail=f"{provider} not configured: {env}")
    # Real implementation would POST to the hook URL with the body. We do
    # not make outbound calls in this build — return 501 so the gating
    # contract is testable without network egress.
    raise HTTPException(status_code=501, detail="Adapter present but outbound call not enabled in this build")


@router.get("/stream-analysis")
async def stream_analysis(
    request: Request,
    process: str = "general business process",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SSE endpoint that streams AI process analysis token by token, then persists full result."""
    ai_limiter.check(f"user:{current_user.id}")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    user_id = current_user.id  # capture before async context

    async def event_generator() -> AsyncGenerator[str, None]:
        client = anthropic.Anthropic(api_key=api_key)
        prompt = f"""Analyze the following business process and provide a JSON-structured assessment.

Process: {process}

Respond with a JSON object containing:
{{
  "current_state": "assessment of current state",
  "key_inefficiencies": ["list of inefficiencies"],
  "automation_opportunities": ["list of opportunities"],
  "implementation_roadmap": [
    {{"phase": 1, "action": "action", "timeline": "weeks"}}
  ],
  "expected_outcomes": ["outcome1"],
  "quick_wins": ["immediate action1"]
}}"""

        full_text = ""
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=2000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text_chunk in stream.text_stream:
                    full_text += text_chunk
                    yield f"data: {json.dumps({'chunk': text_chunk})}\n\n"
                    await asyncio.sleep(0)

            # Parse and persist after streaming completes
            result = parse_ai_json(full_text)
            usage = stream.get_final_message().usage
            tokens = usage.input_tokens + usage.output_tokens

            # Save to DB using a new session (async context)
            from database import SessionLocal
            save_db = SessionLocal()
            try:
                _save_analysis(
                    save_db,
                    user_id=user_id,
                    analysis_type="stream_analysis",
                    input_data={"process": process},
                    result=result,
                    tokens=tokens,
                )
            finally:
                save_db.close()

            yield f"data: {json.dumps({'done': True, 'tokens_used': tokens})}\n\n"
            yield "data: [DONE]\n\n"
        except anthropic.RateLimitError:
            yield f"data: {json.dumps({'error': 'Rate limit reached'})}\n\n"
        except anthropic.APIError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
