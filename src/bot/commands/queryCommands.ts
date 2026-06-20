import type { Bot } from "grammy";
import type { AccountQueryService } from "../../application/read/accountQueryService.js";
import { parsePositiveInteger, type ParseResult } from "../../application/limits/limitPeriodInput.js";
import {
  getTelegramUserProfile,
  parseTelegramUserRef,
  resolveTelegramUserProfile,
  type TelegramUserRef
} from "../telegramProfiles.js";
import type { BotContext } from "../context.js";

const PROFILE_USAGE = "Формат: /profile [telegramId|reply]";
const BALANCE_USAGE = "Формат: /balance <allianceId> [telegramId|reply]";
const ALLIANCE_INFO_USAGE = "Формат: /alliance_info <allianceId>";
const SHOP_USAGE = "Формат: /shop <shopId>";
const INVENTORY_USAGE = "Формат: /inventory [telegramId|reply]";

export function registerQueryCommands(bot: Bot<BotContext>, accountQueryService: AccountQueryService): void {
  bot.command("profile", async (ctx) => {
    const parsed = parseOptionalUserRefArgs(getCommandArgs(ctx), PROFILE_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value
      ? resolveTelegramUserProfile(ctx, parsed.value)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    const profile = await accountQueryService.getProfile(userProfile.value.telegramId);
    await ctx.reply(profile ? formatProfile(profile) : "Профиль пока не найден.");
  });

  bot.command("balance", async (ctx) => {
    const parsed = parseBalanceArgs(getCommandArgs(ctx));
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value.userRef
      ? resolveTelegramUserProfile(ctx, parsed.value.userRef)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    const balance = await accountQueryService.getBalances(parsed.value.allianceId, userProfile.value.telegramId);
    await ctx.reply(balance ? formatBalance(balance) : "Баланс не найден.");
  });

  bot.command("alliance_info", async (ctx) => {
    const parsed = parseSinglePositiveIntArgs(getCommandArgs(ctx), ALLIANCE_INFO_USAGE, "allianceId");
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const alliance = await accountQueryService.getAllianceInfo(parsed.value);
    await ctx.reply(alliance ? formatAllianceInfo(alliance) : "Ролевая не найдена.");
  });

  bot.command("shop", async (ctx) => {
    const parsed = parseSinglePositiveIntArgs(getCommandArgs(ctx), SHOP_USAGE, "shopId");
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const shop = await accountQueryService.getShopItems(parsed.value);
    await ctx.reply(shop ? formatShop(shop) : "Магазин не найден.");
  });

  bot.command("inventory", async (ctx) => {
    const parsed = parseOptionalUserRefArgs(getCommandArgs(ctx), INVENTORY_USAGE);
    if (!parsed.ok) {
      await ctx.reply(parsed.message);
      return;
    }

    const userProfile = parsed.value
      ? resolveTelegramUserProfile(ctx, parsed.value)
      : getOwnProfile(ctx);

    if (!userProfile.ok) {
      await ctx.reply(userProfile.message);
      return;
    }

    const inventory = await accountQueryService.getInventory(userProfile.value.telegramId);
    await ctx.reply(inventory ? formatInventory(inventory) : "Инвентарь не найден.");
  });
}

export function parseBalanceArgs(args: readonly string[]): ParseResult<{
  allianceId: number;
  userRef?: TelegramUserRef;
}> {
  if (args.length < 1) {
    return { ok: false, message: BALANCE_USAGE };
  }

  const allianceId = parsePositiveInteger(args[0], "allianceId должен быть положительным целым числом.");
  if (!allianceId.ok) {
    return allianceId;
  }

  if (args[1] === undefined) {
    return {
      ok: true,
      value: {
        allianceId: allianceId.value
      }
    };
  }

  const userRef = parseTelegramUserRef(args[1]);
  if (!userRef.ok) {
    return userRef;
  }

  return {
    ok: true,
    value: {
      allianceId: allianceId.value,
      userRef: userRef.value
    }
  };
}

function parseOptionalUserRefArgs(
  args: readonly string[],
  usage: string
): ParseResult<TelegramUserRef | undefined> {
  if (args.length === 0) {
    return {
      ok: true,
      value: undefined
    };
  }

  if (args.length > 1) {
    return {
      ok: false,
      message: usage
    };
  }

  return parseTelegramUserRef(args[0]);
}

function parseSinglePositiveIntArgs(args: readonly string[], usage: string, name: string): ParseResult<number> {
  if (args.length !== 1) {
    return { ok: false, message: usage };
  }

  return parsePositiveInteger(args[0], `${name} должен быть положительным целым числом.`);
}

function getOwnProfile(ctx: BotContext): ParseResult<NonNullable<ReturnType<typeof getTelegramUserProfile>>> {
  const profile = getTelegramUserProfile(ctx.from);

  if (!profile) {
    return {
      ok: false,
      message: "Не удалось определить пользователя."
    };
  }

  return { ok: true, value: profile };
}

function getCommandArgs(ctx: BotContext): string[] {
  const text = ctx.message?.text ?? "";
  const [, ...args] = text.trim().split(/\s+/);

  return args;
}

function formatProfile(profile: Awaited<ReturnType<AccountQueryService["getProfile"]>> & {}): string {
  const alliances = profile.alliances.length > 0
    ? profile.alliances.map((alliance) => `#${alliance.allianceId} ${alliance.allianceName}: ${alliance.role}`).join("\n")
    : "нет";

  return [
    `Профиль #${profile.id}`,
    `Имя: ${profile.displayName}`,
    `Telegram: ${profile.telegramId.toString()}${profile.username ? ` (@${profile.username})` : ""}`,
    `Ролевые:\n${alliances}`
  ].join("\n");
}

function formatBalance(balance: Awaited<ReturnType<AccountQueryService["getBalances"]>> & {}): string {
  const rows = balance.balances.length > 0
    ? balance.balances.map((item) => `#${item.currencyId} ${item.currencyName}: ${item.amount} ${item.currencySymbol}`).join("\n")
    : "валют нет";

  return [
    `Баланс: ${balance.userDisplayName}`,
    `Ролевая: ${balance.allianceName}`,
    rows
  ].join("\n");
}

function formatAllianceInfo(alliance: Awaited<ReturnType<AccountQueryService["getAllianceInfo"]>> & {}): string {
  const currencies = alliance.currencies.length > 0
    ? alliance.currencies.map((currency) => `#${currency.id} ${currency.symbol} ${currency.name}`).join("\n")
    : "нет";
  const shops = alliance.shops.length > 0
    ? alliance.shops.map((shop) => `#${shop.id} ${shop.name}`).join("\n")
    : "нет";

  return [
    `Ролевая #${alliance.id}: ${alliance.name} (${alliance.slug})`,
    `Участников: ${alliance.membersCount}`,
    `Валюты:\n${currencies}`,
    `Магазины:\n${shops}`
  ].join("\n");
}

function formatShop(shop: Awaited<ReturnType<AccountQueryService["getShopItems"]>> & {}): string {
  const items = shop.items.length > 0
    ? shop.items
      .map((item) => `#${item.id} ${item.name}: ${item.price} ${item.currencySymbol}, остаток ${item.stock ?? "без лимита"}`)
      .join("\n")
    : "товаров нет";

  return [`Магазин #${shop.shopId}: ${shop.shopName}`, items].join("\n");
}

function formatInventory(inventory: Awaited<ReturnType<AccountQueryService["getInventory"]>> & {}): string {
  const items = inventory.items.length > 0
    ? inventory.items.map((item) => `#${item.id} ${item.name}: ${item.quantity} шт.`).join("\n")
    : "пусто";

  return [`Инвентарь: ${inventory.userDisplayName}`, items].join("\n");
}
