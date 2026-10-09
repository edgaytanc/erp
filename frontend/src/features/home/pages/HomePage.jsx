// frontend/src/features/home/pages/HomePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { APP_ROLES } from "../../auth/constants/roles";
import {
  closeCashRegister,
  getCurrentCashRegister,
  listSales,
  openCashRegister,
} from "../../pos/api/salesApi";

import { unwrap } from "../components/DashboardCommon";
import CashierDashboardView from "../components/CashierDashboardView";
import DashboardPage from "../../dashboard/pages/DashboardPage";

export function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState({
    sales: [],
    purchases: [],
    suppliers: [],
    lowStock: [],
    salesReport: null,
    purchasesReport: null,
    inventoryReport: null,
    cashRegisterSession: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCashRegisterBusy, setIsCashRegisterBusy] = useState(false);
  const [error, setError] = useState("");

  const role = user?.role;
  const isPurchasingOrAdmin =
    role === APP_ROLES.ADMIN ||
    role === APP_ROLES.PURCHASES ||
    role === "purchasing";

  useEffect(() => {
    let isActive = true;

    // Para Admin y Compras, DashboardPage gestiona su propia carga optimizada vía API dedicada
    if (isPurchasingOrAdmin) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const requests = [];

        if (role === APP_ROLES.SALES) {
          requests.push(
            listSales().then((value) => ["sales", unwrap(value)]),
            getCurrentCashRegister().then((value) => [
              "cashRegisterSession",
              value.session,
            ]),
          );
        }

        const results = await Promise.all(requests);

        if (!isActive) return;

        setData((current) => ({
          ...current,
          sales: [],
          purchases: [],
          suppliers: [],
          lowStock: [],
          salesReport: null,
          purchasesReport: null,
          inventoryReport: null,
          cashRegisterSession: null,
          ...Object.fromEntries(results),
        }));
      } catch (loadError) {
        if (!isActive) return;
        setError(
          loadError?.response?.data?.detail ||
            "No se pudo cargar la información del dashboard.",
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [role, isPurchasingOrAdmin, user?.branch]);

  async function handleOpenCashRegister(amount) {
    setIsCashRegisterBusy(true);
    setError("");

    try {
      const session = await openCashRegister({ opening_amount: amount });
      setData((current) => ({ ...current, cashRegisterSession: session }));
      return true;
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo abrir caja."));
      return false;
    } finally {
      setIsCashRegisterBusy(false);
    }
  }

  async function handleCloseCashRegister(amount) {
    setIsCashRegisterBusy(true);
    setError("");

    try {
      const session = await closeCashRegister({ closing_amount: amount });
      setData((current) => ({ ...current, cashRegisterSession: session }));
      return true;
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cerrar caja."));
      return false;
    } finally {
      setIsCashRegisterBusy(false);
    }
  }

  const title = useMemo(() => {
    if (role === APP_ROLES.PURCHASES || role === "purchasing")
      return "Dashboard de compras";
    if (role === APP_ROLES.SALES) return "Dashboard POS";
    return "Dashboard administrativo";
  }, [role]);

  // Si el usuario es Administrador o Encargado de Compras, renderizamos el DashboardPage rediseñado
  if (isPurchasingOrAdmin) {
    return <DashboardPage />;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p>Inicio</p>
          <h1>{title}</h1>
        </div>
        <span>{user?.branch_name || "Todas las sucursales"}</span>
      </header>

      {isLoading ? (
        <div className="dashboard-loading">Cargando información...</div>
      ) : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!isLoading && !error && role === APP_ROLES.SALES ? (
        <CashierDashboardView
          data={data}
          isCashRegisterBusy={isCashRegisterBusy}
          onCloseCashRegister={handleCloseCashRegister}
          onOpenCashRegister={handleOpenCashRegister}
          user={user}
        />
      ) : null}
    </div>
  );
}

export default HomePage;
