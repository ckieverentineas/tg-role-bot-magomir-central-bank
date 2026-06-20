import type { AppConfig } from "../../config/env.js";
import type { BotContext } from "../context.js";

export async function requireAdmin(ctx: BotContext, config: AppConfig): Promise<boolean> {
  if (isAdmin(ctx, config)) {
    return true;
  }

  await ctx.reply("Недостаточно прав для этой команды.");
  return false;
}

function isAdmin(ctx: BotContext, config: AppConfig): boolean {
  const telegramId = ctx.from?.id;

  if (telegramId === undefined) {
    return false;
  }

  return config.adminTelegramIds.some((adminId) => adminId === BigInt(telegramId));
}
