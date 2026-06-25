import { describe, expect, it } from "vitest";
import { parseRegisterPlayerArgs } from "../../src/bot/commands/registrationCommands.js";

describe("parseRegisterPlayerArgs", () => {
  it("parses registration without faculty", () => {
    expect(parseRegisterPlayerArgs(["1", "none", "Merlin", "Ambrosius"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        characterName: "Merlin Ambrosius"
      }
    });
  });

  it("parses registration with faculty, class and spec", () => {
    expect(parseRegisterPlayerArgs(["1", "2", "Merlin", "|", "Mage", "|", "Fire"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        facultyId: 2,
        characterName: "Merlin",
        className: "Mage",
        spec: "Fire"
      }
    });
  });

  it("parses class and spec without spaces around separators", () => {
    expect(parseRegisterPlayerArgs(["1", "2", "Merlin|Mage|Fire"])).toEqual({
      ok: true,
      value: {
        allianceId: 1,
        facultyId: 2,
        characterName: "Merlin",
        className: "Mage",
        spec: "Fire"
      }
    });
  });

  it("rejects missing character name", () => {
    expect(parseRegisterPlayerArgs(["1", "2"])).toMatchObject({
      ok: false
    });
  });

  it("rejects invalid faculty id", () => {
    expect(parseRegisterPlayerArgs(["1", "faculty", "Merlin"])).toMatchObject({
      ok: false
    });
  });
});
