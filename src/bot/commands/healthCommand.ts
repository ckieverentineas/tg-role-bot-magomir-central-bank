import type { Bot } from "grammy";
import type { BotContext } from "../context.js";

export function registerHealthCommand(bot: Bot<BotContext>): void {
  bot.command("health", async (ctx) => {
    await ctx.reply("OK");
  });
}
