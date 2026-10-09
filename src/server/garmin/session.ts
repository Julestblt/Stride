import "server-only";
import { createSupabaseServerClient } from "@/server/supabase/client";
import { createGarminClient, type GarminRequestContext } from "./client";
import { parseGarminApiUrl } from "./environment";

export async function getGarminRequestContext(): Promise<GarminRequestContext | null> {
  try {
    const client = await createSupabaseServerClient();
    const { data: user, error } = await client.auth.getUser();
    if (error || !user.user) return null;
    const { data } = await client.auth.getSession();
    const accessToken = data.session?.access_token;
    return accessToken ? { accessToken } : null;
  } catch {
    return null;
  }
}

export function getGarminClient() {
  return createGarminClient({
    baseUrl: parseGarminApiUrl(process.env.GARMIN_API_URL),
  });
}
