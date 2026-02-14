from __future__ import annotations

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission
from apps.inventory.services import BusinessRuleError, InsufficientStockError
from .models import Sale, SaleStatus
from .serializers import SaleSerializer, SaleVoidSerializer
from .services import confirm_sale, void_sale


class SaleViewSet(viewsets.ModelViewSet):
    module_name = "sales"
    permission_classes = [ModuleRolePermission]
    serializer_class = SaleSerializer

    def get_queryset(self):
        return (
            Sale.objects.select_related("branch")
            .prefetch_related("items__product")
            .all()
            .order_by("-created_at")
        )

    def _ensure_draft(self, sale: Sale, action_name: str):
        if sale.status != SaleStatus.DRAFT:
            raise ValidationError(
                {"detail": f"No se puede {action_name} una venta en estado {sale.status}. Solo DRAFT."}
            )

    def update(self, request, *args, **kwargs):
        sale = self.get_object()
        self._ensure_draft(sale, "editar")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        sale = self.get_object()
        self._ensure_draft(sale, "editar")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        sale = self.get_object()
        self._ensure_draft(sale, "eliminar")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="quick")
    def quick(self, request):
        serializer = SaleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        try:
            cashier_id = request.user.id
            sale = confirm_sale(pk, cashier_id=cashier_id)
            return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_200_OK)

        except InsufficientStockError as e:
            return Response({"detail": str(e)}, status=status.HTTP_409_CONFLICT)
        except BusinessRuleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        serializer = SaleVoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "")

        try:
            cashier_id = request.user.id
            sale = void_sale(pk, user=request.user, cashier_id=cashier_id, reason=reason)
            return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_200_OK)

        except BusinessRuleError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
