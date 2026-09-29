"""add disruptions table

Revision ID: a1b2c3d4e5f6
Revises: 304305ca0d9f
Create Date: 2026-09-29

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "304305ca0d9f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "disruptions",
        sa.Column("id",              sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("disruption_type", sa.String(30),    nullable=False),
        sa.Column("description",     sa.Text(),        nullable=False),
        sa.Column("section_code",    sa.String(50),    nullable=True),
        sa.Column("severity",        sa.String(20),    nullable=False, server_default="medium"),
        sa.Column("impact_minutes",  sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("is_active",       sa.Boolean(),     nullable=False, server_default="true"),
        sa.Column("created_at",      sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("cleared_at",      sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("disruptions")
