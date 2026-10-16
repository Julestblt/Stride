"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  activityState,
  dataActivitySchema,
  freshCategories,
  threadDelay,
  type DataActivityObservation,
} from "../model";
import {
  manualSyncAvailableAt,
  requestedSyncProgress,
  type GarminSyncCategory,
  type GarminSyncStatus,
  type RequestedSyncProgress,
} from "@/features/garmin/sync";
import { requestGarminSync } from "@/server/garmin/actions";

export type SyncRequestFailure =
  "reconnect" | "unavailable" | "session-expired";

export type SyncRequestControl = {
  pending: boolean;
  progress: RequestedSyncProgress | null;
  availableAt: number | null;
  failure: SyncRequestFailure | null;
  request: () => void;
};

type ActivityContext = {
  observation: DataActivityObservation | null;
  state: ReturnType<typeof activityState>;
  fresh: GarminSyncCategory[];
  apply: () => void;
  markLoading: () => () => void;
  thread: boolean;
  sync: SyncRequestControl;
};

type RequestedSync = { baseline: GarminSyncStatus; startedAt: number };

const requestedSyncTimeoutMs = 180_000;
const Context = createContext<ActivityContext | null>(null);
export function useDataActivity() {
  return useContext(Context);
}

export function DataActivityProvider({
  initial,
  children,
}: {
  initial?: DataActivityObservation | null;
  children: React.ReactNode;
}) {
  const [observation, setObservation] = useState(initial ?? null);
  const [unavailable, setUnavailable] = useState(!initial);
  const [offline, setOffline] = useState(false);
  const [fresh, setFresh] = useState<GarminSyncCategory[]>([]);
  const [loads, setLoads] = useState(0);
  const [thread, setThread] = useState(false);
  const [applying, startTransition] = useTransition();
  const [requested, setRequested] = useState<RequestedSync | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<SyncRequestFailure | null>(null);
  const [throttledUntil, setThrottledUntil] = useState<number | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const requestedRef = useRef<RequestedSync | null>(null);
  const pollNow = useRef<() => void>(() => {});
  const applied = useRef(initial ?? null);
  const latest = useRef(initial ?? null);
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const route = useRef(`${pathname}?${query}`);
  const progress =
    requested && observation
      ? requestedSyncProgress(requested.baseline, observation.sync)
      : null;
  const baseState = activityState(observation, offline, unavailable);
  const state =
    progress && ["complete", "attention", "waiting"].includes(baseState)
      ? "syncing"
      : baseState;
  const availableAt =
    clock === null
      ? null
      : (() => {
          const times = [
            throttledUntil,
            manualSyncAvailableAt(observation?.sync, clock),
          ].filter((time): time is number => time !== null && time > clock);
          return times.length ? Math.max(...times) : null;
        })();
  const markLoading = useCallback(() => {
    setLoads((count) => count + 1);
    return () => setLoads((count) => Math.max(0, count - 1));
  }, []);
  const apply = () => {
    if (offline) return;
    applied.current = latest.current;
    setFresh([]);
    startTransition(() => router.refresh());
  };

  useEffect(() => {
    const timer = setTimeout(
      () => setClock(Date.now()),
      availableAt === null ? 0 : Math.max(0, availableAt - Date.now()) + 250,
    );
    return () => clearTimeout(timer);
  }, [availableAt]);

  const request = () => {
    if (pending || requestedRef.current || offline) return;
    setPending(true);
    setFailure(null);
    void requestGarminSync()
      .catch(() => ({ status: "unavailable" as const }))
      .then((result) => {
        setPending(false);
        if (result.status === "requested") {
          const next = { baseline: result.sync, startedAt: Date.now() };
          if (requestedSyncProgress(next.baseline, next.baseline).settled)
            return;
          requestedRef.current = next;
          setRequested(next);
          pollNow.current();
        } else if (result.status === "throttled") {
          setThrottledUntil(Date.parse(result.availableAt));
          setClock(Date.now());
        } else setFailure(result.status);
      });
  };

  useEffect(() => {
    const nextRoute = `${pathname}?${query}`;
    if (nextRoute === route.current) return;
    route.current = nextRoute;
    applied.current = latest.current;
    queueMicrotask(() => setFresh([]));
  }, [pathname, query]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    let failures = 0;
    let running = false;
    const poll = async () => {
      if (disposed || running || !navigator.onLine || document.hidden) return;
      running = true;
      request = new AbortController();
      try {
        const response = await fetch("/api/data-activity", {
          cache: "no-store",
          signal: AbortSignal.any([
            request.signal,
            AbortSignal.timeout(12_000),
          ]),
        });
        if (!response.ok) throw new Error("unavailable");
        const parsed = dataActivitySchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("malformed");
        if (disposed) return;
        failures = 0;
        if (!applied.current) applied.current = parsed.data;
        latest.current = parsed.data;
        setObservation(parsed.data);
        setUnavailable(false);
        const pendingSync = requestedRef.current;
        if (
          pendingSync &&
          (requestedSyncProgress(pendingSync.baseline, parsed.data.sync)
            .settled ||
            Date.now() - pendingSync.startedAt > requestedSyncTimeoutMs)
        ) {
          requestedRef.current = null;
          setRequested(null);
          applied.current = parsed.data;
          setFresh([]);
          startTransition(() => router.refresh());
        } else setFresh(freshCategories(applied.current, parsed.data));
      } catch {
        if (!disposed && !request.signal.aborted) {
          failures += 1;
          setUnavailable(true);
        }
      } finally {
        running = false;
        if (!disposed && failures < 4 && navigator.onLine && !document.hidden)
          timer = setTimeout(
            poll,
            failures
              ? Math.min(30_000, 2_000 * 2 ** failures)
              : requestedRef.current ||
                  activityState(latest.current, false, false) === "syncing"
                ? 2_000
                : 30_000,
          );
      }
    };
    const resume = () => {
      setOffline(!navigator.onLine);
      if (timer) clearTimeout(timer);
      if (!navigator.onLine || document.hidden) {
        request?.abort();
        return;
      }
      failures = 0;
      void poll();
    };
    pollNow.current = resume;
    queueMicrotask(resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      request?.abort();
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [router]);

  const active =
    !offline && (state === "syncing" || loads > 0 || applying || pending);
  const visibleSince = useRef(0);
  useEffect(() => {
    if (offline) {
      const timer = setTimeout(() => {
        setThread(false);
        visibleSince.current = 0;
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => {
        if (active) {
          if (!visibleSince.current) visibleSince.current = Date.now();
          setThread(true);
        } else {
          visibleSince.current = 0;
          setThread(false);
        }
      },
      threadDelay(active, visibleSince.current, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [active, offline]);
  return (
    <Context.Provider
      value={{
        observation,
        state,
        fresh,
        apply,
        markLoading,
        thread,
        sync: { pending, progress, availableAt, failure, request },
      }}
    >
      {children}
    </Context.Provider>
  );
}
