export const PURCHASE_STATUS = {
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED"
} as const;

export type PurchaseStatus = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];
