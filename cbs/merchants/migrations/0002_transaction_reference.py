from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("merchants", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="reference",
            field=models.CharField(default="", editable=False, max_length=20, unique=True),
            preserve_default=False,
        ),
    ]
