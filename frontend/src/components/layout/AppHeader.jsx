import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";

const ROLE_LABELS = {
  admin: "Administrador",
  purchases: "Encargado de Compras",
  sales: "Vendedor",
};

export function AppHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fullName = useMemo(() => {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return name || user?.username || "Usuario";
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-header">
      <div>
        <h1 className="app-header__title">ERP Web</h1>
        <p className="app-header__subtitle">Sistema de gestión de empresas</p>
      </div>

      <div className="app-header__meta">
        <div className="app-header__user">
          <strong>{fullName}</strong>
          <small>{ROLE_LABELS[user?.role] || user?.role || "Sin rol"}</small>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
