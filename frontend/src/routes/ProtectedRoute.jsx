import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen text="Cargando aplicación..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
