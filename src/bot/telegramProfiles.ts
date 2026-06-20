import type { Context } from "grammy";
import type { ParseResult } from "../application/limits/limitPeriodInput.js";
import type { TelegramUserProfile } from "../application/users/telegramUserService.js";
import type { BotContext } from "./context.js";

export type TelegramUserRef =
  | { kind: "telegram_id"; telegramId: bigint }
  | { kind: "reply" };

export function parseTelegramUserRef(token: string | undefined): ParseResult<TelegramUserRef> {
  if (token === undefined) {
    return {
      ok: false,
      message: "Укажите Telegram ID пользователя или reply."
    };
  }

  if (["reply", "ответ", "реплай"].includes(token.trim().toLowerCase())) {
    return {
      ok: true,
      value: {
        kind: "reply"
      }
    };
  }

  if (!/^\d+$/.test(token)) {
    return {
      ok: false,
      message: "Пользователь должен быть числовым Telegram ID или reply."
    };
  }

  return {
    ok: true,
    value: {
      kind: "telegram_id",
      telegramId: BigInt(token)
    }
  };
}

export function resolveTelegramUserProfile(ctx: BotContext, ref: TelegramUserRef): ParseResult<TelegramUserProfile> {
  if (ref.kind === "telegram_id") {
    return {
      ok: true,
      value: {
        telegramId: ref.telegramId,
        displayName: `tg:${ref.telegramId.toString()}`
      }
    };
  }

  const profile = getTelegramUserProfile(ctx.message?.reply_to_message?.from);

  if (!profile) {
    return {
      ok: false,
      message: "Ответьте командой на сообщение пользователя или укажите Telegram ID."
    };
  }

  return { ok: true, value: profile };
}

export function getTelegramUserProfile(from: Context["from"] | undefined): TelegramUserProfile | null {
  if (!from || from.is_bot) {
    return null;
  }

  const lastName = "last_name" in from ? from.last_name : undefined;
  const displayName = [from.first_name, lastName].filter(Boolean).join(" ").trim();

  return {
    telegramId: BigInt(from.id),
    ...(from.username ? { username: from.username } : {}),
    displayName: displayName || `tg:${from.id}`
  };
}
