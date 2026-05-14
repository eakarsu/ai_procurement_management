import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, Text,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship
import enum

from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"
    viewer = "viewer"


class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"


class WorkflowRunStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")
    automation_rules = relationship("AutomationRule", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    ai_analyses = relationship("AIAnalysis", back_populates="user", cascade="all, delete-orphan")
    is_active = Column(Boolean, default=True, nullable=False)


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(SAEnum(WorkflowStatus), default=WorkflowStatus.draft, nullable=False)
    trigger_type = Column(String)
    trigger_config = Column(JSON, default=dict)
    steps = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="workflows")
    runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")
    versions = relationship("WorkflowVersion", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(String, primary_key=True, default=gen_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(WorkflowRunStatus), default=WorkflowRunStatus.running, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    error_message = Column(Text)

    workflow = relationship("Workflow", back_populates="runs")


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    trigger_event = Column(String, nullable=False)
    conditions = Column(JSON, default=list)
    actions = Column(JSON, default=list)
    is_active = Column(Boolean, default=True, nullable=False)
    last_triggered_at = Column(DateTime)

    user = relationship("User", back_populates="automation_rules")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workflow_run_id = Column(String, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.pending, nullable=False)
    priority = Column(SAEnum(TaskPriority), default=TaskPriority.medium, nullable=False)
    due_date = Column(DateTime)
    assigned_to = Column(String)

    user = relationship("User", back_populates="tasks")
    workflow_run = relationship("WorkflowRun")


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_type = Column(String, nullable=False)
    input_data = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="ai_analyses")


# ── Workflow Version History ───────────────────────────────────────────────────

class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(String, primary_key=True, default=gen_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    steps_snapshot = Column(JSON, default=list)
    changed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workflow = relationship("Workflow")
    user = relationship("User")


# ── Workflow Templates ────────────────────────────────────────────────────────

class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False, default="general")
    trigger_type = Column(String, default="manual")
    trigger_config = Column(JSON, default=dict)
    steps = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Webhook Events ────────────────────────────────────────────────────────────

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    automation_rule_id = Column(String, ForeignKey("automation_rules.id", ondelete="SET NULL"), nullable=True)
    source_ip = Column(String)
    payload = Column(JSON, default=dict)
    signature_valid = Column(Boolean, default=False)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    conditions_met = Column(Boolean, default=False)
    actions_fired = Column(JSON, default=list)

    automation_rule = relationship("AutomationRule")


# ── Automation Execution Log ──────────────────────────────────────────────────

class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    automation_rule_id = Column(String, ForeignKey("automation_rules.id", ondelete="CASCADE"), nullable=False)
    trigger_event = Column(String, nullable=False)
    trigger_data = Column(JSON, default=dict)
    conditions_met = Column(Boolean, nullable=False)
    actions_executed = Column(JSON, default=list)
    executed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    error_message = Column(Text)

    automation_rule = relationship("AutomationRule")
