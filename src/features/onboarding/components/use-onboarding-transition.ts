"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingActionResult } from "@/features/onboarding/schemas";

export function useOnboardingTransition() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function run(action: () => Promise<OnboardingActionResult>, failure: string) {
    setMessage(null);
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
          setMessage(result.message);
          if (result.code === "conflict") router.refresh();
        }
      } catch {
        setMessage(failure);
      }
    });
  }
  return { pending, message, run };
}
