import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

export function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
