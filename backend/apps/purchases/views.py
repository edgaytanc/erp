from __future__ import annotations

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission
from apps.inventory.services import BusinessRuleError
from .models import Purchase, PurchaseStatus, Supplier
from .serializers import PurchaseSerializer, SupplierSerializer, PurchaseCancelSerializer
from .services import confirm_purchase, cancel_purchase


class SupplierViewSet(viewsets.ModelViewSet):
    module_name = "purchases"
    permission_classes = [ModuleRolePermission]
    queryset = Supplier.objects.all().order_by("name")
    serializer_class = SupplierSerializer


class PurchaseViewSet(viewsets.ModelViewSet):
    module_name = "purchases"
    permission_classes = [ModuleRolePermission]
    serializer_class = PurchaseSerializer

    def get_queryset(self):
        qs = (
            Purchase.objects.select_related("branch", "supplier")
            .prefetch_related("items__product")
            .all()
            .order_by("-created_at")
        )
        user = self.request.user
        branch_id = self.request.query_params.get("branch")
        status_param = self.request.query_params.get("status")

        if getattr(user, "branch_id", None):
            qs = qs.filter(branch_id=user.branch_id)
        elif not getattr(user, "is_admin", lambda: False)():
            qs = qs.none()
        elif branch_id:
            qs = qs.filter(branch_id=branch_id)

        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    def _ensure_draft(self, purchase: Purchase, action_name: str):
        if purchase.status != PurchaseStatus.DRAFT:
            raise ValidationError(
                {"detail": f"No se puede {action_name} una compra en estado {purchase.status}. Solo DRAFT."}
            )

    def update(self, request, *args, **kwargs):
        purchase = self.get_object()
        self._ensure_draft(purchase, "editar")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        purchase = self.get_object()
        self._ensure_draft(purchase, "editar")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()
        self._ensure_draft(purchase, "eliminar")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="quick")
    def quick(self, request):
        """
        POST /api/purchases/quick/
        Crea una compra DRAFT + items
        """
        serializer = PurchaseSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        purchase = serializer.save()
        return Response(PurchaseSerializer(purchase, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="drafts")
    def drafts(self, request):
        """
        GET /api/purchases/drafts/
        Obtiene las compras con estado DRAFT
        """
        drafts = self.get_queryset().filter(status=PurchaseStatus.DRAFT)
        serializer = self.get_serializer(drafts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        """
        POST /api/purchases/{id}/confirm/
        """
        try:
            purchase = self.get_object()
            purchase = confirm_purchase(purchase.pk)
            return Response(PurchaseSerializer(purchase, context={"request": request}).data, status=status.HTTP_200_OK)

        except BusinessRuleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Purchase.DoesNotExist:
            return Response({"detail": "Compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """
        POST /api/purchases/{id}/cancel/
        Body: { "reason": "..." }
        Solo DRAFT.
        """
        serializer = PurchaseCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "")

        try:
            purchase = self.get_object()
            purchase = cancel_purchase(purchase.pk, reason=reason)
            return Response(PurchaseSerializer(purchase, context={"request": request}).data, status=status.HTTP_200_OK)

        except BusinessRuleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Purchase.DoesNotExist:
            return Response({"detail": "Compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)
