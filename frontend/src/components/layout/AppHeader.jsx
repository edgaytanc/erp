import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  CheckCheck,
  Menu,
  AlertTriangle,
  Package,
  Info,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  unwrapResults,
} from "../../features/system/api/notificationsApi";

const ROLE_LABELS = {
  admin: "Administrador",
  purchases: "Encargado de Compras",
  sales: "Vendedor",
};

/**
 * Formatea una fecha ISO a un formato amigable en español.
 */
function formatNotificationDate(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) {
      return "Hace un momento";
    }
    if (diffMin < 60) {
      return `Hace ${diffMin} min`;
    }
    if (diffHours < 24) {
      return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    }
    if (diffDays === 1) {
      const timeStr = date.toLocaleTimeString("es-GT", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Ayer, ${timeStr}`;
    }
    if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    }

    return date.toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Retorna el icono apropiado según el tipo de notificación.
 */
function getNotificationIcon(type) {
  switch (type) {
    case "LOW_STOCK":
      return <AlertTriangle size={18} className="notification-icon--warning" />;
    case "NEW_PURCHASE":
      return <Package size={18} className="notification-icon--info" />;
    default:
      return <Info size={18} className="notification-icon--default" />;
  }
}

export function AppHeader({ isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const notificationsRef = useRef(null);

  const fullName = useMemo(() => {
    const name = [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || user?.username || "Usuario";
  }, [user]);

  // Carga inicial y sondeo periódico de notificaciones cada 60 segundos
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function fetchNotifications() {
      try {
        const data = await listNotifications();
        if (isMounted) {
          const items = unwrapResults(data);
          setNotifications(items);
          setUnreadCount(items.filter((item) => !item.is_read).length);
        }
      } catch (err) {
        console.error("Error al cargar notificaciones:", err);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Cerrar el dropdown al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationsOpen]);

  // Marcar una notificación individual como leída
  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error al marcar notificación como leída:", err);
      }
    }

    // Redirección contextual según el tipo de notificación
    if (notification.notification_type === "LOW_STOCK") {
      setIsNotificationsOpen(false);
      navigate("/inventory");
    } else if (notification.notification_type === "NEW_PURCHASE") {
      setIsNotificationsOpen(false);
      navigate("/purchases");
    }
  };

  // Marcar todas las notificaciones como leídas
  const handleMarkAllAsRead = async (event) => {
    event.stopPropagation();
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true })),
      );
      setUnreadCount(0);
    } catch (err) {
      console.error(
        "Error al marcar todas las notificaciones como leídas:",
        err,
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Notificaciones ordenadas cronológicamente (más recientes primero)
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [notifications]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          className="app-header__mobile-toggle"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          <Menu size={24} />
        </button>
        <div>
          <h1 className="app-header__title">ERP Web</h1>
          <p className="app-header__subtitle">Sistema de gestión de empresas</p>
        </div>
      </div>

      <div className="app-header__meta">
        {user && (
          <div
            className="app-header__notifications"
            ref={notificationsRef}
          >
            <button
              type="button"
              className={`app-header__bell-btn ${
                isNotificationsOpen ? "app-header__bell-btn--active" : ""
              }`}
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              aria-label="Notificaciones"
              aria-expanded={isNotificationsOpen}
              title="Notificaciones"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="app-header__badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div
                className="notifications-dropdown"
                role="dialog"
                aria-label="Panel de notificaciones"
              >
                <div className="notifications-dropdown__header">
                  <div className="notifications-dropdown__title-group">
                    <h3 className="notifications-dropdown__title">
                      Notificaciones
                    </h3>
                    {unreadCount > 0 && (
                      <span className="notifications-dropdown__unread-badge">
                        {unreadCount} {unreadCount === 1 ? "nueva" : "nuevas"}
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="notifications-dropdown__mark-all-btn"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll}
                      title="Marcar todas como leídas"
                    >
                      <CheckCheck size={15} />
                      <span>
                        {isMarkingAll
                          ? "Marcando..."
                          : "Marcar todas como leídas"}
                      </span>
                    </button>
                  )}
                </div>

                <div className="notifications-dropdown__body">
                  {sortedNotifications.length === 0 ? (
                    <div className="notifications-dropdown__empty">
                      <div className="notifications-dropdown__empty-icon">
                        <BellOff size={32} />
                      </div>
                      <p className="notifications-dropdown__empty-title">
                        No tienes notificaciones
                      </p>
                      <span className="notifications-dropdown__empty-subtitle">
                        Te avisaremos cuando haya novedades en tu sucursal.
                      </span>
                    </div>
                  ) : (
                    <ul className="notifications-dropdown__list">
                      {sortedNotifications.map((notif) => (
                        <li
                          key={notif.id}
                          className={`notifications-dropdown__item ${
                            !notif.is_read
                              ? "notifications-dropdown__item--unread"
                              : ""
                          }`}
                          onClick={() => handleNotificationClick(notif)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleNotificationClick(notif);
                            }
                          }}
                        >
                          <div className="notifications-dropdown__item-icon">
                            {getNotificationIcon(notif.notification_type)}
                          </div>

                          <div className="notifications-dropdown__item-content">
                            <div className="notifications-dropdown__item-top">
                              <span className="notifications-dropdown__item-title">
                                {notif.title}
                              </span>
                              {!notif.is_read && (
                                <span
                                  className="notifications-dropdown__item-dot"
                                  title="No leída"
                                  aria-label="No leída"
                                />
                              )}
                            </div>

                            <p
                              className="notifications-dropdown__item-message"
                              title={notif.message}
                            >
                              {notif.message}
                            </p>

                            <div className="notifications-dropdown__item-footer">
                              <span className="notifications-dropdown__item-date">
                                {formatNotificationDate(notif.created_at)}
                              </span>
                              {notif.branch_name && (
                                <span className="notifications-dropdown__item-branch">
                                  {notif.branch_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
