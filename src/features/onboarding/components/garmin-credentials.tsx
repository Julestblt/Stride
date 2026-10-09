"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  formatCountdown,
  type GarminFailureView,
} from "@/features/onboarding/garmin-flow";
import {
  AsideList,
  ConnectStages,
  GarminNoticeBox,
  ReadOnlyNote,
  SecureNote,
  StepHeading,
  StepLayout,
} from "./garmin-parts";
import { OnboardingActions } from "./onboarding-actions";

const notices = {
  invalid_credentials: {
    title: "Garmin n’a pas pu vérifier ces informations.",
    body: "Vérifie l’e-mail et le mot de passe que tu utilises dans l’app Garmin Connect, puis réessaie. Rien n’a été enregistré.",
  },
  rate_limited: {
    title: "Garmin a mis les connexions en pause un instant.",
    body: "Trop de tentatives en peu de temps. Attends quelques minutes, puis réessaie. Ton compte Stride n’est pas touché.",
  },
  garmin_unavailable: {
    title: "Garmin met plus de temps que d’habitude.",
    body: "Ça vient de Garmin. Tes informations sont toujours là — réessaie dans un instant.",
  },
  connection_failed: {
    title: "La connexion n’a pas pu aboutir.",
    body: "Rien n’a été enregistré. Recommence depuis la connexion — ça passe généralement au deuxième essai.",
  },
} as const;

export function GarminCredentials({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  notice,
  remainingSeconds,
  submitting,
  slow,
  onSubmit,
  onBack,
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  notice: GarminFailureView | null;
  remainingSeconds: number;
  submitting: boolean;
  slow: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const message =
    notice && notice.notice in notices
      ? notices[notice.notice as keyof typeof notices]
      : null;
  const cleared = notice?.clearPassword === true && password === "";
  const locked = remainingSeconds > 0;
  useEffect(() => {
    if (notice?.clearPassword) passwordInput.current?.focus();
  }, [notice]);
  return (
    <StepLayout
      aside={
        notice?.notice === "invalid_credentials" ? (
          <Troubleshooting />
        ) : (
          <>
            <AsideList
              title="À propos de ces informations"
              numbered
              items={[
                {
                  title: "Utilisés une seule fois, pour te connecter",
                  body: "Garmin vérifie ton e-mail et ton mot de passe, et peut demander un code pour confirmer que c’est bien toi.",
                },
                {
                  title: "La connexion reste, le mot de passe non",
                  body: "Après cette étape, Stride n’a plus jamais besoin de ton mot de passe Garmin. Le changer chez Garmin, c’est toi qui décides.",
                },
                {
                  title: "Tu peux y mettre fin",
                  body: "Déconnecte-toi quand tu veux dans Réglages › Connexions.",
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Mot de passe Garmin oublié ? Réinitialise-le dans l’app Garmin
              Connect, puis reviens.
            </p>
          </>
        )
      }
    >
      <ConnectStages
        statuses={["current", "upcoming", "upcoming"]}
        optionalVerification
      />
      <StepHeading title="Connecte-toi à Garmin Connect">
        Utilise le compte lié aux appareils Garmin et à l’historique que Stride
        doit lire.
      </StepHeading>
      {message && (
        <GarminNoticeBox title={message.title}>{message.body}</GarminNoticeBox>
      )}
      <form
        className="flex flex-1 flex-col gap-6"
        aria-busy={submitting}
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitting && !locked) onSubmit();
        }}
      >
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="garmin-email">
              E-mail Garmin Connect
            </FieldLabel>
            <Input
              id="garmin-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              readOnly={submitting}
              onChange={(event) => onEmailChange(event.target.value)}
              aria-describedby={message ? undefined : "garmin-email-hint"}
            />
            {!message && (
              <FieldDescription id="garmin-email-hint">
                Peut différer de ton e-mail Stride.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="garmin-password">
              Mot de passe Garmin Connect
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                ref={passwordInput}
                id="garmin-password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={256}
                placeholder="Saisis ton mot de passe Garmin"
                value={password}
                readOnly={submitting}
                onChange={(event) => onPasswordChange(event.target.value)}
                aria-describedby={cleared ? "garmin-password-hint" : undefined}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    visible
                      ? "Masquer le mot de passe Garmin"
                      : "Afficher le mot de passe Garmin"
                  }
                  aria-pressed={visible}
                  aria-controls="garmin-password"
                  className="h-8 px-2 text-meta text-muted-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setVisible(!visible);
                    passwordInput.current?.focus();
                  }}
                >
                  {visible ? "Masquer" : "Afficher"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {cleared && (
              <FieldDescription id="garmin-password-hint">
                Mot de passe effacé par sécurité. E-mail conservé pour que tu ne
                ressaisisses que le nécessaire.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-4 lg:order-last">
          <SecureNote>
            <span className="hidden lg:inline">
              Tes identifiants Garmin servent uniquement à établir la connexion.
            </span>
            <span className="lg:hidden">Sert uniquement à te connecter.</span>{" "}
            Stride garde la connexion sécurisée, pas ton mot de passe Garmin.
          </SecureNote>
          {notice?.notice === "invalid_credentials" && (
            <div className="lg:hidden">
              <Troubleshooting />
            </div>
          )}
        </div>
        <OnboardingActions className="lg:gap-2.5">
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="lg:order-last"
              onClick={onBack}
            >
              Retour
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={locked}
              aria-busy={submitting}
              aria-disabled={submitting || undefined}
            >
              {submitting ? (
                <>
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                  Connexion à Garmin…
                </>
              ) : locked ? (
                `Réessayer dans ${formatCountdown(remainingSeconds)}`
              ) : notice ? (
                "Réessayer"
              ) : (
                "Continuer"
              )}
            </Button>
          </div>
          {slow && (
            <p role="status" className="text-sm text-muted">
              Toujours en contact avec Garmin…
            </p>
          )}
        </OnboardingActions>
        <div className="hidden lg:order-last lg:block">
          <ReadOnlyNote />
        </div>
      </form>
    </StepLayout>
  );
}

function Troubleshooting() {
  return (
    <AsideList
      title="Si ça ne passe toujours pas"
      items={[
        {
          body: "Connecte-toi d’abord à l’app Garmin Connect pour vérifier que ton mot de passe fonctionne.",
        },
        {
          body: "Inscrit chez Garmin avec Apple ou Google ? Définis un mot de passe Garmin dans l’app, puis utilise-le ici.",
        },
        {
          body: "Après plusieurs essais, Garmin peut suspendre les connexions quelques minutes. Ton compte Stride n’est pas touché.",
        },
      ]}
    />
  );
}
