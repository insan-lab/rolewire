from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel

StorageType = Literal["s3", "gdrive", "telegram"]

REQUIRED_CREDENTIAL_KEYS: dict[str, tuple[str, ...]] = {
    "s3": ("access_key_id", "secret_access_key"),
    "gdrive": ("service_account_json",),
    "telegram": ("bot_token",),
}
REQUIRED_CONFIG_KEYS: dict[str, tuple[str, ...]] = {
    "s3": ("bucket",),
    "gdrive": ("folder_id",),
    "telegram": ("chat_id",),
}


class StorageConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: StorageType
    credentials: dict[str, str]
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_shape(self) -> StorageConfigCreate:
        missing_credentials = [
            key for key in REQUIRED_CREDENTIAL_KEYS[self.type] if not self.credentials.get(key)
        ]
        if missing_credentials:
            raise ValueError(
                f"missing credential keys for {self.type}: {', '.join(missing_credentials)}"
            )
        missing_config = [
            key for key in REQUIRED_CONFIG_KEYS[self.type] if not self.config.get(key)
        ]
        if missing_config:
            raise ValueError(f"missing config keys for {self.type}: {', '.join(missing_config)}")
        return self


class StorageConfigOut(ORMModel):
    """Credentials are never echoed back — only the non-secret config envelope."""

    id: UUID
    tenant_id: UUID
    name: str
    type: StorageType
    config: dict[str, Any]
    created_at: datetime


class PlanOut(ORMModel):
    id: UUID
    name: str
    monthly_price_usd: Decimal | None
    yearly_price_usd: Decimal | None
    monthly_price_bdt: Decimal | None
    yearly_price_bdt: Decimal | None
    features: dict[str, Any]


class SubscriptionOut(ORMModel):
    id: UUID
    plan_id: UUID
    provider: str
    billing_cycle: str
    status: str
    current_period_end: datetime | None


class InvoiceOut(ORMModel):
    id: UUID
    provider: str
    provider_invoice_id: str | None
    amount: Decimal
    currency: str
    status: str
    created_at: datetime


class BillingOverview(BaseModel):
    tenant_status: str
    region: str | None
    payment_provider: str | None
    plan: PlanOut | None
    subscription: SubscriptionOut | None
    invoices: list[InvoiceOut]
    usage: dict[str, Decimal]


class UpgradeRequest(BaseModel):
    plan_id: UUID
    billing_cycle: Literal["monthly", "yearly"]
    provider: Literal["paddle", "uddoktapay"]


class UpgradeCheckout(BaseModel):
    provider: str
    checkout_url: str | None
    plan_id: UUID
    billing_cycle: str
    note: str | None = None
