import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { sendMagicLink, signIn } from "@/server/auth/actions";

export const metadata: Metadata = {
  title: "Sign in · Stride",
  description: "Sign in to your Stride account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const parameters = await searchParams;
  return (
    <AuthShell>
      <SignInForm
        action={signIn}
        magicAction={sendMagicLink}
        linkError={parameters.error === "link"}
        missingRecoveryVerifier={parameters.reason === "verifier"}
      />
    </AuthShell>
  );
}
