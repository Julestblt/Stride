import {
  ArrowRightIcon,
  CheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/features/plans/review/proposal";
import type {
  ProposalReview,
  ReviewBanner,
  ReviewCheck,
  ReviewOperation,
  ReviewTone,
} from "@/features/plans/review/review";

export const toneText: Record<ReviewTone, string> = {
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted",
  danger: "text-danger",
};

export function ToneDot({ tone }: { tone: ReviewTone }) {
  return (
    <PulseDot
      breathing={false}
      tone={tone === "muted" ? "foreground" : tone}
      className={tone === "muted" ? "bg-muted" : undefined}
    />
  );
}

export function StaffMonogram({
  member,
  size = "sm",
}: {
  member: StaffMember;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-tag bg-surface-raised font-semibold text-foreground ring-2 ring-surface-panel",
        size === "sm" ? "size-6 text-label" : "size-9 text-sm",
      )}
    >
      {member.monogram}
    </span>
  );
}

export function StaffStack({ staff }: { staff: StaffMember[] }) {
  return (
    <span aria-hidden="true" className="flex -space-x-1.5">
      {staff.map((member) => (
        <StaffMonogram key={member.name} member={member} />
      ))}
    </span>
  );
}

const bannerStyles: Record<ReviewTone, string> = {
  success: "border-success-border bg-success-surface",
  danger: "border-danger-border bg-danger-surface",
  warning: "border-warning-border bg-warning/4",
  muted: "border-border-strong bg-surface",
};

function Banner({ banner }: { banner: ReviewBanner }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-1 rounded-card border px-3.5 py-3",
        bannerStyles[banner.tone],
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          toneText[banner.tone],
        )}
      >
        <ToneDot tone={banner.tone} />
        {banner.title}
      </span>
      <span className="text-meta leading-normal text-muted">{banner.body}</span>
    </div>
  );
}

function Side({
  side,
  struck,
}: {
  side: ReviewOperation["before"];
  struck: boolean;
}) {
  if (!side) return <span className="text-sm text-muted-foreground">Rien</span>;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "text-sm",
          struck
            ? "text-muted-foreground line-through decoration-dim"
            : "font-semibold",
        )}
      >
        {side.title}
      </span>
      {side.meta && (
        <span
          className={cn(
            "text-xs",
            struck ? "text-muted-foreground" : "text-muted",
          )}
        >
          {side.meta}
        </span>
      )}
    </span>
  );
}

