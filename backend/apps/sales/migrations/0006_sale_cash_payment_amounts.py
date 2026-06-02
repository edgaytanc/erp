from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0005_cashregistersession"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="cash_received",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=14,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="cash_change",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=14,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
    ]
