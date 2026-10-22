import { InfoIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { zoneFills } from "@/components/stride/session-shape";
import { cn } from "@/lib/utils";
import type {
  DebriefStatusTone,
  DebriefStepView,
  DebriefView,
} from "@/features/plans/debrief/view";

const chipTones: Record<DebriefStatusTone, string> = {
  success: "border-success-border bg-success-surface text-success",
  warning: "border-warning-border bg-warning/4 text-warning",
  danger: "border-danger-border bg-danger-surface text-danger",
};

const actualTones: Record<DebriefStepView["actualTone"], string> = {
  default: "",
  danger: "text-danger",
  warning: "text-warning",
};

export function DebriefVerdict({
  debrief,
  pct,
  detail,
}: {
  debrief: DebriefView;
  pct: number | null;
  detail: string | null;
}) {
  const warning = debrief.verdict.tone === "warning";
  return (
    <section
      aria-labelledby="debrief-verdict"
      className={cn(
        "flex flex-col gap-2 rounded-card border p-3.5 sm:gap-2.5 sm:px-4",
        warning
          ? "border-warning-border bg-warning/4"
          : "border-success-border bg-success-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <MonoLabel
            size="nano"
            className={cn(
              "text-[9.5px]",
              warning ? "text-warning" : "text-success",
            )}
          >
            Débrief
          </MonoLabel>
          <span
            id="debrief-verdict"
            className="text-[17px] leading-[1.25] font-semibold"
          >
            {debrief.verdict.title}
          </span>
          <span className="text-[13px] leading-normal text-muted">
            {debrief.verdict.body}
          </span>
        </span>
        {pct !== null && (
          <span className="flex shrink-0 flex-col items-end">
            <span
              className={cn(
                "font-metric text-[28px] leading-none font-semibold tabular-nums sm:text-[30px]",
                warning ? "text-warning" : "text-success",
              )}
            >
              {pct} %
            </span>
            <MonoLabel size="nano">conforme</MonoLabel>
          </span>
        )}
      </div>
      {detail && (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </section>
  );
}

export function DebriefNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-2.5 rounded-surface border border-border bg-surface-raised px-3.5 py-3 text-[13px] leading-normal text-muted"
    >
      <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </p>
  );
}

function StepStatus({ step }: { step: DebriefStepView }) {
  if (!step.status) return <span />;
  if (!step.status.chip)
    return (
      <span className="inline-flex items-center gap-1.5 justify-self-end text-xs text-muted-foreground">
        <span
          aria-hidden="true"
          className="inline-block size-1.5 rounded-full bg-success"
        />
        {step.status.label}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center justify-self-end rounded-full border px-2 text-[11.5px] whitespace-nowrap sm:px-2.25 sm:text-xs",
        chipTones[step.status.tone],
      )}
    >
      {step.status.label}
    </span>
  );
}

export function DebriefSteps({
  steps,
  title = "Étape par étape",
}: {
  steps: DebriefStepView[];
  title?: string;
}) {
  const grid =
    "grid grid-cols-[4px_minmax(0,1fr)_auto_5.375rem] items-center gap-2.5 sm:grid-cols-[4px_minmax(0,1fr)_5.125rem_3.625rem_5.75rem]";
  return (
    <section aria-labelledby="debrief-steps" className="flex flex-col">
      <MonoLabel
        size="nano"
        id="debrief-steps"
        className="pb-1.5 text-[9.5px] sm:pb-2"
        asChild
      >
        <h3>{title}</h3>
      </MonoLabel>
      <div aria-hidden="true" className={cn(grid, "pb-1.5 max-sm:hidden")}>
        <span />
        <MonoLabel size="nano">Étape</MonoLabel>
        <MonoLabel size="nano">Cible</MonoLabel>
        <MonoLabel size="nano">Réalisé</MonoLabel>
        <span />
      </div>
      <ol>
        {steps.map((step) => (
          <li
            key={step.key}
            className={cn(
              grid,
              "border-t border-border",
              step.compact
                ? "py-1.5 text-xs text-muted-foreground"
                : "py-2.25 text-[13px]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "self-stretch rounded-mark",
                step.zone === 1 ? "bg-dim" : zoneFills[step.zone],
              )}
            />
            <span className="flex min-w-0 flex-col gap-px">
              <span
                className={cn(!step.compact && step.detail && "font-semibold")}
              >
                {step.name}
              </span>
              {step.detail && (
                <span className="text-[11.5px] text-muted-foreground">
                  {step.detail}
                </span>
              )}
            </span>
            <span className="font-metric text-[15px] font-semibold text-muted-foreground tabular-nums max-sm:hidden">
              <span className="sr-only">Cible : </span>
              {step.target}
            </span>
            <span className="flex flex-col items-end sm:items-start">
              <span
                className={cn(
                  "font-metric font-semibold tabular-nums",
                  step.compact
                    ? "text-sm text-muted"
                    : "text-base leading-[1.1] sm:text-[15px]",
                  actualTones[step.actualTone],
                )}
              >
                <span className="sr-only">Réalisé : </span>
                {step.actual}
              </span>
              {!step.compact && (
                <span
                  aria-hidden="true"
                  className="font-metric text-xs font-semibold text-muted-foreground tabular-nums sm:hidden"
                >
                  {step.target}
                </span>
              )}
            </span>
            <StepStatus step={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DebriefCoach({
  href,
  stacked = false,
}: {
  href: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-card border border-border bg-surface p-3.5",
        stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center",
      )}
    >
      <p className="flex flex-1 items-start gap-2 text-[13px] leading-[1.45] text-muted">
        <StrideMark aria-hidden="true" className="mt-0.75 size-3.25 shrink-0" />
        Le coach reçoit la séance, ce débrief et ton ressenti.
      </p>
      <Button
        asChild
        size="md"
        className={cn(stacked ? "min-h-12" : "max-sm:min-h-12 sm:self-center")}
      >
        <Link href={href}>En parler au coach</Link>
      </Button>
    </div>
  );
}
