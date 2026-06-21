import type { Bot } from "grammy";
import type {
  SetSbpTransferRuleInput,
  SbpTransferRuleAdminService,
  SbpTransferRuleView
} from "../../application/sbp/sbpTransferRuleAdminService.js";
import type {
  SetShopItemLimitInput,
  ShopItemLimitAdminService,
  ShopItemLimitView
} from "../../application/shop/shopItemLimitAdminService.js";
import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import type { LogRoutingService } from "../../application/logs/logRoutingService.js";
import {
  parseLimitPeriodToken,
  parseNonNegativeNumber,
  parseOptionalLimitToken,
  parsePositiveInteger,
  parsePositiveNumber,
  type ParseResult
} from "../../application/limits/limitPeriodInput.js";
import type { TelegramLogSink } from "../../infrastructure/telegram/telegramLogSink.js";
import { sendAdminAuditLog } from "../adminAuditLog.js";
import { requireAllianceAdmin, requireShopItemAdmin } from "../middleware/adminOnly.js";
import type { BotContext } from "../context.js";

const SET_SBP_LIMIT_USAGE =
  "Формат: /set_sbp_limit <allianceId> <currencyId|all> <minAmount> <maxAmount> <periodAmountLimit|none> <period>";

const SET_ITEM_LIMIT_USAGE =
  "Формат: /set_item_limit <itemId> <minQty> <maxQty> <periodQtyLimit|none> <period>";

