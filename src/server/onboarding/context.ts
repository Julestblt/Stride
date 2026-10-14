import "server-only";
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { createSupabaseServerClient } from "@/server/supabase/client";
export type OnboardingContext = {
  client: SupabaseClient<Database>;
  userId: string;
  email: string | null;
  createdAt?: string | null;
  accessToken: string;
};
export async function verifyOnboardingContext(
  client: SupabaseClient<Database>,
): Promise<OnboardingContext | null> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (expiredSession(error)) return null;
    throw new Error("Identity verification is unavailable");
  }
  if (!data.user) return null;
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    if (expiredSession(sessionError)) return null;
    throw new Error("Session verification is unavailable");
  }
  if (!session.session || session.session.user.id !== data.user.id) return null;
  return {
    client,
    userId: data.user.id,
    email: data.user.email ?? null,
    createdAt: data.user.created_at ?? null,
    accessToken: session.session.access_token,
  };
}
export async function getOnboardingContext({ writable = false } = {}) {
  return verifyOnboardingContext(
    await createSupabaseServerClient({ writable }),
  );
}

function expiredSession(error: unknown) {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) &&
      (error.status === 401 ||
        error.status === 403 ||
        [
          "bad_jwt",
          "refresh_token_not_found",
          "refresh_token_already_used",
          "session_not_found",
        ].includes(error.code ?? "")))
  );
}
