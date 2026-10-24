import { describe, expect, it } from "vitest";
import {
  isActivePath,
  mobileTabBarVisible,
} from "../../src/features/app-shell/mobile-nav";
import {
  coachActionLabel,
  coachWaiting,
} from "../../src/features/app-shell/coach-attention";

describe("mobileTabBarVisible", () => {
  it.each(["/today", "/plan", "/activities/abc", "/progress", "/coach"])(
    "shows the tab bar on %s",
    (pathname) => expect(mobileTabBarVisible(pathname)).toBe(true),
  );

  it("shows the tab bar on the team page", () => {
    expect(mobileTabBarVisible("/coach/team")).toBe(true);
  });

  it.each(["/coach/new", "/coach/5f0c7e8e-2b1a-4c1d-9d3e-0a1b2c3d4e5f"])(
    "hides the tab bar in the conversation %s",
    (pathname) => {
      expect(mobileTabBarVisible(pathname)).toBe(false);
    },
  );
});

describe("isActivePath", () => {
  it("matches the destination and its descendants", () => {
    expect(isActivePath("/activities", "/activities")).toBe(true);
    expect(isActivePath("/activities/abc", "/activities")).toBe(true);
    expect(isActivePath("/coach/team", "/coach")).toBe(true);
  });

  it("ignores routes that only share a prefix", () => {
    expect(isActivePath("/planning", "/plan")).toBe(false);
    expect(isActivePath("/today", "/plan")).toBe(false);
  });
});

describe("coachActionLabel", () => {
  it("names the pending items", () => {
    expect(coachActionLabel({ questions: 2, proposals: 1 })).toBe(
      "Coach, 2 questions et 1 proposition en attente",
    );
  });

  it.each([null, { questions: 0, proposals: 0 }])(
    "stays « Coach » without pending items (%o)",
    (attention) => {
      expect(coachActionLabel(attention)).toBe("Coach");
      expect(coachWaiting(attention)).toBe(0);
    },
  );
});
