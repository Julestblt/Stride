"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth/actions";

export function SignOutButton() {
  const [state, action, pending] = useActionState(signOut, { error: false });

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" size="md" disabled={pending}>
        Se déconnecter
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          Déconnexion impossible. Réessaie.
        </p>
      )}
    </form>
  );
}
