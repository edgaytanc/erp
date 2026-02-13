from rest_framework import viewsets
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission


class SalesHealthViewSet(viewsets.ViewSet):
    """
    Endpoint mínimo para validar permisos del módulo sales.
    Módulo: sales
    - Admin: acceso
    - Sales: acceso
    - Purchases: sin acceso
    """
    module_name = "sales"
    permission_classes = [ModuleRolePermission]

    def list(self, request):
        return Response({"status": "ok", "module": "sales"})
