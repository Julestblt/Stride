import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StrideMark } from "@/components/stride/stride-mark";

export function PlanEmpty() {
  return (
    <section className="flex max-w-200 flex-col gap-5">
      <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
        Pas encore de programme
      </h1>
      <div className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <StrideMark className="mt-1 size-3.5 shrink-0" />
        <p className="text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
          Demande au Coach de construire ton plan. Il part de tes objectifs, de
          tes disponibilités et de ton historique, puis te le propose avant de
          l’enregistrer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/settings/goals">Vérifier mes objectifs</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/training">Mes disponibilités</Link>
        </Button>
      </div>
    </section>
  );
}
