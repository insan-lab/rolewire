from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import ORMModel

QuestionType = Literal[
    "text", "textarea", "select", "multiselect", "file", "boolean", "number", "email", "phone"
]
JobStatus = Literal["draft", "published", "closed"]
StorageTarget = Literal["hosted", "s3", "gdrive", "telegram"]

FIELD_KEY_PATTERN = r"^[a-z][a-z0-9_]{0,62}$"


class JobQuestionIn(BaseModel):
    label: str = Field(min_length=1, max_length=300)
    field_key: str = Field(pattern=FIELD_KEY_PATTERN)
    question_type: QuestionType
    options: list[str] | None = None
    required: bool = True
    sort_order: int = 0

    @model_validator(mode="after")
    def _options_required_for_choice_types(self) -> JobQuestionIn:
        if self.question_type in ("select", "multiselect"):
            if not self.options:
                raise ValueError(f"'{self.question_type}' questions require a non-empty options list")
            if len(set(self.options)) != len(self.options):
                raise ValueError("options must be unique")
        elif self.options:
            raise ValueError(f"'{self.question_type}' questions must not define options")
        return self


class JobQuestionsReplace(BaseModel):
    questions: list[JobQuestionIn]

    @field_validator("questions")
    @classmethod
    def _unique_field_keys(cls, value: list[JobQuestionIn]) -> list[JobQuestionIn]:
        keys = [question.field_key for question in value]
        if len(set(keys)) != len(keys):
            raise ValueError("field_key values must be unique within a job")
        return value


class JobQuestionOut(ORMModel):
    id: UUID
    label: str
    field_key: str
    question_type: QuestionType
    options: list[str] | None
    required: bool
    sort_order: int


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    location: str | None = Field(default=None, max_length=200)
    employment_type: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=120)
    status: JobStatus = "draft"
    storage_target: StorageTarget = "hosted"
    storage_config_id: UUID | None = None
    ats_webhook_url: str | None = None
    opencats_sync: bool = False
    questions: list[JobQuestionIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _storage_config_matches_target(self) -> JobCreate:
        if self.storage_target != "hosted" and self.storage_config_id is None:
            raise ValueError(f"storage_target '{self.storage_target}' requires a storage_config_id")
        if self.storage_target == "hosted" and self.storage_config_id is not None:
            raise ValueError("hosted storage_target must not reference a storage_config_id")
        return self

    @field_validator("ats_webhook_url")
    @classmethod
    def _https_webhook(cls, value: str | None) -> str | None:
        if value and not value.startswith("https://"):
            raise ValueError("ats_webhook_url must be an https URL")
        return value


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    location: str | None = Field(default=None, max_length=200)
    employment_type: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=120)
    status: JobStatus | None = None
    storage_target: StorageTarget | None = None
    storage_config_id: UUID | None = None
    ats_webhook_url: str | None = None
    opencats_sync: bool | None = None

    @field_validator("ats_webhook_url")
    @classmethod
    def _https_webhook(cls, value: str | None) -> str | None:
        if value and not value.startswith("https://"):
            raise ValueError("ats_webhook_url must be an https URL")
        return value


class JobOut(ORMModel):
    id: UUID
    tenant_id: UUID
    title: str
    description: str | None
    location: str | None
    employment_type: str | None
    department: str | None
    status: JobStatus
    storage_target: StorageTarget
    storage_config_id: UUID | None
    ats_webhook_url: str | None
    opencats_sync: bool
    created_at: datetime
    updated_at: datetime
    questions: list[JobQuestionOut] = []


# --- Public API shapes (§5.1) ------------------------------------------------


class PublicQuestion(BaseModel):
    field_key: str
    label: str
    type: QuestionType
    options: list[str] | None = None
    required: bool


class PublicJobSummary(BaseModel):
    id: UUID
    title: str
    location: str | None
    employment_type: str | None
    department: str | None
    created_at: datetime


class PublicJob(PublicJobSummary):
    description: str | None
    company: str
    questions: list[PublicQuestion]


class PublicJobList(BaseModel):
    items: list[PublicJobSummary]
    total: int


class ApplicationSubmit(BaseModel):
    answers: dict[str, Any]
    resume_ref: str | None = None
    applicant_email: str | None = None


class ApplicationAccepted(BaseModel):
    id: UUID
    status: str
    received_at: datetime


class ApplicationOut(ORMModel):
    id: UUID
    job_id: UUID
    tenant_id: UUID
    answers: dict[str, Any]
    resume_ref: str | None
    applicant_email: str | None
    status: str
    created_at: datetime


class UploadTicketRequest(BaseModel):
    field_key: str = Field(pattern=FIELD_KEY_PATTERN)
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=127)
    size_bytes: int = Field(gt=0)


class UploadTicket(BaseModel):
    mode: Literal["presigned", "server_relay"]
    upload_url: str | None = None
    fields: dict[str, str] = Field(default_factory=dict)
    resume_ref: str
    expires_in: int
    max_bytes: int
