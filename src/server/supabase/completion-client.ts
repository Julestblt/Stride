import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicEnvironment } from "@/lib/env";
export function createCompletionClient() {
  const key = process.env.SUPABASE_ONBOARDING_COMPLETION_KEY;
  const url = getPublicEnvironment().NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  const client = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return {
    complete: (userId: string, step: "garmin" | "profile", revision: number) =>
      client.rpc("complete_onboarding_step_server", {
        p_user_id: userId,
        p_step: step,
        p_expected_revision: revision,
      }),
  };
}
