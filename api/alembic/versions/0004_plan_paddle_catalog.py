"""plans: paddle_product_id + previous-price-id columns for catalog sync

Revision ID: 0004_plan_paddle_catalog
Revises: 0003_contact_submissions
Create Date: 2026-09-08

``Base.metadata.create_all`` (used by the earlier migrations) only creates missing tables, never
alters existing ones, so the three new nullable columns on ``plans`` are added explicitly here.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_plan_paddle_catalog"
down_revision: str | None = "0003_contact_submissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    "paddle_product_id",
    "paddle_monthly_price_id_previous",
    "paddle_yearly_price_id_previous",
)


def upgrade() -> None:
    for name in _COLUMNS:
        op.add_column("plans", sa.Column(name, sa.Text(), nullable=True))


def downgrade() -> None:
    for name in _COLUMNS:
        op.drop_column("plans", name)


__all__ = ["downgrade", "upgrade"]
