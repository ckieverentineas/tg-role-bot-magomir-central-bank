export const TRANSFER_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED"
} as const;

export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];