function Operations({ review }: { review: ProposalReview }) {
  const count = review.operations.length;
  return (
    <section
      aria-labelledby="review-operations"
      className="flex flex-col gap-2.5"
    >
      <MonoLabel asChild size="micro">
        <h3 id="review-operations">
          Ce qui change · {count} modification{count > 1 ? "s" : ""}
        </h3>
      </MonoLabel>
      <ul className="flex flex-col border-b border-border">
        {review.operations.map((operation, index) => (
          <li
            key={index}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-t border-border py-3 max-sm:grid-cols-1 max-sm:gap-1.5"
          >
            <span className="flex flex-col gap-1">
              <MonoLabel size="micro" tone="foreground">
                {operation.label}
              </MonoLabel>
              <span className="text-xs text-muted-foreground">
                {operation.context}
              </span>
            </span>
            <span className="grid grid-cols-[minmax(0,1fr)_14px_minmax(0,1fr)] items-center gap-2.5">
              <Side side={operation.before} struck />
              <ArrowRightIcon
                aria-label="devient"
                className="size-3.5 text-muted-foreground"
              />
              <Side side={operation.after} struck={false} />
            </span>
          </li>
        ))}
      </ul>
      {review.weekTotals.map((week) => (
        <div
          key={week.label}
          className="flex flex-wrap items-baseline gap-x-5.5 gap-y-2 rounded-surface border border-border bg-surface-inset px-3.5 py-3"
        >
          <MonoLabel size="micro">{week.label}</MonoLabel>
          <span className="flex items-baseline gap-2">
            <span className="font-metric text-xl font-semibold text-muted-foreground tabular-nums">
              {week.duration.before}
            </span>
            <ArrowRightIcon
              aria-label="devient"
              className="size-3.5 self-center text-muted-foreground"
            />
            <span className="font-metric text-xl font-semibold tabular-nums">
              {week.duration.after}
            </span>
            {week.duration.delta && (
              <span className="text-xs text-muted">{week.duration.delta}</span>
            )}
          </span>
          {week.elevation && (
            <span className="flex items-baseline gap-2">
              <span className="font-metric text-xl font-semibold text-muted-foreground tabular-nums">
                {week.elevation.before}
              </span>
              <ArrowRightIcon
                aria-label="devient"
                className="size-3.5 self-center text-muted-foreground"
              />
              <span className="font-metric text-xl font-semibold tabular-nums">
                {week.elevation.after}
              </span>
              <span className="text-xs text-muted">D+</span>
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

const phaseTones: Record<string, string> = {
  lead_in: "bg-dim",
  base: "bg-provider",
  build: "bg-success",
  specific: "bg-zone-4",
  taper: "bg-border-strong",
  race: "bg-accent",
  recovery: "bg-provider-muted",
  transition: "bg-dim",
};

function NewPlan({ plan }: { plan: NonNullable<ProposalReview["newPlan"]> }) {
  const metrics = [
    { label: "Semaines", value: String(plan.weeks) },
    { label: "Séances", value: String(plan.sessions) },
    { label: "Semaine pic", value: plan.peakWeek },
    { label: "Début", value: plan.startsOn },
  ];
  return (
    <section aria-label="Nouveau plan" className="flex flex-col gap-3.5">
      <dl className="grid grid-cols-4 gap-3 rounded-card border border-border bg-surface-inset p-3.5 max-sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex flex-col gap-0.75">
            <dt className="order-2">
              <MonoLabel size="micro">{metric.label}</MonoLabel>
            </dt>
            <dd className="order-1 font-metric text-2xl leading-none font-semibold tabular-nums">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
      {plan.phases.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <MonoLabel size="micro">Phases</MonoLabel>
          <span aria-hidden="true" className="flex h-2.5 gap-0.5">
            {plan.phases.map((phase) => (
              <span
                key={phase.key}
                className={cn(
                  "rounded-mark",
                  phaseTones[phase.kind] ?? "bg-dim",
                )}
                style={{ flex: phase.weeks }}
              />
            ))}
          </span>
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
            {plan.phases.map((phase) => (
              <li key={phase.key}>
                {phase.name} · {phase.weeks} sem.
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.races.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <MonoLabel size="micro">Courses</MonoLabel>
          <ul className="flex flex-col gap-1.5">
            {plan.races.map((race) => (
              <li
                key={race.id}
                className="flex flex-wrap items-center gap-2.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-5.5 place-items-center rounded-control font-metric text-meta font-bold",
                    race.letter === "A"
                      ? "bg-accent text-accent-foreground"
                      : "border-[1.5px] border-muted text-muted",
                  )}
                >
                  {race.letter}
                </span>
                <span className="sr-only">Course {race.letter} · </span>
                <span className="font-semibold">{race.name}</span>
                <span className="text-muted-foreground">{race.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-meta leading-normal text-muted-foreground">
        {plan.replacesActive
          ? "Si tu l’actives, ton plan actuel est archivé et reste lisible dans l’historique."
          : "Si tu l’actives, il devient ton plan d’entraînement."}
      </p>
    </section>
  );
}

function Opinions({ review }: { review: ProposalReview }) {
  if (review.opinions.length === 0) return null;
  return (
    <section aria-labelledby="review-why" className="flex flex-col gap-3">
      <MonoLabel asChild size="micro">
        <h3 id="review-why">Pourquoi</h3>
      </MonoLabel>
      {review.opinions.map((opinion, index) => (
        <div
          key={index}
          className={cn(
            "grid grid-cols-[36px_minmax(0,1fr)] gap-3",
            !opinion.lead &&
              "rounded-card border border-border bg-surface-inset p-3.5",
          )}
        >
          <StaffMonogram member={opinion} size="md" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {opinion.name}
              <MonoLabel size="micro" className="font-normal">
                {opinion.label}
              </MonoLabel>
              {opinion.verdict && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-border-strong px-2 py-0.5 text-xs font-normal">
                  <ToneDot tone={opinion.verdict.tone} />
                  {opinion.verdict.label}
                </span>
              )}
            </span>
            <p
              className={cn(
                "text-sm leading-[1.55]",
                opinion.lead ? "text-foreground" : "text-muted",
              )}
            >
              {opinion.text}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function CheckIconFor({ tone }: { tone: ReviewCheck["tone"] }) {
  if (tone === "pass")
    return (
      <CheckIcon
        aria-hidden="true"
        className="mt-0.5 size-3 text-success"
        strokeWidth={3}
      />
    );
  if (tone === "warn")
    return (
      <TriangleAlertIcon
        aria-hidden="true"
        className="mt-0.5 size-3 text-warning"
      />
    );
  return (
    <XIcon
      aria-hidden="true"
      className="mt-0.5 size-3 text-danger"
      strokeWidth={3}
    />
  );
}

function Checks({ checks }: { checks: ReviewCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <section aria-labelledby="review-checks" className="flex flex-col gap-2">
      <MonoLabel asChild size="micro">
        <h3 id="review-checks">Contrôles de Stride</h3>
      </MonoLabel>
      <ul className="flex flex-col gap-2 text-meta leading-[1.45] text-muted">
        {checks.map((check) => (
          <li
            key={check.text}
            className={cn(
              "flex items-start gap-2",
              check.tone !== "pass" && "text-foreground",
            )}
          >
            <CheckIconFor tone={check.tone} />
            {check.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProposalReviewBody({
  review,
  titleSlot,
}: {
  review: ProposalReview;
  titleSlot: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5.5">
      {review.banner && <Banner banner={review.banner} />}
      <div className="flex flex-col gap-2">
        {titleSlot}
        {review.summary && (
          <p className="text-body text-muted">{review.summary}</p>
        )}
      </div>
      <div className="flex items-center gap-2.5 rounded-surface border border-border px-3 py-2.5 text-meta text-muted">
        <StaffStack staff={review.origin.staff} />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-foreground">{review.origin.line}</span>
          <span className="text-xs text-muted-foreground">
            {review.origin.detail}
          </span>
        </span>
      </div>
      {review.kind === "change" && review.operations.length > 0 && (
        <Operations review={review} />
      )}
      {review.newPlan && <NewPlan plan={review.newPlan} />}
      <Opinions review={review} />
      <Checks checks={review.checks} />
    </div>
  );
}
