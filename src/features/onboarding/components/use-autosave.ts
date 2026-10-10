"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginSave,
  createAutosave,
  editField,
  maxAutomaticRetries,
  resolveConflict,
  retryDelay,
  saveConflicted,
  saveFailed,
  saveSucceeded,
  type AutosaveState,
  type FieldValues,
  type SaveRequest,
  type Snapshot,
} from "@/features/onboarding/autosave";

export type AutosaveResult<V extends FieldValues> =
  | { status: "saved" | "conflict"; snapshot: Snapshot<V> }
  | { status: "invalid" | "error" | "offline" | "session-expired" };
type Cache<V> = { values: Partial<V>; at: number };

export const saveDelayMs = 800;

export function useAutosave<V extends FieldValues>({
  initial,
  save,
  cacheKey,
  cacheFields,
  serverUpdatedAt,
}: {
  initial: Snapshot<V>;
  save: (request: SaveRequest<V>) => Promise<AutosaveResult<V>>;
  cacheKey: string;
  cacheFields: (keyof V)[];
  serverUpdatedAt: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(() => createAutosave(initial));
  const current = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const running = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  const fieldsRef = useRef(cacheFields);
  const runRef = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    saveRef.current = save;
    fieldsRef.current = cacheFields;
  }, [cacheFields, save]);
  const update = useCallback(
    (change: (state: AutosaveState<V>) => AutosaveState<V>) => {
      current.current = change(current.current);
      setState(current.current);
      writeCache(cacheKey, fieldsRef.current, current.current);
    },
    [cacheKey],
  );
  const run = useCallback((): Promise<void> => {
    if (running.current) return running.current;
    const [next, request] = beginSave(current.current);
    if (!request) return Promise.resolve();
    update(() => next);
    running.current = (async () => {
      let result: AutosaveResult<V>;
      try {
        result = await saveRef.current(request);
      } catch {
        result = { status: navigator.onLine ? "error" : "offline" };
      }
      running.current = null;
      if (result.status === "session-expired") {
        router.replace("/sign-in");
        return;
      }
      if (result.status === "saved")
        update((state) => saveSucceeded(state, request.seq, result.snapshot));
      else if (result.status === "conflict")
        update((state) => saveConflicted(state, request.seq, result.snapshot));
      else
        update((state) =>
          saveFailed(
            state,
            request.seq,
            result.status === "offline" ? "offline" : "error",
          ),
        );
      const after = current.current;
      clearTimeout(timer.current);
      if (after.status === "error" && result.status !== "invalid") {
        if (after.failures <= maxAutomaticRetries)
          timer.current = setTimeout(
            () => void runRef.current(),
            retryDelay(after.failures),
          );
      } else if (after.status === "unsaved")
        timer.current = setTimeout(() => void runRef.current(), 0);
    })();
    return running.current;
  }, [router, update]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const change = useCallback(
    <K extends keyof V>(
      field: K,
      value: V[K],
      timing: "debounce" | "now" = "debounce",
    ) => {
      update((state) => editField(state, field, value));
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () => void run(),
        timing === "now" ? 0 : saveDelayMs,
      );
    },
    [run, update],
  );
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (running.current) await running.current;
      const state = current.current;
      if (state.conflicts.length > 0) return false;
      if (state.dirty.length === 0) return true;
      if (
        attempt > 0 &&
        (state.status === "error" || state.status === "offline")
      )
        return false;
      await run();
    }
    return current.current.dirty.length === 0;
  }, [run]);
  const resolve = useCallback(
    (field: keyof V, choice: "mine" | "theirs") => {
      update((state) => resolveConflict(state, field, choice));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), 0);
    },
    [run, update],
  );
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const cache = readCache<V>(cacheKey);
    if (!cache || cache.at <= Date.parse(serverUpdatedAt ?? "1970-01-01"))
      return;
    for (const [field, value] of Object.entries(cache.values))
      if (fieldsRef.current.includes(field as keyof V))
        update((state) =>
          editField(state, field as keyof V, value as V[keyof V]),
        );
    timer.current = setTimeout(() => void run(), 0);
  }, [cacheKey, run, serverUpdatedAt, update]);
  useEffect(() => {
    const online = () => void run();
    const leave = (event: BeforeUnloadEvent) => {
      if (current.current.dirty.length > 0 || current.current.inflight)
        event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leave);
    };
  }, [run]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { state, change, flush, resolve, retry: run };
}

function readCache<V>(key: string): Cache<V> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "values" in parsed &&
      "at" in parsed &&
      typeof parsed.at === "number" &&
      typeof parsed.values === "object" &&
      parsed.values !== null
    )
      return { values: parsed.values as Partial<V>, at: parsed.at };
  } catch {}
  return null;
}

function writeCache<V extends FieldValues>(
  key: string,
  fields: (keyof V)[],
  state: AutosaveState<V>,
) {
  try {
    const pending = state.dirty.filter((field) => fields.includes(field));
    if (pending.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        values: Object.fromEntries(
          pending.map((field) => [field, state.local[field]]),
        ),
        at: Date.now(),
      }),
    );
  } catch {}
}

export function clearOnboardingCaches() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("stride:onboarding:")) localStorage.removeItem(key);
  } catch {}
}
