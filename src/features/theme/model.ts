import { z } from "zod";

export const themePreferences = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = "light" | "dark";

export const themeStorageKey = "stride-theme";
export const defaultThemePreference: ThemePreference = "dark";
export const lightSchemeQuery = "(prefers-color-scheme: light)";

export const themeLabels: Record<ThemePreference, string> = {
  light: "Clair",
  dark: "Sombre",
  system: "Système",
};

const preferenceSchema = z.enum(themePreferences);

export function parseThemePreference(value: unknown): ThemePreference {
  const parsed = preferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultThemePreference;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersLight ? "light" : "dark";
  return preference;
}

export function themeButtonLabel(preference: ThemePreference) {
  return `Thème : ${themeLabels[preference]}`;
}

export const themeScript = `(function(){var p;try{p=localStorage.getItem(${JSON.stringify(themeStorageKey)})}catch(e){}if(p!=="light"&&p!=="system")p=${JSON.stringify(defaultThemePreference)};document.documentElement.dataset.theme=p==="system"?(matchMedia(${JSON.stringify(lightSchemeQuery)}).matches?"light":"dark"):p})()`;
