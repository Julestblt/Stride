import { addDays, mondayOf } from "../model/dates";
import { sessionKey as nextSessionKey } from "../model/keys";
import {
  sessionSchema,
  type Plan,
  type RaceRole,
  type PlanBlock,
  type PlanSession,
  type PlanState,
  type PlanWeek,
} from "../model/plan";
import type { PlacedSession, PlanOperation } from "./operations";

export type ApplyContext = {
  today: string;
  matchedSessionKeys: ReadonlySet<string>;
};

export type OperationErrorCode =
  | "unknown_key"
  | "frozen_session"
  | "past_date"
  | "outside_plan"
  | "overlapping_targets"
  | "invalid_structure"
  | "invalid_operation"
  | "plan_exists"
  | "missing_plan";

export type OperationError = {
  code: OperationErrorCode;
  operationIndex: number;
  key?: string;
};

export type EntityChanges<T> = { closed: string[]; added: T[] };

export type PlanChangeset = {
  plan: Plan | null;
  blocks: EntityChanges<PlanBlock>;
  weeks: EntityChanges<PlanWeek>;
  sessions: EntityChanges<PlanSession>;
};

export type ApplyResult =
  | { ok: true; state: PlanState; changeset: PlanChangeset }
  | { ok: false; errors: OperationError[] };

