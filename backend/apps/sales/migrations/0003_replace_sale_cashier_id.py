from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0002_sale_ordering_and_constraints"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="sale",
            name="ix_sale_cashier_dt",
        ),
        migrations.RemoveField(
            model_name="sale",
            name="cashier_id",
        ),
        migrations.AddField(
            model_name="sale",
            name="cashier_id",
            field=models.BigIntegerField(db_index=True, default=0),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(fields=["cashier_id", "sold_at"], name="ix_sale_cashier_dt"),
        ),
    ]