import { PulseDot } from "@/components/stride/marks";
import type { GarminConnectionStatus } from "@/features/garmin/connection";
import { cn } from "@/lib/utils";
import {
  garminConnectionLabels,
  garminConnectionTone,
  type GarminTone,
} from "../model";

const toneText: Record<GarminTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  provider: "text-provider",
};

export function GarminConnectionLabel({
  status,
  connectedSuffix,
  breathing = false,
  className,
}: {
  status: GarminConnectionStatus | null;
  connectedSuffix?: string;
  breathing?: boolean;
  className?: string;
}) {
  const tone = garminConnectionTone(status);
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm",
        toneText[tone],
        className,
      )}
    >
      <PulseDot
        tone={tone}
        breathing={breathing && status === "connected"}
        className="size-1.75"
      />
      {status
        ? garminConnectionLabels[status]
        : "État de la connexion indisponible"}
      {status === "connected" && connectedSuffix && ` · ${connectedSuffix}`}
    </span>
  );
}
