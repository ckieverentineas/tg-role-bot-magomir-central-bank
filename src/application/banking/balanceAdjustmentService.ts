import type { Prisma, PrismaClient } from "@prisma/client";
import { LOG_EVENT_TYPE } from "../../domain/logs/logEventType.js";
import { toMoneyNumber } from "../../domain/money/money.js";
import { BANK_ROLE } from "../../domain/users/bankRole.js";
import type { TelegramUserProfile } from "../users/telegramUserService.js";

export type AdjustBalanceInput = {
  allianceId: number;
  currencyId: number;
  user: TelegramUserProfile;
  delta: number;
  comment?: string;
};

export type BalanceAdjustmentResult = {
  allianceId: number;
  currencyId: number;
  currencySymbol: string;
  userId: number;
  userDisplayName: string;
  delta: number;
  amountBefore: number;
  amountAfter: number;
  comment: string | null;
  logEventType: typeof LOG_EVENT_TYPE.FINANCE;
  logText: string;
};

type BalanceAdjustmentDatabase = Pick<
  PrismaClient,
  "$transaction" | "currency" | "user" | "allianceMember" | "balance"
>;

export class BalanceAdjustmentService {
  public constructor(private readonly db: BalanceAdjustmentDatabase) {}

  public async adjust(input: AdjustBalanceInput): Promise<BalanceAdjustmentResult> {
    validateInput(input);

    return this.db.$transaction(async (tx) => {
      const currency = await tx.currency.findFirst({
        where: {
          id: input.currencyId,
          allianceId: input.allianceId
        },
        select: {
          id: true,
          symbol: true
        }
      });

      if (!currency) {
        throw new Error(`Currency ${input.currencyId} was not found in alliance ${input.allianceId}.`);
      }

      const user = await upsertUser(tx, input.user);

      await tx.allianceMember.upsert({
        where: {
          allianceId_userId: {
            allianceId: input.allianceId,
            userId: user.id
          }
        },
        create: {
          allianceId: input.allianceId,
          userId: user.id,
          role: BANK_ROLE.MEMBER
        },
        update: {}
      });

      const currentBalance = await tx.balance.findUnique({
        where: {
          userId_currencyId: {
            userId: user.id,
            currencyId: input.currencyId
          }
        },
        select: {
          amount: true
        }
      });

      const amountBefore = currentBalance ? toMoneyNumber(currentBalance.amount) : 0;
      const amountAfter = amountBefore + input.delta;

      if (amountAfter < 0) {
        throw new Error("Balance cannot become negative.");
      }

      await tx.balance.upsert({
        where: {
          userId_currencyId: {
            userId: user.id,
            currencyId: input.currencyId
          }
        },
        create: {
          userId: user.id,
          currencyId: input.currencyId,
          amount: amountAfter
        },
        update: {
          amount: {
            increment: input.delta
          }
        }
      });

      const comment = normalizeComment(input.comment);

      return {
        allianceId: input.allianceId,
        currencyId: input.currencyId,
        currencySymbol: currency.symbol,
        userId: user.id,
        userDisplayName: user.displayName,
        delta: input.delta,
        amountBefore,
        amountAfter,
        comment,
        logEventType: LOG_EVENT_TYPE.FINANCE,
        logText: formatLogText({
          userDisplayName: user.displayName,
          delta: input.delta,
          amountBefore,
          amountAfter,
          currencySymbol: currency.symbol,
          comment
        })
      };
    });
  }
}

async function upsertUser(
  tx: Pick<Prisma.TransactionClient, "user">,
  profile: TelegramUserProfile
): Promise<{ id: number; displayName: string }> {
  return tx.user.upsert({
    where: {
      telegramId: profile.telegramId
    },
    create: {
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      displayName: profile.displayName
    },
    update: {
      username: profile.username ?? null,
      displayName: profile.displayName
    },
    select: {
      id: true,
      displayName: true
    }
  });
}

function validateInput(input: AdjustBalanceInput): void {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("Balance delta must be a non-zero number.");
  }
}

function normalizeComment(comment: string | undefined): string | null {
  const normalized = comment?.trim();

  return normalized ? normalized : null;
}

function formatLogText(input: {
  userDisplayName: string;
  delta: number;
  amountBefore: number;
  amountAfter: number;
  currencySymbol: string;
  comment: string | null;
}): string {
  const sign = input.delta > 0 ? "+" : "";
  const commentLine = input.comment ? `\nКомментарий: ${input.comment}` : "";

  return [
    "Изменение баланса",
    `Пользователь: ${input.userDisplayName}`,
    `Изменение: ${sign}${input.delta} ${input.currencySymbol}`,
    `Баланс: ${input.amountBefore} -> ${input.amountAfter} ${input.currencySymbol}${commentLine}`
  ].join("\n");
}
