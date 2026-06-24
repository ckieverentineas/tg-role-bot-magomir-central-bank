import { describe, expect, it } from "vitest";
import { parseLogTargetActiveArgs } from "../../src/bot/commands/logBindingCommands.js";

describe("log binding command parsers", () => {
  it("parses log target active commands", () => {
    expect(parseLogTargetActiveArgs(["12"])).toEqual({
      ok: true,
      value: {
        targetId: 12
      }
    });
  });

  it("rejects invalid target ids", () => {
    expect(parseLogTargetActiveArgs(["0"])).toMatchObject({
      ok: false
    });
  });
});
