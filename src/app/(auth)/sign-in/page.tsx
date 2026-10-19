import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import {
  resendConfirmationLink,
  sendMagicLink,
  signIn,
} from "@/server/auth/actions";
import { redirectIfAuthenticated } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Se connecter · Stride",
  description: "Connecte-toi à ton compte Stride.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  await redirectIfAuthenticated();
  const parameters = await searchParams;
  return (
    <AuthShell>
      <SignInForm
        action={signIn}
        magicAction={sendMagicLink}
        resendAction={resendConfirmationLink}
        linkError={parameters.error === "link"}
        missingRecoveryVerifier={parameters.reason === "verifier"}
      />
    </AuthShell>
  );
}
