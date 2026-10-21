"use client";

import { useSyncExternalStore } from "react";
import {
  defaultThemePreference,
  lightSchemeQuery,
  parseThemePreference,
  resolveTheme,
  themeStorageKey,
  type ResolvedTheme,
  type ThemePreference,
} from "../model";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(themeStorageKey));
  } catch {
    return defaultThemePreference;
  }
}

function readResolved(): ResolvedTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function apply() {
  document.documentElement.dataset.theme = resolveTheme(
    readPreference(),
    matchMedia(lightSchemeQuery).matches,
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia(lightSchemeQuery);
  const onStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey) apply();
  };
  media.addEventListener("change", apply);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", apply);
    window.removeEventListener("storage", onStorage);
  };
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(themeStorageKey, preference);
  } catch {}
  apply();
}

export function useThemePreference() {
  return useSyncExternalStore(
    subscribe,
    readPreference,
    () => defaultThemePreference,
  );
}

export function useResolvedTheme() {
  return useSyncExternalStore(
    subscribe,
    readResolved,
    (): ResolvedTheme => "dark",
  );
}
