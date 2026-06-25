import type { BotContext } from "./context.js";

type TelegramEntityLike = {
  type: string;
  offset: number;
  length: number;
  custom_emoji_id?: string;
};

export type TelegramTextToken = {
  text: string;
  customEmojiId?: string;
};

export function getCommandTokens(ctx: BotContext): TelegramTextToken[] {
  const text = ctx.message?.text ?? "";
  const tokens = tokenizeTelegramText(text, ctx.message?.entities ?? []);

  return tokens.slice(1);
}

export function getCommandArgs(ctx: BotContext): string[] {
  return getCommandTokens(ctx).map((token) => token.text);
}

export function tokenizeTelegramText(
  text: string,
  entities: readonly TelegramEntityLike[] = []
): TelegramTextToken[] {
  const customEmojiEntities = entities.filter(
    (entity) => entity.type === "custom_emoji" && typeof entity.custom_emoji_id === "string"
  );

  return [...text.matchAll(/\S+/gu)].map((match) => {
    const tokenText = match[0];
    const start = match.index ?? 0;
    const end = start + tokenText.length;
    const customEmoji = customEmojiEntities.find((entity) => {
      const entityStart = entity.offset;
      const entityEnd = entity.offset + entity.length;

      return start < entityEnd && entityStart < end;
    });

    return {
      text: tokenText,
      ...(customEmoji?.custom_emoji_id ? { customEmojiId: customEmoji.custom_emoji_id } : {})
    };
  });
}
