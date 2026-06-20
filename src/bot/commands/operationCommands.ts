import type { Bot } from "grammy";
import type { LogRoutingService } from "../../application/logs/logRoutingService.js";
import type {
  ExecuteSbpTransferInput,
  ExecutedSbpTransfer,
  SbpTransferExecutionService
} from "../../application/sbp/sbpTransferExecutionService.js";
import type {
  ExecutedShopPurchase,
  ExecuteShopPurchaseInput,
  ShopPurchaseExecutionService
} from "../../application/shop/shopPurchaseExecutionService.js";
import { TelegramUserService } from "../../application/users/telegramUserService.js";
import { parsePositiveInteger, parsePositiveNumber, type ParseResult } from "../../application/limits/limitPeriodInput.js";
import type { TelegramLogSink } from "../../infrastructure/telegram/telegramLogSink.js";
import type { BotContext } from "../context.js";
import {
  getTelegramUserProfile,
  parseTelegramUserRef,
  resolveTelegramUserProfile,
  type TelegramUserRef
} from "../telegramProfiles.js";

const SBP_USAGE = "Формат: /sbp <allianceId> <currencyId> <receiverTelegramId|reply> <amount> [comment]";
const BUY_USAGE = "Формат: /buy <itemId> <quantity>";

export type ParsedSbpTransferCommand = Omit<
  ExecuteSbpTransferInput,
  "senderUserId" | "receiverUserId" | "now"
> & {
  receiver: TelegramUserRef;
};

export type ParsedBuyCommandInput = Omit<ExecuteShopPurchaseInput, "userId" | "now">;

export function registerOperationCommands(
  bot: Bot<BotContext>,
  telegramUserService: TelegramUserService,
  sbpTransferExecutionService: SbpTransferExecutionService,
  shopPurchaseExecutionService: ShopPurchaseExecutionService,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink
): void {
  bot.command("sbp", async (ctx) => {
    const senderProfile = getTelegramUserProfile(ctx.from);
    if (!senderProfile) {
      await ctx.reply("Не удалось определить отправителя.");
      return;
    }

    const parsed = parseSbpTransferArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const receiverProfile = resolveTelegramUserProfile(ctx, parsed.value.receiver);
    if (!receiverProfile.ok) {
      await ctx.reply(receiverProfile.message);
      return;
    }

    try {
      const sender = await telegramUserService.upsertTelegramUser(senderProfile);
      const receiver = await telegramUserService.upsertTelegramUser(receiverProfile.value);
      const transfer = await sbpTransferExecutionService.execute({
        allianceId: parsed.value.allianceId,
        currencyId: parsed.value.currencyId,
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        amount: parsed.value.amount,
        ...(parsed.value.comment ? { comment: parsed.value.comment } : {})
      });

      await ctx.reply(formatTransferSuccess(transfer));
      await sendOperationLog(logRoutingService, telegramLogSink, transfer);
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("buy", async (ctx) => {
    const buyerProfile = getTelegramUserProfile(ctx.from);
    if (!buyerProfile) {
      await ctx.reply("Не удалось определить покупателя.");
      return;
    }

    const parsed = parseBuyArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    try {
      const buyer = await telegramUserService.upsertTelegramUser(buyerProfile);
      const purchase = await shopPurchaseExecutionService.execute({
        userId: buyer.id,
        itemId: parsed.value.itemId,
        quantity: parsed.value.quantity
      });

      await ctx.reply(formatPurchaseSuccess(purchase));
      await sendOperationLog(logRoutingService, telegramLogSink, purchase);
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });
}

export function parseSbpTransferArgs(args: readonly string[]): ParseResult<ParsedSbpTransferCommand> {
  if (args.length < 4) {
    return { ok: false, message: SBP_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const currencyId = parsePositiveInteger(args[1], "currencyId должен быть положительным целым числом.");
  if (!currencyId.ok) {
    return currencyId;
  }

  const receiver = parseTelegramUserRef(args[2]);
  if (!receiver.ok) {
    return receiver;
  }

  const amount = parsePositiveNumber(args[3], "amount должен быть положительным числом.");
  if (!amount.ok) {
    return amount;
  }

  const comment = args.slice(4).join(" ").trim();

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      currencyId: currencyId.value,
      receiver: receiver.value,
      amount: amount.value,
      ...(comment ? { comment } : {})
    }
  };
}

export function parseBuyArgs(args: readonly string[]): ParseResult<ParsedBuyCommandInput> {
  if (args.length < 2) {
    return { ok: false, message: BUY_USAGE };
  }

  const itemId = parsePositiveInteger(args[0], "itemId должен быть положительным целым числом.");
  if (!itemId.ok) {
    return itemId;
  }

  const quantity = parsePositiveInteger(args[1], "quantity должен быть положительным целым числом.");
  if (!quantity.ok) {
    return quantity;
  }

  return {
    ok: true,
    value: {
      itemId: itemId.value,
      quantity: quantity.value
    }
  };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

async function sendOperationLog(
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  operation: Pick<ExecutedSbpTransfer | ExecutedShopPurchase, "allianceId" | "logEventType" | "logText">
): Promise<void> {
  const targets = await logRoutingService.resolveDeliveryTargets(operation.allianceId, operation.logEventType);
  const results = await Promise.allSettled(targets.map((target) => telegramLogSink.send(target, operation.logText)));

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to send operation log", result.reason);
    }
  }
}

function formatTransferSuccess(transfer: ExecutedSbpTransfer): string {
  return [
    `СБП выполнен: #${transfer.id}.`,
    `${transfer.senderDisplayName} -> ${transfer.receiverDisplayName}`,
    `Сумма: ${transfer.amount} ${transfer.currencySymbol}.`
  ].join("\n");
}

function formatPurchaseSuccess(purchase: ExecutedShopPurchase): string {
  return [
    `Покупка выполнена: #${purchase.id}.`,
    `${purchase.itemName}, ${purchase.quantity} шт.`,
    `Сумма: ${purchase.totalPrice} ${purchase.currencySymbol}.`
  ].join("\n");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
