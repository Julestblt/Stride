import { CheckIcon, ChevronRightIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PulseDot } from "@/components/stride/marks";
import { MonoLabel } from "@/components/stride/mono-label";
import { SessionKindTile } from "@/components/stride/session-kind-tile";
import { SessionShape } from "@/components/stride/session-shape";
import { coachRequestHref } from "@/features/coach/request";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { SyncNowButton } from "@/features/data-activity/components/sync-request";
import {
  TodayShoeChip,
  TodayShoeRow,
} from "@/features/gear/components/session-shoes";
import { ScoreRing } from "@/features/progress/components/body-sections";
import { bodyPath } from "@/features/progress/health";
import { cn } from "@/lib/utils";
import type { TodayForm, TodayGoal, TodaySession, TodayWeek } from "../today";
import {
  reviewRule,
  type FormIndicator,
  type FormStatus,
  type TodayVerdict,
  type VerdictTone,
} from "../verdict";

export const todayCard =
  "flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-5 sm:px-5.5";

export function Eyebrow({
  id,
  tone,
  children,
}: {
  id?: string;
  tone?: "accent" | "foreground";
  children: React.ReactNode;
}) {
  return (
    <MonoLabel id={id} size="nano" tone={tone} className="text-[9.5px]">
      {children}
    </MonoLabel>
  );
}

function MoreLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-control text-[13px] text-muted hover:text-foreground",
        className,
      )}
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="size-3" />
    </Link>
  );
}

const toneText: Record<VerdictTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted",
};

const toneDot: Record<
  VerdictTone,
  "success" | "warning" | "danger" | "foreground"
> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  muted: "foreground",
};

const verdictFrames: Record<VerdictTone, string> = {
  success: "border-success-border bg-success-surface",
  warning: "border-warning-border bg-warning/4",
  danger: "border-danger-border bg-danger-surface",
  muted: "border-border bg-surface-raised",
};

function VerdictBlock({ verdict }: { verdict: TodayVerdict }) {
  return (
    <div
      role="group"
      aria-label="Verdict du jour"
      className={cn(
        "flex flex-col gap-2.5 rounded-card border px-3.5 py-3",
        verdictFrames[verdict.tone],
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap",
            toneText[verdict.tone],
          )}
        >
          <PulseDot tone={toneDot[verdict.tone]} breathing={false} />
          {verdict.label}
        </span>
        <span className="min-w-50 flex-1 text-[13.5px] leading-[1.45] text-foreground">
          {verdict.text}
        </span>
      </p>
      {verdict.motif && (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-danger"
          />
          {verdict.motif}
        </p>
      )}
      {(verdict.actions.length > 0 || verdict.sync) && (
        <div className="flex flex-wrap gap-2">
          {verdict.actions.map((action) => (
            <Button
              key={action.key}
              asChild
              variant={action.primary ? "default" : "outline"}
              size="md"
              className="flex-1 max-sm:h-11"
            >
              <Link href={action.href}>
                {(action.key === "lighter" || action.key === "review") && (
                  <MessageCircleIcon aria-hidden="true" className="size-4" />
                )}
                {action.label}
              </Link>
            </Button>
          ))}
          {verdict.sync && (
            <SyncNowButton variant="outline" className="flex-1 max-sm:h-11" />
          )}
        </div>
      )}
    </div>
  );
}

