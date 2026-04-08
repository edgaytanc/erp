import { Navigate, Outlet } from "react-router-dom";

import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { useAuth } from "../contexts/AuthContext";

export function AuthLayout() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen text="Validando sesión..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
}
