from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAdminRole
from .serializers import UserSerializer, CreateUserSerializer, UpdateUserSerializer

User = get_user_model()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UsersListCreateView(generics.ListCreateAPIView):
    """
    Admin puede listar y crear usuarios.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = User.objects.all().order_by("id")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateUserSerializer
        return UserSerializer


class UsersRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin puede ver, editar, desactivar o eliminar usuarios.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = User.objects.select_related("branch").all().order_by("id")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateUserSerializer
        return UserSerializer
