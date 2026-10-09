import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ExpiredLinkForm } from "@/features/auth/components/expired-link-form";
import { resendConfirmationLink } from "@/server/auth/actions";
import { redirectIfAuthenticated } from "@/server/auth/session";

export const metadata: Metadata = { title: "Link expired · Stride" };

export default async function LinkExpiredPage() {
  await redirectIfAuthenticated();
  return (
    <AuthShell signup>
      <ExpiredLinkForm action={resendConfirmationLink} />
    </AuthShell>
  );
}
