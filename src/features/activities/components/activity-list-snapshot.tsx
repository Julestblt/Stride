"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Activity, ActivityFilter } from "../activities";

export type ActivityListQuery = {
  filter: ActivityFilter;
  limit: number;
  search: string;
};

export type ActivityListSnapshot = ActivityListQuery & {
  activities: Activity[];
  total: number;
  today: string;
};

const ActivityListSnapshotContext = createContext<{
  snapshot: ActivityListSnapshot | null;
  register: (snapshot: ActivityListSnapshot) => void;
} | null>(null);

export function ActivityListSnapshotProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ActivityListSnapshot | null>(null);
  const register = useCallback((loaded: ActivityListSnapshot) => {
    setSnapshot(loaded);
  }, []);
  const value = useMemo(() => ({ snapshot, register }), [snapshot, register]);

  return (
    <ActivityListSnapshotContext.Provider value={value}>
      {children}
    </ActivityListSnapshotContext.Provider>
  );
}

export function useRegisterActivityListSnapshot() {
  return useContext(ActivityListSnapshotContext)?.register;
}

export function useActivityListSnapshot(query: ActivityListQuery) {
  const snapshot = useContext(ActivityListSnapshotContext)?.snapshot;
  return snapshot?.filter === query.filter &&
    snapshot.limit === query.limit &&
    snapshot.search === query.search
    ? snapshot
    : null;
}
