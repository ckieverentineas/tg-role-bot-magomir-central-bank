import type { PrismaClient, SbpTransferRule } from "@prisma/client";
import { parseLimitPeriodKind } from "../../domain/limits/limitPeriodKind.js";
import { TRANSFER_STATUS } from "../../domain/transfers/transferStatus.js";
import { getWindowStart, type LimitCheckResult, type LimitUsageEntry } from "../../domain/limits/limitPolicy.js";
import { mapLimitWindow } from "../limits/limitWindowMapper.js";
import { checkSbpTransferLimit, type SbpTransferLimitPolicy } from "./transferLimitPolicy.js";

export type CheckSbpTransferInput = {
  allianceId: number;
  currencyId: number;
  senderUserId: number;
  amount: number;
  now?: Date;
};

type SbpTransferLimitDatabase = Pick<PrismaClient, "sbpTransferRule" | "sbpTransfer">;

type DecimalLike = {
  toNumber(): number;
};

export class SbpTransferLimitService {
  public constructor(private readonly db: SbpTransferLimitDatabase) {}

  public async checkTransfer(input: CheckSbpTransferInput): Promise<LimitCheckResult> {
    const now = input.now ?? new Date();
    const rule = await this.findTransferRule(input.allianceId, input.currencyId);
    const policy = rule ? mapRuleToPolicy(rule) : getDefaultPolicy();
    const windowStart = getWindowStart(policy.window, now);

    const transfers = await this.db.sbpTransfer.findMany({
      where: {
        allianceId: input.allianceId,
        currencyId: input.currencyId,
        senderUserId: input.senderUserId,
        status: TRANSFER_STATUS.COMPLETED,
        createdAt: {
          gte: windowStart
        }
      },
      select: {
        amount: true,
        createdAt: true
      }
    });

    return checkSbpTransferLimit(policy, input.amount, mapTransfersToUsage(transfers), now);
  }

  private async findTransferRule(allianceId: number, currencyId: number): Promise<SbpTransferRule | null> {
    return this.db.sbpTransferRule.findFirst({
      where: {
        allianceId,
        isActive: true,
        OR: [{ currencyId }, { currencyId: null }]
      },
      orderBy: [{ currencyId: "desc" }, { updatedAt: "desc" }]
    });
  }
}

function mapRuleToPolicy(rule: SbpTransferRule): SbpTransferLimitPolicy {
  return {
    minAmount: toNumber(rule.minAmount),
    maxAmount: toNumber(rule.maxAmount),
    ...(rule.periodAmountLimit ? { periodAmountLimit: toNumber(rule.periodAmountLimit) } : {}),
    window: mapLimitWindow({
      periodKind: parseLimitPeriodKind(rule.periodKind),
      periodSeconds: rule.periodSeconds,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt
    })
  };
}

function getDefaultPolicy(): SbpTransferLimitPolicy {
  return {
    minAmount: 0,
    maxAmount: Number.MAX_SAFE_INTEGER,
    window: { kind: "unlimited" }
  };
}

function mapTransfersToUsage(transfers: readonly { amount: DecimalLike; createdAt: Date }[]): LimitUsageEntry[] {
  return transfers.map((transfer) => ({
    value: toNumber(transfer.amount),
    occurredAt: transfer.createdAt
  }));
}

function toNumber(value: DecimalLike): number {
  return value.toNumber();
}
