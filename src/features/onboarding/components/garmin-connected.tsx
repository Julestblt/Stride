"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PulseDot } from "@/components/stride/marks";
import { garminAutoContinueSeconds } from "@/features/onboarding/garmin-flow";
import { ConnectStages, ReadOnlyNote, StepLayout } from "./garmin-parts";
import { OnboardingActions } from "./onboarding-actions";

export function GarminConnected({
  email,
  autoContinue,
  pending,
  failed,
  onContinue,
}: {
  email: string | null;
  autoContinue: boolean;
  pending: boolean;
  failed: boolean;
  onContinue: () => void;
}) {
  const [remaining, setRemaining] = useState(garminAutoContinueSeconds);
  const continued = useRef(false);
  const counting = autoContinue && !failed;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [counting]);
  useEffect(() => {
    if (counting && remaining === 0 && !continued.current) {
      continued.current = true;
      onContinue();
    }
  }, [counting, remaining, onContinue]);
  const rows = [
    {
      Icon: CheckIcon,
      title: "Compte connecté",
      body: email ? `Garmin Connect · ${email}` : "Garmin Connect",
    },
    {
      Icon: LockIcon,
      title: "Ton mot de passe Garmin n’est plus nécessaire",
      body: "Stride garde la connexion sécurisée, pas le mot de passe. Déconnecte-toi quand tu veux dans Réglages › Connexions.",
    },
  ];
  return (
    <StepLayout centered>
      <ConnectStages statuses={["done", "done", "done"]} />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-5">
        <span
          aria-hidden="true"
          className="grid size-13 place-items-center rounded-full border border-success-border bg-success-surface text-success"
        >
          <CheckIcon className="size-6" />
        </span>
        <h1 className="text-[2rem] leading-none font-semibold tracking-[-0.035em] lg:text-[2.75rem]">
          Garmin connecté
        </h1>
      </div>
      <ul className="flex flex-col border-t border-border">
        {rows.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="grid grid-cols-[1rem_1fr] gap-x-4 border-b border-border py-4"
          >
            <Icon aria-hidden="true" className="mt-1 size-4 text-success" />
            <span className="flex flex-col gap-1">
              <span className="text-body font-semibold">{title}</span>
              <span className="text-meta text-muted">{body}</span>
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[1rem_1fr] gap-x-4 py-4">
          <span aria-hidden="true" className="mt-2">
            <PulseDot />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-body font-semibold">
              Préparation de ton historique…
            </span>
            <span className="text-meta text-muted">
              Je commence par tes dernières semaines, puis je remonte les
              années.
            </span>
          </span>
        </li>
      </ul>
      <OnboardingActions>
        <Button
          className="w-full lg:w-auto lg:px-6"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            continued.current = true;
            onContinue();
          }}
        >
          {failed ? "Réessayer" : "Continuer vers l’import"}
        </Button>
        {counting && (
          <p
            className="text-center text-meta text-muted-foreground"
            aria-live="off"
          >
            Passage automatique dans{" "}
            <span className="font-metric font-semibold text-foreground">
              {remaining}
            </span>{" "}
            s
          </p>
        )}
        <div className="flex justify-center lg:hidden">
          <ReadOnlyNote />
        </div>
      </OnboardingActions>
      <div className="hidden lg:block">
        <ReadOnlyNote />
      </div>
    </StepLayout>
  );
}
