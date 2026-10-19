import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { cn } from "@/lib/utils";
import type {
  NutritionRowView,
  NutritionTodayView,
} from "@/features/nutrition/view";
import type { NutritionDayType } from "@/features/nutrition/calculator";

const dayTone: Record<NutritionDayType, string> = {
  rest: "bg-provider",
  easy: "bg-success",
  moderate: "bg-warning",
  long_or_hard: "bg-staff-nutritionist",
  pre_race: "bg-staff-nutritionist",
  race: "bg-accent",
};

function Dot({ type }: { type: NutritionDayType }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full", dayTone[type])}
    />
  );
}

function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-panel border border-border bg-surface-raised p-3.5 sm:gap-1.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
      <MonoLabel size="nano" className="sm:text-label">
        {label}
      </MonoLabel>
      <span className="flex items-baseline gap-1 sm:gap-1.5">
        <span className="font-metric text-[30px] leading-none font-semibold tabular-nums sm:text-[48px] sm:leading-[0.9]">
          {value}
        </span>
        <span className="text-xs text-muted-foreground sm:text-sm">{unit}</span>
      </span>
      <span className="text-xs leading-[1.4] text-muted sm:text-meta">
        {detail}
      </span>
    </div>
  );
}

function AskLea({ className }: { className?: string }) {
  return (
    <Button asChild className={className}>
      <Link href="/coach">
        <StaffPortrait agent="nutritionist" size={22} decorative />
        Demander à Léa
      </Link>
    </Button>
  );
}

