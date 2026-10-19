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
          Étape 1 sur 4 · Confirme ton e-mail
        </p>
        <div
          className="grid size-12 place-items-center rounded-control border border-border text-2xl text-accent"
          aria-hidden="true"
        >
          ✉
        </div>
        <FormHeading
          title="Vérifie ta boîte mail"
          description={`On a envoyé un lien de confirmation à ${state.email}. Ouvre-le pour activer ton compte.`}
        />
        <ol className="flex flex-col gap-3 rounded-surface border border-border bg-surface-raised p-4 text-sm text-muted">
          {[
            "Ouvre l’e-mail de Stride",
            "Clique sur « Confirmer l’adresse e-mail »",
            "Tu reviens ici, connecté, prêt à configurer ton coach",
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
          Mauvaise adresse ?{" "}
          <button type="submit" className="text-accent hover:underline">
            Changer d’e-mail
          </button>
        </form>
        <p className="text-sm text-muted">
          Introuvable ? Regarde dans les spams ou promotions. Les liens expirent
          : utilise l’e-mail le plus récent.
        </p>
        <p className="mt-auto border-t border-border pt-5 text-center text-sm text-muted md:mt-0">
          Déjà confirmé ?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Se connecter
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
        title="Crée ton compte"
        description="Juste l’essentiel. Ton coach te posera le reste."
      />
      <FieldGroup>
        <Field
          data-invalid={Boolean(!edited.fullName && state.errors?.fullName)}
        >
          <FieldLabel htmlFor="fullName">Nom complet</FieldLabel>
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
            C’est ainsi que ton coach t’appellera.
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
          label="Confirmer le mot de passe"
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value);
            setEdited((previous) => ({ ...previous, confirmation: true }));
          }}
          newPassword
          error={
            mismatch
              ? "Les mots de passe ne correspondent pas encore."
              : edited.confirmation || edited.password
                ? undefined
                : state.errors?.confirmation
          }
          disabled={pending}
        />
      </FieldGroup>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || !valid} className="w-full">
        {pending ? "Création du compte…" : "Créer un compte"}
      </Button>
      <p className="text-xs text-muted">
        On t’envoie un lien par e-mail pour confirmer ton adresse.
      </p>
      <div className="text-xs leading-relaxed text-muted-foreground">
        <p>
          En créant un compte, tu acceptes les conditions et la politique de
          confidentialité. Tes données ne sont jamais vendues.
        </p>
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-accent">
            Conditions
          </summary>
          <p className="mt-2">
            Les conditions de Stride ne sont pas encore publiées. Cette version
            n’est pas prête pour un lancement public.
          </p>
        </details>
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-accent">
            Politique de confidentialité
          </summary>
          <p className="mt-2">
            La politique de confidentialité de Stride n’est pas encore publiée.
            L’authentification du compte est gérée par Supabase. Une politique
            complète est requise avant le lancement public.
          </p>
        </details>
      </div>
      <p className="text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
