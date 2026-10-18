import { describe, expect, it } from "vitest";
import { workingLabel } from "../../src/features/coach/activity";
import { defaultStaff } from "../../src/features/coach/staff";

const now = new Date("2026-10-18T15:40:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("Coach working label", () => {
  it("shows the Coach thinking when no model request is composing", () => {
    expect(workingLabel(defaultStaff.coach, null, now)).toEqual({
      text: "Claire réfléchit…",
      since: null,
      writing: false,
    });
  });

  it("keeps thinking during a short model request", () => {
    expect(workingLabel(defaultStaff.coach, ago(19_000), now).writing).toBe(
      false,
    );
  });

  it("shows a long write after twenty seconds without the elapsed minutes yet", () => {
    expect(workingLabel(defaultStaff.coach, ago(20_000), now)).toEqual({
      text: "Claire rédige sa réponse…",
      since: null,
      writing: true,
    });
  });

  it("adds the elapsed minutes once the write lasts a minute", () => {
    expect(
      workingLabel(defaultStaff.coach, ago(3 * 60_000 + 30_000), now),
    ).toEqual({
      text: "Claire rédige sa réponse…",
      since: "depuis 3 min",
      writing: true,
    });
  });

  it("ignores an unreadable start time", () => {
    expect(workingLabel(defaultStaff.coach, "pas une date", now).writing).toBe(
      false,
    );
  });
});
