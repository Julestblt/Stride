"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MonoLabel } from "@/components/stride/mono-label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { saveCheckin } from "@/server/progress/actions";
import type { CheckinDay } from "../body";
import {
  sorenessOptions,
  stressOptions,
  type Checkin,
  type CheckinField,
  type Legs,
} from "../recovery";
import { legsLabels, sorenessLabels, stressLabels } from "../recovery-view";

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const errors = {
  invalid: "Cette réponse n’est pas valide.",
  error: "Enregistrement impossible. Réessaie dans un instant.",
  "session-expired": "Ta session a expiré. Reconnecte-toi pour enregistrer.",
} as const;

const legsOrder: readonly Legs[] = ["fresh", "normal", "heavy"];

const legsDots: Record<Legs, string> = {
  fresh: "bg-success",
  normal: "bg-muted",
  heavy: "bg-warning",
};

const questions = [
  { field: "legs", label: "Jambes", options: legsOrder, labels: legsLabels },
  {
    field: "soreness",
    label: "Courbatures",
    options: sorenessOptions,
    labels: sorenessLabels,
  },
  {
    field: "stress",
    label: "Stress hors sport",
    options: stressOptions,
    labels: stressLabels,
  },
] as const;

type Answers = Pick<Checkin, "legs" | "soreness" | "stress">;

export function CheckinCard({
  initial,
  history,
}: {
  initial: Checkin | null;
  history: { days: CheckinDay[]; label: string };
}) {
  const [answers, setAnswers] = useState<Answers>({
    legs: initial?.legs ?? null,
    soreness: initial?.soreness ?? null,
    stress: initial?.stress ?? null,
  });
  const [savedAt, setSavedAt] = useState(initial?.updatedAt ?? null);
  const [, start] = useTransition();

  function answer(input: CheckinField) {
    const before = answers;
    setAnswers((current) => ({ ...current, [input.field]: input.value }));
    start(async () => {
      const result = await saveCheckin(input);
      if (result.status === "saved") {
        setSavedAt(result.updatedAt);
        return;
      }
      setAnswers(before);
      toast.error(errors[result.status], { id: "progress-checkin" });
    });
  }

  const days = history.days.map((day, index) =>
    index === history.days.length - 1 ? { ...day, legs: answers.legs } : day,
  );
  return (
    <section aria-labelledby="body-checkin" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="body-checkin" className="text-base font-semibold sm:text-lg">
          Ton ressenti
        </h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {savedAt
            ? `ce matin · enregistré à ${time.format(new Date(savedAt))}`
            : "À saisir ce matin"}
        </span>
      </div>
      {questions.map((question) => (
        <div
          key={question.field}
          className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center sm:gap-3"
        >
          <span id={`checkin-${question.field}`} className="text-sm text-muted">
            {question.label}
          </span>
          <ToggleGroup
            type="single"
            variant="choice"
            aria-labelledby={`checkin-${question.field}`}
            value={answers[question.field] ?? ""}
            onValueChange={(value) => {
              if (value)
                answer({ field: question.field, value } as CheckinField);
            }}
            className="grid grid-cols-3 gap-1.5"
          >
            {question.options.map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {(question.labels as Record<string, string>)[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center sm:gap-3">
        <MonoLabel size="micro">7 matins · jambes</MonoLabel>
        <ol
          aria-label={history.label}
          className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground"
        >
          {days.map((day) => (
            <li key={day.day} className="flex flex-col items-center gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 rounded-full",
                  day.legs ? legsDots[day.legs] : "border border-border-strong",
                )}
              />
              <span aria-hidden="true">{day.weekday}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs leading-normal text-muted-foreground">
        Stride lit les tendances pour guider ton entraînement, il ne pose pas de
        diagnostic. Une douleur qui change ta foulée ou qui dure plus de
        quelques jours, c’est pour un kiné ou un médecin.
      </p>
    </section>
  );
}
