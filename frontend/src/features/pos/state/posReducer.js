import { POS_ACTIONS } from "./posActions";
import { posInitialState } from "./posInitialState";

function calculateVisualTotals(cartItems) {
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
    0,
  );

  return {
    subtotal,
    discount: 0,
    tax: 0,
    total: subtotal,
  };
}

export function posReducer(state, action) {
  switch (action.type) {
    case POS_ACTIONS.SET_SEARCH_TERM:
      return { ...state, searchTerm: action.payload, selectedResultIndex: 0 };
    case POS_ACTIONS.SET_RESULTS:
      return {
        ...state,
        searchResults: action.payload,
        selectedResultIndex: 0,
      };
    case POS_ACTIONS.SET_SELECTED_RESULT_INDEX:
      return {
        ...state,
        selectedResultIndex: Math.max(
          0,
          Math.min(action.payload, state.searchResults.length - 1),
        ),
      };
    case POS_ACTIONS.SET_SYNC_STATUS:
      return { ...state, syncStatus: action.payload };
    case POS_ACTIONS.SET_DRAFT_SALE:
      return {
        ...state,
        draftSale: action.payload,
        draftSaleId: action.payload?.id ?? action.payload?.uuid ?? null,
        serverTotals: {
          subtotal: action.payload?.subtotal ?? state.serverTotals.subtotal,
          discount: state.serverTotals.discount,
          tax: action.payload?.tax ?? state.serverTotals.tax,
          total: action.payload?.total ?? state.serverTotals.total,
        },
      };
    case POS_ACTIONS.SET_BRANCH_ID:
      return {
        ...state,
        branchId: action.payload,
        draftSale: null,
        draftSaleId: null,
        lastError: null,
      };
    case POS_ACTIONS.SET_BRANCH_CONTEXT:
      return {
        ...state,
        branchId: action.payload?.branchId || "",
        branchName: action.payload?.branchName || "",
        draftSale: null,
        draftSaleId: null,
        lastError: null,
      };
    case POS_ACTIONS.SET_CASH_REGISTER:
      return {
        ...state,
        cashRegisterSession: action.payload?.session || null,
        isCashRegisterLoading: Boolean(action.payload?.isLoading),
      };
    case POS_ACTIONS.ADD_ITEM: {
      const product = action.payload;
      const existingItem = state.cartItems.find(
        (item) => item.productId === product.productId,
      );
      const cartItems = existingItem
        ? state.cartItems.map((item) =>
            item.productId === product.productId
              ? { ...item, quantity: item.quantity + product.quantity }
              : item,
          )
        : [...state.cartItems, product];

      return {
        ...state,
        cartItems,
        serverTotals: calculateVisualTotals(cartItems),
        lastError: null,
      };
    }
    case POS_ACTIONS.UPDATE_ITEM_QUANTITY: {
      const cartItems = state.cartItems.map((item) =>
        item.productId === action.payload.productId
          ? {
              ...item,
              quantity: Math.max(1, Number(action.payload.quantity || 1)),
            }
          : item,
      );

      return {
        ...state,
        cartItems,
        serverTotals: calculateVisualTotals(cartItems),
      };
    }
    case POS_ACTIONS.REMOVE_ITEM: {
      const cartItems = state.cartItems.filter(
        (item) => item.productId !== action.payload,
      );

      return {
        ...state,
        cartItems,
        serverTotals: calculateVisualTotals(cartItems),
      };
    }
    case POS_ACTIONS.CLEAR_CART:
      return {
        ...state,
        cartItems: [],
        serverTotals: calculateVisualTotals([]),
        lastConfirmedSale: null,
        ticketData: null,
      };
    case POS_ACTIONS.SET_PAYMENT_METHOD:
      return { ...state, paymentMethod: action.payload };
    case POS_ACTIONS.SET_TOTALS:
      return { ...state, serverTotals: action.payload };
    case POS_ACTIONS.SET_CONFIRMED_SALE:
      return {
        ...state,
        lastConfirmedSale: action.payload,
        serverTotals: {
          subtotal:
            action.payload?.subtotal ??
            action.payload?.totals?.subtotal ??
            state.serverTotals.subtotal,
          discount: state.serverTotals.discount,
          tax:
            action.payload?.tax ??
            action.payload?.totals?.tax ??
            state.serverTotals.tax,
          total:
            action.payload?.total ??
            action.payload?.totals?.total ??
            state.serverTotals.total,
        },
        syncStatus:
          action.payload?.status === "VOID" ? "cancelled" : "confirmed",
      };
    case POS_ACTIONS.SET_TICKET:
      return { ...state, ticketData: action.payload };
    case POS_ACTIONS.SET_ERROR:
      return { ...state, lastError: action.payload, syncStatus: "error" };
    case POS_ACTIONS.CLEAR_ERROR:
      return { ...state, lastError: null };
    case POS_ACTIONS.RESET:
      return {
        ...posInitialState,
        branchId: state.branchId,
        branchName: state.branchName,
        cashRegisterSession: state.cashRegisterSession,
        isCashRegisterLoading: state.isCashRegisterLoading,
      };
    default:
      return state;
  }
}
