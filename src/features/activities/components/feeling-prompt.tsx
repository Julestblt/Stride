"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import {
  feelLabels,
  feelValues,
  type FeelValue,
} from "@/features/plans/debrief/debrief";
import type { DebriefFeelingView } from "@/features/plans/debrief/view";
import { saveActivityFeeling } from "@/server/activities/actions";

const errors = {
  invalid: "Ce ressenti n’est pas valide.",
  error: "Enregistrement impossible. Réessaie dans un instant.",
  "session-expired": "Ta session a expiré. Reconnecte-toi pour enregistrer.",
} as const;

const efforts = Array.from({ length: 10 }, (_, index) => index + 1);

export function FeelingPrompt({
  activityId,
  initial = null,
  compact = false,
  onSaved,
}: {
  activityId: string;
  initial?: { effort: number | null; feel: FeelValue | null } | null;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const id = useId();
  const [effort, setEffort] = useState<number | null>(initial?.effort ?? null);
  const [feel, setFeel] = useState<FeelValue | null>(initial?.feel ?? null);
  const [pending, start] = useTransition();

  function save(nextEffort: number | null, value: FeelValue) {
    if (nextEffort === null) return;
    const before = { effort, feel };
    setEffort(nextEffort);
    setFeel(value);
    start(async () => {
      const result = await saveActivityFeeling({
        activityId,
        effort: nextEffort,
        feel: value,
      });
      if (result.status === "saved") {
        toast.success("Ressenti enregistré.", { id: `feeling-${activityId}` });
        onSaved?.();
        return;
      }
      setEffort(before.effort);
      setFeel(before.feel);
      toast.error(errors[result.status], { id: `feeling-${activityId}` });
    });
  }

  const showFeel = !compact || effort !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.75">
        <span id={`${id}-title`} className="text-[15px] font-semibold">
          {compact
            ? "Comment c’était ? Effort perçu, de 1 à 10"
            : "Comment c’était ?"}
        </span>
        <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
          {initial
            ? "Change ton effort ou tes sensations, c’est enregistré aussitôt."
            : compact
              ? "Ta montre n’a rien enregistré. Tes sensations juste après."
              : "Ta montre n’a pas enregistré de ressenti. Deux choix et c’est noté."}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {!compact && (
          <span id={`${id}-effort`} className="text-meta text-muted">
            Effort perçu, de 1 à 10
          </span>
        )}
        <ToggleGroup
          type="single"
          variant="choice"
          aria-labelledby={compact ? `${id}-title` : `${id}-effort`}
          value={effort === null ? "" : String(effort)}
          disabled={pending}
          onValueChange={(value) => {
            const next = Number(value);
            if (!efforts.includes(next)) return;
            if (feel === null) setEffort(next);
            else save(next, feel);
          }}
          className="grid grid-cols-5 gap-1.5"
        >
          {efforts.map((value) => (
            <ToggleGroupItem
              key={value}
              value={String(value)}
              className="min-h-11 px-0 font-metric text-lg tabular-nums"
            >
              {value}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="flex justify-between text-[11px] text-muted-foreground">
          <span>Très facile</span>
          <span>Maximal</span>
        </span>
      </div>
      {showFeel && (
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-feel`} className="text-meta text-muted">
            Sensations
          </span>
          <ToggleGroup
            type="single"
            variant="choice"
            aria-labelledby={`${id}-feel`}
            value={feel === null ? "" : String(feel)}
            disabled={pending || effort === null}
            onValueChange={(value) => {
              const next = feelValues.find((item) => String(item) === value);
              if (next !== undefined) save(effort, next);
            }}
            className="grid grid-cols-5 gap-1.5"
          >
            {feelValues.map((value) => (
              <ToggleGroupItem
                key={value}
                value={String(value)}
                className="min-h-11 px-1 text-[12.5px] whitespace-normal"
              >
                {feelLabels[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}

export function DebriefFeeling({
  activityId,
  feeling,
}: {
  activityId: string;
  feeling: DebriefFeelingView | null;
}) {
  const [editing, setEditing] = useState(false);
  if (!feeling || editing)
    return (
      <section
        aria-label="Ton ressenti"
        className="rounded-card border border-border-strong bg-surface p-3.5"
      >
        <FeelingPrompt
          activityId={activityId}
          initial={feeling?.value ?? null}
          onSaved={() => setEditing(false)}
        />
      </section>
    );
  const garmin = feeling.source === "garmin";
  return (
    <section
      aria-labelledby={`feeling-${activityId}`}
      className="flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-2.5">
        <MonoLabel size="nano" className="text-[9.5px]" asChild>
          <h3 id={`feeling-${activityId}`}>Ton ressenti</h3>
        </MonoLabel>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {garmin && <PulseDot tone="provider" breathing={false} />}
          {feeling.sourceLabel}
        </span>
      </div>
      {garmin ? (
        <dl className="grid grid-cols-2 gap-2.5">
          {feeling.effort && (
            <div className="flex flex-col gap-0.5 rounded-surface border border-border bg-surface px-3.5 py-3">
              <dt className="order-2 text-xs text-muted-foreground">
                {feeling.effortLabel}
              </dt>
              <dd className="order-1 font-metric text-2xl leading-[1.1] font-semibold tabular-nums">
                {feeling.effort}
              </dd>
            </div>
          )}
          {feeling.feel && (
            <div className="flex flex-col gap-0.5 rounded-surface border border-border bg-surface px-3.5 py-3">
              <dt className="order-2 text-xs text-muted-foreground">
                Sensations
              </dt>
              <dd className="order-1 text-lg leading-[1.35] font-semibold">
                {feeling.feel}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="flex items-center gap-3 rounded-surface border border-border bg-surface px-3.5 py-3">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="flex items-baseline gap-2.5">
              {feeling.effort && (
                <span className="font-metric text-2xl leading-[1.1] font-semibold tabular-nums">
                  {feeling.effort}
                </span>
              )}
              {feeling.feel && (
                <span className="text-[15px] font-semibold">
                  {feeling.feel}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              Effort perçu · sensations
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="max-sm:min-h-11"
            onClick={() => setEditing(true)}
          >
            Modifier
          </Button>
        </div>
      )}
    </section>
  );
}