export function registerLimitCommands(
  bot: Bot<BotContext>,
  sbpRuleAdminService: SbpTransferRuleAdminService,
  shopItemLimitAdminService: ShopItemLimitAdminService,
  logRoutingService: LogRoutingService,
  telegramLogSink: TelegramLogSink,
  authorizationService: AuthorizationService
): void {
  bot.command("set_sbp_limit", async (ctx) => {
    const parsed = parseSetSbpLimitArgs(getCommandArgs(ctx));

    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    try {
      const rule = await sbpRuleAdminService.setRule(parsed.value);
      await ctx.reply(formatSbpRule(rule));
      await sendAdminAuditLog({
        ctx,
        logRoutingService,
        telegramLogSink,
        allianceId: rule.allianceId,
        action: "Настройка лимита СБП",
        details: [
          `Правило: #${rule.id}`,
          `Валюта: ${rule.currencyId ?? "all"}`,
          `Передача: ${rule.minAmount.toString()}..${rule.maxAmount.toString()}`,
          `За период: ${rule.periodAmountLimit?.toString() ?? "без общего лимита"}`,
          `Период: ${formatPeriod(rule.periodKind, rule.periodSeconds, rule.startsAt, rule.endsAt)}`
        ]
      });
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("set_item_limit", async (ctx) => {
    const parsed = parseSetShopItemLimitArgs(getCommandArgs(ctx));

    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireShopItemAdmin(ctx, authorizationService, parsed.value.itemId))) {
      return;
    }

    try {
      const item = await shopItemLimitAdminService.setLimit(parsed.value);
      await ctx.reply(formatShopItemLimit(item));
      await sendAdminAuditLog({
        ctx,
        logRoutingService,
        telegramLogSink,
        allianceId: item.shop.allianceId,
        action: "Настройка лимита товара",
        details: [
          `Товар: #${item.id} ${item.name}`,
          `Покупка: ${item.minQuantity}..${item.maxQuantityPerPurchase} шт.`,
          `За период: ${item.periodQuantityLimit ?? "без общего лимита"}`,
          `Период: ${formatPeriod(item.limitPeriodKind, item.limitPeriodSeconds, item.limitStartsAt, item.limitEndsAt)}`
        ]
      });
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });
}

export function parseSetSbpLimitArgs(
  args: readonly string[],
  now = new Date()
): ParseResult<SetSbpTransferRuleInput> {
  if (args.length < 6) {
    return { ok: false, message: SET_SBP_LIMIT_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const currencyId = parseCurrencyId(args[1]);
  if (!currencyId.ok) {
    return currencyId;
  }

  const minAmount = parseNonNegativeNumber(args[2], "minAmount должен быть неотрицательным числом.");
  if (!minAmount.ok) {
    return minAmount;
  }

  const maxAmount = parsePositiveNumber(args[3], "maxAmount должен быть положительным числом.");
  if (!maxAmount.ok) {
    return maxAmount;
  }

  if (minAmount.value > maxAmount.value) {
    return { ok: false, message: "minAmount не может быть больше maxAmount." };
  }

  const periodAmountLimit = parseOptionalLimitToken(args[4]);
  if (!periodAmountLimit.ok) {
    return periodAmountLimit;
  }

  if (periodAmountLimit.value !== undefined && periodAmountLimit.value < maxAmount.value) {
    return { ok: false, message: "periodAmountLimit не может быть меньше maxAmount." };
  }

  const period = parseLimitPeriodToken(args[5], now);
  if (!period.ok) {
    return period;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      minAmount: minAmount.value,
      maxAmount: maxAmount.value,
      ...(currencyId.value !== undefined ? { currencyId: currencyId.value } : {}),
      ...(periodAmountLimit.value !== undefined ? { periodAmountLimit: periodAmountLimit.value } : {}),
      period: period.value
    }
  };
}

export function parseSetShopItemLimitArgs(
  args: readonly string[],
  now = new Date()
): ParseResult<SetShopItemLimitInput> {
  if (args.length < 5) {
    return { ok: false, message: SET_ITEM_LIMIT_USAGE };
  }

  const itemId = parsePositiveInteger(args[0], "itemId должен быть положительным целым числом.");
  if (!itemId.ok) {
    return itemId;
  }

  const minQuantity = parsePositiveInteger(args[1], "minQty должен быть положительным целым числом.");
  if (!minQuantity.ok) {
    return minQuantity;
  }

  const maxQuantityPerPurchase = parsePositiveInteger(args[2], "maxQty должен быть положительным целым числом.");
  if (!maxQuantityPerPurchase.ok) {
    return maxQuantityPerPurchase;
  }

  if (minQuantity.value > maxQuantityPerPurchase.value) {
    return { ok: false, message: "minQty не может быть больше maxQty." };
  }

  const periodQuantityLimit = parseOptionalLimitToken(args[3]);
  if (!periodQuantityLimit.ok) {
    return periodQuantityLimit;
  }

  if (periodQuantityLimit.value !== undefined && !Number.isInteger(periodQuantityLimit.value)) {
    return { ok: false, message: "periodQtyLimit должен быть целым числом или none." };
  }

  if (periodQuantityLimit.value !== undefined && periodQuantityLimit.value < maxQuantityPerPurchase.value) {
    return { ok: false, message: "periodQtyLimit не может быть меньше maxQty." };
  }

  const period = parseLimitPeriodToken(args[4], now);
  if (!period.ok) {
    return period;
  }

  return {
    ok: true,
    value: {
      itemId: itemId.value,
      minQuantity: minQuantity.value,
      maxQuantityPerPurchase: maxQuantityPerPurchase.value,
      ...(periodQuantityLimit.value !== undefined ? { periodQuantityLimit: periodQuantityLimit.value } : {}),
      period: period.value
    }
  };
}

function parseCurrencyId(token: string | undefined): ParseResult<number | undefined> {
  if (token === undefined) {
    return { ok: false, message: "currencyId должен быть положительным целым числом или all." };
  }

  if (["all", "*", "any", "все", "любая"].includes(token.trim().toLowerCase())) {
    return { ok: true, value: undefined };
  }

  return parsePositiveInteger(token, "currencyId должен быть положительным целым числом или all.");
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

function formatSbpRule(rule: SbpTransferRuleView): string {
  return [
    `Лимит СБП сохранён: rule #${rule.id}.`,
    `Союз: ${rule.allianceId}, валюта: ${rule.currencyId ?? "all"}.`,
    `Передача: ${rule.minAmount.toString()}..${rule.maxAmount.toString()}.`,
    `За период: ${rule.periodAmountLimit?.toString() ?? "без общего лимита"}, ${formatPeriod(rule.periodKind, rule.periodSeconds, rule.startsAt, rule.endsAt)}.`
  ].join("\n");
}

function formatShopItemLimit(item: ShopItemLimitView): string {
  return [
    `Лимит товара сохранён: #${item.id} ${item.name}.`,
    `Покупка: ${item.minQuantity}..${item.maxQuantityPerPurchase} шт.`,
    `За период: ${item.periodQuantityLimit ?? "без общего лимита"}, ${formatPeriod(item.limitPeriodKind, item.limitPeriodSeconds, item.limitStartsAt, item.limitEndsAt)}.`
  ].join("\n");
}

function formatPeriod(periodKind: string, periodSeconds: number | null, startsAt: Date | null, endsAt: Date | null): string {
  if (endsAt) {
    return `${formatDate(startsAt)}..${formatDate(endsAt)}`;
  }

  if (periodSeconds !== null) {
    return `${periodSeconds} сек.`;
  }

  return periodKind.toLowerCase();
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "сейчас";
  }

  return value.toISOString().slice(0, 10);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
