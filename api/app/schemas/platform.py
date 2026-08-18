from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel

PLATFORM_TOKEN_TYPE = "bearer"

CompanyStatus = Literal["active", "past_due", "suspended"]
JobStatusType = Literal["draft", "published", "closed"]
UserRoleType = Literal["admin", "member"]


class PlatformCompanyStatusUpdate(BaseModel):
    status: CompanyStatus


class PlatformJobStatusUpdate(BaseModel):
    status: JobStatusType


class PlatformUserUpdate(BaseModel):
    role: UserRoleType | None = None
    email_verified: bool | None = None


class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class PlatformRefreshRequest(BaseModel):
    refresh_token: str


class PlatformTokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class PlatformAdminOut(ORMModel):
    id: UUID
    email: EmailStr
    created_at: datetime


class PlatformStats(BaseModel):
    tenants_total: int
    tenants_active: int
    users_total: int
    jobs_total: int
    jobs_published: int
    applications_total: int
    subscriptions_active: int
    revenue_paid_total: dict[str, Decimal]


class PlatformUserOut(BaseModel):
    id: UUID
    email: EmailStr
    role: str
    email_verified: bool
    created_at: datetime
    tenant_id: UUID
    tenant_name: str
    tenant_slug: str


class PlatformCompanyOut(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
    region: str | None
    payment_provider: str | None
    plan_name: str | None
    created_at: datetime
    user_count: int
    job_count: int


class PlatformJobOut(BaseModel):
    id: UUID
    title: str
    status: str
    created_at: datetime
    tenant_id: UUID
    tenant_name: str
    application_count: int


class PlatformInvoiceOut(BaseModel):
    id: UUID
    provider: str
    amount: Decimal
    currency: str
    status: str
    created_at: datetime
    tenant_id: UUID
    tenant_name: str
