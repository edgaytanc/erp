// frontend/src/app/router.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AuthLayout } from "../layouts/AuthLayout";
import { AppLayout } from "../layouts/AppLayout";
import { PosLayout } from "../layouts/PosLayout";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { RoleRoute } from "../routes/RoleRoute";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { HomePage } from "../features/home/pages/HomePage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { InventoryPage } from "../features/inventory/pages/InventoryPage";
import { PurchasesPage } from "../features/purchases/pages/PurchasesPage";
import { PosPage } from "../features/pos/pages/PosPage";
import { ReportsPage } from "../features/reports/pages/ReportsPage";
import { AdminConfigPage } from "../features/admin/pages/AdminConfigPage";
import { NotFoundPage } from "../features/system/pages/NotFoundPage";
import { ForbiddenPage } from "../features/system/pages/ForbiddenPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app" replace /> },
          { path: "app", element: <HomePage /> },
          {
            path: "dashboard",
            element: (
              <RoleRoute allowedRoles={["admin", "purchases"]}>
                <DashboardPage />
              </RoleRoute>
            ),
          },
          {
            path: "inventory",
            element: (
              <RoleRoute allowedRoles={["admin", "purchases"]}>
                <InventoryPage />
              </RoleRoute>
            ),
          },
          {
            path: "purchases",
            element: (
              <RoleRoute allowedRoles={["admin", "purchases"]}>
                <PurchasesPage />
              </RoleRoute>
            ),
          },
          {
            path: "reports",
            element: (
              <RoleRoute allowedRoles={["admin"]}>
                <ReportsPage />
              </RoleRoute>
            ),
          },
          {
            path: "admin/config",
            element: (
              <RoleRoute allowedRoles={["admin"]}>
                <AdminConfigPage />
              </RoleRoute>
            ),
          },
          // Redirecciones de conveniencia para rutas compuestas
          { path: "app/reports", element: <Navigate to="/reports" replace /> },
          { path: "app/purchases", element: <Navigate to="/purchases" replace /> },
          { path: "app/inventory", element: <Navigate to="/inventory" replace /> },
          { path: "forbidden", element: <ForbiddenPage /> },
        ],
      },
      {
        path: "pos",
        element: (
          <RoleRoute allowedRoles={["admin", "sales"]}>
            <PosLayout />
          </RoleRoute>
        ),
        children: [{ index: true, element: <PosPage /> }],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
