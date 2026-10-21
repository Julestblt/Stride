"use client";
import { useCallback, useRef, useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SaveRequest } from "@/features/onboarding/autosave";
import {
  maxRaces,
  missingRaceFields,
  type GoalFocus,
  type GoalValues,
  type GoalsSnapshot,
  type RaceSnapshot,
} from "@/features/onboarding/goals";
import { cn } from "@/lib/utils";
import {
  addAthleteRace,
  completeOnboarding,
  removeAthleteRaces,
  saveAthleteGoal,
} from "@/server/onboarding/actions";
import { SaveIndicator } from "./about-fields";
import { OnboardingActions } from "./onboarding-actions";
import { RaceForm, type RaceHandle } from "./race-form";
import { useAutosave, type AutosaveResult } from "./use-autosave";
import { useOnboardingTransition } from "./use-onboarding-transition";

const goalCacheFields: (keyof GoalValues)[] = ["focus"];
const focuses: { value: GoalFocus; title: string; detail: string }[] = [
  {
    value: "general_fitness",
    title: "Forme générale",
    detail: "Bien courir, rester en forme",
  },
  {
    value: "faster",
    title: "Aller plus vite",
    detail: "Pas de course requise",
  },
  {
    value: "short_distance",
    title: "5 km · 10 km",
    detail: "Vitesse et seuil",
  },
  {
    value: "half_marathon_marathon",
    title: "Semi · Marathon",
    detail: "Endurance sur route",
  },
  { value: "trail", title: "Course trail", detail: "Jusqu’à ~50 km" },
  { value: "ultra_trail", title: "Ultra-trail", detail: "50 km et plus" },
];

