import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { APP_ROLES } from "../../auth/constants/roles";
import {
  listStocks,
  unwrapResults as unwrapInventoryResults,
} from "../../inventory/api/inventoryApi";
import {
  listPurchases,
  listSuppliers,
  unwrapResults as unwrapPurchaseResults,
} from "../../purchases/api/purchasesApi";
import {
  closeCashRegister,
  getCurrentCashRegister,
  listSales,
  openCashRegister,
} from "../../pos/api/salesApi";
import {
  getInventoryReport,
  getPurchasesReport,
  getSalesReport,
} from "../../reports/api/reportsApi";

import { unwrap } from "../components/DashboardCommon";
import AdminDashboardView from "../components/AdminDashboardView";
import CashierDashboardView from "../components/CashierDashboardView";
import PurchasesDashboardView from "../components/PurchasesDashboardView";

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

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const requests = [];

        if (role === APP_ROLES.ADMIN) {
          requests.push(
            getSalesReport().then((value) => ["salesReport", value]),
            getPurchasesReport().then((value) => ["purchasesReport", value]),
            getInventoryReport().then((value) => ["inventoryReport", value]),
            listSales().then((value) => ["sales", unwrap(value)]),
            listPurchases().then((value) => [
              "purchases",
              unwrapPurchaseResults(value),
            ]),
            listSuppliers().then((value) => [
              "suppliers",
              unwrapPurchaseResults(value),
            ]),
            listStocks({ low: "true", page_size: 8 }).then((value) => [
              "lowStock",
              unwrapInventoryResults(value),
            ]),
          );
          if (user?.branch) {
            requests.push(
              getCurrentCashRegister().then((value) => [
                "cashRegisterSession",
                value.session,
              ]),
            );
          }
        }

        if (role === APP_ROLES.PURCHASES) {
          const stockParams = user?.branch
            ? { branch: user.branch, low: "true", page_size: 8 }
            : { low: "true", page_size: 8 };
          requests.push(
            listPurchases().then((value) => [
              "purchases",
              unwrapPurchaseResults(value),
            ]),
            listSuppliers().then((value) => [
              "suppliers",
              unwrapPurchaseResults(value),
            ]),
            listStocks(stockParams).then((value) => [
              "lowStock",
              unwrapInventoryResults(value),
            ]),
          );
        }

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
  }, [role, user?.branch]);

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
    if (role === APP_ROLES.PURCHASES) return "Dashboard de compras";
    if (role === APP_ROLES.SALES) return "Dashboard POS";
    return "Dashboard administrativo";
  }, [role]);

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

      {!isLoading && !error && role === APP_ROLES.ADMIN ? (
        <AdminDashboardView
          data={data}
          isCashRegisterBusy={isCashRegisterBusy}
          onCloseCashRegister={handleCloseCashRegister}
          onOpenCashRegister={handleOpenCashRegister}
          user={user}
        />
      ) : null}
      {!isLoading && !error && role === APP_ROLES.PURCHASES ? (
        <PurchasesDashboardView data={data} />
      ) : null}
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
