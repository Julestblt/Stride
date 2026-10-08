import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { signUp } from "@/server/auth/actions";

export const metadata: Metadata = {
  title: "Create account · Stride",
  description: "Create your Stride account.",
};

export default function SignUpPage() {
  return (
    <AuthShell signup>
      <SignUpForm action={signUp} />
    </AuthShell>
  );
}
