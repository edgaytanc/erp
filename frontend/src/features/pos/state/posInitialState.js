import { PAYMENT_METHODS, SYNC_STATUS } from "../constants/posConstants";

export const posInitialState = {
  draftSaleId: null,
  draftSale: null,
  branchId: null,
  branchName: "",
  cashRegisterSession: null,
  isCashRegisterLoading: true,
  searchTerm: "",
  searchResults: [],
  selectedResultIndex: 0,
  cartItems: [],
  paymentMethod: PAYMENT_METHODS.CASH,
  serverTotals: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  },
  syncStatus: SYNC_STATUS.IDLE,
  lastError: null,
  lastConfirmedSale: null,
  ticketData: null,
};
