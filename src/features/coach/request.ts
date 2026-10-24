import { z } from "zod";

export const maximumRequestLength = 500;

const requestTextSchema = z
  .string()
  .trim()
  .min(1)
  .transform((text) => text.slice(0, maximumRequestLength).trim());

export function parseRequestText(value: unknown) {
  const parsed = requestTextSchema.safeParse(
    Array.isArray(value) ? value[0] : value,
  );
  return parsed.success ? parsed.data : null;
}

export function coachRequestHref(text: string, sessionKey?: string | null) {
  const params = new URLSearchParams({
    text: text.slice(0, maximumRequestLength),
  });
  if (sessionKey) params.set("session", sessionKey);
  return `/coach/new?${params.toString()}`;
}
