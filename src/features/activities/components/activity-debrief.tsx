import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import { DebriefFeeling } from "@/features/activities/components/feeling-prompt";
import {
  DebriefCoach,
  DebriefSteps,
} from "@/features/activities/components/session-debrief";
import type { DebriefView } from "@/features/plans/debrief/view";

export function ActivityDebrief({ debrief }: { debrief: DebriefView }) {
  const warning = debrief.verdict.tone === "warning";
  return (
    <section
      aria-labelledby="activity-debrief"
      className="flex flex-col gap-5.5 rounded-panel border border-border bg-surface p-5 sm:px-7 sm:py-6.5"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="activity-debrief" className="text-sm font-semibold">
          Débrief de la séance
        </h2>
        <MonoLabel size="micro">
          {[`Prévue : ${debrief.sessionTitle}`, debrief.alignment]
            .filter(Boolean)
            .join(" · ")}
        </MonoLabel>
        <Link
          href={debrief.planHref}
          className="ml-auto inline-flex min-h-8 items-center gap-1.5 text-meta text-muted hover:text-foreground"
        >
          Voir dans le plan
          <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      <div className="flex max-w-215 flex-col gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2 text-meta",
            warning ? "text-warning" : "text-success",
          )}
        >
          <PulseDot tone={warning ? "warning" : "success"} breathing={false} />
          {debrief.verdict.title}
        </span>
        <p className="text-title leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
          {debrief.verdict.body}
        </p>
      </div>
      {debrief.aligned || debrief.note ? (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(17.5rem,1fr)]">
          <div className="flex min-w-0 flex-col gap-3.5 border-t border-border-strong pt-3.5">
            {debrief.aligned ? (
              <DebriefSteps steps={debrief.steps} />
            ) : (
              <p className="flex items-start gap-2.5 text-[13px] leading-normal text-muted">
                <InfoIcon
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {debrief.note}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3.5">
            <DebriefFeeling
              activityId={debrief.activityId}
              feeling={debrief.feeling}
            />
            <DebriefCoach href={debrief.coachHref} stacked />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-3.5 lg:grid-cols-2">
          <DebriefFeeling
            activityId={debrief.activityId}
            feeling={debrief.feeling}
          />
          <DebriefCoach href={debrief.coachHref} stacked />
        </div>
      )}
    </section>
  );
}
