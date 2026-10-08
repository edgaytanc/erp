from django.contrib import admin

from .models import Branch, Company, Notification


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "tax_id", "phone", "created_at")
    search_fields = ("name", "tax_id")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "is_active", "created_at")
    list_filter = ("company", "is_active")
    search_fields = ("name",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "branch",
        "notification_type",
        "title",
        "is_read",
        "created_at",
    )
    list_filter = ("branch", "notification_type", "is_read")
    search_fields = ("title", "message", "reference_id")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("branch",)
