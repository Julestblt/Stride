import type { PlanSession } from "../model/plan";
import { isUntrackedSession } from "../model/volume";
import { sessionFamily } from "./matching";

export const matchStatuses = [
  "completed",
  "partial",
  "substituted",
  "dismissed",
] as const;
export type MatchStatus = (typeof matchStatuses)[number];

export type SessionMatchRecord = { sessionKey: string; status: MatchStatus };

export type AdherenceWindow = { from: string; to: string };

export type AdherenceCounts = {
  due: number;
  done: number;
  substituted: number;
  missed: number;
  keyDue: number;
  keyDone: number;
};

export type Adherence = AdherenceCounts & {
  share: number | null;
  keyShare: number | null;
  windows: (number | null)[];
};

const statusRank: Record<MatchStatus, number> = {
  dismissed: 3,
  completed: 2,
  partial: 1,
  substituted: 0,
};

export function sessionStatuses(matches: SessionMatchRecord[]) {
  const statuses = new Map<string, MatchStatus>();
  for (const match of matches) {
    const current = statuses.get(match.sessionKey);
    if (!current || statusRank[match.status] > statusRank[current])
      statuses.set(match.sessionKey, match.status);
  }
  return statuses;
}

function share(done: number, due: number) {
  return due > 0 ? done / due : null;
}

function count(
  sessions: PlanSession[],
  statuses: Map<string, MatchStatus>,
  from: string,
  to: string,
  today: string,
): AdherenceCounts {
  const counts: AdherenceCounts = {
    due: 0,
    done: 0,
    substituted: 0,
    missed: 0,
    keyDue: 0,
    keyDone: 0,
  };
  for (const session of sessions) {
    if (sessionFamily(session) === null) continue;
    if (session.scheduledOn < from || session.scheduledOn > to) continue;
    const status = statuses.get(session.sessionKey);
    if (isUntrackedSession(session) && !status) continue;
    if (session.scheduledOn > today) continue;
    if (session.scheduledOn === today && !status) continue;
    const done = status === "completed" || status === "partial";
    counts.due += 1;
    if (done) counts.done += 1;
    else if (status === "substituted") counts.substituted += 1;
    else counts.missed += 1;
    if (session.isKey) {
      counts.keyDue += 1;
      if (done) counts.keyDone += 1;
    }
  }
  return counts;
}

export function planAdherence({
  sessions,
  matches,
  start,
  today,
  windows,
}: {
  sessions: PlanSession[];
  matches: SessionMatchRecord[];
  start: string;
  today: string;
  windows: AdherenceWindow[];
}): Adherence {
  const statuses = sessionStatuses(matches);
  const counts = count(sessions, statuses, start, today, today);
  return {
    ...counts,
    share: share(counts.done, counts.due),
    keyShare: share(counts.keyDone, counts.keyDue),
    windows: windows.map(({ from, to }) => {
      const window = count(sessions, statuses, from, to, today);
      return share(window.done, window.due);
    }),
  };
}
