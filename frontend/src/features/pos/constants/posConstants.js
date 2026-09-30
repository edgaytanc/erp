export const SYNC_STATUS = Object.freeze({
  IDLE: "idle",
  SYNCING: "syncing",
  CONFIRMED: "confirmed",
  ERROR: "error",
  CANCELLED: "cancelled",
});

export const PAYMENT_METHODS = Object.freeze({
  CASH: "CASH",
  CARD: "CARD",
  TRANSFER: "TRANSFER",
});

export const SALE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  VOID: "VOID",
});
