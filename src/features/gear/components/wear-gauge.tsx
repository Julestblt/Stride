import { cn } from "@/lib/utils";
import type { Wear } from "../mileage";

export function WearGauge({
  wear,
  split = false,
  className,
}: {
  wear: Wear;
  split?: boolean;
  className?: string;
}) {
  const total = Math.min(wear.percent, 100);
  const starting = Math.min((wear.startingKm / wear.lifespanKm) * 100, total);
  const label = split
    ? `${Math.round(wear.totalKm)} km sur ${wear.lifespanKm} : ${Math.round(wear.startingKm)} km de départ et ${Math.round(wear.garminKm)} km comptés par Garmin`
    : `Usure ${wear.percent} %`;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative h-1.5 overflow-hidden rounded-full bg-border",
        className,
      )}
    >
      {split ? (
        <>
          <span
            className="absolute inset-y-0 left-0 bg-foreground"
            style={{ width: `${starting}%` }}
          />
          <span
            className="absolute inset-y-0 bg-provider"
            style={{ left: `${starting}%`, width: `${total - starting}%` }}
          />
        </>
      ) : (
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            wear.percent >= 80 ? "bg-warning" : "bg-foreground",
          )}
          style={{ width: `${total}%` }}
        />
      )}
    </div>
  );
}
