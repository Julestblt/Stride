import type { Metadata } from "next";
import { RecoveryShell } from "@/features/auth/components/recovery";
import { ResetForm } from "@/features/auth/components/reset-form";
import { savePassword } from "@/server/auth/actions";
import { createSupabaseServerClient } from "@/server/supabase/client";

export const metadata: Metadata = {
  title: "New password · Stride",
  description: "Choose a new Stride password after verifying your account.",
};

export default async function ResetPasswordPage() {
  let verified = false;
  let email: string | undefined;
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    verified = !error && Boolean(data.user?.email_confirmed_at);
    email = data.user?.email;
  } catch {
    verified = false;
  }
  return (
    <RecoveryShell>
      <ResetForm action={savePassword} verified={verified} email={email} />
    </RecoveryShell>
  );
}
