export type FieldValues = Record<string, unknown>;
export type SaveStatus =
  "saved" | "unsaved" | "saving" | "error" | "offline" | "conflict";
export type Snapshot<V extends FieldValues> = {
  values: V;
  revision: number | null;
};
export type SaveRequest<V extends FieldValues> = {
  seq: number;
  values: Partial<V>;
  revision: number | null;
};
export type AutosaveState<V extends FieldValues> = {
  base: V;
  revision: number | null;
  local: V;
  dirty: (keyof V)[];
  inflight: SaveRequest<V> | null;
  nextSeq: number;
  status: SaveStatus;
  conflicts: (keyof V)[];
  theirs: Partial<V>;
  failures: number;
};

export function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function createAutosave<V extends FieldValues>(
  snapshot: Snapshot<V>,
): AutosaveState<V> {
  return {
    base: snapshot.values,
    revision: snapshot.revision,
    local: snapshot.values,
    dirty: [],
    inflight: null,
    nextSeq: 1,
    status: "saved",
    conflicts: [],
    theirs: {},
    failures: 0,
  };
}

export function editField<V extends FieldValues, K extends keyof V>(
  state: AutosaveState<V>,
  field: K,
  value: V[K],
): AutosaveState<V> {
  if (sameValue(state.local[field], value)) return state;
  const local = { ...state.local, [field]: value };
  const clean =
    sameValue(state.base[field], value) &&
    !(state.inflight && Object.hasOwn(state.inflight.values, field));
  const dirty = clean
    ? state.dirty.filter((key) => key !== field)
    : state.dirty.includes(field)
      ? state.dirty
      : [...state.dirty, field];
  const conflicts = state.conflicts.filter((key) => key !== field);
  return {
    ...state,
    local,
    dirty,
    conflicts,
    status: statusFor({ ...state, dirty, conflicts }),
  };
}

function statusFor<V extends FieldValues>(
  state: Pick<AutosaveState<V>, "dirty" | "conflicts" | "inflight" | "status">,
): SaveStatus {
  if (state.conflicts.length > 0) return "conflict";
  if (state.inflight) return "saving";
  if (state.status === "offline" || state.status === "error")
    return state.dirty.length > 0 ? state.status : "saved";
  return state.dirty.length > 0 ? "unsaved" : "saved";
}

export function beginSave<V extends FieldValues>(
  state: AutosaveState<V>,
): [AutosaveState<V>, SaveRequest<V> | null] {
  const fields = state.dirty.filter((key) => !state.conflicts.includes(key));
  if (state.inflight || fields.length === 0) return [state, null];
  const request: SaveRequest<V> = {
    seq: state.nextSeq,
    values: Object.fromEntries(
      fields.map((key) => [key, state.local[key]]),
    ) as Partial<V>,
    revision: state.revision,
  };
  return [
    {
      ...state,
      inflight: request,
      nextSeq: state.nextSeq + 1,
      status: "saving",
    },
    request,
  ];
}

export function saveSucceeded<V extends FieldValues>(
  state: AutosaveState<V>,
  seq: number,
  snapshot: Snapshot<V>,
): AutosaveState<V> {
  if (state.inflight?.seq !== seq) return state;
  const sent = state.inflight.values;
  const dirty = state.dirty.filter(
    (key) => !(key in sent) || !sameValue(state.local[key], sent[key]),
  );
  const local = { ...snapshot.values };
  for (const key of dirty) local[key] = state.local[key];
  const next = {
    ...state,
    base: snapshot.values,
    revision: snapshot.revision,
    local,
    dirty,
    inflight: null,
    failures: 0,
    status: "saved" as SaveStatus,
  };
  return { ...next, status: statusFor(next) };
}

export function saveFailed<V extends FieldValues>(
  state: AutosaveState<V>,
  seq: number,
  reason: "offline" | "error",
): AutosaveState<V> {
  if (state.inflight?.seq !== seq) return state;
  return {
    ...state,
    inflight: null,
    failures: state.failures + 1,
    status: state.conflicts.length > 0 ? "conflict" : reason,
  };
}

export function saveConflicted<V extends FieldValues>(
  state: AutosaveState<V>,
  seq: number,
  latest: Snapshot<V>,
): AutosaveState<V> {
  if (state.inflight?.seq !== seq) return state;
  const conflicts: (keyof V)[] = [...state.conflicts];
  const theirs: Partial<V> = { ...state.theirs };
  const dirty: (keyof V)[] = [];
  for (const key of state.dirty) {
    if (sameValue(latest.values[key], state.local[key])) continue;
    dirty.push(key);
    if (!sameValue(latest.values[key], state.base[key])) {
      if (!conflicts.includes(key)) conflicts.push(key);
      theirs[key] = latest.values[key];
    }
  }
  const local = { ...latest.values };
  for (const key of dirty) local[key] = state.local[key];
  const next = {
    ...state,
    base: latest.values,
    revision: latest.revision,
    local,
    dirty,
    conflicts,
    theirs,
    inflight: null,
    status: "saved" as SaveStatus,
  };
  return { ...next, status: statusFor(next) };
}

export function resolveConflict<V extends FieldValues>(
  state: AutosaveState<V>,
  field: keyof V,
  choice: "mine" | "theirs",
): AutosaveState<V> {
  if (!state.conflicts.includes(field)) return state;
  const conflicts = state.conflicts.filter((key) => key !== field);
  const theirs = { ...state.theirs };
  delete theirs[field];
  if (choice === "mine") {
    const next = { ...state, conflicts, theirs };
    return { ...next, status: statusFor(next) };
  }
  const local = { ...state.local, [field]: state.base[field] };
  const dirty = state.dirty.filter((key) => key !== field);
  const next = { ...state, local, dirty, conflicts, theirs };
  return { ...next, status: statusFor(next) };
}

export function retryDelay(failures: number) {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, failures - 1));
}

export const maxAutomaticRetries = 5;
