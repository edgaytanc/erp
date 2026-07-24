import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";
import {
  listPurchases,
  unwrapResults,
} from "../../features/purchases/api/purchasesApi";

const ROLE_LABELS = {
  admin: "Administrador",
  purchases: "Encargado de Compras",
  sales: "Vendedor",
};

export function AppHeader({ isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = user?.role === "admin";

  const fullName = useMemo(() => {
    const name = [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || user?.username || "Usuario";
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;

    async function fetchPendingPurchases() {
      try {
        const response = await listPurchases({ status: "DRAFT" });
        if (isMounted) {
          setPendingPurchases(unwrapResults(response));
        }
      } catch (err) {
        console.error("Error fetching purchases for notifications", err);
      }
    }

    fetchPendingPurchases();
    // Poll every 30 seconds for new drafts
    const interval = setInterval(fetchPendingPurchases, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

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
        {isAdmin && (
          <div
            className="app-header__notifications"
            style={{ position: "relative" }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                position: "relative",
                padding: "0.6rem 0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>🔔</span>
              {pendingPurchases.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    lineHeight: "1",
                  }}
                >
                  {pendingPurchases.length}
                </span>
              )}
            </Button>

            {showNotifications && (
              <div
                className="card"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "0.5rem",
                  width: "320px",
                  zIndex: 100,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                <div
                  className="card__header"
                  style={{
                    padding: "0.8rem 1rem",
                    borderBottom: "1px solid #e5edf7",
                  }}
                >
                  <h4
                    className="card__title"
                    style={{ fontSize: "0.95rem", margin: 0 }}
                  >
                    Órdenes DRAFT Pendientes
                  </h4>
                </div>
                <div className="card__body" style={{ padding: "0.5rem 1rem" }}>
                  {pendingPurchases.length === 0 ? (
                    <p
                      style={{
                        margin: "1rem 0",
                        color: "#64748b",
                        textAlign: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      No hay órdenes pendientes.
                    </p>
                  ) : (
                    pendingPurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        style={{
                          padding: "0.75rem 0",
                          borderBottom: "1px solid #edf2f7",
                          fontSize: "0.85rem",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontWeight: "600",
                          }}
                        >
                          <span>
                            Factura:{" "}
                            {purchase.invoice_number ||
                              String(purchase.id).slice(0, 8)}
                          </span>
                          <span style={{ color: "#2563eb" }}>
                            Q {Number(purchase.total_cost || 0).toFixed(2)}
                          </span>
                        </div>
                        <div style={{ color: "#64748b", marginTop: "0.15rem" }}>
                          Sucursal: {purchase.branch_name || "N/A"}
                        </div>
                        <div style={{ color: "#64748b" }}>
                          Proveedor: {purchase.supplier_name || "N/A"}
                        </div>
                      </div>
                    ))
                  )}
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/purchases");
                    }}
                    style={{
                      width: "100%",
                      marginTop: "0.75rem",
                      padding: "0.5rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Ir a Compras
                  </Button>
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
