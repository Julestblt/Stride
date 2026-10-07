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
  try {
    origin = parseSiteUrl(process.env.SITE_URL);
    if (input.success) {
      const client = await createSupabaseServerClient({ writable: true });
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
      if (!response.error && response.data.session)
        destination =
          input.data.type === "recovery"
            ? "/reset-password"
            : safeDestination(parameters.get("next"));
    }
  } catch {
    destination = "/sign-in?error=link";
  }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
