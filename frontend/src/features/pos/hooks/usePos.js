import { useCallback, useEffect, useReducer, useRef } from "react";

import { useProductSearch } from "./useProductSearch";
import { useSaleActions } from "./useSaleActions";
import { useSaleDraft } from "./useSaleDraft";

import { useAuth } from "../../../contexts/AuthContext";
import { getCurrentCashRegister } from "../api/salesApi";
import { searchPosProducts } from "../api/productsApi";
import { POS_ACTIONS } from "../state/posActions";
import { posInitialState } from "../state/posInitialState";
import { posReducer } from "../state/posReducer";

export function usePos() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(posReducer, posInitialState);
  const searchInputRef = useRef(null);
  const productSearch = useProductSearch({
    branchId: state.branchId,
    searchTerm: state.searchTerm,
  });
  const saleDraft = useSaleDraft({ dispatch, state });
  const saleActions = useSaleActions({
    state,
    dispatch,
    syncDraftNow: saleDraft.syncDraftNow,
  });

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
    requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select?.();
      }
    });
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

      const existingItem = state.cartItems.find(
        (item) => item.productId === product.id,
      );

      if (
        product.stock !== null &&
        existingItem &&
        existingItem.quantity >= product.stock
      ) {
        dispatch({
          type: POS_ACTIONS.SET_ERROR,
          payload:
            "Stock insuficiente para agregar otra unidad de este producto.",
        });
        return;
      }

      const branchPrice =
        product.branch_price !== undefined && product.branch_price !== null
          ? product.branch_price
          : product.sale_price !== undefined && product.sale_price !== null
            ? product.sale_price
            : product.price !== undefined && product.price !== null
              ? product.price
              : product.unitPrice ?? 0;

      dispatch({
        type: POS_ACTIONS.ADD_ITEM,
        payload: {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          stock: product.stock,
          unitPrice: Number(branchPrice),
          branch_price: Number(branchPrice),
          sale_price: Number(branchPrice),
          price: Number(branchPrice),
          quantity: 1,
        },
      });
      dispatch({ type: POS_ACTIONS.SET_SEARCH_TERM, payload: "" });
      focusSearch();
    },
    [
      focusSearch,
      state.cartItems,
      state.cashRegisterSession,
      state.lastConfirmedSale,
    ],
  );

  const updateQuantity = useCallback(
    (productId, quantity, shouldFocus = true) => {
      const item = state.cartItems.find(
        (cartItem) => cartItem.productId === productId,
      );

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

      if (shouldFocus) {
        focusSearch();
      }
    },
    [focusSearch, state.cartItems],
  );

  const removeItem = useCallback(
    (productId) => {
      dispatch({ type: POS_ACTIONS.REMOVE_ITEM, payload: productId });
      focusSearch();
    },
    [focusSearch],
  );

  const setPaymentMethod = useCallback((paymentMethod) => {
    dispatch({ type: POS_ACTIONS.SET_PAYMENT_METHOD, payload: paymentMethod });
  }, []);

  const submitSearch = useCallback(
    async (termOverride) => {
      const rawTerm =
        termOverride !== undefined ? termOverride : state.searchTerm;
      const term = (rawTerm || "").trim();

      const findExactMatch = (items) => {
        if (!Array.isArray(items) || items.length === 0) return null;
        const lowerTerm = term.toLowerCase();
        return (
          items.find((p) => {
            const skuMatch =
              p.sku && String(p.sku).trim().toLowerCase() === lowerTerm;
            const barcodeMatch =
              p.barcode && String(p.barcode).trim().toLowerCase() === lowerTerm;
            const nameMatch =
              p.name && String(p.name).trim().toLowerCase() === lowerTerm;
            return skuMatch || barcodeMatch || nameMatch;
          }) || null
        );
      };

      if (!term) {
        const selectedProduct = state.searchResults[state.selectedResultIndex];
        if (selectedProduct) {
          addProduct(selectedProduct);
        }
        return;
      }

      // 1. Coincidencia exacta en la lista actual de resultados
      const exactInState = findExactMatch(state.searchResults);
      if (exactInState) {
        addProduct(exactInState);
        return;
      }

      // 2. Si es el ÚNICO resultado en la lista actual
      if (state.searchResults.length === 1) {
        addProduct(state.searchResults[0]);
        return;
      }

      // 3. Si no hay coincidencia exacta o los resultados están desfasados por ráfaga rápida de escáner
      // Realizamos búsqueda directa inmediata a la API sin esperar el debounce
      try {
        if (state.branchId) {
          const directProducts = await searchPosProducts({
            branchId: state.branchId,
            q: term,
            pageSize: 10,
          });

          const directExact = findExactMatch(directProducts);
          if (directExact) {
            addProduct(directExact);
            return;
          }

          if (directProducts.length === 1) {
            addProduct(directProducts[0]);
            return;
          }
        }
      } catch (error) {
        // En caso de error de red, continuar con la selección por índice si existiese
      }

      // 4. Si hay múltiples resultados y el cajero navegó/seleccionó uno con las flechas
      const selectedProduct = state.searchResults[state.selectedResultIndex];
      if (selectedProduct) {
        addProduct(selectedProduct);
      }
    },
    [
      addProduct,
      state.branchId,
      state.searchResults,
      state.searchTerm,
      state.selectedResultIndex,
    ],
  );

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
      submitSearch,
      updateQuantity,
    },
    isProductSearchLoading: productSearch.isLoading,
  };
}
