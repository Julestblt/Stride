"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const failureMessages: Record<string, string> = {
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
      toast.success(savedMessage, { id: "settings-notice", duration: 5000 });
    } else if (status === "deleted") {
      toast.success("Course supprimée.", {
        id: "settings-notice",
        duration: 5000,
      });
    } else {
      toast.error(
        failureMessages[status] ??
          "Impossible d’enregistrer les modifications. Réessaie.",
        { id: "settings-notice", duration: 8000 },
      );
    }
    router.replace(pathname, { scroll: false });
  }, [status, savedMessage, pathname, router]);
  return null;
}
