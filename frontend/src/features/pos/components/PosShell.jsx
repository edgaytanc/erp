import { useState } from "react";

import { BranchPanel } from "./BranchPanel";
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

export function PosShell({ actions, isProductSearchLoading, searchInputRef, state }) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCashPaymentModalOpen, setIsCashPaymentModalOpen] = useState(false);
  const hasOpenCashRegister = Boolean(state.cashRegisterSession);
  const canConfirm = state.cartItems.length > 0 && state.syncStatus !== "syncing" && hasOpenCashRegister;
  const canCancel = state.lastConfirmedSale?.status === "CONFIRMED";

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
    <div className="pos-shell">
      <SaleStatusBar cartCount={state.cartItems.length} draftSaleId={state.draftSaleId} status={state.syncStatus} />
      <section className={hasOpenCashRegister ? "pos-cash-status pos-cash-status--open" : "pos-cash-status"}>
        <strong>{hasOpenCashRegister ? "Caja abierta" : "Caja cerrada"}</strong>
        <span>
          {state.isCashRegisterLoading
            ? "Validando caja..."
            : hasOpenCashRegister
              ? `Apertura Q ${Number(state.cashRegisterSession.opening_amount || 0).toFixed(2)}`
              : "Abre caja desde el dashboard POS antes de vender."}
        </span>
      </section>
      <SaleErrorBanner message={state.lastError} />

      <div className="pos-shell__grid">
        <div className="pos-shell__left">
          <BranchPanel branchId={state.branchId} branchName={state.branchName} />
          <ProductSearch
            disabled={!state.branchId || Boolean(state.lastConfirmedSale) || !hasOpenCashRegister}
            inputRef={searchInputRef}
            isLoading={isProductSearchLoading}
            onAddProduct={actions.addProduct}
            onHighlight={actions.setSelectedResultIndex}
            onSearchTermChange={actions.setSearchTerm}
            results={state.searchResults}
            searchTerm={state.searchTerm}
            selectedIndex={state.selectedResultIndex}
          />
          <CartPanel
            items={state.cartItems}
            onRemove={actions.removeItem}
            onUpdateQuantity={actions.updateQuantity}
          />
        </div>

        <aside className="pos-shell__right">
          <CartTotals totals={state.serverTotals} />
          <PaymentPanel onChange={actions.setPaymentMethod} paymentMethod={state.paymentMethod} />
          <SaleActions
            canCancel={canCancel}
            canConfirm={canConfirm}
            onCancel={() => setIsCancelModalOpen(true)}
            onClear={actions.clearSale}
            onConfirm={handleConfirmClick}
          />
          <TicketPreview ticket={state.ticketData} />
        </aside>
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
