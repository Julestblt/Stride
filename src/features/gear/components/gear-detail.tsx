import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { SourceMark } from "@/components/stride/marks";
import { formatFrenchDate } from "@/features/onboarding/dates";
import { cn } from "@/lib/utils";
import { categoryLabels, terrainLabels } from "../model";
import { replacementDate } from "../mileage";
import {
  formatDay,
  formatKm,
  modelName,
  pairCard,
  specRows,
  type ShoeInput,
} from "../view";
import { CurrentKmButton, RetireShoeButton } from "./gear-actions";
import { WearGauge } from "./wear-gauge";

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function Tile({
  source,
  label,
  value,
  detail,
}: {
  source: "manual" | "provider";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface-panel px-4 py-3.5">
      <MonoLabel size="nano" className="inline-flex items-center gap-1.5">
        <SourceMark source={source} />
        {label}
      </MonoLabel>
      <span className="font-metric text-[26px] leading-tight font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">
        {detail}
      </span>
    </div>
  );
}

export function GearDetail({
  shoe,
  today,
}: {
  shoe: ShoeInput;
  today: string;
}) {
  const card = pairCard(shoe, today);
  const { wear } = card;
  const replacement = replacementDate(wear, shoe.activities, today);
  const garmin = shoe.garmin;
  const retired = shoe.retiredOn !== null;
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            {[
              categoryLabels[shoe.spec.category],
              terrainLabels[shoe.spec.terrain],
            ].map((tag) => (
              <MonoLabel
                key={tag}
                size="nano"
                tone="secondary"
                className="rounded-tag border border-border-strong px-1.5 py-0.5"
              >
                {tag}
              </MonoLabel>
            ))}
            {retired && (
              <span className="text-xs text-muted-foreground">
                Retirée le {formatFrenchDate(shoe.retiredOn)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {shoe.spec.brand}
            </span>
            <h1 className="text-[clamp(32px,3.5vw,44px)] leading-none font-semibold tracking-[-0.03em]">
              {modelName(shoe.spec)}
            </h1>
          </div>
          <p className="text-meta text-muted-foreground">
            {garmin ? "Suivie par Garmin" : "Hors Garmin"} · première sortie le{" "}
            {formatFrenchDate(shoe.firstUseDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="md">
            <Link href={`/gear/${shoe.id}/edit`}>Modifier la fiche</Link>
          </Button>
          <RetireShoeButton id={shoe.id} retired={retired} />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-end gap-3.5">
            <span className="font-metric text-[72px] leading-[0.78] font-semibold tabular-nums sm:text-[88px]">
              {card.totalKm}
            </span>
            <span className="flex flex-col gap-0.5 pb-1">
              <span className="text-body">km sur {card.lifespanKm}</span>
              <span className="text-meta text-muted-foreground">
                {wear.percent} % de la durée de vie
              </span>
            </span>
          </div>
          <div className="flex flex-col items-start gap-0.5 sm:items-end sm:text-right">
            <span
              className={cn(
                "font-metric text-[28px] leading-none font-semibold tabular-nums",
                card.high && "text-warning",
              )}
            >
              {wear.worn
                ? "Durée de vie atteinte"
                : `${formatKm(wear.remainingKm)} km restants`}
            </span>
            <span className="text-meta text-muted">
              {replacement && !wear.worn
                ? `à remplacer vers le ${formatFrenchDate(replacement)} au rythme actuel`
                : "pas assez de sorties récentes pour estimer une date"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <WearGauge wear={wear} split className="h-2.5" />
          <div className="flex justify-between text-micro text-muted-foreground">
            <span>0</span>
            <span>{card.lifespanKm} km · alerte Garmin</span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <Tile
            source="manual"
            label="Km de départ · toi"
            value={`${formatKm(wear.startingKm)} km`}
            detail="avant que Garmin ne compte cette paire"
          />
          <Tile
            source="provider"
            label="Depuis · Garmin"
            value={`${formatKm(wear.garminKm)} km`}
            detail={
              garmin
                ? `${garmin.totalActivities} ${garmin.totalActivities > 1 ? "activités liées" : "activité liée"} à cette paire dans Garmin`
                : "paire absente de Garmin"
            }
          />
          {garmin && (
            <Tile
              source="provider"
              label="Alerte d’usure · Garmin"
              value={`${formatKm(Math.max(wear.lifespanKm - wear.startingKm, 1))} km`}
              detail={`limite réglée dans Garmin : ${card.lifespanKm} − ${formatKm(wear.startingKm)} km de départ. Garmin te prévient.`}
            />
          )}
        </div>
        <div>
          <CurrentKmButton
            id={shoe.id}
            currentKm={wear.totalKm}
            garminKm={wear.garminKm}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
          <h2 className="text-lead font-semibold">La paire</h2>
          {shoe.spec.description && (
            <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface-panel px-4 py-3.5">
              <MonoLabel
                size="nano"
                className="inline-flex items-center gap-1.5"
              >
                <SourceMark
                  source={
                    shoe.suggested.includes("description")
                      ? "estimate"
                      : "manual"
                  }
                />
                {shoe.suggested.includes("description")
                  ? "Suggestion Stride"
                  : "Toi"}
              </MonoLabel>
              <p className="text-[15px] leading-normal">
                {shoe.spec.description}
              </p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-5">
            {specRows(shoe.spec, shoe.suggested).map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 border-t border-border py-2.5"
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd
                  className={cn(
                    "text-[15px] font-medium",
                    row.value === null && "text-muted-foreground",
                  )}
                >
                  {row.value ?? "Non renseignée"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-lead font-semibold">Dernières activités</h2>
            <span className="text-xs text-muted-foreground">
              sur les 12 derniers mois
            </span>
          </div>
          {shoe.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune sortie liée à cette paire dans Garmin pour l’instant.
            </p>
          ) : (
            <ul>
              {shoe.activities.slice(0, 8).map((activity) => (
                <li
                  key={activity.activityId}
                  className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2.5 text-meta"
                >
                  <MonoLabel size="nano">{formatDay(activity.day)}</MonoLabel>
                  <span className="truncate">{activity.name ?? "Sortie"}</span>
                  <span className="font-metric text-base font-semibold tabular-nums">
                    {decimal.format(activity.distanceM / 1000)} km
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
