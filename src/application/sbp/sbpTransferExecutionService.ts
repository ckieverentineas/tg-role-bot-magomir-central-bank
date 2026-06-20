import type { Prisma, PrismaClient } from "@prisma/client";
import { LOG_EVENT_TYPE } from "../../domain/logs/logEventType.js";
import { toMoneyNumber } from "../../domain/money/money.js";
import { TRANSFER_STATUS } from "../../domain/transfers/transferStatus.js";
import { SbpTransferLimitService } from "./sbpTransferLimitService.js";

export type ExecuteSbpTransferInput = {
  allianceId: number;
  currencyId: number;
  senderUserId: number;
  receiverUserId: number;
  amount: number;
  comment?: string;
  now?: Date;
};

export type ExecutedSbpTransfer = {
  id: number;
  allianceId: number;
  currencyId: number;
  currencyName: string;
  currencySymbol: string;
  senderUserId: number;
  senderDisplayName: string;
  receiverUserId: number;
  receiverDisplayName: string;
  amount: number;
  comment: string | null;
  createdAt: Date;
  logEventType: typeof LOG_EVENT_TYPE.FINANCE;
  logText: string;
};

type SbpTransferExecutionDatabase = Pick<
  PrismaClient,
  "$transaction" | "currency" | "allianceMember" | "balance" | "sbpTransfer" | "sbpTransferRule"
>;

export class SbpTransferExecutionService {
  public constructor(private readonly db: SbpTransferExecutionDatabase) {}

  public async execute(input: ExecuteSbpTransferInput): Promise<ExecutedSbpTransfer> {
    validateTransferInput(input);

    return this.db.$transaction(async (tx) => {
      const currency = await tx.currency.findFirst({
        where: {
          id: input.currencyId,
          allianceId: input.allianceId
        },
        select: {
          id: true,
          name: true,
          symbol: true,
          isTransferEnabled: true
        }
      });

      if (!currency) {
        throw new Error(`Currency ${input.currencyId} was not found in alliance ${input.allianceId}.`);
      }

      if (!currency.isTransferEnabled) {
        throw new Error("Transfers are disabled for this currency.");
      }

      await assertAllianceMembers(tx, input.allianceId, [input.senderUserId, input.receiverUserId]);

      const limitResult = await new SbpTransferLimitService(tx).checkTransfer(input);
      if (!limitResult.allowed) {
        throw new Error(limitResult.message);
      }

      const senderBalance = await tx.balance.findUnique({
        where: {
          userId_currencyId: {
            userId: input.senderUserId,
            currencyId: input.currencyId
          }
        },
        select: {
          amount: true
        }
      });

      const senderAmount = senderBalance ? toMoneyNumber(senderBalance.amount) : 0;
      if (senderAmount < input.amount) {
        throw new Error("Insufficient balance for transfer.");
      }

      await tx.balance.update({
        where: {
          userId_currencyId: {
            userId: input.senderUserId,
            currencyId: input.currencyId
          }
        },
        data: {
          amount: {
            decrement: input.amount
          }
        }
      });

      await tx.balance.upsert({
        where: {
          userId_currencyId: {
            userId: input.receiverUserId,
            currencyId: input.currencyId
          }
        },
        create: {
          userId: input.receiverUserId,
          currencyId: input.currencyId,
          amount: input.amount
        },
        update: {
          amount: {
            increment: input.amount
          }
        }
      });

      const transfer = await tx.sbpTransfer.create({
        data: {
          allianceId: input.allianceId,
          currencyId: input.currencyId,
          senderUserId: input.senderUserId,
          receiverUserId: input.receiverUserId,
          amount: input.amount,
          status: TRANSFER_STATUS.COMPLETED,
          comment: normalizeComment(input.comment)
        },
        select: {
          id: true,
          amount: true,
          comment: true,
          createdAt: true,
          sender: {
            select: {
              displayName: true
            }
          },
          receiver: {
            select: {
              displayName: true
            }
          }
        }
      });

      const amount = toMoneyNumber(transfer.amount);
      const result = {
        id: transfer.id,
        allianceId: input.allianceId,
        currencyId: input.currencyId,
        currencyName: currency.name,
        currencySymbol: currency.symbol,
        senderUserId: input.senderUserId,
        senderDisplayName: transfer.sender.displayName,
        receiverUserId: input.receiverUserId,
        receiverDisplayName: transfer.receiver.displayName,
        amount,
        comment: transfer.comment,
        createdAt: transfer.createdAt,
        logEventType: LOG_EVENT_TYPE.FINANCE,
        logText: formatTransferLog({
          id: transfer.id,
          amount,
          currencySymbol: currency.symbol,
          senderDisplayName: transfer.sender.displayName,
          receiverDisplayName: transfer.receiver.displayName,
          comment: transfer.comment
        })
      } satisfies ExecutedSbpTransfer;

      return result;
    });
  }
}

async function assertAllianceMembers(
  tx: Pick<Prisma.TransactionClient, "allianceMember">,
  allianceId: number,
  userIds: readonly number[]
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const members = await tx.allianceMember.findMany({
    where: {
      allianceId,
      userId: {
        in: uniqueUserIds
      }
    },
    select: {
      userId: true
    }
  });

  if (members.length !== uniqueUserIds.length) {
    throw new Error("Both transfer participants must be alliance members.");
  }
}

function validateTransferInput(input: ExecuteSbpTransferInput): void {
  if (input.senderUserId === input.receiverUserId) {
    throw new Error("Sender and receiver must be different users.");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Transfer amount must be a positive number.");
  }
}

function normalizeComment(comment: string | undefined): string | null {
  const normalized = comment?.trim();

  return normalized ? normalized : null;
}

function formatTransferLog(input: {
  id: number;
  amount: number;
  currencySymbol: string;
  senderDisplayName: string;
  receiverDisplayName: string;
  comment: string | null;
}): string {
  const commentLine = input.comment ? `\nКомментарий: ${input.comment}` : "";

  return [
    `СБП #${input.id}`,
    `${input.senderDisplayName} -> ${input.receiverDisplayName}`,
    `Сумма: ${input.amount} ${input.currencySymbol}${commentLine}`
  ].join("\n");
}
