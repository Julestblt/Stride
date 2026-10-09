"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialAuthState, type AuthAction } from "@/features/auth/schemas";
import { FormFeedback, FormHeading } from "./form-controls";

export function ExpiredLinkForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-1 flex-col gap-5 md:flex-none">
      <p className="font-mono text-xs tracking-widest text-warning uppercase">
        Link expired
      </p>
      <FormHeading
        title="This link is no longer valid"
        description="Confirmation links expire and work only once. Request a new one and we'll email it right away."
      />
      <form action={formAction} className="flex flex-col gap-5">
        <Field data-invalid={Boolean(state.errors?.email)}>
          <FieldLabel htmlFor="expired-email">Email</FieldLabel>
          <Input
            id="expired-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(state.errors?.email)}
          />
          {state.errors?.email && <FieldError>{state.errors.email}</FieldError>}
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send a new link"}
        </Button>
        <FormFeedback state={state} />
      </form>
      <p className="text-center text-sm">
        <Link href="/sign-in" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
      <p className="mt-auto text-center text-sm text-muted md:mt-0">
        Already confirmed? Just sign in.
      </p>
    </div>
  );
}
