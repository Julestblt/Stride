"use client";
import { createContext, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initialSyncPollingState,
  nextSyncPollDelay,
  observeSync,
  syncObservationSchema,
  type SyncPollingState,
} from "@/features/onboarding/sync-polling";
import type { GarminPhase } from "@/features/onboarding/shell-status";

type OnboardingStatus = {
  garminPhase: GarminPhase | null;
  setGarminPhase: (phase: GarminPhase) => void;
  sync: SyncPollingState;
};

const OnboardingStatusContext = createContext<OnboardingStatus | null>(null);

export function OnboardingStatusProvider({
  polling,
  children,
  initialSync = initialSyncPollingState,
}: {
  polling: boolean;
  initialSync?: SyncPollingState;
  children: React.ReactNode;
}) {
  const [garminPhase, setGarminPhase] = useState<GarminPhase | null>(null);
  const sync = useSyncPolling(
    polling || garminPhase === "connected",
    initialSync,
  );
  return (
    <OnboardingStatusContext value={{ garminPhase, setGarminPhase, sync }}>
      {children}
    </OnboardingStatusContext>
  );
}

export function useOnboardingStatus() {
  const status = use(OnboardingStatusContext);
  if (!status)
    throw new Error("useOnboardingStatus requires OnboardingStatusProvider");
  return status;
}

export function useReportGarminPhase(phase: GarminPhase) {
  const { setGarminPhase } = useOnboardingStatus();
  useEffect(() => setGarminPhase(phase), [phase, setGarminPhase]);
}

function useSyncPolling(active: boolean, initialSync: SyncPollingState) {
  const router = useRouter();
  const [state, setState] = useState(initialSync);
  const latest = useRef(initialSync);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let current = latest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;
    async function poll() {
      if (disposed || inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      let observation = null;
      try {
        const response = await fetch("/api/onboarding/sync", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if (disposed) return;
        if (response.status === 401) {
          router.replace("/sign-in");
          return;
        }
        const parsed = syncObservationSchema.safeParse(
          response.ok ? await response.json() : null,
        );
        if (parsed.success) observation = parsed.data;
      } catch {
        if (disposed || controller.signal.aborted) return;
      } finally {
        inFlight = false;
      }
      if (disposed) return;
      current = observeSync(current, observation);
      latest.current = current;
      setState(current);
      const delay = nextSyncPollDelay(current);
      if (delay !== null) timer = setTimeout(poll, delay);
    }
    function resume() {
      clearTimeout(timer);
      if (
        !document.hidden &&
        (current.observation === null || nextSyncPollDelay(current) !== null)
      )
        void poll();
    }
    void poll();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [active, router]);
  return state;
}
