import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { resendConfirmationLink, signUp } from "@/server/auth/actions";
import { redirectIfAuthenticated } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Create account · Stride",
  description: "Create your Stride account.",
};

export default async function SignUpPage() {
  await redirectIfAuthenticated();
  return (
    <AuthShell signup>
      <SignUpForm action={signUp} resendAction={resendConfirmationLink} />
    </AuthShell>
  );
}
