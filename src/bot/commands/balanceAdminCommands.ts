import type { Bot } from "grammy";
import type {
  AdjustBalanceInput,
  BalanceAdjustmentResult,
  BalanceAdjustmentService
} from "../../application/banking/balanceAdjustmentService.js";
import { parsePositiveInteger, type ParseResult } from "../../application/limits/limitPeriodInput.js";
import type { LogRoutingService } from "../../application/logs/logRoutingService.js";
import type { AppConfig } from "../../config/env.js";
import type { TelegramLogSink } from "../../infrastructure/telegram/telegramLogSink.js";
import { requireAdmin } from "../middleware/adminOnly.js";
import { sendOperationLog } from "../logDelivery.js";
import { parseTelegramUserRef, resolveTelegramUserProfile, type TelegramUserRef } from "../telegramProfiles.js";
import type { BotContext } from "../context.js";

const ADJUST_BALANCE_USAGE = "Формат: /adjust_balance <allianceId> <currencyId> <telegramId|reply> <+/-amount> [comment]";

export type ParsedAdjustBalanceCommand = Omit<AdjustBalanceInput, "user"> & {
  userRef: TelegramUserRef;
};

export function registerBalanceAdminCommands(
  bot: Bot<BotContext>,
  balanceAdjustmentService: BalanceAdjustmentService,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  config: AppConfig
): void {
  bot.command("adjust_balance", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseAdjustBalanceArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = resolveTelegramUserProfile(ctx, parsed.value.userRef);
    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    try {
      const adjustment = await balanceAdjustmentService.adjust({
        allianceId: parsed.value.allianceId,
        currencyId: parsed.value.currencyId,
        user: userProfile.value,
        delta: parsed.value.delta,
        ...(parsed.value.comment ? { comment: parsed.value.comment } : {})
      });

      await ctx.reply(formatAdjustment(adjustment));
      await sendOperationLog(logRoutingService, telegramLogSink, adjustment);
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });
}

export function parseAdjustBalanceArgs(args: readonly string[]): ParseResult<ParsedAdjustBalanceCommand> {
  if (args.length < 4) {
    return { ok: false, message: ADJUST_BALANCE_USAGE };
  }

  const allianceId = parsePositiveId(args[0], "allianceId");
  if (!allianceId.ok) {
    return allianceId;
  }

  const currencyId = parsePositiveId(args[1], "currencyId");
  if (!currencyId.ok) {
    return currencyId;
  }

  const userRef = parseTelegramUserRef(args[2]);
  if (!userRef.ok) {
    return userRef;
  }

  const delta = parseDelta(args[3]);
  if (!delta.ok) {
    return delta;
  }

  const comment = args.slice(4).join(" ").trim();

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      currencyId: currencyId.value,
      userRef: userRef.value,
      delta: delta.value,
      ...(comment ? { comment } : {})
    }
  };
}

function parsePositiveId(token: string | undefined, name: string): ParseResult<number> {
  return parsePositiveInteger(token, `${name} должен быть положительным целым числом.`);
}

function parseDelta(token: string | undefined): ParseResult<number> {
  if (token === undefined || token.trim() === "") {
    return { ok: false, message: "delta должен быть ненулевым числом." };
  }

  const value = Number(token.replace(",", "."));

  if (!Number.isFinite(value) || value === 0) {
    return { ok: false, message: "delta должен быть ненулевым числом." };
  }

  return { ok: true, value };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

function formatAdjustment(adjustment: BalanceAdjustmentResult): string {
  const sign = adjustment.delta > 0 ? "+" : "";

  return [
    `Баланс изменён: ${adjustment.userDisplayName}`,
    `Изменение: ${sign}${adjustment.delta} ${adjustment.currencySymbol}`,
    `Итог: ${adjustment.amountAfter} ${adjustment.currencySymbol}`
  ].join("\n");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