export function GoalsStep({
  userId,
  revision,
  goals,
}: {
  userId: string;
  revision: number;
  goals: GoalsSnapshot;
}) {
  const completion = useOnboardingTransition();
  const [races, setRaces] = useState<RaceSnapshot[]>(goals.races);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const handles = useRef(new Map<string, RaceHandle>());
  const saveGoal = useCallback(
    async (
      request: SaveRequest<GoalValues>,
    ): Promise<AutosaveResult<GoalValues>> => {
      const result = await saveAthleteGoal({
        values: request.values,
        revision: request.revision,
      });
      return result.status === "missing" ? { status: "invalid" } : result;
    },
    [],
  );
  const goal = useAutosave<GoalValues>({
    initial: { values: goals.goal.values, revision: goals.goal.revision },
    save: saveGoal,
    cacheKey: `stride:onboarding:goal:${userId}`,
    cacheFields: goalCacheFields,
    serverUpdatedAt: goals.goal.updatedAt,
  });
  const register = useCallback((id: string, handle: RaceHandle | null) => {
    if (handle) handles.current.set(id, handle);
    else handles.current.delete(id);
  }, []);
  const forget = useCallback(
    (ids: string[]) =>
      setRaces((current) => current.filter((race) => !ids.includes(race.id))),
    [],
  );
  async function add() {
    setBusy("add");
    setNotice(null);
    try {
      const result = await addAthleteRace();
      if (result.status === "created")
        setRaces((current) => [...current, result.race]);
      else
        toast.error("Impossible d’ajouter une course pour l’instant.", {
          id: "goals-race-add",
        });
    } catch {
      toast.error("Impossible d’ajouter une course pour l’instant.", {
        id: "goals-race-add",
      });
    } finally {
      setBusy(null);
    }
  }
  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(ids.length === 1 ? ids[0] : "all");
    setNotice(null);
    try {
      const result = await removeAthleteRaces({ ids });
      if (result.status === "deleted") {
        for (const id of ids)
          localStorage.removeItem(`stride:onboarding:race:${id}`);
        forget(ids);
      } else
        toast.error("La suppression a échoué. Réessaie dans un instant.", {
          id: "goals-race-remove",
        });
    } catch {
      toast.error("La suppression a échoué. Réessaie dans un instant.", {
        id: "goals-race-remove",
      });
    } finally {
      setBusy(null);
    }
  }
  async function finish() {
    setNotice(null);
    const all = [...handles.current.values()];
    const saved = (
      await Promise.all([goal.flush(), ...all.map((race) => race.flush())])
    ).every(Boolean);
    if (!saved) {
      setNotice("Enregistre tes réponses avant de continuer.");
      return;
    }
    if (!goal.state.local.focus) {
      setNotice("Choisis ce qui compte le plus pour toi en ce moment.");
      return;
    }
    if (all.some((race) => missingRaceFields(race.values()).length > 0)) {
      setShowErrors(true);
      setNotice("Complète ou retire les courses incomplètes.");
      return;
    }
    completion.run(
      () => completeOnboarding({ step: "goals", revision }),
      "L’enregistrement a échoué. Réessaie dans un instant.",
    );
  }
  const selected = goal.state.local.focus;
  return (
    <div className="flex flex-1 flex-col gap-7 motion-safe:animate-rise lg:max-w-212 lg:gap-9">
      <div className="flex flex-col gap-3">
        <h1 className="text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
          Pour quoi t’entraînes-tu ?
        </h1>
        <p className="text-body text-pretty text-muted lg:text-lead">
          Choisis ce qui compte le plus en ce moment. La course est facultative
          — ne pas avoir de course est un très bon objectif.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Ce qui compte le plus"
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {focuses.map((focus) => {
          const checked = selected === focus.value;
          return (
            <button
              key={focus.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => {
                setNotice(null);
                goal.change("focus", focus.value, "now");
              }}
              className={cn(
                "flex min-h-19 flex-col items-start gap-1 rounded-surface border border-border bg-surface p-3.5 text-left transition-colors duration-150 ease-stride hover:border-border-strong",
                checked && "border-accent hover:border-accent",
              )}
            >
              <span className="flex items-center gap-1.5 text-body font-semibold">
                {focus.title}
                {checked && (
                  <CheckIcon
                    aria-hidden="true"
                    className="size-3.5 text-accent"
                  />
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {focus.detail}
              </span>
            </button>
          );
        })}
      </div>
      {goal.state.status !== "saved" && (
        <SaveIndicator
          status={goal.state.status}
          onRetry={() => void goal.retry()}
        />
      )}
      <section
        aria-labelledby="race-title"
        className="flex flex-col gap-5 border-t border-border pt-7"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="race-title" className="text-title font-semibold">
            Course objectif
          </h2>
          {races.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy !== null}>
                  Pas de course pour l’instant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retirer tes courses ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {races.length === 1
                      ? "La course saisie sera supprimée."
                      : `Les ${races.length} courses saisies seront supprimées.`}{" "}
                    Tu pourras en ajouter plus tard.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void remove(races.map((race) => race.id))}
                  >
                    Retirer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {races.length === 0 && (
          <p className="text-sm text-muted">
            Pas de course pour l’instant. Ajoute-en une si tu prépares un
            objectif précis.
          </p>
        )}
        {races.map((race, index) => (
          <RaceForm
            key={race.id}
            race={race}
            index={index}
            showErrors={showErrors}
            register={register}
            removing={busy === race.id || busy === "all"}
            onRemove={() => void remove([race.id])}
            onMissing={() => forget([race.id])}
          />
        ))}
        {races.length < maxRaces && (
          <Button
            variant="outline"
            className="self-start border-dashed"
            disabled={busy !== null}
            aria-busy={busy === "add"}
            onClick={() => void add()}
          >
            <PlusIcon data-icon="inline-start" />
            Ajouter une course
          </Button>
        )}
      </section>
      <OnboardingActions className="lg:border-t lg:border-border lg:pt-8">
        {notice && (
          <p role="alert" className="text-sm text-warning lg:basis-full">
            {notice}
          </p>
        )}
        <Button
          className="w-full lg:w-auto lg:px-5.5"
          disabled={completion.pending || busy !== null}
          aria-busy={completion.pending}
          onClick={() => void finish()}
        >
          Voir mon profil d’athlète
        </Button>
      </OnboardingActions>
    </div>
  );
}
