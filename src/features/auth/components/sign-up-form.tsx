"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { ConfirmationResend } from "./confirmation-resend";

export function SignUpForm({
  action,
  resendAction,
}: {
  action: AuthAction;
  resendAction: AuthAction;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [edited, setEdited] = useState<
    Partial<Record<"fullName" | "email" | "password" | "confirmation", boolean>>
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
    fullName.trim().length >= 2 &&
    passwordPolicy(password, email).valid &&
    password === confirmation;
  if (state.status === "success" && state.email) {
    return (
      <div className="flex flex-1 flex-col gap-6 md:flex-none">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Step 1 of 4 · Confirm your email
        </p>
        <div
          className="grid size-12 place-items-center rounded-control border border-border text-2xl text-accent"
          aria-hidden="true"
        >
          ✉
        </div>
        <FormHeading
          title="Check your inbox"
          description={`We sent a confirmation link to ${state.email}. Open it to activate your account.`}
        />
        <ol className="flex flex-col gap-3 rounded-surface border border-border bg-surface-raised p-4 text-sm text-muted">
          {[
            "Open the email from Stride",
            "Select “Confirm email”",
            "Come back here, signed in",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border font-mono text-xs text-foreground">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <ConfirmationResend
          action={resendAction}
          email={state.email}
          sentAt={state.sentAt}
        />
        <form action="/sign-up" method="get" className="text-sm text-muted">
          Wrong address?{" "}
          <button type="submit" className="text-accent hover:underline">
            Change email
          </button>
        </form>
        <p className="text-sm text-muted">
          Can&apos;t find it? Check spam or promotions. Use the most recent
          link.
        </p>
        <p className="mt-auto border-t border-border pt-5 text-center text-sm text-muted md:mt-0">
          Already confirmed?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }
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
        <Field
          data-invalid={Boolean(!edited.fullName && state.errors?.fullName)}
        >
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setEdited((previous) => ({ ...previous, fullName: true }));
            }}
            disabled={pending}
            aria-invalid={Boolean(!edited.fullName && state.errors?.fullName)}
            aria-describedby={
              state.errors?.fullName
                ? "full-name-error full-name-help"
                : "full-name-help"
            }
          />
          <p id="full-name-help" className="text-xs text-muted">
            This is how your coach will address you.
          </p>
          {!edited.fullName && state.errors?.fullName && (
            <FieldError id="full-name-error">
              {state.errors.fullName}
            </FieldError>
          )}
        </Field>
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
      <p className="text-xs text-muted">
        We&apos;ll email you a link to confirm your address.
      </p>
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
