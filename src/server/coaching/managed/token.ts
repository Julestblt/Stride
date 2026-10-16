import "server-only";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

export const turnTimeoutMs = 900_000;

const claimsSchema = z.object({ exp: z.number().int().positive() });

export function accessTokenExpiry(token: string): number | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const claims = claimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return claims.success ? claims.data.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function tokenNeedsRefresh(
  expiresAtMs: number | null,
  nowMs: number,
  windowMs = turnTimeoutMs,
) {
  return expiresAtMs === null || expiresAtMs - nowMs <= windowMs;
}

export async function turnAccessToken(
  context: OnboardingContext,
  nowMs = Date.now(),
): Promise<string | null> {
  if (!tokenNeedsRefresh(accessTokenExpiry(context.accessToken), nowMs))
    return context.accessToken;
  const { data, error } = await context.client.auth.refreshSession();
  const session = data.session;
  if (error || !session || session.user.id !== context.userId) return null;
  if (tokenNeedsRefresh(accessTokenExpiry(session.access_token), nowMs))
    return null;
  return session.access_token;
}
