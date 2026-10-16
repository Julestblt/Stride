import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DirectionMark, PulseDot } from "@/components/stride/marks";
import { MonoLabel } from "@/components/stride/mono-label";
import { SessionKindTile } from "@/components/stride/session-kind-tile";
import { SessionShape } from "@/components/stride/session-shape";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import type { Legs } from "@/features/progress/recovery";
import { cn } from "@/lib/utils";
import type {
  TodayHeader,
  TodayLatest,
  TodayRace,
  TodayReadiness,
  TodaySession,
  TodayUpcoming,
  TodayWeek,
} from "../today";
import { LegsCheckin } from "./legs-checkin";

const card =
  "flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-5 sm:px-5.5";

function Eyebrow({
  id,
  tone,
  children,
}: {
  id?: string;
  tone?: "accent";
  children: React.ReactNode;
}) {
  return (
    <MonoLabel id={id} size="nano" tone={tone} className="text-[9.5px]">
      {children}
    </MonoLabel>
  );
}

function MoreLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="ml-auto inline-flex items-center gap-1.5 rounded-control text-[13px] text-muted hover:text-foreground"
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="size-3" />
    </Link>
  );
}

function RaceTile({ race, primary }: { race: TodayRace; primary: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-tag font-metric text-xs font-bold",
        primary
          ? "bg-accent text-accent-foreground"
          : "border-[1.5px] border-dim text-muted",
      )}
    >
      {race.letter}
    </span>
  );
}

export function TodayRaceLine({ header }: { header: TodayHeader }) {
  const { goal, next, week } = header;
  if (!goal && !week && !next) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
      {goal && (
        <>
          <Link
            href={`/races/${goal.id}`}
            className="inline-flex items-center gap-2 rounded-control text-foreground hover:text-accent"
          >
            <RaceTile race={goal} primary />
            {goal.name}
          </Link>
          <span className="font-metric text-base font-semibold text-foreground tabular-nums">
            {goal.days === 0 ? "Jour J" : `J-${goal.days}`}
          </span>
        </>
      )}
      {goal && week && <span aria-hidden="true">·</span>}
      {week && <span>{week}</span>}
      {next && (
        <Link
          href={`/races/${next.id}`}
          className="ml-auto inline-flex items-center gap-2 rounded-control hover:text-foreground max-sm:hidden"
        >
          <RaceTile race={next} primary={false} />
          {next.days === 0
            ? `${next.name} aujourd’hui`
            : `${next.name} dans ${next.days} j`}
        </Link>
      )}
    </div>
  );
}

