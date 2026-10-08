import "server-only";
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/client";
import { parseSiteUrl, safeDestination } from "./environment";

const callbackSchema = z.union([
  z.object({
    code: z.string().min(1).max(2048),
    flowId: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable(),
    token_hash: z.null(),
    type: z.null(),
  }),
  z.object({
    code: z.null(),
    flowId: z.null(),
    token_hash: z.string().min(1).max(2048),
    type: z.enum(["signup", "email", "magiclink", "recovery"]),
  }),
]);

function authErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) return {};
  const details = error as { name?: unknown; code?: unknown };
  return {
    name:
      typeof details.name === "string" &&
      /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(details.name)
        ? details.name
        : "UnknownError",
    code:
      typeof details.code === "string" && /^[a-z0-9_]{1,64}$/.test(details.code)
        ? details.code
        : undefined,
  };
}

export async function completeAuthCallback(request: NextRequest) {
  const parameters = request.nextUrl.searchParams;
  const input = callbackSchema.safeParse({
    code: parameters.get("code"),
    flowId: parameters.get("sb_flow_id"),
    token_hash: parameters.get("token_hash"),
    type: parameters.get("type"),
  });
  let destination = "/sign-in?error=link";
  let origin = request.nextUrl.origin;
  let stage = "callback_input";
  try {
    origin = parseSiteUrl(process.env.SITE_URL);
    if (input.success) {
      const client = await createSupabaseServerClient({ writable: true });
      stage = input.data.code !== null ? "pkce_exchange" : "token_verification";
      const response =
        input.data.code !== null
          ? await client.auth.exchangeCodeForSession(
              input.data.code,
              input.data.flowId ? { flowId: input.data.flowId } : undefined,
            )
          : await client.auth.verifyOtp({
              token_hash: input.data.token_hash,
              type: input.data.type,
            });
      if (response.error) {
        const details = authErrorDetails(response.error);
        console.warn("Supabase Auth callback failed", { stage, ...details });
        if (details.code === "pkce_code_verifier_not_found")
          destination = "/sign-in?error=link&reason=verifier";
      } else if (response.data.session) {
        destination =
          input.data.type === "recovery"
            ? "/reset-password"
            : safeDestination(parameters.get("next"));
      } else {
        console.warn("Supabase Auth callback returned no session", { stage });
      }
    }
  } catch (error) {
    console.warn("Supabase Auth callback failed", {
      stage,
      ...authErrorDetails(error),
    });
  }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
