"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  maxUnavailablePeriods,
  unavailabilityErrorMessages,
} from "@/features/settings/planning";

const successMessages: Record<string, string> = {
  deleted: "Course supprimée.",
  "period-added": "Période d’indisponibilité ajoutée.",
  "period-removed": "Période d’indisponibilité supprimée.",
};

const failureMessages: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(unavailabilityErrorMessages).map(([key, message]) => [
      `unavailability-${key}`,
      message,
    ]),
  ),
  "unavailability-limit": `Tu peux enregistrer ${maxUnavailablePeriods} périodes au plus. Supprime celles qui sont passées.`,
  conflict:
    "Ces informations ont changé. Vérifie les dernières valeurs et réessaie.",
  invalid: "Vérifie les valeurs saisies et réessaie.",
  "session-expired": "Ta session a expiré. Connecte-toi à nouveau.",
};

export function SettingsNotice({
  status,
  savedMessage = "Modifications enregistrées.",
}: {
  status?: string;
  savedMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!status) return;
    if (status === "saved") {
      toast.success(savedMessage, { id: "settings-notice" });
    } else if (successMessages[status]) {
      toast.success(successMessages[status], { id: "settings-notice" });
    } else {
      toast.error(
        failureMessages[status] ??
          "Impossible d’enregistrer les modifications. Réessaie.",
        { id: "settings-notice" },
      );
    }
    router.replace(pathname, { scroll: false });
  }, [status, savedMessage, pathname, router]);
  return null;
}
