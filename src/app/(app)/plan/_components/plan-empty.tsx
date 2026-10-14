import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DeterministicPlan } from "@/features/plans/detailing/build";
import { formatFrenchDate } from "@/features/onboarding/dates";

export function PlanEmpty({
  plan,
}: {
  plan: Exclude<DeterministicPlan, { status: "ready" }>;
}) {
  const { feasibility, objective } = plan;
  const title =
    plan.status === "too_short"
      ? `Pas assez de semaines avant ${objective.race?.name ?? "ta course"}`
      : "Pas encore assez de données pour construire ton plan";
  return (
    <section className="flex max-w-200 flex-col gap-5">
      <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
        {title}
      </h1>
      {feasibility.reasons.map((reason) => (
        <p
          key={reason}
          className="text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]"
        >
          {reason}
        </p>
      ))}
      {feasibility.options.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-title font-semibold">Ce que tu peux faire</h2>
          <ul className="flex flex-col border-t border-border">
            {feasibility.options.map((option) => (
              <li
                key={option.kind}
                className="border-b border-border py-3 text-sm"
              >
                {option.kind === "shorter_format"
                  ? `Viser un format plus court : ${option.label}.`
                  : option.kind === "later_race"
                    ? `Choisir une course à partir du ${formatFrenchDate(option.earliestDate)}.`
                    : "Construire d’abord une base sans échéance, puis revenir à ta course."}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/settings/goals">Modifier mes objectifs</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/training">Mes disponibilités</Link>
        </Button>
      </div>
    </section>
  );
}