export function SessionSection({
  session,
  date,
}: {
  session: TodaySession;
  date: string;
}) {
  return (
    <section
      aria-labelledby="today-session"
      className={cn(card, "gap-4.5 sm:px-6.5 sm:py-6")}
    >
      <div className="flex items-center gap-2.5">
        <Eyebrow id="today-session" tone="accent">
          Séance du jour
        </Eyebrow>
        <Eyebrow>· {date}</Eyebrow>
      </div>
      {session.kind === "session" ? (
        <PlannedSession session={session} />
      ) : session.kind === "rest" ? (
        <>
          <div className="flex items-start gap-3.5">
            <SessionKindTile kind="rest" size="xl" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-[34px]">
                Repos
              </h2>
              <p className="text-[15px] leading-normal text-muted">
                Pas de séance prévue aujourd’hui. Récupère, c’est aussi de
                l’entraînement.
              </p>
            </div>
          </div>
          {session.next && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="md">
                <Link href={session.next.href}>Prochaine séance</Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                {session.next.title} · {session.next.when}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.025em]">
              Aucun plan actif
            </h2>
            <p className="text-[15px] leading-normal text-muted">
              Ta séance du jour s’affichera ici dès qu’un plan d’entraînement
              sera actif.
            </p>
          </div>
          <div>
            <Button asChild variant="outline" size="md">
              <Link href="/plan">Voir le plan</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function PlannedSession({
  session,
}: {
  session: Extract<TodaySession, { kind: "session" }>;
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
      {session.stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {session.stats.map((stat) => (
            <div key={stat.key} className="flex min-w-0 flex-col gap-0.75">
              <dt className="order-2">
                <Eyebrow>{stat.label}</Eyebrow>
              </dt>
              <dd className="order-1 truncate font-metric text-[26px] leading-none font-semibold tabular-nums sm:text-[30px]">
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
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="md">
          <Link href={session.href}>Voir les étapes</Link>
        </Button>
        {session.terrain && (
          <span className="ml-auto text-xs text-muted-foreground">
            {session.terrain}
          </span>
        )}
      </div>
    </>
  );
}

const scoreTones = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export function ReadinessSection({
  readiness,
  legs,
}: {
  readiness: TodayReadiness;
  legs: Legs | null;
}) {
  return (
    <section aria-labelledby="today-readiness" className={card}>
      <div className="flex items-baseline gap-2.5">
        <Eyebrow id="today-readiness">Forme du jour</Eyebrow>
        <MoreLink href="/progress/recovery">Récupération</MoreLink>
      </div>
      {readiness.score !== null ? (
        <div className="flex items-end gap-3">
          <span
            className={cn(
              "font-metric text-[56px] leading-[0.8] font-semibold tabular-nums",
              scoreTones[readiness.tone],
            )}
          >
            {readiness.score}
          </span>
          <span className="flex flex-col gap-0.5 pb-0.5">
            <span className="text-[15px] font-medium">{readiness.level}</span>
            {readiness.context && (
              <span className="text-xs text-muted-foreground">
                {readiness.context}
              </span>
            )}
          </span>
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">
          Garmin n’a pas transmis de forme du jour pour aujourd’hui.
        </p>
      )}
      {readiness.rows.length > 0 && (
        <dl className="flex flex-col">
          {readiness.rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[76px_70px_minmax(0,1fr)] items-baseline gap-2.5 border-t border-border py-2"
            >
              <dt className="text-[13px] text-muted">{row.label}</dt>
              <dd className="font-metric text-[17px] font-semibold tabular-nums">
                {row.value}
              </dd>
              <dd className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {row.direction ? (
                  <DirectionMark direction={row.direction} tone={row.tone} />
                ) : row.tone === "success" ? (
                  <PulseDot tone="success" breathing={false} />
                ) : null}
                {row.note}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <LegsCheckin initial={legs} />
    </section>
  );
}

export function WeekSection({ week }: { week: TodayWeek }) {
  return (
    <section aria-labelledby="today-week" className={card}>
      <div className="flex items-baseline gap-2.5">
        <Eyebrow id="today-week">Cette semaine · S{week.number}</Eyebrow>
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
            <SessionKindTile kind={day.family} size="lg" className="size-7" />
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

export function LatestSection({ latest }: { latest: TodayLatest | null }) {
  return (
    <section aria-labelledby="today-latest" className={cn(card, "gap-2.5")}>
      <div className="flex items-baseline gap-2.5">
        <Eyebrow id="today-latest">
          {latest?.heading ?? "Dernière activité"}
        </Eyebrow>
        {latest && <MoreLink href={latest.href}>Activité</MoreLink>}
      </div>
      {latest ? (
        <div className="flex items-center gap-3">
          <SessionKindTile kind={latest.family} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">
              {latest.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {latest.detail}
            </span>
          </span>
          {latest.compliance && (
            <span
              className={cn(
                "flex items-center gap-1.5 font-metric font-semibold",
                latest.compliance.partial ? "text-warning" : "text-success",
              )}
            >
              <CheckIcon
                aria-hidden="true"
                className="size-3"
                strokeWidth={2.5}
              />
              <span className="text-xl tabular-nums">
                {latest.compliance.pct !== null
                  ? `${latest.compliance.pct} %`
                  : latest.compliance.partial
                    ? "En partie"
                    : "Fait"}
              </span>
              {latest.compliance.pct !== null && (
                <span className="sr-only">
                  {latest.compliance.partial
                    ? "de la séance, faite en partie"
                    : "de la séance prévue"}
                </span>
              )}
            </span>
          )}
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">
          Aucune activité importée depuis Garmin pour l’instant.
        </p>
      )}
    </section>
  );
}

export function UpcomingSection({ items }: { items: TodayUpcoming[] }) {
  return (
    <section aria-labelledby="today-upcoming" className={cn(card, "gap-1.5")}>
      <Eyebrow id="today-upcoming">À venir</Eyebrow>
      {items.length > 0 ? (
        <ul className="mt-1.5 flex flex-col">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-control border-t border-border py-2.5 hover:bg-surface-raised"
              >
                <SessionKindTile
                  kind={item.family}
                  size="lg"
                  className="size-7"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {item.title}
                  </span>
                  {item.detail && (
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                </span>
                <Eyebrow>{item.when}</Eyebrow>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta text-muted-foreground">
          Rien de prévu pour l’instant.
        </p>
      )}
    </section>
  );
}
