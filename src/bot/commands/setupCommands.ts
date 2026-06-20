import type { Bot } from "grammy";
import type {
  AddMemberInput,
  AdminSetupService,
  AllianceView,
  BalanceView,
  CreateAllianceInput,
  CreateCurrencyInput,
  CreateShopInput,
  CreateShopItemInput,
  CurrencyView,
  MemberView,
  ShopItemView,
  ShopView
} from "../../application/setup/adminSetupService.js";
import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import {
  parseNonNegativeNumber,
  parsePositiveInteger,
  type ParseResult
} from "../../application/limits/limitPeriodInput.js";
import type { AppConfig } from "../../config/env.js";
import { parseBankRole, type BankRole } from "../../domain/users/bankRole.js";
import { requireAdmin, requireAllianceAdmin, requireShopAdmin } from "../middleware/adminOnly.js";
import { parseTelegramUserRef, resolveTelegramUserProfile, type TelegramUserRef } from "../telegramProfiles.js";
import type { BotContext } from "../context.js";

const CREATE_ALLIANCE_USAGE = "Формат: /create_alliance <slug> <name>";
const CREATE_CURRENCY_USAGE = "Формат: /create_currency <allianceId> <symbol> <name>";
const ADD_MEMBER_USAGE = "Формат: /add_member <allianceId> <telegramId|reply> [member|bank_admin|super_admin]";
const SET_BALANCE_USAGE = "Формат: /set_balance <allianceId> <currencyId> <telegramId|reply> <amount>";
const CREATE_SHOP_USAGE = "Формат: /create_shop <allianceId> <name>";
const CREATE_ITEM_USAGE = "Формат: /create_item <shopId> <currencyId> <price> <stock|none> <name>";

export type ParsedAddMemberCommand = Omit<AddMemberInput, "user"> & {
  userRef: TelegramUserRef;
  role: BankRole;
};

export type ParsedSetBalanceCommand = Omit<AddMemberInput, "user" | "role"> & {
  currencyId: number;
  userRef: TelegramUserRef;
  amount: number;
};

