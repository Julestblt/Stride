import { describe, expect, it } from "vitest";
import { parsePublicEnvironment } from "../../src/lib/env";

describe("public environment", () => {
  it("accepts an unconfigured local environment", () => {
    expect(parsePublicEnvironment({})).toEqual({});
  });

  it("accepts a complete Supabase configuration", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://stride.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://stride.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
  });

  it("rejects partial Supabase configuration", () => {
    expect(() =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://stride.supabase.co",
      }),
    ).toThrow("Supabase URL and publishable key must be configured together");
  });

  it("rejects invalid Supabase URLs", () => {
    expect(() =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow();
  });
});
