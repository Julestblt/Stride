"use client";

import { useState, useTransition } from "react";
import { MonoLabel } from "@/components/stride/mono-label";
import { SourceMark } from "@/components/stride/marks";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveCheckin } from "@/server/progress/actions";
import {
  legsOptions,
  sorenessOptions,
  stressOptions,
  type Checkin,
  type CheckinField,
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

const questions = [
  { field: "legs", label: "Jambes", options: legsOptions, labels: legsLabels },
  {
    field: "soreness",
    label: "Courbatures",
    options: sorenessOptions,
    labels: sorenessLabels,
  },
  {
    field: "stress",
    label: "Stress",
    options: stressOptions,
    labels: stressLabels,
  },
] as const;

type Answers = Pick<Checkin, "legs" | "soreness" | "stress">;

export function CheckinCard({ initial }: { initial: Checkin | null }) {
  const [answers, setAnswers] = useState<Answers>({
    legs: initial?.legs ?? null,
    soreness: initial?.soreness ?? null,
    stress: initial?.stress ?? null,
  });
  const [savedAt, setSavedAt] = useState(initial?.updatedAt ?? null);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function answer(input: CheckinField) {
    const before = answers;
    setAnswers((current) => ({ ...current, [input.field]: input.value }));
    start(async () => {
      const result = await saveCheckin(input);
      if (result.status === "saved") {
        setSavedAt(result.updatedAt);
        setError("");
      } else {
        setAnswers(before);
        setError(errors[result.status]);
      }
    });
  }

  return (
    <section
      aria-labelledby="recovery-checkin"
      className="flex min-w-0 flex-[1_1_420px] flex-col gap-5 rounded-panel border border-border bg-surface p-4 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="recovery-checkin"
          className="flex items-center gap-2 text-base font-semibold sm:text-lg"
        >
          Ton ressenti
          <MonoLabel size="nano" className="inline-flex items-center gap-1">
            <SourceMark source="manual" className="size-1.25" />
            Toi
          </MonoLabel>
        </h2>
        <MonoLabel size="micro" aria-live="polite">
          {savedAt ? `Saisi à ${time.format(new Date(savedAt))}` : "À saisir"}
        </MonoLabel>
      </div>
      {questions.map((question) => (
        <div key={question.field} className="flex flex-col gap-2">
          <span
            id={`checkin-${question.field}`}
            className="text-meta text-muted"
          >
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
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <p className="text-xs leading-normal text-muted-foreground">
        Stride lit les tendances pour guider ton entraînement, il ne pose pas de
        diagnostic. Une douleur qui change ta foulée ou qui dure plus de
        quelques jours, c’est pour un kiné ou un médecin.
      </p>
    </section>
  );
}
