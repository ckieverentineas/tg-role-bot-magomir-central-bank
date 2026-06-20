import type { Bot } from "grammy";
import type { BotContext } from "../../bot/context.js";
import type { LogDeliveryTarget } from "../../application/logs/logRoutingService.js";

export class TelegramLogSink {
  public constructor(private readonly bot: Bot<BotContext>) {}

  public async send(target: Pick<LogDeliveryTarget, "chatId" | "topicId">, text: string): Promise<void> {
    if (target.topicId === null) {
      await this.bot.api.sendMessage(target.chatId.toString(), text);
      return;
    }

    await this.bot.api.sendMessage(target.chatId.toString(), text, {
      message_thread_id: target.topicId
    });
  }
}
