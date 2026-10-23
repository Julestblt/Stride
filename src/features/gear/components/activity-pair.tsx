"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NavGearIcon } from "@/components/stride/nav-icons";
import { cn } from "@/lib/utils";
import { setActivityPair } from "@/server/gear/actions";
import type { PairCheckState } from "../check";
import type { ActivityPairView, PairQuestion } from "../check-view";
import { gearErrorMessage } from "../form";
import { PairSheet } from "./session-shoes";

const stateDots: Record<PairCheckState, string> = {
  same: "bg-success",
  different: "bg-warning",
  missing: "bg-accent",
  corrected: "bg-foreground",
  unplanned: "bg-provider",
};

function useActivityPair(activityId: string) {
  const [pending, startTransition] = useTransition();
  const save = (shoeId: string | null, message: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await setActivityPair({ activityId, shoeId });
      if (result.status === "saved") {
        toast.success(message);
        onDone?.();
      } else toast.error(gearErrorMessage(result));
    });
  return { pending, save };
}

export function PairQuestionCard({ question }: { question: PairQuestion }) {
  const [picking, setPicking] = useState(false);
  const { pending, save } = useActivityPair(question.activityId);
  const id = `pair-question-${question.activityId}`;
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex flex-col gap-2.5 rounded-card border border-warning-border bg-warning/4 px-3.5 py-3"
    >
      <span
        id={id}
        className="flex items-start gap-2 text-[13px] leading-[1.45] text-foreground"
      >
        <span
          aria-hidden="true"
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning"
        />
        <span>
          Garmin indique les{" "}
          <b className="font-semibold">{question.garmin.name}</b>, la séance
          prévoyait les <b className="font-semibold">{question.planned.name}</b>
          .
        </span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="md"
          disabled={pending}
          className="max-sm:h-11"
          onClick={() =>
            save(null, `C’étaient les ${question.garmin.name}, c’est noté.`)
          }
        >
          Oui, les {question.garmin.name}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={pending}
          className="max-sm:h-11"
          onClick={() =>
            save(
              question.planned.id,
              `Les ${question.planned.name}, corrigé dans Garmin.`,
            )
          }
        >
          Non, les {question.planned.name}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={pending}
          className="max-sm:h-11"
          onClick={() => setPicking(true)}
        >
          Autre paire
        </Button>
      </div>
      <span className="text-[11.5px] text-muted-foreground">
        Ta réponse corrige aussi la paire dans Garmin.
      </span>
      {picking && (
        <PairSheet
          title="Quelle paire as-tu portée ?"
          context={question.context}
          note="Ta réponse corrige aussi la paire dans Garmin."
          options={question.options}
          initialId={null}
          pending={pending}
          open={picking}
          onOpenChange={setPicking}
          onConfirm={(option) =>
            save(option.id, `Les ${option.name}, corrigé dans Garmin.`, () =>
              setPicking(false),
            )
          }
        />
      )}
    </div>
  );
}

export function PairAlert({ question }: { question: PairQuestion }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-warning-border bg-warning/4 px-4 py-3.5">
      <span
        aria-hidden="true"
        className="mt-1.75 size-1.5 shrink-0 rounded-full bg-warning"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{question.title}</span>
        <span className="text-[13px] leading-[1.45] text-muted">
          Garmin indique les {question.garmin.name}, la séance prévoyait les{" "}
          {question.planned.name}.
        </span>
      </span>
      <Button asChild variant="outline" size="md" className="max-sm:h-11">
        <Link href={`/activities/${question.activityId}`}>Répondre</Link>
      </Button>
    </div>
  );
}

export function ActivityPairBlock({ view }: { view: ActivityPairView }) {
  const [picking, setPicking] = useState(false);
  const { pending, save } = useActivityPair(view.activityId);
  return (
    <section
      aria-label="Chaussures"
      className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface px-4 py-3.5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border-strong bg-surface-raised">
        <NavGearIcon className="size-4.5" />
      </span>
      <span className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{view.name}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              stateDots[view.state],
            )}
          />
          {view.line}
        </span>
      </span>
      {view.options.length > 0 && (
        <Button
          variant="outline"
          size="md"
          className="max-sm:h-11"
          disabled={pending}
          onClick={() => setPicking(true)}
        >
          Changer
        </Button>
      )}
      {picking && (
        <PairSheet
          title="Quelle paire as-tu portée ?"
          context={view.context}
          note="Stride corrige aussi la paire dans Garmin."
          options={view.options}
          initialId={view.selectedId}
          pending={pending}
          open={picking}
          onOpenChange={setPicking}
          onConfirm={(option) =>
            save(option.id, `Les ${option.name}, corrigé dans Garmin.`, () =>
              setPicking(false),
            )
          }
        />
      )}
    </section>
  );
}
