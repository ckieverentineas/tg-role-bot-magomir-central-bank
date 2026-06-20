import { Bot } from "grammy";
import type { PrismaClient } from "@prisma/client";
import { LogRoutingService } from "../application/logs/logRoutingService.js";
import type { AppConfig } from "../config/env.js";
import { registerHealthCommand } from "./commands/healthCommand.js";
import { registerLogBindingCommands } from "./commands/logBindingCommands.js";
import { registerStartCommand } from "./commands/startCommand.js";
import type { BotContext } from "./context.js";

export function createBot(config: AppConfig, db: PrismaClient): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.botToken);
  const logRoutingService = new LogRoutingService(db);

  registerStartCommand(bot);
  registerHealthCommand(bot);
  registerLogBindingCommands(bot, logRoutingService, config);

  bot.catch((error) => {
    console.error("Telegram bot error", error);
  });

  return bot;
}
