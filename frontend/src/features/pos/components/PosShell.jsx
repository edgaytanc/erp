import { useState } from "react";

import { BranchPanel } from "./BranchPanel";
import { CancelSaleModal } from "./CancelSaleModal";
import { CartPanel } from "./CartPanel";
import { CartTotals } from "./CartTotals";
import { PaymentPanel } from "./PaymentPanel";
import { ProductSearch } from "./ProductSearch";
import { SaleActions } from "./SaleActions";
import { SaleErrorBanner } from "./SaleErrorBanner";
import { SaleStatusBar } from "./SaleStatusBar";
import { TicketPreview } from "./TicketPreview";

export function PosShell({ actions, isProductSearchLoading, searchInputRef, state }) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const canConfirm = state.cartItems.length > 0 && state.syncStatus !== "syncing";
  const canCancel = state.lastConfirmedSale?.status === "CONFIRMED";

  function handleCancelConfirm(reason) {
    actions.cancelSale(reason);
    setIsCancelModalOpen(false);
  }

  return (
    <div className="pos-shell">
      <SaleStatusBar cartCount={state.cartItems.length} draftSaleId={state.draftSaleId} status={state.syncStatus} />
      <SaleErrorBanner message={state.lastError} />

      <div className="pos-shell__grid">
        <div className="pos-shell__left">
          <BranchPanel branchId={state.branchId} branchName={state.branchName} />
          <ProductSearch
            disabled={!state.branchId || Boolean(state.lastConfirmedSale)}
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
            onConfirm={actions.confirmSale}
          />
          <TicketPreview ticket={state.ticketData} />
        </aside>
      </div>

      <CancelSaleModal
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        open={isCancelModalOpen}
      />
    </div>
  );
}
