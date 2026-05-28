from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView, UsersListCreateView, UsersRetrieveUpdateDestroyView

urlpatterns = [
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UsersListCreateView.as_view(), name="users_list_create"),
    path("users/<int:pk>/", UsersRetrieveUpdateDestroyView.as_view(), name="users_detail"),
]
