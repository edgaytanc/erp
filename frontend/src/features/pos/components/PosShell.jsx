import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { CancelSaleModal } from "./CancelSaleModal";
import { CartPanel } from "./CartPanel";
import { CartTotals } from "./CartTotals";
import { CashPaymentModal } from "./CashPaymentModal";
import { PaymentPanel } from "./PaymentPanel";
import { ProductSearch } from "./ProductSearch";
import { SaleActions } from "./SaleActions";
import { SaleErrorBanner } from "./SaleErrorBanner";
import { SaleStatusBar } from "./SaleStatusBar";
import { TicketPreview } from "./TicketPreview";
import { usePosKeyboard } from "../hooks/usePosKeyboard";

export function PosShell({
  actions,
  isProductSearchLoading,
  searchInputRef,
  state,
}) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCashPaymentModalOpen, setIsCashPaymentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  const hasOpenCashRegister = Boolean(state.cashRegisterSession);
  const canConfirm =
    state.cartItems.length > 0 &&
    state.syncStatus !== "syncing" &&
    hasOpenCashRegister;
  const canCancel = state.lastConfirmedSale?.status === "CONFIRMED";

  // Focus search input on mount
  useEffect(() => {
    actions.focusSearch();
  }, [actions]);

  // Hook for global keyboard shortcuts
  usePosKeyboard({
    enabled: true,
    onSearchFocus: () => {
      actions.focusSearch();
    },
    onNavigateResults: (direction) => {
      const len = state.searchResults.length;
      if (len === 0) return;
      let nextIndex = state.selectedResultIndex;
      if (direction === "up") {
        nextIndex = nextIndex <= 0 ? len - 1 : nextIndex - 1;
      } else {
        nextIndex = nextIndex >= len - 1 ? 0 : nextIndex + 1;
      }
      actions.setSelectedResultIndex(nextIndex);
    },
    onAddSelectedProduct: () => {
      const selectedProduct = state.searchResults[state.selectedResultIndex];
      if (selectedProduct) {
        actions.addProduct(selectedProduct);
      }
    },
    onConfirm: () => {
      if (isCashPaymentModalOpen) return;
      if (canConfirm) {
        handleConfirmClick();
      }
    },
    onCancel: () => {
      if (isCashPaymentModalOpen) {
        setIsCashPaymentModalOpen(false);
      } else if (isCancelModalOpen) {
        setIsCancelModalOpen(false);
      } else {
        actions.clearSale();
      }
    },
  });

  function handleCancelConfirm(reason) {
    actions.cancelSale(reason);
    setIsCancelModalOpen(false);
  }

  function handleConfirmClick() {
    if (state.paymentMethod === "CASH") {
      setIsCashPaymentModalOpen(true);
      return;
    }

    actions.confirmSale();
  }

  function handleCashPaymentConfirm(paymentDetails) {
    actions.confirmSale(paymentDetails);
    setIsCashPaymentModalOpen(false);
  }

  return (
    <div className="pos-container">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1>POS</h1>
          <p>Interfaz rápida para vendedores y administradores</p>
        </div>
        <Link to="/app">
          <button className="btn-back" type="button">
            Volver al panel
          </button>
        </Link>
      </div>

      {/* Status Bar */}
      <SaleStatusBar
        cartCount={state.cartItems.length}
        draftSaleId={state.draftSaleId}
        status={state.syncStatus}
        branchName={state.branchName}
      />

      {/* Cash Status */}
      <div className={hasOpenCashRegister ? "cash-status open" : "cash-status"}>
        <strong>{hasOpenCashRegister ? "Caja abierta" : "Caja cerrada"}</strong>
        <span>
          {state.isCashRegisterLoading
            ? "Validando caja..."
            : hasOpenCashRegister
              ? `Apertura Q ${Number(state.cashRegisterSession.opening_amount || 0).toFixed(2)}`
              : "Abre caja desde el dashboard POS antes de vender."}
        </span>
      </div>

      {/* Sale Error Banner */}
      <SaleErrorBanner message={state.lastError} />

      {/* Mobile tabs navigation */}
      <div className="pos-tabs">
        <button
          className={`pos-tab-button ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
          type="button"
        >
          🔍 Buscar productos
        </button>
        <button
          className={`pos-tab-button ${activeTab === "cart" ? "active" : ""}`}
          onClick={() => setActiveTab("cart")}
          type="button"
        >
          🛒 Carrito ({state.cartItems.length})
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Left Column */}
        <div
          className={`left-column ${activeTab === "search" ? "show-search" : "show-cart"}`}
        >
          <CartPanel
            items={state.cartItems}
            onRemove={actions.removeItem}
            onUpdateQuantity={actions.updateQuantity}
          />
          <ProductSearch
            disabled={
              !state.branchId ||
              Boolean(state.lastConfirmedSale) ||
              !hasOpenCashRegister
            }
            inputRef={searchInputRef}
            isLoading={isProductSearchLoading}
            onAddProduct={actions.addProduct}
            onHighlight={actions.setSelectedResultIndex}
            onSearchTermChange={actions.setSearchTerm}
            results={state.searchResults}
            searchTerm={state.searchTerm}
            selectedIndex={state.selectedResultIndex}
          />
        </div>

        {/* Right Column */}
        <div
          className={`right-column ${activeTab === "cart" ? "show-right" : "hide-right"}`}
        >
          <CartTotals totals={state.serverTotals} />

          <PaymentPanel
            onChange={actions.setPaymentMethod}
            paymentMethod={state.paymentMethod}
          />

          <TicketPreview ticket={state.ticketData} />

          <SaleActions
            canCancel={canCancel}
            canConfirm={canConfirm}
            onCancel={() => setIsCancelModalOpen(true)}
            onClear={actions.clearSale}
            onConfirm={handleConfirmClick}
          />
        </div>
      </div>

      <CancelSaleModal
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        open={isCancelModalOpen}
      />
      <CashPaymentModal
        onClose={() => setIsCashPaymentModalOpen(false)}
        onConfirm={handleCashPaymentConfirm}
        open={isCashPaymentModalOpen}
        total={state.serverTotals.total}
      />
    </div>
  );
}