export function isFrozenSession(
  session: Pick<PlanSession, "sessionKey" | "scheduledOn">,
  context: ApplyContext,
) {
  return (
    session.scheduledOn < context.today ||
    context.matchedSessionKeys.has(session.sessionKey)
  );
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (name) =>
          `${JSON.stringify(name)}:${stable((value as Record<string, unknown>)[name])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

function diff<T>(
  before: readonly T[],
  after: readonly T[],
  keyOf: (item: T) => string,
): EntityChanges<T> {
  const previous = new Map(before.map((item) => [keyOf(item), stable(item)]));
  const next = new Set(after.map(keyOf));
  const closed = before
    .map(keyOf)
    .filter(
      (name) =>
        !next.has(name) ||
        stable(after.find((item) => keyOf(item) === name)) !==
          previous.get(name),
    );
  const added = after.filter((item) => {
    const old = previous.get(keyOf(item));
    return old === undefined || old !== stable(item);
  });
  return { closed, added };
}

function bySchedule(first: PlanSession, second: PlanSession) {
  return (
    first.scheduledOn.localeCompare(second.scheduledOn) ||
    first.sessionKey.localeCompare(second.sessionKey)
  );
}

export function computeChangeset(
  before: PlanState | null,
  after: PlanState,
): PlanChangeset {
  return {
    plan:
      before && stable(before.plan) === stable(after.plan) ? null : after.plan,
    blocks: diff(before?.blocks ?? [], after.blocks, (block) => block.blockKey),
    weeks: diff(before?.weeks ?? [], after.weeks, (week) => week.weekKey),
    sessions: diff(
      before?.sessions ?? [],
      after.sessions,
      (session) => session.sessionKey,
    ),
  };
}

function withRaceRole(plan: Plan, raceId: string, role: RaceRole | null) {
  const previousPrimary =
    role === "primary" && plan.primaryRaceId && plan.primaryRaceId !== raceId
      ? plan.primaryRaceId
      : null;
  const roles = plan.raceRoles
    .filter((entry) => entry.raceId !== raceId)
    .map((entry) =>
      entry.raceId === previousPrimary
        ? { ...entry, role: "preparation" as const }
        : entry,
    );
  if (
    previousPrimary &&
    !roles.some((entry) => entry.raceId === previousPrimary)
  )
    roles.push({ raceId: previousPrimary, role: "preparation" });
  return {
    ...plan,
    primaryRaceId:
      role === "primary"
        ? raceId
        : plan.primaryRaceId === raceId
          ? null
          : plan.primaryRaceId,
    raceRoles: role ? [...roles, { raceId, role }] : roles,
  };
}

function mondaysBetween(first: string, last: string) {
  const mondays: string[] = [];
  for (let monday = first; monday <= last; monday = addDays(monday, 7))
    mondays.push(monday);
  return mondays;
}

function targetKeys(operation: PlanOperation, state: PlanState | null) {
  switch (operation.op) {
    case "move_session":
    case "shorten_session":
    case "replace_session":
    case "skip_session":
      return [`session:${operation.sessionKey}`];
    case "swap_sessions":
      return [
        `session:${operation.firstKey}`,
        `session:${operation.secondKey}`,
      ];
    case "set_week_targets":
      return [`week:${operation.weekKey}`];
    case "replace_range":
      return (state?.sessions ?? [])
        .filter(
          (session) =>
            session.scheduledOn >= operation.from &&
            session.scheduledOn <= operation.to,
        )
        .map((session) => `session:${session.sessionKey}`);
    case "rewrite_range":
      return [
        ...(state?.weeks ?? [])
          .filter(
            (week) =>
              week.weekStart >= operation.from &&
              week.weekStart <= operation.to,
          )
          .map((week) => `week:${week.weekKey}`),
        ...(state?.sessions ?? [])
          .filter(
            (session) =>
              session.scheduledOn >= operation.from &&
              session.scheduledOn <= operation.to,
          )
          .map((session) => `session:${session.sessionKey}`),
      ];
    case "set_race_role":
      return [`race:${operation.raceId}`];
    case "extend_plan":
      return ["plan:end", `race:${operation.raceId}`];
    default:
      return [];
  }
}

function overlapErrors(
  operations: readonly PlanOperation[],
  state: PlanState | null,
) {
  const seen = new Set<string>();
  const errors: OperationError[] = [];
  operations.forEach((operation, operationIndex) => {
    for (const target of new Set(targetKeys(operation, state))) {
      if (seen.has(target))
        errors.push({
          code: "overlapping_targets",
          operationIndex,
          key: target.slice(target.indexOf(":") + 1),
        });
      seen.add(target);
    }
  });
  return errors;
}

export function applyOperations(
  state: PlanState | null,
  operations: readonly PlanOperation[],
  context: ApplyContext,
): ApplyResult {
  const creation = operations.findIndex(
    (operation) => operation.op === "create_plan",
  );
  if (creation !== -1) {
    const operation = operations[creation];
    if (state)
      return {
        ok: false,
        errors: [{ code: "plan_exists", operationIndex: creation }],
      };
    if (operations.length > 1 || operation.op !== "create_plan")
      return {
        ok: false,
        errors: [{ code: "invalid_operation", operationIndex: creation }],
      };
    const created = {
      ...operation.state,
      sessions: [...operation.state.sessions].sort(bySchedule),
    };
    return {
      ok: true,
      state: created,
      changeset: computeChangeset(null, created),
    };
  }
  if (!state)
    return {
      ok: false,
      errors: [{ code: "missing_plan", operationIndex: 0 }],
    };

  const overlaps = overlapErrors(operations, state);
  if (overlaps.length > 0) return { ok: false, errors: overlaps };

  let plan = state.plan;
  const blocks = new Map(state.blocks.map((block) => [block.blockKey, block]));
  const sessions = new Map(
    state.sessions.map((session) => [session.sessionKey, session]),
  );
  const weeks = new Map(state.weeks.map((week) => [week.weekKey, week]));
  const errors: OperationError[] = [];

  operations.forEach((operation, operationIndex) => {
    const fail = (code: OperationErrorCode, key?: string) => {
      errors.push(
        key ? { code, operationIndex, key } : { code, operationIndex },
      );
      return null;
    };
    const mutable = (key: string) => {
      const session = sessions.get(key);
      if (!session) return fail("unknown_key", key);
      if (isFrozenSession(session, context)) return fail("frozen_session", key);
      return session;
    };
    const dateAllowed = (date: string, key?: string) => {
      const code =
        date < context.today
          ? "past_date"
          : date < plan.startsOn || date > plan.endsOn
            ? "outside_plan"
            : null;
      if (code) fail(code, key);
      return code === null;
    };
    const store = (candidate: PlanSession) => {
      const parsed = sessionSchema.safeParse(candidate);
      if (!parsed.success)
        return fail("invalid_structure", candidate.sessionKey);
      sessions.set(parsed.data.sessionKey, parsed.data);
      return parsed.data;
    };
    const place = (placed: PlacedSession) => {
      if (!dateAllowed(placed.scheduledOn)) return;
      store({
        ...placed.content,
        sessionKey: nextSessionKey(placed.scheduledOn, sessions.keys()),
        scheduledOn: placed.scheduledOn,
      });
    };

    switch (operation.op) {
      case "move_session": {
        const session = mutable(operation.sessionKey);
        if (session && dateAllowed(operation.toDate, session.sessionKey))
          sessions.set(session.sessionKey, {
            ...session,
            scheduledOn: operation.toDate,
          });
        return;
      }
      case "swap_sessions": {
        const first = mutable(operation.firstKey);
        const second = mutable(operation.secondKey);
        if (!first || !second) return;
        sessions.set(first.sessionKey, {
          ...first,
          scheduledOn: second.scheduledOn,
        });
        sessions.set(second.sessionKey, {
          ...second,
          scheduledOn: first.scheduledOn,
        });
        return;
      }
      case "shorten_session": {
        const session = mutable(operation.sessionKey);
        if (!session) return;
        if (operation.durationSeconds >= session.targets.durationSeconds)
          return fail("invalid_operation", session.sessionKey);
        store({
          ...session,
          targets: {
            ...session.targets,
            durationSeconds: operation.durationSeconds,
          },
          structure: operation.structure,
        });
        return;
      }
      case "replace_session": {
        const session = mutable(operation.sessionKey);
        if (session)
          store({
            ...operation.content,
            sessionKey: session.sessionKey,
            scheduledOn: session.scheduledOn,
          });
        return;
      }
      case "skip_session": {
        const session = mutable(operation.sessionKey);
        if (session) sessions.delete(session.sessionKey);
        return;
      }
      case "add_session":
        place(operation.session);
        return;
      case "set_week_targets": {
        const week = weeks.get(operation.weekKey);
        if (!week) return fail("unknown_key", operation.weekKey);
        if (addDays(week.weekStart, 6) < context.today)
          return fail("past_date", operation.weekKey);
        weeks.set(week.weekKey, { ...week, targets: operation.targets });
        return;
      }
      case "replace_range": {
        if (!dateAllowed(operation.from) || !dateAllowed(operation.to)) return;
        const inRange = [...sessions.values()].filter(
          (session) =>
            session.scheduledOn >= operation.from &&
            session.scheduledOn <= operation.to,
        );
        const frozen = inRange.find((session) =>
          isFrozenSession(session, context),
        );
        if (frozen) return fail("frozen_session", frozen.sessionKey);
        if (
          operation.sessions.some(
            (placed) =>
              placed.scheduledOn < operation.from ||
              placed.scheduledOn > operation.to,
          )
        )
          return fail("invalid_operation");
        for (const session of inRange) sessions.delete(session.sessionKey);
        operation.sessions.forEach(place);
        return;
      }
      case "set_race_role":
        plan = withRaceRole(plan, operation.raceId, operation.role);
        return;
      case "extend_plan": {
        if (operationIndex !== 0 || operation.previousEndsOn !== plan.endsOn)
          return fail("invalid_operation");
        if (operation.endsOn < context.today) return fail("past_date");
        if (operation.endsOn <= plan.endsOn) return fail("outside_plan");
        const previousEnd = plan.endsOn;
        const after = (date: string) =>
          date > previousEnd && date <= operation.endsOn;
        for (const block of operation.blocks) {
          if (
            blocks.has(block.blockKey) ||
            !after(block.startsOn) ||
            !after(block.endsOn)
          )
            return fail("invalid_operation", block.blockKey);
          blocks.set(block.blockKey, block);
        }
        const expected = mondaysBetween(
          addDays(mondayOf(previousEnd), 7),
          mondayOf(operation.endsOn),
        );
        const given = operation.weeks.map((week) => week.weekStart).sort();
        if (expected.join() !== given.join())
          return fail("invalid_operation", "weeks");
        for (const week of operation.weeks) {
          if (weeks.has(week.weekKey) || !blocks.has(week.blockKey))
            return fail("invalid_operation", week.weekKey);
          weeks.set(week.weekKey, week);
        }
        for (const session of operation.sessions) {
          if (sessions.has(session.sessionKey))
            return fail("invalid_operation", session.sessionKey);
          if (
            !after(session.scheduledOn) ||
            !given.includes(mondayOf(session.scheduledOn))
          )
            return fail("outside_plan", session.sessionKey);
          if (session.scheduledOn < context.today)
            return fail("past_date", session.sessionKey);
          sessions.set(session.sessionKey, session);
        }
        plan = {
          ...withRaceRole(plan, operation.raceId, operation.role),
          endsOn: operation.endsOn,
        };
        return;
      }
      case "rewrite_range": {
        if (!dateAllowed(operation.from) || !dateAllowed(operation.to)) return;
        const next = addDays(operation.to, 1);
        if (
          mondayOf(operation.from) !== operation.from ||
          (operation.to !== plan.endsOn && mondayOf(next) !== next)
        )
          return fail("invalid_operation", "range");
        const inRange = (date: string) =>
          date >= operation.from && date <= operation.to;
        const replaced = [...sessions.values()].filter((session) =>
          inRange(session.scheduledOn),
        );
        const frozen = replaced.find((session) =>
          isFrozenSession(session, context),
        );
        if (frozen) return fail("frozen_session", frozen.sessionKey);
        const expected = mondaysBetween(operation.from, mondayOf(operation.to));
        const given = operation.weeks.map((week) => week.weekStart).sort();
        if (expected.join() !== given.join())
          return fail("invalid_operation", "weeks");
        for (const block of [...blocks.values()]) {
          if (block.endsOn < operation.from || block.startsOn > operation.to)
            continue;
          const before = block.startsOn < operation.from;
          const after = block.endsOn > operation.to;
          if (before && after) return fail("invalid_operation", block.blockKey);
          if (before)
            blocks.set(block.blockKey, {
              ...block,
              endsOn: addDays(operation.from, -1),
            });
          else if (after)
            blocks.set(block.blockKey, { ...block, startsOn: next });
          else blocks.delete(block.blockKey);
        }
        for (const week of [...weeks.values()])
          if (inRange(week.weekStart)) weeks.delete(week.weekKey);
        for (const session of replaced) sessions.delete(session.sessionKey);
        for (const block of operation.blocks) {
          if (
            blocks.has(block.blockKey) ||
            !inRange(block.startsOn) ||
            !inRange(block.endsOn)
          )
            return fail("invalid_operation", block.blockKey);
          blocks.set(block.blockKey, block);
        }
        for (const week of weeks.values())
          if (!blocks.has(week.blockKey))
            return fail("invalid_operation", week.blockKey);
        for (const week of operation.weeks) {
          if (
            weeks.has(week.weekKey) ||
            !operation.blocks.some((block) => block.blockKey === week.blockKey)
          )
            return fail("invalid_operation", week.weekKey);
          weeks.set(week.weekKey, week);
        }
        for (const session of operation.sessions) {
          if (sessions.has(session.sessionKey))
            return fail("invalid_operation", session.sessionKey);
          if (!inRange(session.scheduledOn))
            return fail("outside_plan", session.sessionKey);
          sessions.set(session.sessionKey, session);
        }
        return;
      }
      case "create_plan":
        return;
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  const next: PlanState = {
    plan,
    blocks: [...blocks.values()],
    weeks: [...weeks.values()].sort((first, second) =>
      first.weekStart.localeCompare(second.weekStart),
    ),
    sessions: [...sessions.values()].sort(bySchedule),
  };
  return { ok: true, state: next, changeset: computeChangeset(state, next) };
}
