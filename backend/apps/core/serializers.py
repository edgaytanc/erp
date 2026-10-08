from __future__ import annotations

from rest_framework import serializers

from .models import Notification, Branch


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Notification.
    Permite exponer información completa de la notificación y su sucursal.
    """
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    notification_type_display = serializers.CharField(
        source="get_notification_type_display",
        read_only=True,
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "branch",
            "branch_name",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "is_read",
            "reference_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "branch_name",
            "notification_type_display",
            "created_at",
            "updated_at",
        ]
