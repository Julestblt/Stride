"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  normalizeCode,
  requiresNewSignIn,
  type GarminFailureView,
} from "@/features/onboarding/garmin-flow";
import { cn } from "@/lib/utils";
import {
  ConnectStages,
  ReadOnlyNote,
  SecureNote,
  StepHeading,
  StepLayout,
} from "./garmin-parts";
import { OnboardingActions } from "./onboarding-actions";

const notices = {
  invalid_code: {
    title:
      "Ce code n’a pas été accepté. Vérifie le dernier code reçu de Garmin et réessaie.",
    body: "Tout le code est sélectionné — saisis-le à nouveau pour le remplacer.",
  },
  code_rejected: {
    title: "Ce code n’a pas été accepté.",
    body: "Reconnecte-toi : Garmin enverra un nouveau code. Ton e-mail est conservé.",
  },
  expired_code: {
    title: "Ce code a expiré.",
    body: "Reconnecte-toi et Garmin t’enverra un nouveau code. Ton e-mail est conservé.",
  },
  garmin_unavailable: {
    title: "Garmin met plus de temps que d’habitude.",
    body: "Ça vient de Garmin. Ton code est toujours là — réessaie dans un instant.",
  },
} as const;

export function GarminCode({
  email,
  code,
  onCodeChange,
  notice,
  submitting,
  verified,
  slow,
  onSubmit,
  onSignInAgain,
  onUseAnotherAccount,
}: {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  notice: GarminFailureView | null;
  submitting: boolean;
  verified: boolean;
  slow: boolean;
  onSubmit: () => void;
  onSignInAgain: () => void;
  onUseAnotherAccount: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const message =
    notice && notice.notice in notices
      ? notices[notice.notice as keyof typeof notices]
      : null;
  const signInAgain = requiresNewSignIn(notice?.notice ?? null);
  const selected = notice?.selectCode === true;
  const busy = submitting || verified;
  useEffect(() => {
    if (selected) input.current?.select();
    else input.current?.focus();
  }, [selected, notice]);
  return (
    <StepLayout
      aside={
        <>
          <section
            aria-label="Connexion en cours"
            className="flex flex-col gap-3"
          >
            <h2 className="font-mono text-label text-muted-foreground uppercase">
              Connexion en cours
            </h2>
            <div className="flex flex-col gap-1 rounded-card border border-border p-4">
              <span className="text-xs text-muted-foreground">
                Compte Garmin Connect
              </span>
              <span className="text-body break-all">{email}</span>
              <button
                type="button"
                className="mt-1 self-start rounded-control text-sm text-accent hover:underline"
                onClick={onUseAnotherAccount}
              >
                Utiliser un autre compte
              </button>
            </div>
          </section>
          {notice ? (
            <p className="text-sm text-muted">
              Les codes expirent au bout de quelques minutes. Si tu en as reçu
              plusieurs, utilise le plus récent.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <SecureNote>
                Le code confirme seulement cette connexion. Stride ne le
                conserve pas.
              </SecureNote>
              <ReadOnlyNote />
            </div>
          )}
        </>
      }
    >
      <ConnectStages statuses={["done", "current", "upcoming"]} />
      <StepHeading title="Confirme que c’est toi">
        Garmin a envoyé un code de vérification pour cette connexion. Saisis-le
        ci-dessous pour terminer.
      </StepHeading>
      <form
        className="flex flex-1 flex-col gap-5"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (signInAgain) onSignInAgain();
          else if (!busy && code.length === 6) onSubmit();
        }}
      >
        <div className="flex flex-col gap-2.5">
          <label htmlFor="garmin-code" className="text-sm font-medium">
            Code de vérification
          </label>
          <div className="relative grid w-full max-w-94 grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => {
              const active =
                focused && !busy && index === Math.min(code.length, 5);
              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    "grid h-14 place-items-center rounded-surface border border-border-strong bg-surface font-metric text-metric-lg font-semibold lg:h-16",
                    active && "border-accent ring-3 ring-accent/20",
                    selected && "border-warning-border bg-warning/5",
                    verified && "border-success-border text-success",
                    submitting && "text-muted",
                  )}
                >
                  {code[index] ??
                    (active && (
                      <span className="h-6 w-px bg-accent motion-safe:animate-pulse" />
                    ))}
                </span>
              );
            })}
            <input
              ref={input}
              id="garmin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              readOnly={busy || signInAgain}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(event) =>
                onCodeChange(normalizeCode(event.target.value))
              }
              aria-describedby="garmin-code-hint"
              aria-invalid={Boolean(message) || undefined}
              className="absolute inset-0 size-full cursor-text rounded-surface text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
            />
          </div>
          <p id="garmin-code-hint" className="text-xs text-muted-foreground">
            Envoyé par Garmin à l’e-mail ou au téléphone de ton compte. Tu peux
            aussi le coller.
          </p>
        </div>
        {verified && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-success"
          >
            <CheckIcon aria-hidden="true" className="size-4" />
            Vérifié
          </p>
        )}
        {message && (
          <div role="alert" className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-warning">
              {message.title}
            </p>
            <p className="text-xs text-muted-foreground">{message.body}</p>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-5 lg:order-last lg:mt-0">
          <p className="text-sm font-medium">Tu n’as pas reçu de code ?</p>
          <p className="text-meta text-muted-foreground">
            Regarde tes spams, puis{" "}
            <button
              type="button"
              className="rounded-control font-medium text-accent hover:underline"
              onClick={onSignInAgain}
            >
              reviens te connecter
            </button>{" "}
            — Garmin envoie un nouveau code à chaque connexion.
          </p>
        </div>
        <OnboardingActions className="lg:gap-2.5">
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="lg:order-last"
              onClick={onSignInAgain}
            >
              Retour
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!signInAgain && !busy && code.length < 6}
              aria-busy={submitting}
              aria-disabled={busy || undefined}
            >
              {signInAgain ? (
                "Se reconnecter"
              ) : submitting ? (
                <>
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                  Vérification…
                </>
              ) : (
                "Vérifier"
              )}
            </Button>
          </div>
          {slow && (
            <p role="status" className="text-sm text-muted">
              Toujours en contact avec Garmin…
            </p>
          )}
          {!signInAgain && code.length < 6 && !slow && (
            <p className="hidden text-meta text-muted-foreground lg:block">
              Le bouton s’active à 6 chiffres.
            </p>
          )}
        </OnboardingActions>
      </form>
    </StepLayout>
  );
}
