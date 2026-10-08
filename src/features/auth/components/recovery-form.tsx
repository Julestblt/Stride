"use client";

import { useActionState, useEffect, useState } from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  initialAuthState,
  type AuthAction,
  type AuthState,
} from "@/features/auth/schemas";
import { EmailField, FormFeedback } from "./form-controls";
import { RecoveryStage } from "./recovery";

export function RecoveryForm({ action }: { action: AuthAction }) {
  const [inbox, setInbox] = useState<AuthState>();
  const [remaining, setRemaining] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [hideFeedback, setHideFeedback] = useState(false);
  const [edited, setEdited] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: AuthState, data: FormData) => {
      setHideFeedback(false);
      setEdited(false);
      setCooldownUntil(Date.now() + 60_000);
      setRemaining(60);
      const result = await action(previous, data);
      if (result.status === "success") {
        setInbox(result);
        setCooldownUntil((result.sentAt ?? Date.now()) + 60_000);
      }
      return result;
    },
    initialAuthState,
  );
  const [email, setEmail] = useState("");
  const sent = Boolean(inbox);
  useEffect(() => {
    if (!sent) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [sent, cooldownUntil]);
  return (
    <div className="grid flex-1 md:grid-cols-3">
      <RecoveryStage number={1} title="Ask for a link" active={!sent}>
        <p className="text-sm leading-relaxed text-muted">
          Enter the email you signed up with. Use the reset link in your inbox
          before it expires.
        </p>
        <form
          id="recovery-request"
          action={formAction}
          className="flex flex-col gap-5"
          aria-busy={pending}
        >
          <EmailField
            value={email}
            onChange={(value) => {
              setEmail(value);
              setEdited(true);
            }}
            error={!sent && !edited ? state.errors?.email : undefined}
            disabled={pending || sent}
          />
          <FormFeedback
            state={sent || hideFeedback ? initialAuthState : state}
          />
          <Button type="submit" disabled={pending || sent} className="w-full">
            {pending ? "Requesting link…" : "Send reset link"}
          </Button>
        </form>
      </RecoveryStage>
      <RecoveryStage number={2} title="Check your inbox" active={sent}>
        {sent ? (
          <>
            <div
              role="status"
              className="flex flex-col gap-3.5 rounded-surface border border-border bg-surface p-5"
            >
              <MailIcon aria-hidden="true" className="h-7 w-9 text-accent" />
              <p className="text-[15px] leading-relaxed">
                If an account exists for{" "}
                <strong className="font-semibold break-all">
                  {inbox?.email}
                </strong>
                , you&apos;ll receive a reset link.
              </p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nothing after a few minutes? Check spam, or resend.
              </p>
            </div>
            <FormFeedback
              state={
                !pending && state.status === "error" ? state : initialAuthState
              }
            />
            <form action={formAction}>
              <input type="hidden" name="email" value={inbox?.email} />
              <Button
                type="submit"
                variant="outline"
                disabled={pending || remaining > 0}
                className="w-full"
              >
                {pending
                  ? "Requesting link…"
                  : remaining > 0
                    ? `Resend in 0:${String(remaining).padStart(2, "0")}`
                    : "Resend reset link"}
              </Button>
            </form>
            <Button
              type="button"
              variant="link"
              disabled={pending}
              className="h-auto justify-start p-0 text-sm"
              onClick={() => {
                setInbox(undefined);
                setHideFeedback(true);
                setEdited(true);
                setEmail("");
              }}
            >
              Use a different email
            </Button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            After requesting a link, check your inbox and spam folder. This step
            becomes available when the request is accepted.
          </p>
        )}
      </RecoveryStage>
      <RecoveryStage number={3} title="Choose a new password" active={false}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open the recovery link to verify your account and choose a new
          password.
        </p>
      </RecoveryStage>
    </div>
  );
}