export function registerSetupCommands(
  bot: Bot<BotContext>,
  adminSetupService: AdminSetupService,
  authorizationService: AuthorizationService,
  config: AppConfig
): void {
  bot.command("create_alliance", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseCreateAllianceArgs(getCommandArgs(ctx), ctx.chat?.id);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    try {
      const alliance = await adminSetupService.createAlliance(parsed.value);
      await ctx.reply(formatAlliance(alliance));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("create_currency", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseCreateCurrencyArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    try {
      const currency = await adminSetupService.createCurrency(parsed.value);
      await ctx.reply(formatCurrency(currency));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("add_member", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseAddMemberArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    const userProfile = resolveTelegramUserProfile(ctx, parsed.value.userRef);
    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    try {
      const member = await adminSetupService.addMember({
        allianceId: parsed.value.allianceId,
        user: userProfile.value,
        role: parsed.value.role
      });
      await ctx.reply(formatMember(member));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("set_balance", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseSetBalanceArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    const userProfile = resolveTelegramUserProfile(ctx, parsed.value.userRef);
    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    try {
      const balance = await adminSetupService.setBalance({
        allianceId: parsed.value.allianceId,
        currencyId: parsed.value.currencyId,
        user: userProfile.value,
        amount: parsed.value.amount
      });
      await ctx.reply(formatBalance(balance));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("create_shop", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseCreateShopArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireAllianceAdmin(ctx, authorizationService, parsed.value.allianceId))) {
      return;
    }

    try {
      const shop = await adminSetupService.createShop(parsed.value);
      await ctx.reply(formatShop(shop));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });

  bot.command("create_item", async (ctx) => {
    if (!(await requireAdmin(ctx, config))) {
      return;
    }

    const parsed = parseCreateShopItemArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    if (!(await requireShopAdmin(ctx, authorizationService, parsed.value.shopId))) {
      return;
    }

    try {
      const item = await adminSetupService.createShopItem(parsed.value);
      await ctx.reply(formatShopItem(item));
    } catch (error) {
      await ctx.reply(formatError(error));
    }
  });
}

export function parseCreateAllianceArgs(
  args: readonly string[],
  chatId?: number
): ParseResult<CreateAllianceInput> {
  if (args.length < 2) {
    return { ok: false, message: CREATE_ALLIANCE_USAGE };
  }

  const name = args.slice(1).join(" ").trim();
  if (!name) {
    return { ok: false, message: CREATE_ALLIANCE_USAGE };
  }

  return {
    ok: true,
    value: {
      slug: args[0] ?? "",
      name,
      ...(chatId !== undefined ? { telegramChatId: BigInt(chatId) } : {})
    }
  };
}

export function parseCreateCurrencyArgs(args: readonly string[]): ParseResult<CreateCurrencyInput> {
  if (args.length < 3) {
    return { ok: false, message: CREATE_CURRENCY_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const symbol = args[1]?.trim();
  const name = args.slice(2).join(" ").trim();

  if (!symbol || !name) {
    return { ok: false, message: CREATE_CURRENCY_USAGE };
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      symbol,
      name
    }
  };
}

export function parseAddMemberArgs(args: readonly string[]): ParseResult<ParsedAddMemberCommand> {
  if (args.length < 2) {
    return { ok: false, message: ADD_MEMBER_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const userRef = parseTelegramUserRef(args[1]);
  if (!userRef.ok) {
    return userRef;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      userRef: userRef.value,
      role: parseBankRole(args[2])
    }
  };
}

export function parseSetBalanceArgs(args: readonly string[]): ParseResult<ParsedSetBalanceCommand> {
  if (args.length < 4) {
    return { ok: false, message: SET_BALANCE_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const currencyId = parsePositiveInteger(args[1], "currencyId должен быть положительным целым числом.");
  if (!currencyId.ok) {
    return currencyId;
  }

  const userRef = parseTelegramUserRef(args[2]);
  if (!userRef.ok) {
    return userRef;
  }

  const amount = parseNonNegativeNumber(args[3], "amount должен быть неотрицательным числом.");
  if (!amount.ok) {
    return amount;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      currencyId: currencyId.value,
      userRef: userRef.value,
      amount: amount.value
    }
  };
}

export function parseCreateShopArgs(args: readonly string[]): ParseResult<CreateShopInput> {
  if (args.length < 2) {
    return { ok: false, message: CREATE_SHOP_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  const name = args.slice(1).join(" ").trim();
  if (!name) {
    return { ok: false, message: CREATE_SHOP_USAGE };
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      name
    }
  };
}

export function parseCreateShopItemArgs(args: readonly string[]): ParseResult<CreateShopItemInput> {
  if (args.length < 5) {
    return { ok: false, message: CREATE_ITEM_USAGE };
  }

  const shopId = parsePositiveInteger(args[0], "shopId должен быть положительным целым числом.");
  if (!shopId.ok) {
    return shopId;
  }

  const currencyId = parsePositiveInteger(args[1], "currencyId должен быть положительным целым числом.");
  if (!currencyId.ok) {
    return currencyId;
  }

  const price = parseNonNegativeNumber(args[2], "price должен быть неотрицательным числом.");
  if (!price.ok) {
    return price;
  }

  const stock = parseStock(args[3]);
  if (!stock.ok) {
    return stock;
  }

  const name = args.slice(4).join(" ").trim();
  if (!name) {
    return { ok: false, message: CREATE_ITEM_USAGE };
  }

  return {
    ok: true,
    value: {
      shopId: shopId.value,
      currencyId: currencyId.value,
      price: price.value,
      name,
      ...(stock.value.stock !== undefined ? { stock: stock.value.stock } : {})
    }
  };
}

function parseStock(token: string | undefined): ParseResult<{ stock?: number }> {
  if (token === undefined) {
    return { ok: false, message: "stock должен быть целым неотрицательным числом или none." };
  }

  if (["none", "no", "-", "null", "без", "нет"].includes(token.trim().toLowerCase())) {
    return { ok: true, value: {} };
  }

  if (!/^\d+$/.test(token)) {
    return { ok: false, message: "stock должен быть целым неотрицательным числом или none." };
  }

  const stock = Number(token);
  if (!Number.isSafeInteger(stock)) {
    return { ok: false, message: "stock слишком большой." };
  }

  return {
    ok: true,
    value: { stock }
  };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

function formatAlliance(alliance: AllianceView): string {
  return `Ролевая сохранена: #${alliance.id} ${alliance.name} (${alliance.slug}).`;
}

function formatCurrency(currency: CurrencyView): string {
  return `Валюта сохранена: #${currency.id} ${currency.symbol} ${currency.name}.`;
}

function formatMember(member: MemberView): string {
  return `Участник сохранён: ${member.user.displayName}, роль ${member.role}, ролевая #${member.allianceId}.`;
}

function formatBalance(balance: BalanceView): string {
  return `Баланс сохранён: ${balance.user.displayName}, ${balance.amount.toString()} ${balance.currency.symbol}.`;
}

function formatShop(shop: ShopView): string {
  return `Магазин сохранён: #${shop.id} ${shop.name}, ролевая #${shop.allianceId}.`;
}

function formatShopItem(item: ShopItemView): string {
  return `Товар сохранён: #${item.id} ${item.name}, цена ${item.price.toString()}, остаток ${item.stock ?? "без лимита"}.`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Ошибка: ${error.message}`;
  }

  return "Ошибка: не удалось выполнить команду.";
}
