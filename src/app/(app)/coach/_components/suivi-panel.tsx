import { CheckIcon } from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import {
  messagesLabel,
  staffReads,
  suiviCard,
  suiviParticipants,
  suiviTimeline,
  type ThreadStatus,
} from "@/features/coach/conversations";
import type { ThreadItem } from "@/features/coach/items";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { staff } from "@/features/coach/staff";

const cardTone = {
  accent: "border-border bg-surface",
  warning: "border-warning-border bg-surface",
  success: "border-success-border bg-success-surface",
  muted: "border-border bg-surface",
} as const;

const dotTone = {
  accent: "accent",
  warning: "warning",
  success: "success",
  muted: "foreground",
} as const;

export function SuiviPanel({
  items,
  status,
  pendingToolUseId,
  proposalStatuses,
  timeZone,
}: {
  items: readonly ThreadItem[];
  status: ThreadStatus;
  pendingToolUseId: string | null;
  proposalStatuses: Readonly<Record<string, string>>;
  timeZone: string;
}) {
  const card = suiviCard(status);
  const steps = suiviTimeline({
    items,
    status,
    pendingToolUseId,
    proposalStatuses,
    timeZone,
  });
  const reads = staffReads(items);
  return (
    <div className="flex flex-col gap-6.5">
      <section className="flex flex-col gap-2.5">
        <MonoLabel size="micro">Suivi</MonoLabel>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-card border px-3.5 py-3",
            cardTone[card.tone],
          )}
        >
          <PulseDot
            tone={dotTone[card.tone]}
            breathing={status === "working"}
            className={cn("size-2", card.tone === "muted" && "bg-dim")}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.detail}</span>
          </span>
        </div>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="pb-1.5 text-sm font-semibold">Participants</h2>
        {suiviParticipants(items).map((participant) => (
          <div
            key={participant.agent}
            className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border-subtle py-2"
          >
            <StaffPortrait agent={participant.agent} size={36} decorative />
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-sm font-semibold">
                {staff[participant.agent].name}
              </span>
              <span className="text-xs text-muted-foreground">
                {participant.role}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {messagesLabel(participant.messages)}
            </span>
          </div>
        ))}
      </section>
      {steps.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="pb-1.5 text-sm font-semibold">Déroulé</h2>
          <ol className="flex flex-col">
            {steps.map((step, index) => (
              <li
                key={step.key}
                className="relative grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-2.5 py-1.75"
              >
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-5.5 -bottom-2 left-1.5 w-px bg-border"
                  />
                )}
                {step.state === "pending" ? (
                  <span
                    aria-hidden="true"
                    className="relative z-1 mt-0.5 size-3.25 rounded-full bg-warning ring-3 ring-warning/15"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="relative z-1 mt-0.5 grid size-3.25 place-items-center rounded-full border border-dim bg-surface-raised"
                  >
                    <CheckIcon className="size-2 text-muted" strokeWidth={3} />
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-px">
                  <span
                    className={cn(
                      "text-meta",
                      step.state === "pending"
                        ? "text-foreground"
                        : "text-muted",
                    )}
                  >
                    {step.label}
                    {step.state === "pending" && (
                      <span className="sr-only"> (en attente)</span>
                    )}
                  </span>
                  {step.detail && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {step.detail}
                    </span>
                  )}
                </span>
                {step.at && <MonoLabel size="nano">{step.at}</MonoLabel>}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Ce que le staff a lu</h2>
        {reads.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {reads.map((read) => (
              <span
                key={read}
                className="inline-flex items-center rounded-control border border-border-strong px-2 py-0.75 text-xs text-muted"
              >
                {read}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Aucune donnée lue pour l’instant.
          </span>
        )}
        <span className="text-xs leading-normal text-muted-foreground">
          Lecture seule. Le staff ne modifie rien sans ton accord.
        </span>
      </section>
    </div>
  );
}
