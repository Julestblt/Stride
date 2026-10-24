import { describe, expect, it } from "vitest";
import {
  coachRequestHref,
  maximumRequestLength,
  parseRequestText,
} from "@/features/coach/request";

describe("coach request prefill", () => {
  it("builds a new conversation link with the request and the session", () => {
    const href = coachRequestHref(
      "Allège le seuil de jeudi, mes jambes sont lourdes.",
      "2026-10-15:threshold",
    );
    const url = new URL(href, "https://stride.test");
    expect(url.pathname).toBe("/coach/nouvelle");
    expect(parseRequestText(url.searchParams.get("texte"))).toBe(
      "Allège le seuil de jeudi, mes jambes sont lourdes.",
    );
    expect(url.searchParams.get("seance")).toBe("2026-10-15:threshold");
  });

  it("ignores missing text and truncates long text", () => {
    expect(parseRequestText(undefined)).toBeNull();
    expect(parseRequestText("   ")).toBeNull();
    expect(parseRequestText(["  Bonjour  ", "ignoré"])).toBe("Bonjour");
    expect(parseRequestText("a".repeat(800))).toHaveLength(
      maximumRequestLength,
    );
  });
});
