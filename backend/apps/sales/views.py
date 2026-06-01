from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission
from apps.inventory.services import BusinessRuleError, InsufficientStockError
from .models import CashRegisterSession, Sale, SaleStatus
from .serializers import (
    CashRegisterCloseSerializer,
    CashRegisterOpenSerializer,
    CashRegisterSessionSerializer,
    SaleConfirmSerializer,
    SaleSerializer,
    SaleTicketSerializer,
    SaleVoidSerializer,
)
from .services import close_cash_session, confirm_sale, open_cash_session, recompute_totals_for_update, void_sale


class CashRegisterViewSet(viewsets.ReadOnlyModelViewSet):
    module_name = "sales"
    permission_classes = [ModuleRolePermission]
    serializer_class = CashRegisterSessionSerializer

    def get_queryset(self):
        qs = CashRegisterSession.objects.select_related("branch", "cashier").all().order_by("-opened_at")
        user = self.request.user

        if getattr(user, "branch_id", None):
            qs = qs.filter(branch_id=user.branch_id)
        elif not getattr(user, "is_admin", lambda: False)():
            qs = qs.none()

        return qs

    def _user_branch(self):
        branch = getattr(self.request.user, "branch", None)
        if not branch:
            raise ValidationError({"branch": "Tu usuario no tiene una sucursal asignada."})
        return branch

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        session = (
            self.get_queryset()
            .filter(cashier=request.user, status="OPEN")
            .order_by("-opened_at")
            .first()
        )
        if not session:
            return Response({"session": None}, status=status.HTTP_200_OK)
        return Response({"session": self.get_serializer(session).data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="open")
    def open(self, request):
        serializer = CashRegisterOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = open_cash_session(
                branch=self._user_branch(),
                cashier=request.user,
                opening_amount=serializer.validated_data["opening_amount"],
            )
            return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)
        except BusinessRuleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="close")
    def close(self, request):
        serializer = CashRegisterCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = close_cash_session(
                branch=self._user_branch(),
                cashier=request.user,
                closing_amount=serializer.validated_data["closing_amount"],
            )
            return Response(self.get_serializer(session).data, status=status.HTTP_200_OK)
        except BusinessRuleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class SaleViewSet(viewsets.ModelViewSet):
    module_name = "sales"
    permission_classes = [ModuleRolePermission]
    serializer_class = SaleSerializer

    def get_queryset(self):
        qs = (
            Sale.objects.select_related("branch", "branch__company")
            .prefetch_related("items__product")
            .all()
            .order_by("-created_at")
        )
        user = self.request.user

        if getattr(user, "branch_id", None):
            qs = qs.filter(branch_id=user.branch_id)
        elif not getattr(user, "is_admin", lambda: False)():
            qs = qs.none()

        return qs

    def get_serializer_class(self):
        if self.action == "ticket":
            return SaleTicketSerializer
        return super().get_serializer_class()

    def _ensure_draft(self, sale: Sale, action_name: str):
        if sale.status != SaleStatus.DRAFT:
            raise ValidationError(
                {"detail": f"No se puede {action_name} una venta en estado {sale.status}. Solo DRAFT."}
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()

        recompute_totals_for_update(sale)
        sale.refresh_from_db()

        output_serializer = self.get_serializer(sale)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        self._ensure_draft(instance, "editar")

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()

        recompute_totals_for_update(sale)
        sale.refresh_from_db()

        output_serializer = self.get_serializer(sale)
        return Response(output_serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        sale = self.get_object()
        self._ensure_draft(sale, "eliminar")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="quick")
    def quick(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()

        recompute_totals_for_update(sale)
        sale.refresh_from_db()

        output_serializer = self.get_serializer(sale)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        serializer = SaleConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            sale = self.get_object()
            sale = confirm_sale(
                sale.pk,
                cashier_id=request.user.id,
                cash_received=serializer.validated_data.get("cash_received"),
            )
            sale.refresh_from_db()
            return Response(
                SaleSerializer(sale, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )
        except InsufficientStockError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except BusinessRuleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        serializer = SaleVoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "")

        try:
            sale = self.get_object()
            sale = void_sale(sale.pk, user=request.user, cashier_id=request.user.id, reason=reason)
            sale.refresh_from_db()
            return Response(
                SaleSerializer(sale, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )
        except BusinessRuleError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["get"], url_path="ticket")
    def ticket(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleTicketSerializer(sale, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
