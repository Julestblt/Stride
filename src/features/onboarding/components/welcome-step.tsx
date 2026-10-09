"use client";
import { Button } from "@/components/ui/button";
import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/onboarding/actions";
import { useOnboardingTransition } from "./use-onboarding-transition";
const stages = [
  {
    title: "Connecter Garmin",
    description: "Connecte-toi avec ton compte Garmin Connect.",
  },
  {
    title: "Je lis ton historique",
    description: "Ça continue pendant que tu avances.",
  },
  {
    title: "Tu complètes le reste",
    description: "Quelques taps, pas de longs formulaires.",
  },
  {
    title: "Découvre ton profil",
    description: "Vérifie ce que j’ai appris. Corrige-moi.",
  },
];
export function WelcomeStep({ revision }: { revision: number }) {
  const { pending, message, run } = useOnboardingTransition();
  function start() {
    run(
      () => completeOnboarding({ step: "welcome", revision }),
      "L’enregistrement a échoué. Réessaie dans un instant.",
    );
  }
  return (
    <div className="flex flex-1 flex-col lg:justify-center">
      <div className="flex flex-1 flex-col gap-6 motion-safe:animate-rise lg:max-w-160 lg:flex-none lg:gap-10">
        <div className="flex flex-col gap-3.5 lg:gap-4.5">
          <StrideMark className="size-8.5 lg:size-10" strokeWidth="1.6" />
          <h1 className="text-[2.125rem] leading-none font-semibold tracking-[-0.035em] lg:text-display">
            Configurons ton coach.
          </h1>
          <p className="text-body text-pretty text-muted lg:text-lg lg:leading-relaxed">
            Un bon coach commence par comprendre comment tu t’entraînes.
            Connecte Garmin et je lis ton historique — des années de sorties, de
            sommeil et de récupération — pour que ton premier plan te
            corresponde déjà.
          </p>
        </div>
        <ol className="flex flex-col border-t border-border lg:grid lg:grid-cols-3">
          {stages.map((stage, index) => (
            <li
              key={stage.title}
              className="grid grid-cols-[1.875rem_1fr] gap-3 border-b border-border py-3.5 lg:flex lg:flex-col lg:gap-1.5 lg:border-0 lg:pt-4 lg:pr-4 lg:pb-0"
            >
              <span
                className={cn(
                  "font-metric text-metric font-semibold tabular-nums",
                  index === 0 ? "text-accent" : "text-muted-foreground",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-0.75 lg:gap-1.5">
                <span className="text-body font-semibold">{stage.title}</span>
                <span className="text-meta text-muted-foreground">
                  {stage.description}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="sticky bottom-0 -mx-5 mt-auto -mb-6 flex flex-col gap-3 border-t border-border bg-surface-inset px-5 pt-4 pb-7.5 lg:static lg:m-0 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0">
          {message && (
            <p role="alert" className="text-sm text-danger lg:basis-full">
              {message}
            </p>
          )}
          <Button
            className="w-full lg:w-auto lg:px-5.5"
            disabled={pending}
            aria-busy={pending}
            onClick={start}
          >
            {message ? "Réessayer" : "C’est parti"}
          </Button>
          <span className="text-center text-xs text-muted-foreground lg:text-left lg:text-meta">
            Je ne modifie jamais ton plan sans te demander.
          </span>
        </div>
      </div>
    </div>
  );
}
