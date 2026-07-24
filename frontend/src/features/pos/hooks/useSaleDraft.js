import { useCallback, useEffect, useRef } from "react";

import { createSale, updateSale } from "../api/salesApi";
import { POS_ACTIONS } from "../state/posActions";
import { getPosErrorMessage } from "../utils/posErrors";
import { mapSalePayload } from "../utils/mapSalePayload";

export function useSaleDraft({ dispatch, state }) {
  const syncTimerRef = useRef(null);

  const syncDraftNow = useCallback(async () => {
    if (state.cartItems.length === 0) {
      return null;
    }

    if (!state.branchId) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: "Configura la sucursal antes de guardar la venta.",
      });
      return null;
    }

    dispatch({ type: POS_ACTIONS.SET_SYNC_STATUS, payload: "syncing" });

    try {
      const payload = mapSalePayload({
        branchId: state.branchId,
        paymentMethod: state.paymentMethod,
        items: state.cartItems,
      });
      const sale = state.draftSaleId
        ? await updateSale(state.draftSaleId, payload)
        : await createSale(payload);

      dispatch({ type: POS_ACTIONS.SET_DRAFT_SALE, payload: sale });
      dispatch({ type: POS_ACTIONS.SET_SYNC_STATUS, payload: "idle" });
      dispatch({ type: POS_ACTIONS.CLEAR_ERROR });
      return sale;
    } catch (error) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: getPosErrorMessage(error),
      });
      return null;
    }
  }, [
    dispatch,
    state.branchId,
    state.cartItems,
    state.draftSaleId,
    state.paymentMethod,
  ]);

  useEffect(() => {
    window.clearTimeout(syncTimerRef.current);

    if (state.cartItems.length === 0 || state.lastConfirmedSale) {
      return undefined;
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncDraftNow();
    }, 350);

    return () => window.clearTimeout(syncTimerRef.current);
  }, [
    state.cartItems,
    state.lastConfirmedSale,
    state.paymentMethod,
    syncDraftNow,
  ]);

  return {
    syncDraftNow,
  };
}
