"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { releasePushSubscription } from "@/features/notifications/components/release-push";
import { clearOnboardingCaches } from "@/features/onboarding/components/use-autosave";
import { signOut } from "@/server/auth/actions";
import { AccountMenuSignOutIcon } from "./account-menu-icons";

export function SignOutMenuItem() {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenuItem
      className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        clearOnboardingCaches();
        startTransition(async () => {
          await releasePushSubscription();
          const result = await signOut();
          if (result.error)
            toast.error("Déconnexion impossible. Réessaie.", {
              id: "sign-out",
            });
        });
      }}
    >
      <AccountMenuSignOutIcon />
      Se déconnecter
    </DropdownMenuItem>
  );
}
