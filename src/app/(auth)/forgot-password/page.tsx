import type { Metadata } from "next";
import { RecoveryShell } from "@/features/auth/components/recovery";
import { RecoveryForm } from "@/features/auth/components/recovery-form";
import { sendRecoveryLink } from "@/server/auth/actions";
import { redirectIfAuthenticated } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Mot de passe oublié · Stride",
  description: "Demande un lien pour réinitialiser ton mot de passe Stride.",
};

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();
  return (
    <RecoveryShell>
      <RecoveryForm action={sendRecoveryLink} />
    </RecoveryShell>
  );
}
