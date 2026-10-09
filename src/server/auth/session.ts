import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/client";

export async function getCurrentUser() {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export async function redirectIfAuthenticated() {
  if (await getCurrentUser()) redirect("/");
}
