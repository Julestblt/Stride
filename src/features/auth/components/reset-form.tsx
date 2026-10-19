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
      <RecoveryStage number={1} title="Demande un lien" active={false}>
        <p className="text-sm leading-relaxed text-muted">
          Besoin d’un autre lien ? Demande-en un nouveau avec l’e-mail de ton
          compte.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-accent hover:underline"
        >
          Demander un lien de réinitialisation
        </Link>
      </RecoveryStage>
      <RecoveryStage number={2} title="Vérifie ta boîte mail" active={false}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ouvre le lien reçu par e-mail pour vérifier ton compte.
        </p>
      </RecoveryStage>
      <RecoveryStage
        number={3}
        title="Choisis un nouveau mot de passe"
        active={verified}
      >
        {verified ? (
          <form
            action={formAction}
            onSubmit={() => setEdited({})}
            className="flex flex-col gap-5"
            aria-busy={pending}
          >
            <PasswordField
              label="Nouveau mot de passe"
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
              label="Confirmer"
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
                Les mots de passe correspondent
              </p>
            )}
            <FormFeedback state={state} />
            <Button
              type="submit"
              disabled={pending || !valid || state.status === "success"}
              className="w-full"
            >
              {pending ? "Enregistrement…" : "Enregistrer et se connecter"}
            </Button>
            {state.status === "success" && (
              <Link href="/" className="text-sm text-accent hover:underline">
                Continuer vers Stride
              </Link>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tu seras déconnecté des autres appareils après l’enregistrement.
              Les accès déjà ouverts restent valides jusqu’à leur expiration.
            </p>
          </form>
        ) : (
          <>
            <FormFeedback
              state={{
                status: "error",
                message:
                  "Connecte-toi ou ouvre un nouveau lien de réinitialisation depuis ta boîte mail avant de choisir un nouveau mot de passe.",
              }}
            />
            <Link
              href="/forgot-password"
              className="text-sm text-accent hover:underline"
            >
              Obtenir un nouveau lien
            </Link>
          </>
        )}
      </RecoveryStage>
    </div>
  );
}
