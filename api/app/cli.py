"""Operational CLI: ``python -m app.cli <command>``.

Commands are deliberately small and idempotent so they are safe to run against a live database
during a deploy.
"""

from __future__ import annotations

import argparse
import asyncio
import uuid
from decimal import Decimal

from sqlalchemy import select

from app.core.crypto import generate_key
from app.core.db import dispose_engine, get_sessionmaker
from app.models import Plan

# Mirrors the Paddle product catalog; price ids are environment-specific and set via --paddle-*.
DEFAULT_PLANS = [
    {
        "name": "basic",
        "monthly_price_usd": Decimal("9.00"),
        "yearly_price_usd": Decimal("90.00"),
        "monthly_price_bdt": Decimal("990.00"),
        "yearly_price_bdt": Decimal("9900.00"),
        "features": {
            "email_sending": False,
            "opencats_included": False,
            "own_storage": True,
            "hosted_storage_gb_included": 1,
            "ats_webhook": True,
        },
    },
    {
        "name": "pro",
        "monthly_price_usd": Decimal("14.00"),
        "yearly_price_usd": Decimal("140.00"),
        "monthly_price_bdt": Decimal("1490.00"),
        "yearly_price_bdt": Decimal("14900.00"),
        "features": {
            "email_sending": True,
            "opencats_included": True,
            "own_storage": True,
            "hosted_storage_gb_included": 10,
            "ats_webhook": True,
        },
    },
]


async def seed_plans() -> None:
    async with get_sessionmaker()() as session:
        for spec in DEFAULT_PLANS:
            existing = await session.scalar(select(Plan).where(Plan.name == spec["name"]))
            if existing is None:
                session.add(Plan(id=uuid.uuid4(), **spec))
                print(f"created plan '{spec['name']}'")
            else:
                for field, value in spec.items():
                    setattr(existing, field, value)
                print(f"updated plan '{spec['name']}'")
        await session.commit()
    await dispose_engine()


async def list_plans() -> None:
    async with get_sessionmaker()() as session:
        for plan in await session.scalars(select(Plan).order_by(Plan.monthly_price_usd)):
            print(
                f"{plan.name:8} ${plan.monthly_price_usd}/mo  ৳{plan.monthly_price_bdt}/mo  "
                f"paddle_monthly={plan.paddle_monthly_price_id or '-'}"
            )
    await dispose_engine()


def main() -> None:
    parser = argparse.ArgumentParser(prog="rolewire")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("seed-plans", help="create/update the default pricing tiers")
    subparsers.add_parser("list-plans", help="print the configured plans")
    subparsers.add_parser("generate-encryption-key", help="print a new Fernet key for ENCRYPTION_KEY")

    args = parser.parse_args()
    if args.command == "seed-plans":
        asyncio.run(seed_plans())
    elif args.command == "list-plans":
        asyncio.run(list_plans())
    elif args.command == "generate-encryption-key":
        print(generate_key())


if __name__ == "__main__":
    main()
