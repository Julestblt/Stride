"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { initialAuthState, type AuthAction } from "@/features/auth/schemas";
import {
  EmailField,
  FormFeedback,
  FormHeading,
  PasswordField,
} from "./form-controls";
import { ConfirmationResend } from "./confirmation-resend";

export function SignInForm({
  action,
  magicAction,
  resendAction,
  linkError = false,
  missingRecoveryVerifier = false,
}: {
  action: AuthAction;
  magicAction: AuthAction;
  resendAction: AuthAction;
  linkError?: boolean;
  missingRecoveryVerifier?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const [magicState, magicFormAction, magicPending] = useActionState(
    magicAction,
    initialAuthState,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [latest, setLatest] = useState<"password" | "magic" | null>(null);
  const [edited, setEdited] = useState<
    Partial<Record<"email" | "password", boolean>>
  >({});
  const feedback =
    latest === "magic"
      ? magicState
      : latest === "password"
        ? state
        : initialAuthState;
  const busy = pending || magicPending;
  return (
    <div className="flex flex-1 flex-col gap-4 md:flex-none">
      <FormHeading
        title="Welcome back"
        description="Sign in to see today's session."
      />
      {state.status === "unconfirmed" &&
        latest === "password" &&
        state.email && (
          <div
            className="rounded-surface border border-warning/40 bg-surface-raised p-4 text-sm"
            role="status"
          >
            <p className="font-semibold text-warning">
              Confirm your email to continue
            </p>
            <p className="mt-1 text-muted">{state.message}</p>
            <div className="mt-3">
              <ConfirmationResend
                action={resendAction}
                email={state.email}
                sentAt={state.sentAt}
              />
            </div>
            <button
              type="button"
              className="mt-3 text-accent hover:underline"
              onClick={() => {
                setEmail("");
                setPassword("");
                setLatest(null);
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      <form
        action={formAction}
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          setLatest(
            submitter instanceof HTMLButtonElement &&
              submitter.dataset.intent === "magic"
              ? "magic"
              : "password",
          );
          setEdited({});
        }}
        className="flex flex-1 flex-col gap-4.5 md:flex-none md:gap-5.5"
        aria-busy={busy}
      >
        {linkError && latest === null && (
          <FormFeedback
            state={{
              status: "error",
              message: missingRecoveryVerifier
                ? "We couldn't find the verification state for this recovery link. Request a fresh link from this browser and open the newest message here. If you already did that, an email preview or link tracker may have used the one-time link first."
                : "This link is invalid or has expired. Request a fresh link to continue.",
            }}
          />
        )}
        <FieldGroup className="gap-4.5 md:gap-5.5">
          <EmailField
            value={email}
            onChange={(value) => {
              setEmail(value);
              setEdited((previous) => ({ ...previous, email: true }));
            }}
            error={edited.email ? undefined : feedback.errors?.email}
            disabled={busy}
          />
          <PasswordField
            value={password}
            onChange={(value) => {
              setPassword(value);
              setEdited((previous) => ({ ...previous, password: true }));
            }}
            error={edited.password ? undefined : feedback.errors?.password}
            disabled={busy}
            trailing={
              <Link
                href="/forgot-password"
                className="text-[13px] text-accent hover:underline"
              >
                Forgot password?
              </Link>
            }
          />
          <Field orientation="horizontal" className="min-h-8 gap-2.5">
            <Checkbox
              id="remember"
              name="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
              disabled={busy}
            />
            <FieldLabel
              htmlFor="remember"
              className="text-sm font-normal text-muted"
            >
              Keep me signed in on this device
            </FieldLabel>
          </Field>
        </FieldGroup>
        <FormFeedback
          state={
            busy || feedback.status === "unconfirmed"
              ? initialAuthState
              : feedback
          }
        />
        <Button type="submit" disabled={busy} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="hidden items-center gap-3 md:flex">
          <Separator className="flex-1" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            or
          </span>
          <Separator className="flex-1" />
        </div>
        <Button
          type="submit"
          formAction={magicFormAction}
          data-intent="magic"
          formNoValidate
          disabled={busy}
          variant="outline"
          className="w-full"
        >
          {magicPending ? "Requesting link…" : "Email me a sign-in link"}
        </Button>
        <p className="mt-auto pt-4 text-center text-sm text-muted md:mt-0 md:pt-0">
          New to Stride?{" "}
          <Link href="/sign-up" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
