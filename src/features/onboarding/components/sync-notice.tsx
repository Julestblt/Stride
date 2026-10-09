"use client";
import Link from "next/link";
import { SyncStatus } from "@/components/stride/sync-status";
import {
  connectionNotice,
  type OnboardingConnection,
} from "@/features/onboarding/progress";
import { useOnboardingStatus } from "./onboarding-status";
export function SyncNotice({
  connection,
}: {
  connection: OnboardingConnection;
}) {
  const { sync } = useOnboardingStatus();
  const notice = connectionNotice(connection);
  if (notice === "reconnect") {
    const status = connection.ok
      ? connection.value.status
      : "reconnect_required";
    if (status === "connecting")
      return (
        <SyncStatus state="importing">
          La connexion Garmin est en cours.
        </SyncStatus>
      );
    const firstConnection = status === "disconnected";
    const verification = status === "mfa_required";
    return (
      <SyncStatus
        state="expired"
        action={
          <Link href="/onboarding/garmin" className="text-accent underline">
            {firstConnection
              ? "Connecter"
              : verification
                ? "Vérifier"
                : "Reconnecter"}
          </Link>
        }
      >
        {firstConnection
          ? "Connecte Garmin pour terminer ton parcours."
          : verification
            ? "Une vérification Garmin est nécessaire."
            : "Garmin doit être reconnecté avant de terminer ton parcours."}
      </SyncStatus>
    );
  }
  if (notice === "unavailable" || sync.unavailable)
    return (
      <SyncStatus state="retrying">
        Garmin est indisponible. Les dernières données affichées peuvent être
        anciennes.
      </SyncStatus>
    );
  return null;
}