export function NutritionPage({
  today,
  days,
}: {
  today: NutritionTodayView;
  days: NutritionRowView[];
}) {
  return (
    <div className="flex flex-col gap-6.5 sm:gap-12">
      <section className="flex max-w-205 flex-col gap-2.5 sm:gap-3">
        <MonoLabel>Nutrition · {today.dateLabel}</MonoLabel>
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          {today.headline}
        </h1>
        <p className="text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
          {today.summary}
        </p>
        <div className="flex flex-wrap gap-2.5 pt-1.5 max-sm:hidden">
          <AskLea />
          <Button asChild variant="outline">
            <Link href="/settings/profile">Vérifier mon profil</Link>
          </Button>
        </div>
      </section>

      <section
        aria-label="Objectifs du jour"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] sm:gap-8 sm:border-y sm:border-border sm:py-7"
      >
        <Stat
          label="Énergie"
          value={today.energy.value}
          unit="kcal"
          detail={today.energy.detail}
        />
        <Stat
          label="Glucides"
          value={today.carbs.value}
          unit="g"
          detail={today.carbs.detail}
        />
        <Stat
          label="Protéines"
          value={today.protein.value}
          unit="g"
          detail={today.protein.detail}
        />
        <Stat
          label="Lipides"
          value={today.fat.value}
          unit="g"
          detail={today.fat.detail}
        />
      </section>

      {today.fueling || today.recovery ? (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-x-10 gap-y-6.5">
          {today.fueling ? (
            <div className="flex flex-col gap-2 sm:gap-2.5">
              <h2 className="text-[17px] font-semibold sm:text-lg">
                Pendant la séance
              </h2>
              <p className="flex items-baseline gap-2.5">
                <span className="font-metric text-[44px] leading-none font-semibold tabular-nums">
                  {today.fueling.perHour}
                </span>
                <span className="text-meta text-muted-foreground">
                  g de glucides par heure
                </span>
              </p>
              <p className="text-sm leading-[1.55] text-muted">
                Soit {today.fueling.total} g sur {today.fueling.duration}.
                Profites-en pour tester ton ravitaillement de course.
              </p>
            </div>
          ) : null}
          {today.recovery ? (
            <div className="flex flex-col gap-2 sm:gap-2.5">
              <h2 className="text-[17px] font-semibold sm:text-lg">
                Récupération
              </h2>
              <p className="flex items-baseline gap-2.5">
                <span className="font-metric text-[44px] leading-none font-semibold tabular-nums">
                  {today.recovery.withinHours} h
                </span>
                <span className="text-meta text-muted-foreground">
                  après la séance
                </span>
              </p>
              <p className="text-sm leading-[1.55] text-muted">
                Une prise de {today.recovery.perIntake} g de protéines avec des
                glucides dans les {today.recovery.withinHours} heures qui
                suivent. Répartis le reste sur {today.recovery.intakes} prises
                dans la journée.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        aria-labelledby="nutrition-days"
        className="flex flex-col gap-3.5"
      >
        <h2
          id="nutrition-days"
          className="text-[17px] font-semibold sm:text-lg"
        >
          Les 7 prochains jours
        </h2>
        <ul className="sm:hidden">
          {days.map((day) => (
            <li
              key={day.date}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-border py-3"
            >
              <span className={cn("text-sm", day.today && "font-semibold")}>
                {day.dateLabel}
                {day.today ? " · aujourd’hui" : ""}
              </span>
              <span className="text-right font-metric text-lg font-semibold tabular-nums">
                {day.energy} kcal
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Dot type={day.dayType} />
                {day.dayTypeLabel}
              </span>
              <span className="text-right text-xs text-muted-foreground">
                Glucides {day.carbs}
              </span>
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto max-sm:hidden">
          <table className="w-full min-w-180 border-collapse text-sm">
            <thead>
              <tr>
                {[
                  "Jour",
                  "Séance prévue",
                  "Type de journée",
                  "Énergie · kcal",
                  "Glucides",
                  "Protéines",
                ].map((title, index) => (
                  <th
                    key={title}
                    scope="col"
                    className={cn(
                      "px-3 pb-2.5 font-mono text-label font-normal text-muted-foreground uppercase first:pl-0 last:pr-0",
                      index < 3 ? "text-left" : "text-right",
                    )}
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr
                  key={day.date}
                  aria-current={day.today ? "date" : undefined}
                  className={cn(
                    "border-t border-border",
                    day.today && "bg-surface-raised",
                  )}
                >
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {day.dateLabel}
                    {day.today ? (
                      <MonoLabel tone="accent" className="ml-2">
                        Aujourd’hui
                      </MonoLabel>
                    ) : null}
                  </td>
                  <td className="p-3 text-muted">{day.session}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-meta">
                      <Dot type={day.dayType} />
                      {day.dayTypeLabel}
                    </span>
                  </td>
                  <td className="p-3 text-right font-metric text-lg font-semibold tabular-nums">
                    {day.energy}
                  </td>
                  <td className="p-3 text-right font-metric text-lg font-semibold tabular-nums">
                    {day.carbs}
                  </td>
                  <td className="py-3 pl-3 text-right font-metric text-lg font-semibold tabular-nums">
                    {day.protein}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="nutrition-method"
        className="flex max-w-205 flex-col gap-3.5"
      >
        <h2
          id="nutrition-method"
          className="text-[17px] font-semibold sm:text-lg"
        >
          Comment on calcule
        </h2>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2.5 text-sm">
          {today.method.map((row) => (
            <div key={row.label} className="contents">
              <dt className="flex flex-wrap items-center gap-2 text-muted">
                {row.label}
                {row.estimated ? (
                  <MonoLabel
                    tone="warning"
                    className="rounded-[4px] border border-border-strong px-1.5"
                  >
                    Estimation
                  </MonoLabel>
                ) : null}
              </dt>
              <dd className="text-right font-metric text-lg font-semibold tabular-nums">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-meta leading-[1.55] text-muted-foreground">
          {today.neatEstimated
            ? "L’activité hors entraînement est une estimation par défaut tant que les calories quotidiennes Garmin ne sont pas disponibles. "
            : ""}
          Pas d’objectif de poids : un déficit léger se demande à Léa, jamais un
          jour long, en affûtage ou avec un signal de santé ouvert.
        </p>
      </section>

      <AskLea className="min-h-12 sm:hidden" />
    </div>
  );
}

export function NutritionMissing({ missing }: { missing: string[] }) {
  return (
    <div className="flex flex-col gap-6.5">
      <section className="flex max-w-140 flex-col gap-3 rounded-panel border border-border bg-surface-raised p-4.5">
        <MonoLabel tone="warning">Données manquantes</MonoLabel>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-[-0.02em]">
          Complète ton profil pour voir tes objectifs.
        </h1>
        <p className="text-sm leading-normal text-muted">
          Sans ces informations, Stride ne calcule aucun chiffre plutôt que de
          deviner.
        </p>
        {missing.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {missing.map((field) => (
              <li key={field} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning"
                />
                {field}
              </li>
            ))}
          </ul>
        ) : null}
        <Button asChild className="min-h-12">
          <Link href="/settings/profile">Compléter mon profil</Link>
        </Button>
      </section>
    </div>
  );
}