export function SessionSection({
  session,
  verdict,
}: {
  session: TodaySession;
  verdict: TodayVerdict | null;
}) {
  return (
    <section
      aria-labelledby="today-session"
      className={cn(todayCard, "gap-4 sm:px-6.5 sm:py-6")}
    >
      <Eyebrow id="today-session" tone="accent">
        Séance du jour
      </Eyebrow>
      {session.kind === "session" ? (
        <PlannedSession session={session} verdict={verdict} />
      ) : session.kind === "rest" ? (
        <>
          <div className="flex items-start gap-3.5">
            <SessionKindTile
              kind="rest"
              size="xl"
              className="max-sm:size-10 max-sm:rounded-[10px]"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-[34px]">
                Jour de repos
              </h2>
              {session.next ? (
                <p className="text-[15px] leading-normal text-muted">
                  Prochaine séance :{" "}
                  <Link
                    href={session.next.href}
                    className="rounded-control text-foreground underline-offset-4 hover:underline"
                  >
                    {session.next.when} · {session.next.title}
                  </Link>
                </p>
              ) : (
                <p className="text-[15px] leading-normal text-muted">
                  Pas de séance prévue aujourd’hui.
                </p>
              )}
            </div>
          </div>
          {verdict && <VerdictBlock verdict={verdict} />}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.025em]">
              Pas encore de plan
            </h2>
            <p className="text-[15px] leading-normal text-muted">
              Ajoute une course objectif : Stride construit ton plan et te dit
              chaque matin quoi faire.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="md" className="flex-1 max-sm:h-11">
              <Link href="/races">Ajouter une course</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="md"
              className="flex-1 max-sm:h-11"
            >
              <Link
                href={coachRequestHref(
                  "Je n’ai pas encore de plan. Propose-moi une séance pour aujourd’hui.",
                )}
              >
                Demander une séance au coach
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function PlannedSession({
  session,
  verdict,
}: {
  session: Extract<TodaySession, { kind: "session" }>;
  verdict: TodayVerdict | null;
}) {
  const { panel } = session;
  const done = panel.status === "done" || panel.status === "partial";
  return (
    <>
      <div className="flex items-start gap-3.5">
        <SessionKindTile
          kind={panel.family}
          size="xl"
          className="max-sm:size-10 max-sm:rounded-[10px]"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-[34px]">
            {panel.title}
          </h2>
          <p className="text-[15px] leading-normal text-muted">
            {panel.purpose}
          </p>
        </div>
      </div>
      {done && panel.completion && (
        <p
          className={cn(
            "flex items-center gap-2 text-[13px]",
            panel.status === "done" ? "text-success" : "text-warning",
          )}
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
          {panel.completion.headline}
        </p>
      )}
      {panel.checkIn?.done && (
        <p className="flex items-center gap-2 text-[13px] text-success">
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
          Fait · noté par toi
        </p>
      )}
      {session.stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {session.stats.map((stat) => (
            <div key={stat.key} className="flex min-w-0 flex-col gap-0.75">
              <dt className="order-2">
                <Eyebrow>{stat.label}</Eyebrow>
              </dt>
              <dd className="order-1 truncate font-metric text-[26px] leading-none font-semibold tabular-nums sm:text-[28px]">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {panel.segments.length > 0 && (
        <SessionShape
          label={panel.structureLabel}
          blocks={panel.segments.map((segment) => ({
            minutes: segment.seconds / 60,
            zone: segment.zone,
          }))}
          className="h-10"
        />
      )}
      {verdict && !done ? (
        <VerdictBlock verdict={verdict} />
      ) : (
        <div>
          <Button asChild variant="outline" size="md">
            <Link href={session.href}>Voir les étapes</Link>
          </Button>
        </div>
      )}
      {!done && panel.shoes && <TodayShoeRow shoes={panel.shoes} />}
      {(session.terrain || (!done && panel.shoes?.chosen)) && (
        <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
          {session.terrain}
          {!done && panel.shoes && (
            <span className="ml-auto">
              <TodayShoeChip shoes={panel.shoes} href={session.href} />
            </span>
          )}
        </span>
      )}
    </>
  );
}

const statusTones: Record<FormStatus, VerdictTone> = {
  normal: "success",
  watch: "warning",
  crossed: "danger",
};

const markerFills: Record<FormStatus, string> = {
  normal: "bg-success",
  watch: "bg-warning",
  crossed: "bg-danger",
};

function IndicatorRow({ indicator }: { indicator: FormIndicator }) {
  const tone = statusTones[indicator.status];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border-subtle py-2.75">
      <dt className="flex min-w-0 items-baseline gap-2.5">
        <span className="w-18 shrink-0 text-[13px] text-muted">
          {indicator.label}
        </span>
        <span className="font-metric text-[19px] font-semibold tabular-nums">
          {indicator.value}
        </span>
      </dt>
      <dd
        className={cn(
          "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
          toneText[tone],
        )}
      >
        <PulseDot tone={toneDot[tone]} breathing={false} />
        {indicator.statusLabel}
      </dd>
      <dd className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        {indicator.band && indicator.marker !== null ? (
          <span aria-hidden="true" className="px-0.5">
            <span className="relative block h-1.5 rounded-full bg-border">
              <span
                className="absolute inset-y-0 rounded-full bg-dim"
                style={{
                  left: `${indicator.band.start}%`,
                  width: `${indicator.band.end - indicator.band.start}%`,
                }}
              />
              {indicator.threshold !== null && (
                <span
                  className="absolute -top-0.75 h-3 w-0.5 rounded-mark bg-danger"
                  style={{ left: `${indicator.threshold}%` }}
                />
              )}
              <span
                className={cn(
                  "absolute -top-0.5 size-2.5 -translate-x-1/2 rounded-full ring-2 ring-surface",
                  markerFills[indicator.status],
                )}
                style={{ left: `${indicator.marker}%` }}
              />
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11.5px] whitespace-nowrap text-muted-foreground">
          {indicator.note}
        </span>
      </dd>
    </div>
  );
}

export function FormSection({
  form,
  verdict,
}: {
  form: TodayForm;
  verdict: TodayVerdict | null;
}) {
  return (
    <section aria-labelledby="today-form" className={cn(todayCard, "gap-3")}>
      <div className="flex items-baseline gap-2.5">
        <h2>
          <Eyebrow id="today-form">Forme du jour</Eyebrow>
        </h2>
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          Garmin + ressenti
        </span>
        <MoreLink href={bodyPath}>Corps</MoreLink>
      </div>
      {form.score !== null ? (
        <div className="flex items-center gap-3.5">
          <ScoreRing
            score={form.score}
            tone={form.tone}
            className="size-16"
            metricClassName={cn("text-[27px] leading-16", toneText[form.tone])}
          />
          <span className="flex flex-col gap-0.5">
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold">
                {form.score} · {form.level}
              </span>
              <span className="text-[13px] text-muted-foreground">sur 100</span>
            </span>
            {form.gap && (
              <span className="text-[13px] text-muted-foreground">
                {form.gap}
              </span>
            )}
          </span>
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">
          Garmin n’a pas transmis de forme du jour pour aujourd’hui.
        </p>
      )}
      {form.indicators.length > 0 && (
        <dl className="grid gap-x-7 sm:grid-cols-2">
          {form.indicators.map((indicator) => (
            <IndicatorRow key={indicator.key} indicator={indicator} />
          ))}
        </dl>
      )}
      {verdict?.compat && (
        <div className="flex flex-col gap-1 rounded-card bg-surface-raised px-3.5 py-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span>{verdict.compat.question}</span>
            <b
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 font-semibold whitespace-nowrap",
                toneText[verdict.compat.tone],
              )}
            >
              <PulseDot tone={toneDot[verdict.compat.tone]} breathing={false} />
              {verdict.compat.answer}
            </b>
          </p>
          <p className="text-xs text-muted-foreground">
            {verdict.compat.detail}
          </p>
        </div>
      )}
      {verdict?.compat && (
        <p className="text-[11.5px] leading-normal text-muted-foreground">
          {reviewRule}
        </p>
      )}
    </section>
  );
}

export function WeekSection({ week }: { week: TodayWeek }) {
  return (
    <section aria-labelledby="today-week" className={todayCard}>
      <div className="flex items-baseline gap-2.5">
        <h2>
          <Eyebrow id="today-week">
            Cette semaine · S{week.number} / {week.total}
          </Eyebrow>
        </h2>
        <span className="text-xs text-muted-foreground">{week.blockName}</span>
        <MoreLink href={week.href}>Plan</MoreLink>
      </div>
      <ol className="flex gap-1">
        {week.days.map((day) => (
          <li
            key={day.date}
            aria-current={day.isToday ? "date" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-surface border border-transparent py-2",
              day.isToday && "border-foreground bg-surface-raised",
              day.isPast && "opacity-55",
            )}
          >
            <span className="sr-only">{day.label}</span>
            <MonoLabel
              aria-hidden="true"
              size="nano"
              tone={day.isToday ? "accent" : "muted"}
            >
              {day.letter}
            </MonoLabel>
            <SessionKindTile kind={day.family} size="lg" className="size-6.5" />
            <span aria-hidden="true" className="flex h-3 items-center">
              {(day.state === "done" || day.state === "partial") && (
                <CheckIcon
                  className={cn(
                    "size-2.5",
                    day.state === "done" ? "text-success" : "text-warning",
                  )}
                  strokeWidth={3}
                />
              )}
              {day.state === "missed" && (
                <PulseDot tone="danger" breathing={false} />
              )}
              {day.state === "proposed" && (
                <PulseDot tone="warning" breathing={false} />
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-muted">
          <b className="font-metric text-[17px] font-semibold text-foreground">
            {week.done.duration}
          </b>{" "}
          sur {week.planned.duration}
          {week.planned.distance && (
            <>
              {" · "}
              <b className="font-metric text-[17px] font-semibold text-foreground">
                {week.done.distance ?? "–"}
              </b>{" "}
              sur {week.planned.distance}
            </>
          )}
        </span>
        <span
          role="progressbar"
          aria-label="Volume de la semaine réalisé"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={week.pct}
          className="h-1 flex-1 overflow-hidden rounded-mark bg-border"
        >
          <span
            className="block h-full bg-success"
            style={{ width: `${week.pct}%` }}
          />
        </span>
      </div>
    </section>
  );
}

export function GoalSection({ goal }: { goal: TodayGoal | null }) {
  return (
    <section aria-labelledby="today-goal" className={cn(todayCard, "gap-3")}>
      <div className="flex items-baseline gap-2.5">
        <h2>
          <Eyebrow id="today-goal">Objectif</Eyebrow>
        </h2>
        {goal && <MoreLink href="/races">Courses</MoreLink>}
      </div>
      {goal ? (
        <>
          <Link
            href={goal.href}
            className="flex items-center gap-3 rounded-control hover:text-accent"
          >
            <span
              aria-hidden="true"
              className="inline-grid size-8 shrink-0 place-items-center rounded-surface bg-accent font-metric text-[17px] font-bold text-accent-foreground"
            >
              {goal.letter}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">
                {goal.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {goal.detail}
              </span>
            </span>
            <span className="font-metric text-[30px] leading-none font-semibold text-foreground tabular-nums">
              {goal.days === 0 ? "Jour J" : `J-${goal.days}`}
            </span>
          </Link>
          {(goal.block || goal.light) && (
            <dl className="flex flex-col border-t border-border">
              {goal.block && (
                <div className="flex items-center gap-2.5 border-b border-border-subtle py-2.5 text-[13px] last:border-b-0">
                  <dt className="flex-1 text-muted">Bloc {goal.block.name}</dt>
                  <dd className="font-metric text-base font-semibold tabular-nums">
                    {goal.block.week}
                  </dd>
                </div>
              )}
              {goal.light && (
                <div className="flex items-center gap-2.5 py-2.5 text-[13px]">
                  <dt className="flex-1 text-muted">Semaine allégée</dt>
                  <dd>{goal.light}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      ) : (
        <>
          <p className="text-meta text-muted-foreground">
            Aucune course objectif pour l’instant.
          </p>
          <div>
            <MoreLink href="/races" className="ml-0">
              Voir les courses
            </MoreLink>
          </div>
        </>
      )}
    </section>
  );
}
