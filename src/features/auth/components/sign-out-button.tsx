"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearOnboardingCaches } from "@/features/onboarding/components/use-autosave";
import { signOut } from "@/server/auth/actions";

async function signOutWithFeedback() {
  const result = await signOut();
  if (result.error)
    toast.error("Déconnexion impossible. Réessaie.", { id: "sign-out" });
  return result;
}

export function SignOutButton() {
  const [, action, pending] = useActionState(signOutWithFeedback, {
    error: false,
  });

  return (
    <form
      action={action}
      onSubmit={clearOnboardingCaches}
      className="flex flex-col items-start gap-2"
    >
      <Button type="submit" variant="outline" size="md" disabled={pending}>
        Se déconnecter
      </Button>
    </form>
  );
}
