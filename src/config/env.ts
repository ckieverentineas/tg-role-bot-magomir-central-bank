import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  ADMIN_TELEGRAM_IDS: z.string().default("")
});

export type AppConfig = {
  botToken: string;
  databaseUrl: string;
  adminTelegramIds: readonly bigint[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    botToken: parsed.BOT_TOKEN,
    databaseUrl: parsed.DATABASE_URL,
    adminTelegramIds: parseTelegramIds(parsed.ADMIN_TELEGRAM_IDS)
  };
}

function parseTelegramIds(value: string): bigint[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (!/^-?\d+$/.test(part)) {
        throw new Error(`Invalid ADMIN_TELEGRAM_IDS value: ${part}`);
      }

      return BigInt(part);
    });
}
