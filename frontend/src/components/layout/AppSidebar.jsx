import { NavLink } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { APP_ROLES } from "../../features/auth/constants/roles";

const NAV_ITEMS = [
  { to: "/app", label: "Inicio", roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES, APP_ROLES.SALES] },
  { to: "/inventory", label: "Inventario", roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES] },
  { to: "/purchases", label: "Compras", roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES] },
  { to: "/pos", label: "Ventas POS", roles: [APP_ROLES.ADMIN, APP_ROLES.SALES] },
  { to: "/reports", label: "Reportes", roles: [APP_ROLES.ADMIN] },
];

export function AppSidebar() {
  const { user } = useAuth();
  const allowedItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-badge">ERP</span>
        <div>
          <strong>Gestión Comercial</strong>
          <small>React + Django REST</small>
        </div>
      </div>

      <nav className="sidebar__nav">
        {allowedItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
