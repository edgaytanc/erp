import { NavLink } from "react-router-dom";
import {
  Home,
  Package,
  ShoppingCart,
  Monitor,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { APP_ROLES } from "../../features/auth/constants/roles";

const NAV_ITEMS = [
  {
    to: "/app",
    label: "Inicio",
    roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES, APP_ROLES.SALES],
    icon: Home,
  },
  {
    to: "/inventory",
    label: "Inventario",
    roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES],
    icon: Package,
  },
  {
    to: "/purchases",
    label: "Compras",
    roles: [APP_ROLES.ADMIN, APP_ROLES.PURCHASES],
    icon: ShoppingCart,
  },
  {
    to: "/pos",
    label: "Ventas POS",
    roles: [APP_ROLES.ADMIN, APP_ROLES.SALES],
    icon: Monitor,
  },
  {
    to: "/reports",
    label: "Reportes",
    roles: [APP_ROLES.ADMIN],
    icon: BarChart3,
  },
  {
    to: "/admin/config",
    label: "Configuracion",
    roles: [APP_ROLES.ADMIN],
    icon: Settings,
  },
];

export function AppSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) {
  const { user } = useAuth();
  const allowedItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role),
  );

  return (
    <aside
      className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""} ${isMobileOpen ? "sidebar--open" : ""}`}
    >
      <div className="sidebar__brand">
        <span className="sidebar__brand-badge">ERP</span>
        <div className="sidebar__brand-text">
          <strong>Gestión Comercial</strong>
        </div>
      </div>

      <nav className="sidebar__nav">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              {Icon && <Icon size={20} className="sidebar__link-icon" />}
              <span className="sidebar__link-text">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        className="sidebar__collapse-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </aside>
  );
}
