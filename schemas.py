from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Workflow ───────────────────────────────────────────────────────────────────

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = {}
    steps: Optional[List[Dict[str, Any]]] = []

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 200:
            raise ValueError("Name must be 200 characters or fewer")
        return v

    @field_validator("trigger_type")
    @classmethod
    def valid_trigger_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("manual", "scheduled", "event"):
            raise ValueError("trigger_type must be one of: manual, scheduled, event")
        return v


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    steps: Optional[List[Dict[str, Any]]] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("draft", "active", "paused"):
            raise ValueError("status must be one of: draft, active, paused")
        return v


class WorkflowOut(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    status: str
    trigger_type: Optional[str]
    trigger_config: Optional[Dict[str, Any]]
    steps: Optional[List[Dict[str, Any]]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowExecuteRequest(BaseModel):
    input_data: Optional[Dict[str, Any]] = {}


class WorkflowRunOut(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    input_data: Optional[Dict[str, Any]]
    output_data: Optional[Dict[str, Any]]
    error_message: Optional[str]

    model_config = {"from_attributes": True}


class PaginatedWorkflows(BaseModel):
    items: List[WorkflowOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedRuns(BaseModel):
    items: List[WorkflowRunOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Workflow Version ───────────────────────────────────────────────────────────

class WorkflowVersionOut(BaseModel):
    id: str
    workflow_id: str
    version_number: int
    steps_snapshot: Optional[List[Dict[str, Any]]]
    changed_by: Optional[str]
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Workflow Template ──────────────────────────────────────────────────────────

class WorkflowTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: str
    trigger_type: Optional[str]
    trigger_config: Optional[Dict[str, Any]]
    steps: Optional[List[Dict[str, Any]]]
    tags: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    workflow_run_id: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 500:
            raise ValueError("Title must be 500 characters or fewer")
        return v

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "in_progress", "completed", "failed"):
            raise ValueError("status must be one of: pending, in_progress, completed, failed")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("low", "medium", "high", "critical"):
            raise ValueError("priority must be one of: low, medium, high, critical")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "in_progress", "completed", "failed"):
            raise ValueError("status must be one of: pending, in_progress, completed, failed")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("low", "medium", "high", "critical"):
            raise ValueError("priority must be one of: low, medium, high, critical")
        return v


class TaskOut(BaseModel):
    id: str
    user_id: str
    workflow_run_id: Optional[str]
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    assigned_to: Optional[str]

    model_config = {"from_attributes": True}


class PaginatedTasks(BaseModel):
    items: List[TaskOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkTaskUpdate(BaseModel):
    task_ids: List[str]
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None

    @field_validator("task_ids")
    @classmethod
    def ids_not_empty(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("task_ids cannot be empty")
        if len(v) > 100:
            raise ValueError("Cannot bulk update more than 100 tasks at once")
        return v


# ── Automation ────────────────────────────────────────────────────────────────

class AutomationCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: Optional[List[Dict[str, Any]]] = []
    actions: Optional[List[Dict[str, Any]]] = []
    is_active: Optional[bool] = True

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("trigger_event")
    @classmethod
    def trigger_event_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("trigger_event cannot be empty")
        return v


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger_event: Optional[str] = None
    conditions: Optional[List[Dict[str, Any]]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None


class AutomationOut(BaseModel):
    id: str
    user_id: str
    name: str
    trigger_event: str
    conditions: Optional[List[Dict[str, Any]]]
    actions: Optional[List[Dict[str, Any]]]
    is_active: bool
    last_triggered_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PaginatedAutomations(BaseModel):
    items: List[AutomationOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AutomationTestRequest(BaseModel):
    test_data: Optional[Dict[str, Any]] = {}


# ── AI ────────────────────────────────────────────────────────────────────────

class AnalyzeProcessRequest(BaseModel):
    process_description: str
    goals: Optional[List[str]] = []

    @field_validator("process_description")
    @classmethod
    def description_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("process_description cannot be empty")
        if len(v) > 10000:
            raise ValueError("process_description must be 10000 characters or fewer")
        return v


class GenerateWorkflowRequest(BaseModel):
    business_goal: str
    constraints: Optional[List[str]] = []

    @field_validator("business_goal")
    @classmethod
    def goal_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("business_goal cannot be empty")
        if len(v) > 5000:
            raise ValueError("business_goal must be 5000 characters or fewer")
        return v


class PrioritizeTasksRequest(BaseModel):
    context: Optional[str] = ""


class AIAnalysisOut(BaseModel):
    id: str
    user_id: str
    analysis_type: str
    input_data: Optional[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    tokens_used: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAIAnalyses(BaseModel):
    items: List[AIAnalysisOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsOut(BaseModel):
    workflows_total: int
    workflows_active: int
    tasks_total: int
    tasks_pending: int
    tasks_completed: int
    automations_total: int
    automations_active: int
    ai_analyses_total: int
    ai_tokens_total: int
    workflow_runs_total: int
    workflow_runs_succeeded: int
    workflow_runs_failed: int
    recent_activity: List[Dict[str, Any]]


# ── Webhook ───────────────────────────────────────────────────────────────────

class WebhookEventOut(BaseModel):
    id: str
    automation_rule_id: Optional[str]
    source_ip: Optional[str]
    payload: Optional[Dict[str, Any]]
    signature_valid: bool
    processed_at: datetime
    conditions_met: bool
    actions_fired: Optional[List[Any]]

    model_config = {"from_attributes": True}
