import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import {
  gearLists,
  gearReadiness,
  gearSummary,
} from "@/features/races/checklists";
import { ChecklistBoard } from "@/features/races/components/checklist-board";
import { RaceCard } from "@/features/races/components/race-ui";
import { loadRace } from "@/server/races/load";

export default async function RaceGearPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await loadRace(id);
  const items = data.checklist.filter((item) =>
    gearLists.some((list) => list === item.list),
  );
  const readiness = gearReadiness(items);
  const summary = gearSummary(items);
  const missing = [...summary.missing, ...summary.testing, ...summary.checking];
  return (
    <>
      <RaceCard className="flex-row flex-wrap items-center gap-6">
        <div className="flex shrink-0 flex-col gap-1">
          <span className="font-metric text-[2.5rem] leading-none font-semibold tabular-nums">
            {readiness.ready}/{readiness.total}
          </span>
          <MonoLabel size="micro">Prêt</MonoLabel>
        </div>
        <div className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-relaxed text-muted sm:text-[15px]">
          <StrideMark className="mt-1 size-3.5 shrink-0" />
          <p>
            {missing.length > 0
              ? `${missing.length} élément${missing.length > 1 ? "s" : ""} à préparer : ${missing
                  .slice(0, 3)
                  .map((item) => item.label)
                  .join(", ")}${missing.length > 3 ? "…" : "."}`
              : readiness.total > 0
                ? "Ton équipement est prêt. Vérifie-le une dernière fois avant le départ."
                : "Ajoute ton équipement ou utilise une liste type pour préparer la course."}
          </p>
        </div>
        <Link
          href={`/races/${id}/preparation`}
          className="inline-flex min-h-9 items-center gap-2 rounded-control border border-border-strong px-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring"
        >
          Voir la préparation <ArrowRightIcon className="size-3.5" />
        </Link>
      </RaceCard>
      <ChecklistBoard raceId={id} lists={gearLists} items={items} />
    </>
  );
}
