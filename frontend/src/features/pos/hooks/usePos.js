import { useCallback, useEffect, useReducer, useRef } from "react";

import { useProductSearch } from "./useProductSearch";
import { useSaleActions } from "./useSaleActions";
import { useSaleDraft } from "./useSaleDraft";
import { usePosKeyboard } from "./usePosKeyboard";
import { useAuth } from "../../../contexts/AuthContext";
import { getCurrentCashRegister } from "../api/salesApi";
import { POS_ACTIONS } from "../state/posActions";
import { posInitialState } from "../state/posInitialState";
import { posReducer } from "../state/posReducer";

export function usePos() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(posReducer, posInitialState);
  const searchInputRef = useRef(null);
  const productSearch = useProductSearch({ branchId: state.branchId, searchTerm: state.searchTerm });
  const saleDraft = useSaleDraft({ dispatch, state });
  const saleActions = useSaleActions({ state, dispatch, syncDraftNow: saleDraft.syncDraftNow });

  useEffect(() => {
    dispatch({
      type: POS_ACTIONS.SET_BRANCH_CONTEXT,
      payload: {
        branchId: user?.branch || "",
        branchName: user?.branch_name || "",
      },
    });
  }, [user?.branch, user?.branch_name]);

  useEffect(() => {
    let isActive = true;

    async function loadCashRegister() {
      dispatch({
        type: POS_ACTIONS.SET_CASH_REGISTER,
        payload: { session: null, isLoading: true },
      });

      try {
        const response = await getCurrentCashRegister();
        if (!isActive) return;
        dispatch({
          type: POS_ACTIONS.SET_CASH_REGISTER,
          payload: { session: response.session, isLoading: false },
        });
      } catch (error) {
        if (!isActive) return;
        dispatch({
          type: POS_ACTIONS.SET_CASH_REGISTER,
          payload: { session: null, isLoading: false },
        });
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "No se pudo validar si la caja esta abierta.",
        });
      }
    }

    if (user?.branch) {
      loadCashRegister();
    } else {
      dispatch({
        type: POS_ACTIONS.SET_CASH_REGISTER,
        payload: { session: null, isLoading: false },
      });
    }

    return () => {
      isActive = false;
    };
  }, [user?.branch]);

  useEffect(() => {
    dispatch({ type: POS_ACTIONS.SET_RESULTS, payload: productSearch.results });
  }, [productSearch.results]);

  useEffect(() => {
    if (productSearch.error) {
      dispatch({ type: POS_ACTIONS.SET_ERROR, payload: productSearch.error });
    }
  }, [productSearch.error]);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const setSearchTerm = useCallback((value) => {
    dispatch({ type: POS_ACTIONS.SET_SEARCH_TERM, payload: value });
  }, []);

  const setSelectedResultIndex = useCallback((index) => {
    dispatch({ type: POS_ACTIONS.SET_SELECTED_RESULT_INDEX, payload: index });
  }, []);

  const addProduct = useCallback(
    (product) => {
      if (!product) {
        return;
      }

      if (state.lastConfirmedSale) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "Inicia una nueva venta antes de agregar mas productos.",
        });
        return;
      }

      if (!state.cashRegisterSession) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "Debes abrir caja antes de agregar productos.",
        });
        return;
      }

      if (product.stock !== null && product.stock <= 0) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "Este producto no tiene stock disponible en la sucursal.",
        });
        return;
      }

      const existingItem = state.cartItems.find((item) => item.productId === product.id);

      if (product.stock !== null && existingItem && existingItem.quantity >= product.stock) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "Stock insuficiente para agregar otra unidad de este producto.",
        });
        return;
      }

      dispatch({
        type: POS_ACTIONS.ADD_ITEM,
        payload: {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          stock: product.stock,
          unitPrice: product.price,
          quantity: 1,
        },
      });
      dispatch({ type: POS_ACTIONS.SET_SEARCH_TERM, payload: "" });
      focusSearch();
    },
    [focusSearch, state.cartItems, state.cashRegisterSession, state.lastConfirmedSale],
  );

  const updateQuantity = useCallback(
    (productId, quantity) => {
      const item = state.cartItems.find((cartItem) => cartItem.productId === productId);

      if (item && item.stock !== null && Number(quantity) > item.stock) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload: "La cantidad solicitada supera el stock disponible.",
        });
        return;
      }

      dispatch({
        type: POS_ACTIONS.UPDATE_ITEM_QUANTITY,
        payload: { productId, quantity },
      });
    },
    [state.cartItems],
  );

  const removeItem = useCallback((productId) => {
    dispatch({ type: POS_ACTIONS.REMOVE_ITEM, payload: productId });
  }, []);

  const setPaymentMethod = useCallback((paymentMethod) => {
    dispatch({ type: POS_ACTIONS.SET_PAYMENT_METHOD, payload: paymentMethod });
  }, []);

  usePosKeyboard({
    onConfirm: saleActions.confirmSale,
    onClear: saleActions.clearSale,
    onSearchFocus: focusSearch,
  });

  return {
    state,
    searchInputRef,
    actions: {
      ...saleActions,
      addProduct,
      focusSearch,
      removeItem,
      setPaymentMethod,
      setSearchTerm,
      setSelectedResultIndex,
      updateQuantity,
    },
    isProductSearchLoading: productSearch.isLoading,
  };
}
