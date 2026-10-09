import { describe, expect, it } from "vitest";
import {
  beginSave,
  createAutosave,
  editField,
  resolveConflict,
  retryDelay,
  saveConflicted,
  saveFailed,
  saveSucceeded,
} from "../../src/features/onboarding/autosave";

type Values = {
  name: string | null;
  days: number[] | null;
  weight: number | null;
};
const start = () =>
  createAutosave<Values>({
    values: { name: "Ada", days: [2, 4], weight: 60 },
    revision: 3,
  });

describe("autosave queue", () => {
  it("tracks dirty fields and sends only them with the expected revision", () => {
    const edited = editField(
      editField(start(), "name", "Ada L."),
      "weight",
      61,
    );
    expect(edited.dirty).toEqual(["name", "weight"]);
    expect(edited.status).toBe("unsaved");
    const [saving, request] = beginSave(edited);
    expect(request).toEqual({
      seq: 1,
      values: { name: "Ada L.", weight: 61 },
      revision: 3,
    });
    expect(saving.status).toBe("saving");
    expect(beginSave(saving)[1]).toBeNull();
  });
  it("returns to clean when an edit is reverted before saving", () => {
    const reverted = editField(editField(start(), "weight", 61), "weight", 60);
    expect(reverted.dirty).toEqual([]);
    expect(reverted.status).toBe("saved");
  });
  it("keeps newer edits made while a slow save is in flight", () => {
    const [saving, request] = beginSave(editField(start(), "name", "Ad"));
    const typed = editField(saving, "name", "Ada Lovelace");
    const done = saveSucceeded(typed, request!.seq, {
      values: { name: "Ad", days: [2, 4], weight: 60 },
      revision: 4,
    });
    expect(done.local.name).toBe("Ada Lovelace");
    expect(done.dirty).toEqual(["name"]);
    expect(done.revision).toBe(4);
    expect(done.status).toBe("unsaved");
    expect(beginSave(done)[1]?.values).toEqual({ name: "Ada Lovelace" });
  });
  it("ignores responses that are not the current request", () => {
    const [saving] = beginSave(editField(start(), "weight", 62));
    const stale = saveSucceeded(saving, 99, {
      values: { name: "X", days: null, weight: 1 },
      revision: 9,
    });
    expect(stale).toBe(saving);
    expect(saveFailed(saving, 99, "error")).toBe(saving);
  });
  it("adopts server values for untouched fields after a save", () => {
    const [saving, request] = beginSave(editField(start(), "weight", 62));
    const done = saveSucceeded(saving, request!.seq, {
      values: { name: "Ada (autre appareil)", days: [1], weight: 62 },
      revision: 5,
    });
    expect(done.local).toEqual({
      name: "Ada (autre appareil)",
      days: [1],
      weight: 62,
    });
    expect(done.status).toBe("saved");
  });
  it("keeps input on failure and reports offline separately", () => {
    const [saving, request] = beginSave(editField(start(), "weight", 62));
    const failed = saveFailed(saving, request!.seq, "error");
    expect(failed.local.weight).toBe(62);
    expect(failed.dirty).toEqual(["weight"]);
    expect(failed.status).toBe("error");
    expect(failed.failures).toBe(1);
    expect(saveFailed(saving, request!.seq, "offline").status).toBe("offline");
    const [retrying, retry] = beginSave(failed);
    expect(retry?.values).toEqual({ weight: 62 });
    expect(retrying.status).toBe("saving");
  });
  it("resends unchanged-on-server fields after a revision conflict", () => {
    const [saving, request] = beginSave(editField(start(), "weight", 62));
    const conflicted = saveConflicted(saving, request!.seq, {
      values: { name: "Ada", days: [1, 3], weight: 60 },
      revision: 4,
    });
    expect(conflicted.conflicts).toEqual([]);
    expect(conflicted.dirty).toEqual(["weight"]);
    expect(conflicted.local).toEqual({ name: "Ada", days: [1, 3], weight: 62 });
    expect(beginSave(conflicted)[1]).toEqual({
      seq: 2,
      values: { weight: 62 },
      revision: 4,
    });
  });
  it("surfaces fields changed on both devices instead of overwriting", () => {
    const [saving, request] = beginSave(editField(start(), "weight", 62));
    const conflicted = saveConflicted(saving, request!.seq, {
      values: { name: "Ada", days: [2, 4], weight: 70 },
      revision: 4,
    });
    expect(conflicted.status).toBe("conflict");
    expect(conflicted.conflicts).toEqual(["weight"]);
    expect(conflicted.theirs).toEqual({ weight: 70 });
    expect(conflicted.local.weight).toBe(62);
    expect(beginSave(conflicted)[1]).toBeNull();
    const mine = resolveConflict(conflicted, "weight", "mine");
    expect(beginSave(mine)[1]?.values).toEqual({ weight: 62 });
    const theirs = resolveConflict(conflicted, "weight", "theirs");
    expect(theirs.local.weight).toBe(70);
    expect(theirs.dirty).toEqual([]);
    expect(theirs.status).toBe("saved");
  });
  it("backs off retries up to thirty seconds", () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
      2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
    ]);
  });
});
