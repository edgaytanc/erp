from rest_framework import viewsets
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission


class PurchasesHealthViewSet(viewsets.ViewSet):
    """
    Endpoint mínimo para validar permisos del módulo purchases.
    Módulo: purchases
    - Admin: acceso
    - Purchases: acceso
    - Sales: sin acceso
    """
    module_name = "purchases"
    permission_classes = [ModuleRolePermission]

    def list(self, request):
        return Response({"status": "ok", "module": "purchases"})
