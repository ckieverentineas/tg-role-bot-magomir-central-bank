import type { AuthorizationService } from "../../application/auth/authorizationService.js";
import type { AppConfig } from "../../config/env.js";
import type { BotContext } from "../context.js";

export async function requireAdmin(ctx: BotContext, config: AppConfig): Promise<boolean> {
  if (isGlobalAdmin(ctx, config)) {
    return true;
  }

  await ctx.reply("Недостаточно прав для этой команды.");
  return false;
}

export async function requireAllianceAdmin(
  ctx: BotContext,
  authorizationService: AuthorizationService,
  allianceId: number
): Promise<boolean> {
  if (await authorizationService.canManageAlliance(getTelegramId(ctx), allianceId)) {
    return true;
  }

  await ctx.reply("Недостаточно прав для управления этой ролевой.");
  return false;
}

export async function requireShopAdmin(
  ctx: BotContext,
  authorizationService: AuthorizationService,
  shopId: number
): Promise<boolean> {
  if (await authorizationService.canManageShop(getTelegramId(ctx), shopId)) {
    return true;
  }

  await ctx.reply("Недостаточно прав для управления этим магазином.");
  return false;
}

export async function requireShopItemAdmin(
  ctx: BotContext,
  authorizationService: AuthorizationService,
  itemId: number
): Promise<boolean> {
  if (await authorizationService.canManageShopItem(getTelegramId(ctx), itemId)) {
    return true;
  }

  await ctx.reply("Недостаточно прав для управления этим товаром.");
  return false;
}

export function getTelegramId(ctx: BotContext): bigint | undefined {
  const telegramId = ctx.from?.id;

  return telegramId === undefined ? undefined : BigInt(telegramId);
}

function isGlobalAdmin(ctx: BotContext, config: AppConfig): boolean {
  const telegramId = getTelegramId(ctx);

  if (telegramId === undefined) {
    return false;
  }

  return config.adminTelegramIds.some((adminId) => adminId === telegramId);
}
