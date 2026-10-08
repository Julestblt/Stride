"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  initialAuthState,
  type AuthAction,
  type AuthState,
} from "@/features/auth/schemas";
import { passwordPolicy } from "@/features/auth/password-policy";
import {
  EmailField,
  FormFeedback,
  FormHeading,
  PasswordField,
  PasswordGuidance,
} from "./form-controls";

export function SignUpForm({ action }: { action: AuthAction }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [edited, setEdited] = useState<
    Partial<Record<"email" | "password" | "confirmation", boolean>>
  >({});
  const [state, formAction, pending] = useActionState(
    async (previous: AuthState, data: FormData) => {
      const result = await action(previous, data);
      if (result.status === "success") {
        setPassword("");
        setConfirmation("");
      }
      return result;
    },
    initialAuthState,
  );
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const valid =
    passwordPolicy(password, email).valid && password === confirmation;
  return (
    <form
      action={formAction}
      onSubmit={() => setEdited({})}
      className="flex flex-col gap-5"
      aria-busy={pending}
    >
      <FormHeading
        title="Create your account"
        description="Just the basics. Your coach will ask the rest."
      />
      <FieldGroup>
        <EmailField
          value={email}
          onChange={(value) => {
            setEmail(value);
            setEdited((previous) => ({ ...previous, email: true }));
          }}
          error={edited.email ? undefined : state.errors?.email}
          disabled={pending}
        />
        <div className="flex flex-col gap-3">
          <PasswordField
            value={password}
            onChange={(value) => {
              setPassword(value);
              setEdited((previous) => ({ ...previous, password: true }));
            }}
            newPassword
            error={
              edited.password || edited.email
                ? undefined
                : state.errors?.password
            }
            description="password-guidance"
            disabled={pending}
          />
          <PasswordGuidance password={password} email={email} />
        </div>
        <PasswordField
          name="confirmation"
          label="Confirm password"
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value);
            setEdited((previous) => ({ ...previous, confirmation: true }));
          }}
          newPassword
          error={
            mismatch
              ? "Passwords don't match yet."
              : edited.confirmation || edited.password
                ? undefined
                : state.errors?.confirmation
          }
          disabled={pending}
        />
      </FieldGroup>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || !valid} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <div className="text-xs leading-relaxed text-muted-foreground">
        <p>Review the account policies before continuing.</p>
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-accent">Terms</summary>
          <p className="mt-2">
            Stride&apos;s terms are not published yet. This product foundation
            is not ready for public launch.
          </p>
        </details>
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-accent">
            Privacy policy
          </summary>
          <p className="mt-2">
            Stride&apos;s privacy policy is not published yet. Account
            authentication is handled by Supabase. A complete privacy policy is
            required before public launch.
          </p>
        </details>
      </div>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
