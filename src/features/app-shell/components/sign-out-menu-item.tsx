"use client";

import { useState, useTransition } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { clearOnboardingCaches } from "@/features/onboarding/components/use-autosave";
import { signOut } from "@/server/auth/actions";
import { AccountMenuSignOutIcon } from "./account-menu-icons";

export function SignOutMenuItem() {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        clearOnboardingCaches();
        startTransition(async () => {
          const result = await signOut();
          setFailed(result.error);
        });
      }}
    >
      <AccountMenuSignOutIcon />
      {failed ? "Déconnexion impossible. Réessaie." : "Se déconnecter"}
    </DropdownMenuItem>
  );
}
