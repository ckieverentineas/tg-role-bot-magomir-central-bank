import type { PrismaClient, User } from "@prisma/client";

export type TelegramUserProfile = {
  telegramId: bigint;
  username?: string;
  displayName: string;
};

type UserDatabase = Pick<PrismaClient, "user">;

export class TelegramUserService {
  public constructor(private readonly db: UserDatabase) {}

  public async upsertTelegramUser(profile: TelegramUserProfile): Promise<User> {
    return this.db.user.upsert({
      where: {
        telegramId: profile.telegramId
      },
      create: {
        telegramId: profile.telegramId,
        username: profile.username ?? null,
        displayName: profile.displayName
      },
      update: {
        username: profile.username ?? null,
        displayName: profile.displayName
      }
    });
  }
}
