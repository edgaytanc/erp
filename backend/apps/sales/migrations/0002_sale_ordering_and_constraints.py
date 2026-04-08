from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="sale",
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(fields=["branch", "voided_at"], name="ix_sale_branch_void_dt"),
        ),
        migrations.AddConstraint(
            model_name="saleitem",
            constraint=models.UniqueConstraint(fields=("sale", "product"), name="uq_sale_item_sale_product"),
        ),
    ]