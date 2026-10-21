import { describe, expect, it } from "vitest";
import {
  parseThemePreference,
  resolveTheme,
  themeButtonLabel,
} from "../../src/features/theme/model";

describe("theme preference", () => {
  it("keeps known preferences and falls back to dark", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference(null)).toBe("dark");
    expect(parseThemePreference("sepia")).toBe("dark");
  });

  it("follows the operating system only for the system preference", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("names the current choice in French", () => {
    expect(themeButtonLabel("system")).toBe("Thème : Système");
  });
});
