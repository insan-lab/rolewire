"""SQLAlchemy models mirroring §4 and §9.2 of the spec.

Column types are chosen so the same models run on Postgres (production) and SQLite
(unit tests): generic ``Uuid``/``JSON`` with Postgres-specific variants where it matters.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")

# Tables that carry tenant_id and therefore get RLS policies (§3).
TENANT_SCOPED_TABLES = (
    "users",
    "jobs",
    "job_questions",
    "applications",
    "storage_configs",
    "usage_events",
    "subscriptions",
    "invoices",
)


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _created_at() -> Mapped[datetime]:
    # Python-side default as well as server_default so the value is available immediately
    # after flush without an extra round-trip.
    return mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now(), nullable=False
    )


def _updated_at() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        onupdate=_utcnow,
        nullable=False,
    )


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    monthly_price_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    yearly_price_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    monthly_price_bdt: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    yearly_price_bdt: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    paddle_monthly_price_id: Mapped[str | None] = mapped_column(Text)
    paddle_yearly_price_id: Mapped[str | None] = mapped_column(Text)
    features: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict, nullable=False)
    created_at: Mapped[datetime] = _created_at()


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plans.id", ondelete="SET NULL")
    )
    billing_cycle: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    region: Mapped[str | None] = mapped_column(String(16))
    payment_provider: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint(
            "billing_cycle IS NULL OR billing_cycle IN ('monthly','yearly')",
            name="tenants_billing_cycle_check",
        ),
        CheckConstraint(
            "status IN ('active','past_due','suspended')", name="tenants_status_check"
        ),
    )

    plan: Mapped[Plan | None] = relationship(lazy="selectin")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_deliverable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16), default="admin", nullable=False)
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint("role IN ('admin','member')", name="users_role_check"),
        Index("ix_users_tenant_id", "tenant_id"),
    )

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    provider_email: Mapped[str | None] = mapped_column(Text)
    access_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    refresh_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_profile: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
        CheckConstraint(
            "provider IN ('google','facebook','github','linkedin')",
            name="oauth_accounts_provider_check",
        ),
        Index("ix_oauth_accounts_user_id", "user_id"),
    )

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class StorageConfig(Base):
    __tablename__ = "storage_configs"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    encrypted_credentials: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict, nullable=False)
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint("type IN ('s3','gdrive','telegram')", name="storage_configs_type_check"),
        Index("ix_storage_configs_tenant_id", "tenant_id"),
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    employment_type: Mapped[str | None] = mapped_column(String(32))
    department: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    storage_target: Mapped[str] = mapped_column(String(16), default="hosted", nullable=False)
    storage_config_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("storage_configs.id", ondelete="SET NULL")
    )
    ats_webhook_url: Mapped[str | None] = mapped_column(Text)
    opencats_sync: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    __table_args__ = (
        CheckConstraint("status IN ('draft','published','closed')", name="jobs_status_check"),
        CheckConstraint(
            "storage_target IN ('hosted','s3','gdrive','telegram')",
            name="jobs_storage_target_check",
        ),
        Index("ix_jobs_tenant_id_status", "tenant_id", "status"),
    )

    questions: Mapped[list[JobQuestion]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="JobQuestion.sort_order",
    )
    storage_config: Mapped[StorageConfig | None] = relationship(lazy="selectin")


class JobQuestion(Base):
    __tablename__ = "job_questions"

    QUESTION_TYPES = (
        "text",
        "textarea",
        "select",
        "multiselect",
        "file",
        "boolean",
        "number",
        "email",
        "phone",
    )

    id: Mapped[uuid.UUID] = _pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    field_key: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(16), nullable=False)
    options: Mapped[list[str] | None] = mapped_column(JSONType)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "field_key", name="uq_job_questions_job_field_key"),
        CheckConstraint(
            "question_type IN ('text','textarea','select','multiselect','file','boolean',"
            "'number','email','phone')",
            name="job_questions_type_check",
        ),
        Index("ix_job_questions_tenant_id", "tenant_id"),
    )

    job: Mapped[Job] = relationship(back_populates="questions")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = _pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    answers: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    resume_ref: Mapped[str | None] = mapped_column(Text)
    applicant_email: Mapped[str | None] = mapped_column(Text)
    ip_hash: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="received", nullable=False)
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint(
            "status IN ('received','forwarded','failed')", name="applications_status_check"
        ),
        Index("ix_applications_tenant_job", "tenant_id", "job_id"),
        Index("ix_applications_created_at", "created_at"),
    )


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    occurred_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('storage_mb','opencats_active','application_received')",
            name="usage_events_type_check",
        ),
        Index("ix_usage_events_tenant_occurred", "tenant_id", "occurred_at"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plans.id"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_subscription_id: Mapped[str | None] = mapped_column(Text)
    billing_cycle: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    __table_args__ = (
        CheckConstraint("provider IN ('paddle','uddoktapay')", name="subscriptions_provider_check"),
        CheckConstraint(
            "billing_cycle IN ('monthly','yearly')", name="subscriptions_billing_cycle_check"
        ),
        CheckConstraint(
            "status IN ('active','past_due','canceled','paused')", name="subscriptions_status_check"
        ),
        Index("ix_subscriptions_tenant_id", "tenant_id"),
        Index("ix_subscriptions_provider_sub_id", "provider", "provider_subscription_id"),
    )

    plan: Mapped[Plan] = relationship(lazy="selectin")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL")
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_invoice_id: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = _created_at()

    __table_args__ = (
        CheckConstraint("status IN ('paid','failed','refunded')", name="invoices_status_check"),
        UniqueConstraint(
            "provider", "provider_invoice_id", name="uq_invoices_provider_invoice_id"
        ),
        Index("ix_invoices_tenant_id", "tenant_id"),
    )


__all__ = [
    "Application",
    "Invoice",
    "Job",
    "JobQuestion",
    "OAuthAccount",
    "Plan",
    "StorageConfig",
    "Subscription",
    "TENANT_SCOPED_TABLES",
    "Tenant",
    "UsageEvent",
    "User",
]
