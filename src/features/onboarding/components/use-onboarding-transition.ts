"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OnboardingActionResult } from "@/features/onboarding/schemas";

export function useOnboardingTransition() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  function run(action: () => Promise<OnboardingActionResult>, failure: string) {
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "success")
          startTransition(() => {
            router.push(result.href);
            router.refresh();
          });
        else if (result.code === "session-expired") router.replace("/sign-in");
        else {
          setFailed(true);
          toast.error(result.message, { id: "onboarding-transition" });
          if (result.code === "conflict") router.refresh();
        }
      } catch {
        setFailed(true);
        toast.error(failure, { id: "onboarding-transition" });
      }
    });
  }
  return { pending, failed, run };
}
