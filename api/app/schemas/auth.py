from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    company_name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(default="", max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(max_length=256)


class UpdateCompanyRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    company_slug: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class OAuthAccountOut(ORMModel):
    provider: str
    provider_email: str | None
    created_at: datetime


class UserOut(ORMModel):
    id: UUID
    tenant_id: UUID
    company_name: str | None = None
    company_slug: str | None = None
    email: EmailStr
    email_verified: bool
    avatar_url: str | None
    role: str
    created_at: datetime
    has_password: bool = False
    oauth_providers: list[str] = []


class OAuthStartOut(BaseModel):
    authorization_url: str
    state: str
