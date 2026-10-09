import type { Metadata } from "next";
import { RecoveryShell } from "@/features/auth/components/recovery";
import { RecoveryForm } from "@/features/auth/components/recovery-form";
import { sendRecoveryLink } from "@/server/auth/actions";
import { redirectIfAuthenticated } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Password recovery · Stride",
  description: "Request a link to reset your Stride password.",
};

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();
  return (
    <RecoveryShell>
      <RecoveryForm action={sendRecoveryLink} />
    </RecoveryShell>
  );
}
