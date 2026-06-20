import { createBot } from "./bot/createBot.js";
import { loadConfig } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/prismaClient.js";

const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);
const bot = createBot(config, prisma);

const stop = async (): Promise<void> => {
  await bot.stop();
  await prisma.$disconnect();
};

process.once("SIGINT", () => {
  void stop();
});

process.once("SIGTERM", () => {
  void stop();
});

await bot.start({
  drop_pending_updates: true,
  onStart: (botInfo) => {
    console.log(`Telegram bot started as @${botInfo.username}.`);
  }
});
