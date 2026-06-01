import uuid
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0001_initial"),
        ("sales", "0004_alter_sale_voided_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="CashRegisterSession",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("business_date", models.DateField(db_index=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("OPEN", "OPEN"), ("CLOSED", "CLOSED")],
                        db_index=True,
                        default="OPEN",
                        max_length=12,
                    ),
                ),
                (
                    "opening_amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=14,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                (
                    "closing_amount",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                ("opened_at", models.DateTimeField(db_index=True)),
                ("closed_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "branch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cash_sessions",
                        to="core.branch",
                    ),
                ),
                (
                    "cashier",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cash_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "sales_cash_register_session",
                "ordering": ["-opened_at"],
            },
        ),
        migrations.AddIndex(
            model_name="cashregistersession",
            index=models.Index(fields=["branch", "business_date"], name="ix_cash_branch_date"),
        ),
        migrations.AddIndex(
            model_name="cashregistersession",
            index=models.Index(fields=["cashier", "business_date"], name="ix_cash_cashier_date"),
        ),
        migrations.AddIndex(
            model_name="cashregistersession",
            index=models.Index(fields=["status", "opened_at"], name="ix_cash_status_opened"),
        ),
        migrations.AddConstraint(
            model_name="cashregistersession",
            constraint=models.UniqueConstraint(
                fields=("branch", "cashier", "business_date"),
                name="uq_cash_session_daily_cashier",
            ),
        ),
    ]
