"use client";

import { useRef, useState } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { passwordPolicy } from "@/features/auth/password-policy";
import type { AuthState } from "@/features/auth/schemas";
import { cn } from "@/lib/utils";

export function EmailField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="email">E-mail</FieldLabel>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "email-error" : undefined}
      />
      {error && <FieldError id="email-error">{error}</FieldError>}
    </Field>
  );
}

export function PasswordField({
  name = "password",
  label = "Mot de passe",
  value,
  onChange,
  error,
  description,
  newPassword = false,
  disabled,
  trailing,
}: {
  name?: "password" | "confirmation";
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  description?: string;
  newPassword?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const describedBy =
    [description, error ? `${name}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        {trailing}
      </div>
      <InputGroup>
        <InputGroupInput
          ref={input}
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={`${visible ? "Masquer" : "Afficher"} ${name === "confirmation" ? "la confirmation" : "le mot de passe"}`}
            aria-pressed={visible}
            aria-controls={name}
            disabled={disabled}
            className="h-8 px-2 text-[13px] text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setVisible(!visible);
              input.current?.focus();
            }}
          >
            {visible ? "Masquer" : "Afficher"}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function PasswordGuidance({
  password,
  email,
}: {
  password: string;
  email: string;
}) {
  const policy = passwordPolicy(password, email);
  const rules = [
    { met: policy.lengthMet, label: "10 caractères minimum" },
    {
      met: policy.distinct && password.length > 0,
      label: "Ni ton e-mail ni un mot de passe courant",
    },
    { met: password.length >= 14, label: "14+ caractères pour « Fort »" },
  ];
  return (
    <div id="password-guidance" className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-center gap-2.5" aria-live="polite">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1 flex-1 rounded-full",
                segment <= policy.score
                  ? policy.score === 4
                    ? "bg-success"
                    : "bg-foreground"
                  : "bg-border",
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted">{policy.strength}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={rule.met ? "text-foreground" : "text-muted-foreground"}
          >
            <span
              className={cn(
                "mr-2",
                rule.met ? "text-success" : "text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {rule.met ? "✓" : "○"}
            </span>
            <span className="sr-only">
              {rule.met ? "Respecté : " : "Non respecté : "}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormFeedback({ state }: { state: AuthState }) {
  if (!state.message) return null;
  return (
    <Alert
      variant={state.status === "error" ? "destructive" : "default"}
      role={state.status === "error" ? "alert" : "status"}
    >
      <AlertDescription className="text-current">
        {state.message}
      </AlertDescription>
    </Alert>
  );
}

export function FormHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em] md:text-[32px]">
        {title}
      </h1>
      <p className="text-[15px] text-muted">{description}</p>
    </div>
  );
}
