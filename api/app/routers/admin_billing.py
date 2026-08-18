"""Billing overview and upgrade initiation (§9).

Two structurally separate rails: Paddle (global, Merchant of Record, real subscription objects)
and UddoktaPay (Bangladesh, one-time charges with Rolewire-side renewal emulation). Provider
choice comes from the checkout flow the tenant enters, never from a self-reported country field.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.models import Invoice, Plan, Subscription
from app.routers.deps import AdminPrincipal, CurrentPrincipal, DbSession
from app.schemas.billing import (
    BillingOverview,
    InvoiceOut,
    PlanOut,
    SubscriptionOut,
    UpgradeCheckout,
    UpgradeRequest,
)
from app.services import billing, usage

router = APIRouter(prefix="/v1/admin/billing", tags=["admin:billing"])


@router.get("", response_model=BillingOverview)
async def overview(principal: CurrentPrincipal, session: DbSession) -> BillingOverview:
    subscription = await session.scalar(
        select(Subscription)
        .where(Subscription.tenant_id == principal.tenant_id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    plan_id = subscription.plan_id if subscription else principal.tenant.plan_id
    plan = await session.scalar(select(Plan).where(Plan.id == plan_id)) if plan_id else None
    invoices = await session.scalars(
        select(Invoice)
        .where(Invoice.tenant_id == principal.tenant_id)
        .order_by(Invoice.created_at.desc())
        .limit(24)
    )
    return BillingOverview(
        tenant_status=principal.tenant.status,
        region=principal.tenant.region,
        payment_provider=principal.tenant.payment_provider,
        plan=PlanOut.model_validate(plan, from_attributes=True) if plan else None,
        subscription=(
            SubscriptionOut.model_validate(subscription, from_attributes=True)
            if subscription
            else None
        ),
        invoices=[InvoiceOut.model_validate(row, from_attributes=True) for row in invoices],
        usage=await usage.totals_for_tenant(session, principal.tenant_id),
    )


@router.get("/plans", response_model=list[PlanOut])
async def list_plans(principal: CurrentPrincipal, session: DbSession) -> list[PlanOut]:
    rows = await session.scalars(select(Plan).order_by(Plan.monthly_price_usd.asc()))
    return [PlanOut.model_validate(row, from_attributes=True) for row in rows]


@router.post("/upgrade", response_model=UpgradeCheckout)
async def upgrade(
    payload: UpgradeRequest, principal: AdminPrincipal, session: DbSession
) -> UpgradeCheckout:
    plan = await session.scalar(select(Plan).where(Plan.id == payload.plan_id))
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan not found")
    try:
        return await billing.start_checkout(
            session,
            tenant=principal.tenant,
            user=principal.user,
            plan=plan,
            provider=payload.provider,
            billing_cycle=payload.billing_cycle,
        )
    except billing.BillingConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except billing.BillingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


__all__ = ["router"]
