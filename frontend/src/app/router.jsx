import { createBrowserRouter, Navigate } from "react-router-dom";

import { AuthLayout } from "../layouts/AuthLayout";
import { AppLayout } from "../layouts/AppLayout";
import { PosLayout } from "../layouts/PosLayout";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { RoleRoute } from "../routes/RoleRoute";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { HomePage } from "../features/home/pages/HomePage";
import { InventoryPage } from "../features/inventory/pages/InventoryPage";
import { PurchasesPage } from "../features/purchases/pages/PurchasesPage";
import { PosPage } from "../features/pos/pages/PosPage";
import { ReportsPage } from "../features/reports/pages/ReportsPage";
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
