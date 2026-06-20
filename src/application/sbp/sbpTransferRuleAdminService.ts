import type { Prisma, PrismaClient } from "@prisma/client";
import type { LimitPeriodInput } from "../limits/limitPeriodInput.js";

const sbpRuleSelect = {
  id: true,
  allianceId: true,
  currencyId: true,
  minAmount: true,
  maxAmount: true,
  periodAmountLimit: true,
  periodKind: true,
  periodSeconds: true,
  startsAt: true,
  endsAt: true,
  isActive: true
} satisfies Prisma.SbpTransferRuleSelect;

export type SbpTransferRuleView = Prisma.SbpTransferRuleGetPayload<{
  select: typeof sbpRuleSelect;
}>;

export type SetSbpTransferRuleInput = {
  allianceId: number;
  currencyId?: number;
  minAmount: number;
  maxAmount: number;
  periodAmountLimit?: number;
  period: LimitPeriodInput;
};

export class SbpTransferRuleAdminService {
  public constructor(private readonly db: PrismaClient) {}

  public async setRule(input: SetSbpTransferRuleInput): Promise<SbpTransferRuleView> {
    validateTransferRule(input);

    return this.db.$transaction(async (tx) => {
      const alliance = await tx.alliance.findUnique({
        where: { id: input.allianceId },
        select: { id: true }
      });

      if (!alliance) {
        throw new Error(`Alliance ${input.allianceId} was not found.`);
      }

      if (input.currencyId !== undefined) {
        const currency = await tx.currency.findFirst({
          where: {
            id: input.currencyId,
            allianceId: input.allianceId
          },
          select: { id: true }
        });

        if (!currency) {
          throw new Error(`Currency ${input.currencyId} was not found in alliance ${input.allianceId}.`);
        }
      }

      await tx.sbpTransferRule.updateMany({
        where: {
          allianceId: input.allianceId,
          currencyId: input.currencyId ?? null,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      return tx.sbpTransferRule.create({
        data: {
          allianceId: input.allianceId,
          currencyId: input.currencyId ?? null,
          minAmount: input.minAmount,
          maxAmount: input.maxAmount,
          periodAmountLimit: input.periodAmountLimit ?? null,
          periodKind: input.period.periodKind,
          periodSeconds: input.period.periodSeconds,
          startsAt: input.period.startsAt,
          endsAt: input.period.endsAt,
          isActive: true
        },
        select: sbpRuleSelect
      });
    });
  }
}

function validateTransferRule(input: SetSbpTransferRuleInput): void {
  if (!Number.isFinite(input.minAmount) || input.minAmount < 0) {
    throw new Error("Transfer min amount must be a non-negative number.");
  }

  if (!Number.isFinite(input.maxAmount) || input.maxAmount <= 0) {
    throw new Error("Transfer max amount must be a positive number.");
  }

  if (input.minAmount > input.maxAmount) {
    throw new Error("Transfer min amount cannot be greater than max amount.");
  }

  if (input.periodAmountLimit !== undefined && input.periodAmountLimit < input.maxAmount) {
    throw new Error("Period amount limit cannot be lower than max amount.");
  }
}
