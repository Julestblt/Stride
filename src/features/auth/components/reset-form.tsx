"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialAuthState, type AuthAction } from "@/features/auth/schemas";
import { passwordPolicy } from "@/features/auth/password-policy";
import { FormFeedback, PasswordField, PasswordGuidance } from "./form-controls";
import { RecoveryStage } from "./recovery";

export function ResetForm({
  action,
  verified,
  email,
}: {
  action: AuthAction;
  verified: boolean;
  email?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [edited, setEdited] = useState<
    Partial<Record<"password" | "confirmation", boolean>>
  >({});
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const valid =
    passwordPolicy(password, email).valid && password === confirmation;
  return (
    <div className="grid flex-1 content-start md:grid-cols-3 md:content-stretch">
      <RecoveryStage number={1} title="Ask for a link" active={false}>
        <p className="text-sm leading-relaxed text-muted">
          Need another link? Request a fresh one with your account email.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-accent hover:underline"
        >
          Request a recovery link
        </Link>
      </RecoveryStage>
      <RecoveryStage number={2} title="Check your inbox" active={false}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Follow the recovery link from your email to verify your account.
        </p>
      </RecoveryStage>
      <RecoveryStage number={3} title="Choose a new password" active={verified}>
        {verified ? (
          <form
            action={formAction}
            onSubmit={() => setEdited({})}
            className="flex flex-col gap-5"
            aria-busy={pending}
          >
            <PasswordField
              label="New password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setEdited((previous) => ({ ...previous, password: true }));
              }}
              newPassword
              description="password-guidance"
              error={edited.password ? undefined : state.errors?.password}
              disabled={pending || state.status === "success"}
            />
            <PasswordGuidance password={password} email={email ?? ""} />
            <PasswordField
              name="confirmation"
              label="Confirm"
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
              disabled={pending || state.status === "success"}
            />
            {confirmation && !mismatch && (
              <p
                className="flex items-center gap-2 text-meta text-success"
                role="status"
              >
                <CheckIcon
                  aria-hidden="true"
                  className="size-3"
                  strokeWidth={3}
                />
                Passwords match
              </p>
            )}
            <FormFeedback state={state} />
            <Button
              type="submit"
              disabled={pending || !valid || state.status === "success"}
              className="w-full"
            >
              {pending ? "Saving password…" : "Save and sign in"}
            </Button>
            {state.status === "success" && (
              <Link href="/" className="text-sm text-accent hover:underline">
                Continue to Stride
              </Link>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              We&apos;ll request sign-out on other devices after saving.
              Existing access tokens may remain valid until they expire.
            </p>
          </form>
        ) : (
          <>
            <FormFeedback
              state={{
                status: "error",
                message:
                  "Sign in or open a fresh recovery link from your inbox before choosing a new password.",
              }}
            />
            <Link
              href="/forgot-password"
              className="text-sm text-accent hover:underline"
            >
              Get a fresh link
            </Link>
          </>
        )}
      </RecoveryStage>
    </div>
  );
}
