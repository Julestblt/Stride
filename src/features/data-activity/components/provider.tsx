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
import type { GarminSyncCategory } from "@/features/garmin/sync";

type ActivityContext = {
  observation: DataActivityObservation | null;
  state: ReturnType<typeof activityState>;
  fresh: GarminSyncCategory[];
  apply: () => void;
  markLoading: () => () => void;
  thread: boolean;
};
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
  const applied = useRef(initial ?? null);
  const latest = useRef(initial ?? null);
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const route = useRef(`${pathname}?${query}`);
  const state = activityState(observation, offline, unavailable);
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
        setFresh(freshCategories(applied.current, parsed.data));
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
              : activityState(latest.current, false, false) === "syncing"
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
  }, []);

  const active =
    !offline &&
    state !== "reconnect" &&
    (state === "syncing" || loads > 0 || applying);
  const visibleSince = useRef(0);
  useEffect(() => {
    if (offline || state === "reconnect") {
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
  }, [active, offline, state]);
  return (
    <Context.Provider
      value={{ observation, state, fresh, apply, markLoading, thread }}
    >
      {children}
    </Context.Provider>
  );
}
