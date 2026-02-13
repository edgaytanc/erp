from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_admin", lambda: False)())


class IsPurchasesRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_purchases", lambda: False)())


class IsSalesRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_sales", lambda: False)())


class ModuleRolePermission(BasePermission):
    """
    Política por módulo:
    - Admin: todo
    - Purchases: compras completo + inventario SOLO lectura
    - Sales: ventas completo
    Para usarlo, en cada ViewSet define: module_name = "inventory"|"purchases"|"sales"
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if getattr(user, "is_admin", lambda: False)():
            return True

        module = getattr(view, "module_name", "")

        if module == "inventory":
            return getattr(user, "is_purchases", lambda: False)() and request.method in SAFE_METHODS

        if module == "purchases":
            return getattr(user, "is_purchases", lambda: False)()

        if module == "sales":
            return getattr(user, "is_sales", lambda: False)()

        # Si no se define module_name, por seguridad se bloquea.
        return False
