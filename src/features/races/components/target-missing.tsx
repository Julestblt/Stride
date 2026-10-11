import { RaceSettingsDialog } from "./race-settings-dialog";
import { CardLabel, RaceCard } from "./race-ui";
import { Button } from "@/components/ui/button";
import type { RacePlan, RaceSummary } from "../race";

export function TargetMissing({
  race,
  plan,
}: {
  race: RaceSummary;
  plan: RacePlan;
}) {
  return (
    <RaceCard>
      <CardLabel>Simulation à compléter</CardLabel>
      <p className="max-w-150 text-sm leading-relaxed text-muted">
        Indique ton temps objectif pour calculer les heures de passage, les
        portions de nuit et le plan de nutrition.
      </p>
      <RaceSettingsDialog
        raceId={race.id}
        raceRevision={race.revision}
        targetSeconds={race.targetSeconds}
        kind={race.kind}
        plan={plan}
      >
        <Button className="self-start" size="sm">
          Définir mon objectif
        </Button>
      </RaceSettingsDialog>
    </RaceCard>
  );
}
