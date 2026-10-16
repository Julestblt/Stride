import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicEnvironment } from "@/lib/env";
import type { OnboardingContext } from "@/server/onboarding/context";
import type { Database } from "@/server/supabase/database.types";
import { applyAcceptedProposal, resetPlan, type WorkerResult } from "./apply";

export type WorkerRequest = {
  method: string;
  path: string;
  authorization: string | undefined;
};

export type WorkerResponse = {
  status: number;
  body: WorkerResult | { ok: boolean; reason?: string };
};

const applyPath = /^\/v1\/proposals\/([^/]+)\/apply$/;
const proposalId = z.uuid();

async function athleteContext(
  authorization: string | undefined,
): Promise<OnboardingContext | null> {
  const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token) return null;
  const environment = getPublicEnvironment();
  if (
    !environment.NEXT_PUBLIC_SUPABASE_URL ||
    !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("Supabase is not configured");
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    client,
    userId: data.user.id,
    email: data.user.email ?? null,
    accessToken: token,
  };
}

export async function handleWorkerRequest(
  request: WorkerRequest,
): Promise<WorkerResponse> {
  if (request.method === "GET" && request.path === "/healthz")
    return { status: 200, body: { ok: true } };
  if (request.method !== "POST")
    return { status: 404, body: { ok: false, reason: "not_found" } };
  const apply = request.path.match(applyPath);
  if (!apply && request.path !== "/v1/plan/reset")
    return { status: 404, body: { ok: false, reason: "not_found" } };
  if (apply && !proposalId.safeParse(apply[1]).success)
    return { status: 400, body: { ok: false, reason: "invalid_request" } };

  const context = await athleteContext(request.authorization);
  if (!context)
    return { status: 401, body: { ok: false, reason: "unauthorized" } };

  const result = apply
    ? await applyAcceptedProposal(context, apply[1])
    : await resetPlan(context);
  return { status: result.ok ? 200 : 409, body: result };
}
