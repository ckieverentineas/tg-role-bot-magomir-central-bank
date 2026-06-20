export type LimitWindow =
  | { kind: "unlimited" }
  | { kind: "rolling"; durationMs: number }
  | { kind: "fixed"; startsAt?: Date; endsAt: Date };

export type LimitUsageEntry = {
  value: number;
  occurredAt: Date;
};

export type RangedLimitPolicy = {
  minValue: number;
  maxValue: number;
  periodLimit?: number;
  window: LimitWindow;
};

export type LimitRejectionReason =
  | "INVALID_VALUE"
  | "INVALID_POLICY"
  | "WINDOW_NOT_STARTED"
  | "WINDOW_EXPIRED"
  | "VALUE_BELOW_MIN"
  | "VALUE_ABOVE_MAX"
  | "PERIOD_LIMIT_EXCEEDED";

export type LimitCheckResult =
  | {
      allowed: true;
      usedInPeriod: number;
      remainingInPeriod?: number;
    }
  | {
      allowed: false;
      reason: LimitRejectionReason;
      message: string;
      usedInPeriod: number;
      remainingInPeriod?: number;
    };

const EPOCH_START = new Date(0);

export function checkRangedLimit(
  policy: RangedLimitPolicy,
  requestedValue: number,
  usage: readonly LimitUsageEntry[],
  now = new Date()
): LimitCheckResult {
  const policyError = validatePolicy(policy);
  if (policyError) {
    return reject("INVALID_POLICY", policyError, 0);
  }

  if (!Number.isFinite(requestedValue) || requestedValue <= 0) {
    return reject("INVALID_VALUE", "Значение лимита должно быть положительным числом.", 0);
  }

  const windowState = getWindowState(policy.window, now);
  if (windowState.status === "not_started") {
    return reject("WINDOW_NOT_STARTED", "Период лимита ещё не начался.", 0);
  }

  if (windowState.status === "expired") {
    return reject("WINDOW_EXPIRED", "Период лимита уже завершён.", 0);
  }

  if (requestedValue < policy.minValue) {
    return reject("VALUE_BELOW_MIN", "Значение меньше минимально разрешённого.", 0);
  }

  if (requestedValue > policy.maxValue) {
    return reject("VALUE_ABOVE_MAX", "Значение больше максимально разрешённого.", 0);
  }

  const usedInPeriod = sumUsageInWindow(usage, windowState.startsAt, now);
  const remainingBeforeRequest = getRemaining(policy.periodLimit, usedInPeriod);

  if (policy.periodLimit !== undefined && usedInPeriod + requestedValue > policy.periodLimit) {
    return reject(
      "PERIOD_LIMIT_EXCEEDED",
      "Значение превышает доступный лимит за период.",
      usedInPeriod,
      remainingBeforeRequest
    );
  }

  return {
    allowed: true,
    usedInPeriod,
    ...(policy.periodLimit !== undefined
      ? { remainingInPeriod: Math.max(0, policy.periodLimit - usedInPeriod - requestedValue) }
      : {})
  };
}

export function getWindowStart(window: LimitWindow, now = new Date()): Date {
  const state = getWindowState(window, now);

  if (state.status !== "active") {
    return EPOCH_START;
  }

  return state.startsAt;
}

function validatePolicy(policy: RangedLimitPolicy): string | null {
  if (!Number.isFinite(policy.minValue) || !Number.isFinite(policy.maxValue)) {
    return "Границы лимита должны быть конечными числами.";
  }

  if (policy.minValue < 0 || policy.maxValue <= 0 || policy.minValue > policy.maxValue) {
    return "Границы лимита заданы некорректно.";
  }

  if (policy.periodLimit !== undefined && (!Number.isFinite(policy.periodLimit) || policy.periodLimit <= 0)) {
    return "Периодический лимит должен быть положительным числом.";
  }

  if (policy.window.kind === "rolling" && (!Number.isFinite(policy.window.durationMs) || policy.window.durationMs <= 0)) {
    return "Длительность периода должна быть положительным числом.";
  }

  if (policy.window.kind === "fixed" && policy.window.startsAt && policy.window.startsAt >= policy.window.endsAt) {
    return "Дата начала периода должна быть раньше даты окончания.";
  }

  return null;
}

function getWindowState(
  window: LimitWindow,
  now: Date
):
  | { status: "active"; startsAt: Date }
  | { status: "not_started" }
  | { status: "expired" } {
  if (window.kind === "unlimited") {
    return { status: "active", startsAt: EPOCH_START };
  }

  if (window.kind === "rolling") {
    return { status: "active", startsAt: new Date(now.getTime() - window.durationMs) };
  }

  const startsAt = window.startsAt ?? EPOCH_START;

  if (now < startsAt) {
    return { status: "not_started" };
  }

  if (now > window.endsAt) {
    return { status: "expired" };
  }

  return { status: "active", startsAt };
}

function sumUsageInWindow(usage: readonly LimitUsageEntry[], startsAt: Date, now: Date): number {
  return usage.reduce((sum, entry) => {
    if (entry.occurredAt < startsAt || entry.occurredAt > now) {
      return sum;
    }

    return sum + entry.value;
  }, 0);
}

function getRemaining(periodLimit: number | undefined, usedInPeriod: number): number | undefined {
  if (periodLimit === undefined) {
    return undefined;
  }

  return Math.max(0, periodLimit - usedInPeriod);
}

function reject(
  reason: LimitRejectionReason,
  message: string,
  usedInPeriod: number,
  remainingInPeriod?: number
): LimitCheckResult {
  return {
    allowed: false,
    reason,
    message,
    usedInPeriod,
    ...(remainingInPeriod !== undefined ? { remainingInPeriod } : {})
  };
}
