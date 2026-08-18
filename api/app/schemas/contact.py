from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel

ContactStatus = Literal["pending", "in_progress", "resolved", "ignored"]


class ContactSubmissionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    message: str = Field(min_length=1, max_length=5000)


class ContactSubmissionOut(ORMModel):
    id: UUID
    name: str
    email: EmailStr
    message: str
    status: ContactStatus
    created_at: datetime
    updated_at: datetime


class ContactSubmissionStatusUpdate(BaseModel):
    status: ContactStatus
