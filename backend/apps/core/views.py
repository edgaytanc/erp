# backend/apps/core/views.py
from __future__ import annotations

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para listar, consultar y gestionar el estado de lectura de Notificaciones.
    Filtra automáticamente por la sucursal asignada al usuario en sesión y
    ordena por fecha descendente (-created_at).
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()

        qs = Notification.objects.select_related("branch").all()

        # Si el usuario tiene una sucursal asignada, se restringe estrictamente a ella
        if getattr(user, "branch", None):
            qs = qs.filter(branch=user.branch)
        elif getattr(user, "is_admin", lambda: False)():
            # Administradores globales sin sucursal fija pueden filtrar opcionalmente por ?branch=
            branch_param = self.request.query_params.get("branch")
            if branch_param:
                qs = qs.filter(branch_id=branch_param)
        else:
            return Notification.objects.none()

        # Filtro opcional por estado de lectura (?is_read=true / ?is_read=false)
        is_read_param = self.request.query_params.get("is_read")
        if is_read_param is not None:
            if is_read_param.lower() in ("true", "1"):
                qs = qs.filter(is_read=True)
            elif is_read_param.lower() in ("false", "0"):
                qs = qs.filter(is_read=False)

        # Filtro opcional por tipo de notificación (?notification_type=LOW_STOCK)
        notification_type = self.request.query_params.get("notification_type")
        if notification_type:
            qs = qs.filter(notification_type=notification_type)

        return qs.order_by("-created_at")

    @action(detail=True, methods=["post"])
    def mark_as_read(self, request, pk=None):
        """
        Marca una notificación específica como leída.
        """
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def mark_all_as_read(self, request):
        """
        Marca todas las notificaciones no leídas de la sucursal actual como leídas.
        """
        qs = self.get_queryset().filter(is_read=False)
        updated_count = qs.update(is_read=True)
        return Response(
            {
                "detail": f"{updated_count} notificaciones marcadas como leídas.",
                "updated_count": updated_count,
            },
            status=status.HTTP_200_OK,
        )
