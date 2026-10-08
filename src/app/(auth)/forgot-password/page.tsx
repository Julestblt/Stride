import type { Metadata } from "next";
import { RecoveryShell } from "@/features/auth/components/recovery";
import { RecoveryForm } from "@/features/auth/components/recovery-form";
import { sendRecoveryLink } from "@/server/auth/actions";

export const metadata: Metadata = {
  title: "Password recovery · Stride",
  description: "Request a link to reset your Stride password.",
};

export default function ForgotPasswordPage() {
  return (
    <RecoveryShell>
      <RecoveryForm action={sendRecoveryLink} />
    </RecoveryShell>
  );
}
