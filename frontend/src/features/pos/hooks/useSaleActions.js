import { useCallback } from "react";

import { confirmSale as confirmSaleRequest, voidSale } from "../api/salesApi";
import { getSaleTicket } from "../api/ticketApi";
import { POS_ACTIONS } from "../state/posActions";
import { getPosErrorMessage } from "../utils/posErrors";

export function useSaleActions({ state, dispatch, syncDraftNow }) {
  const confirmSale = useCallback(async (paymentDetails = {}) => {
    if (state.cartItems.length === 0) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: "Agrega al menos un producto antes de confirmar la venta.",
      });
      return;
    }

    if (!state.branchId) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: "Configura la sucursal antes de confirmar la venta.",
      });
      return;
    }

    if (!state.cashRegisterSession) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: "Debes abrir caja antes de confirmar ventas.",
      });
      return;
    }

    dispatch({ type: POS_ACTIONS.SET_SYNC_STATUS, payload: "syncing" });

    try {
      const draftSale = await syncDraftNow();
      const saleId = draftSale?.id || state.draftSaleId;

      if (!saleId) {
        return;
      }

      const confirmPayload =
        state.paymentMethod === "CASH"
          ? { cash_received: paymentDetails.cashReceived }
          : {};
      const confirmedSale = await confirmSaleRequest(saleId, confirmPayload);
      const ticket = await getSaleTicket(saleId);

      dispatch({ type: POS_ACTIONS.SET_CONFIRMED_SALE, payload: confirmedSale });
      dispatch({ type: POS_ACTIONS.SET_TICKET, payload: ticket });
      dispatch({ type: POS_ACTIONS.CLEAR_ERROR });
    } catch (error) {
      dispatch({ type: POS_ACTIONS.SET_ERROR, payload: getPosErrorMessage(error) });
    }
  }, [
    dispatch,
    state.branchId,
    state.cartItems,
    state.cashRegisterSession,
    state.draftSaleId,
    state.paymentMethod,
    syncDraftNow,
  ]);

  const clearSale = useCallback(() => {
    dispatch({ type: POS_ACTIONS.RESET });
  }, [dispatch]);

  const cancelSale = useCallback(async (reason = "") => {
    if (!state.lastConfirmedSale) {
      dispatch({
        type: POS_ACTIONS.SET_ERROR,
        payload: "Solo puedes anular una venta confirmada.",
      });
      return;
    }
    dispatch({ type: POS_ACTIONS.SET_SYNC_STATUS, payload: "syncing" });

    try {
      const cancelledSale = await voidSale(state.lastConfirmedSale.id, { reason });
      const ticket = await getSaleTicket(state.lastConfirmedSale.id);

      dispatch({ type: POS_ACTIONS.SET_CONFIRMED_SALE, payload: cancelledSale });
      dispatch({ type: POS_ACTIONS.SET_SYNC_STATUS, payload: "cancelled" });
      dispatch({ type: POS_ACTIONS.SET_TICKET, payload: ticket });
      dispatch({ type: POS_ACTIONS.CLEAR_ERROR });
    } catch (error) {
      dispatch({ type: POS_ACTIONS.SET_ERROR, payload: getPosErrorMessage(error) });
    }
  }, [dispatch, state.lastConfirmedSale]);

  return {
    confirmSale,
    clearSale,
    cancelSale,
  };
}
