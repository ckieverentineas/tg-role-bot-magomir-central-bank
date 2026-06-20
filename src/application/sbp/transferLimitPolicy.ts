import {
  checkRangedLimit,
  type LimitCheckResult,
  type LimitUsageEntry,
  type LimitWindow
} from "../../domain/limits/limitPolicy.js";

export type SbpTransferLimitPolicy = {
  minAmount: number;
  maxAmount: number;
  periodAmountLimit?: number;
  window: LimitWindow;
};

export function checkSbpTransferLimit(
  policy: SbpTransferLimitPolicy,
  amount: number,
  transfers: readonly LimitUsageEntry[],
  now = new Date()
): LimitCheckResult {
  return checkRangedLimit(
    {
      minValue: policy.minAmount,
      maxValue: policy.maxAmount,
      ...(policy.periodAmountLimit !== undefined ? { periodLimit: policy.periodAmountLimit } : {}),
      window: policy.window
    },
    amount,
    transfers,
    now
  );
}
