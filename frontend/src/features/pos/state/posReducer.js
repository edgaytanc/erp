import { POS_ACTIONS } from "./posActions";
import { posInitialState } from "./posInitialState";

export function posReducer(state, action) {
  switch (action.type) {
    case POS_ACTIONS.SET_SEARCH_TERM:
      return { ...state, searchTerm: action.payload };
    case POS_ACTIONS.SET_RESULTS:
      return { ...state, searchResults: action.payload };
    case POS_ACTIONS.ADD_ITEM:
      return { ...state, cartItems: [...state.cartItems, action.payload] };
    case POS_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        cartItems: state.cartItems.filter((item) => item.id !== action.payload),
      };
    case POS_ACTIONS.SET_PAYMENT_METHOD:
      return { ...state, paymentMethod: action.payload };
    case POS_ACTIONS.SET_ERROR:
      return { ...state, lastError: action.payload };
    case POS_ACTIONS.RESET:
      return posInitialState;
    default:
      return state;
  }
}
