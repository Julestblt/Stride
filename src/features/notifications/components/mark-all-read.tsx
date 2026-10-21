"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/server/notifications/actions";
import { cn } from "@/lib/utils";

export function MarkAllRead({
  label = "Tout marquer comme lu",
  variant = "ghost",
  size = "sm",
  className,
}: {
  label?: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-busy={pending || undefined}
      disabled={pending}
      className={cn("text-[12.5px]", className)}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsRead().catch(() => null);
          if (result?.status === "saved") {
            toast.success("Notifications marquées comme lues.", {
              id: "notifications-read",
            });
            router.refresh();
          } else
            toast.error(
              result?.status === "session-expired"
                ? "Ta session a expiré. Reconnecte-toi puis réessaie."
                : "Impossible de marquer les notifications comme lues.",
              { id: "notifications-read" },
            );
        })
      }
    >
      {label}
    </Button>
  );
}
