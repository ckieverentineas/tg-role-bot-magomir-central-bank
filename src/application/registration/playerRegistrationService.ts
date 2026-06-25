import type { PrismaClient } from "@prisma/client";
import type { TelegramUserProfile } from "../users/telegramUserService.js";

type PlayerRegistrationDatabase = Pick<PrismaClient, "alliance" | "faculty" | "user" | "allianceMember">;

export type RegistrationAllianceView = {
  id: number;
  name: string;
  slug: string;
  faculties: {
    id: number;
    name: string;
    symbol: string;
  }[];
};

export type RegisteredPlayerView = {
  id: number;
  telegramId: bigint;
  displayName: string;
  characterName: string;
  className: string | null;
  spec: string | null;
  activeAlliance: {
    id: number;
    name: string;
  } | null;
  faculty: {
    id: number;
    name: string;
    symbol: string;
  } | null;
};

export type RegisterPlayerInput = {
  telegramProfile: TelegramUserProfile;
  allianceId: number;
  characterName: string;
  className?: string;
  spec?: string;
  facultyId?: number;
};

export class PlayerRegistrationService {
  public constructor(private readonly db: PlayerRegistrationDatabase) {}

  public async listRegistrationAlliances(): Promise<RegistrationAllianceView[]> {
    const alliances = await this.db.alliance.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        faculties: {
          where: {
            isHidden: false
          },
          select: {
            id: true,
            name: true,
            symbol: true
          },
          orderBy: [
            { sortOrder: "asc" },
            { id: "asc" }
          ]
        }
      },
      orderBy: {
        id: "asc"
      }
    });

    return alliances;
  }

  public async getPlayer(telegramId: bigint): Promise<RegisteredPlayerView | null> {
    const user = await this.db.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true,
        telegramId: true,
        displayName: true,
        characterName: true,
        className: true,
        spec: true,
        activeAlliance: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user || !user.characterName) {
      return null;
    }

    const membership = user.activeAlliance
      ? await this.db.allianceMember.findUnique({
          where: {
            allianceId_userId: {
              allianceId: user.activeAlliance.id,
              userId: user.id
            }
          },
          select: {
            faculty: {
              select: {
                id: true,
                name: true,
                symbol: true
              }
            }
          }
        })
      : null;

    return {
      id: user.id,
      telegramId: user.telegramId,
      displayName: user.displayName,
      characterName: user.characterName,
      className: user.className,
      spec: user.spec,
      activeAlliance: user.activeAlliance,
      faculty: membership?.faculty ?? null
    };
  }

  public async registerPlayer(input: RegisterPlayerInput): Promise<RegisteredPlayerView> {
    const characterName = normalizeRequiredText(input.characterName, "Character name is required.");
    const className = normalizeOptionalText(input.className);
    const spec = normalizeOptionalText(input.spec);

    const alliance = await this.db.alliance.findUnique({
      where: {
        id: input.allianceId
      },
      select: {
        id: true
      }
    });

    if (!alliance) {
      throw new Error(`Alliance ${input.allianceId} was not found.`);
    }

    if (input.facultyId !== undefined) {
      const faculty = await this.db.faculty.findFirst({
        where: {
          id: input.facultyId,
          allianceId: input.allianceId,
          isHidden: false
        },
        select: {
          id: true
        }
      });

      if (!faculty) {
        throw new Error(`Faculty ${input.facultyId} was not found in alliance ${input.allianceId}.`);
      }
    }

    const user = await this.db.user.upsert({
      where: {
        telegramId: input.telegramProfile.telegramId
      },
      create: {
        telegramId: input.telegramProfile.telegramId,
        username: input.telegramProfile.username ?? null,
        displayName: input.telegramProfile.displayName,
        characterName,
        className: className ?? null,
        spec: spec ?? null,
        activeAllianceId: input.allianceId
      },
      update: {
        username: input.telegramProfile.username ?? null,
        displayName: input.telegramProfile.displayName,
        characterName,
        className: className ?? null,
        spec: spec ?? null,
        activeAllianceId: input.allianceId
      },
      select: {
        id: true
      }
    });

    await this.db.allianceMember.upsert({
      where: {
        allianceId_userId: {
          allianceId: input.allianceId,
          userId: user.id
        }
      },
      create: {
        allianceId: input.allianceId,
        userId: user.id,
        className: className ?? null,
        spec: spec ?? null,
        facultyId: input.facultyId ?? null
      },
      update: {
        className: className ?? null,
        spec: spec ?? null,
        facultyId: input.facultyId ?? null
      }
    });

    const registered = await this.getPlayer(input.telegramProfile.telegramId);
    if (!registered) {
      throw new Error("Player registration was not saved.");
    }

    return registered;
  }
}

function normalizeRequiredText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
