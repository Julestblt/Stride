import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));

import type { PlanSession } from "@/features/plans/model/plan";
import {
  buildWatchRequest,
  watchCopy,
  watchDayTags,
  watchIntent,
  watchKey,
  watchRowLabel,
  watchState,
  watchUpcoming,
  type WatchRow,
} from "@/features/garmin/watch";
import { watchNeedsSync } from "@/server/garmin/watch";
import { easyRun, thresholdSession } from "./plan-fixture";

const planId = "8f2a1c3e-0000-4000-8000-000000000001";
const today = "2026-10-14";

function session(
  sessionKey: string,
  scheduledOn: string,
  content = easyRun(45),
): PlanSession {
  return { ...content, sessionKey, scheduledOn };
}

const strength: PlanSession = {
  ...session("s-strength", "2026-10-16"),
  sport: "strength",
  kind: "strength",
  title: "Renfo",
};
const rest: PlanSession = {
  ...session("s-rest", "2026-10-17"),
  sport: "rest",
  kind: "rest",
  structure: [],
};
const sessions = [
  session("s-past", "2026-10-13"),
  session("s-today", "2026-10-14", thresholdSession()),
  strength,
  rest,
  session("s-next", "2026-10-20"),
  session("s-later", "2026-10-28"),
];

function row(sessionKey: string, overrides: Partial<WatchRow> = {}): WatchRow {
  return {
    key: watchKey(planId, sessionKey),
    scheduledOn: "2026-10-20",
    status: "sent",
    errorCode: null,
    simplifications: [],
    sentAt: "2026-10-12T19:04:00Z",
    ...overrides,
  };
}

describe("watch request", () => {
  it("sends the run and trail sessions of the next seven days", () => {
    const request = buildWatchRequest({ planId, sessions, today, rows: [] });

    expect(request.from).toBe(today);
    expect(request.to).toBe("2026-10-20");
    expect(request.workouts.map((workout) => workout.key)).toEqual([
      `${planId}:s-today`,
      `${planId}:s-next`,
    ]);
    expect(request.workouts[0]).toMatchObject({
      date: "2026-10-14",
      name: "Seuil · 4 × 6'",
      description: "Développer l'allure seuil",
    });
    expect(request.workouts[0].steps).toBe(sessions[1].structure);
    expect(request.workouts[0]).not.toHaveProperty("force");
  });

  it("keeps sessions sent earlier beyond the window and the requested one", () => {
    const request = buildWatchRequest({
      planId,
      sessions,
      today,
      rows: [
        row("s-later", { scheduledOn: "2026-10-28" }),
        row("s-gone"),
        { ...row("s-next"), key: "other-plan:s-next" },
      ],
      intent: watchIntent("s-later", "resend"),
    });

    expect(request.to).toBe("2026-10-28");
    expect(request.workouts.map((workout) => workout.key)).toEqual([
      `${planId}:s-today`,
      `${planId}:s-next`,
      `${planId}:s-later`,
    ]);
    expect(request.workouts[2].force).toBe(true);
    expect(request.workouts[1]).not.toHaveProperty("force");
  });

  it("never sends past, unsupported or out-of-range sessions", () => {
    const request = buildWatchRequest({
      planId,
      sessions: [...sessions, session("s-far", "2026-12-01")],
      today,
      rows: [],
      intent: watchIntent("s-far", "send"),
    });
    for (const key of ["s-past", "s-strength", "s-rest", "s-far"])
      expect(request.workouts.map((workout) => workout.key)).not.toContain(
        `${planId}:${key}`,
      );
  });

  it("keeps an earlier confirmation when a simplified workout is sent again", () => {
    const request = buildWatchRequest({
      planId,
      sessions,
      today,
      rows: [
        row("s-next", { simplifications: ["rpe_target"] }),
        row("s-today", {
          status: "failed",
          errorCode: "provider_unavailable",
          simplifications: ["rpe_target"],
        }),
      ],
      intent: watchIntent("s-next", "resend"),
    });
    expect(request.workouts).toEqual([
      expect.objectContaining({
        key: `${planId}:s-today`,
        allow_simplified: true,
      }),
      expect.objectContaining({
        key: `${planId}:s-next`,
        force: true,
        allow_simplified: true,
      }),
    ]);
    const held = buildWatchRequest({
      planId,
      sessions,
      today,
      rows: [row("s-next", { status: "needs_confirmation" })],
    });
    expect(held.workouts[1]).not.toHaveProperty("allow_simplified");
  });

  it("widens the window to remove workouts that left the plan", () => {
    const request = buildWatchRequest({
      planId,
      sessions,
      today,
      rows: [
        row("s-dropped", { scheduledOn: "2026-11-03" }),
        { ...row("s-old"), key: "old-plan:s-old", scheduledOn: "2026-10-25" },
        row("s-beyond", { scheduledOn: "2026-12-20" }),
      ],
    });
    expect(request.to).toBe("2026-11-03");
    expect(request.workouts.map((workout) => workout.key)).toEqual([
      `${planId}:s-today`,
      `${planId}:s-next`,
    ]);
  });

  it("never sends more workouts than garmin_mcp accepts", () => {
    const many = Array.from({ length: 45 }, (_, index) =>
      session(`s-${index}`, today),
    );
    const request = buildWatchRequest({
      planId,
      sessions: [...many, session("s-ahead", "2026-10-30")],
      today,
      rows: [],
      intent: watchIntent("s-ahead", "send"),
    });
    expect(request.workouts).toHaveLength(40);
    expect(request.workouts.at(-1)?.key).toBe(`${planId}:s-ahead`);
  });

  it("maps actions to request flags", () => {
    expect(watchIntent("s", "resend")).toMatchObject({ force: true });
    expect(watchIntent("s", "confirm")).toMatchObject({
      allowSimplified: true,
    });
    expect(watchIntent("s", "retry")).toEqual({
      sessionKey: "s",
      force: undefined,
      allowSimplified: undefined,
    });
  });
});

describe("watch state", () => {
  const stateOf = (item: PlanSession, value: WatchRow | null = null) =>
    watchState({ session: item, today, row: value });

  it("follows the pushed workout status", () => {
    expect(stateOf(sessions[4], row("s-next"))).toEqual({
      kind: "sent",
      sentAt: "2026-10-12T19:04:00Z",
    });
    expect(
      stateOf(
        sessions[4],
        row("s-next", { status: "failed", errorCode: "rate_limited" }),
      ),
    ).toEqual({ kind: "failed", errorCode: "rate_limited" });
    expect(
      stateOf(sessions[4], row("s-next", { status: "needs_confirmation" })),
    ).toEqual({ kind: "needs_confirmation" });
  });

  it("explains sessions that are not on the watch yet", () => {
    expect(stateOf(sessions[4])).toEqual({ kind: "pending" });
    expect(stateOf(sessions[5])).toEqual({
      kind: "scheduled",
      sendsOn: "2026-10-22",
      sendable: true,
    });
    expect(stateOf(session("s-far", "2026-12-01"))).toMatchObject({
      sendable: false,
    });
    expect(
      stateOf(sessions[4], row("s-next", { scheduledOn: "2026-10-18" })),
    ).toEqual({ kind: "pending" });
    expect(stateOf(strength)).toEqual({ kind: "unsupported" });
    expect(stateOf(rest)).toBeNull();
    expect(stateOf(sessions[0])).toBeNull();
  });

  it("writes French copy for each state", () => {
    expect(watchCopy({ kind: "sent", sentAt: "2026-10-12T19:04:00Z" })).toEqual(
      {
        tone: "success",
        title: "Sur ta montre",
        detail:
          "Envoyée lun. 12 oct. à 21:04. Lance-la depuis Entraînements sur ta montre.",
        action: { kind: "resend", label: "Renvoyer sur la montre" },
      },
    );
    expect(
      watchCopy({ kind: "sent", sentAt: null }, { pendingChange: true }).detail,
    ).toBe(
      "Si tu acceptes le changement, je mets la montre à jour tout de suite.",
    );
    expect(
      watchCopy({ kind: "scheduled", sendsOn: "2026-10-22", sendable: true })
        .title,
    ).toBe("Envoi prévu le jeu. 22 oct.");
    expect(
      watchCopy({ kind: "scheduled", sendsOn: "2026-12-01", sendable: false })
        .action,
    ).toBeNull();
    expect(
      watchCopy({ kind: "failed", errorCode: "unsupported_data" }),
    ).toMatchObject({
      tone: "danger",
      title: "Pas sur ta montre",
      action: { kind: "retry", label: "Réessayer" },
    });
    expect(watchCopy({ kind: "needs_confirmation" }).action).toEqual({
      kind: "confirm",
      label: "Envoyer quand même",
    });
    expect(watchCopy({ kind: "unsupported" }).action).toBeNull();
    expect(
      watchRowLabel({ kind: "sent", sentAt: null }, { pendingChange: true }),
    ).toEqual({
      tone: "warning",
      label: "Mise à jour si tu acceptes le changement",
    });
  });

  it("tags week days only when sending is on", () => {
    const rows = [
      row("s-next"),
      row("s-today", {
        status: "failed",
        errorCode: "provider_unavailable",
        scheduledOn: today,
      }),
    ];
    expect(
      watchDayTags({ enabled: true, rows, planId, sessions, today }),
    ).toEqual({ "s-next": "on", "s-today": "off" });
    expect(
      watchDayTags({ enabled: false, rows, planId, sessions, today }),
    ).toEqual({});
  });

  it("lists the next seven days for settings", () => {
    const upcoming = watchUpcoming({
      rows: [row("s-next")],
      planId,
      sessions,
      today,
      pendingKeys: ["s-next"],
    });
    expect(upcoming.map((item) => [item.day, item.state.kind])).toEqual([
      ["mer. 14 oct.", "pending"],
      ["ven. 16 oct.", "unsupported"],
      ["mar. 20 oct.", "sent"],
    ]);
    expect(upcoming[2].pendingChange).toBe(true);
  });
});

describe("watch refresh", () => {
  const plan = {
    planId,
    activeVersion: 3,
    timeZone: "Europe/Paris",
  };
  const now = new Date("2026-10-14T08:00:00Z");
  const synced = {
    enabled: true,
    syncedKey: `${planId}:3:2026-10-14`,
    syncedAt: "2026-10-14T07:30:00Z",
  };

  it("runs when the plan version or the day changes", () => {
    expect(watchNeedsSync({ setting: synced, plan, rows: [], now })).toBe(
      false,
    );
    expect(
      watchNeedsSync({
        setting: synced,
        plan: { ...plan, activeVersion: 4 },
        rows: [],
        now,
      }),
    ).toBe(true);
    expect(
      watchNeedsSync({
        setting: synced,
        plan,
        rows: [],
        now: new Date("2026-10-15T06:00:00Z"),
      }),
    ).toBe(true);
  });

  it("waits between attempts and retries failures hourly", () => {
    expect(
      watchNeedsSync({
        setting: {
          ...synced,
          syncedKey: null,
          syncedAt: "2026-10-14T07:55:00Z",
        },
        plan,
        rows: [],
        now,
      }),
    ).toBe(false);
    const failed = [
      row("s-next", { status: "failed", errorCode: "rate_limited" }),
    ];
    expect(watchNeedsSync({ setting: synced, plan, rows: failed, now })).toBe(
      false,
    );
    expect(
      watchNeedsSync({
        setting: { ...synced, syncedAt: "2026-10-14T06:30:00Z" },
        plan,
        rows: failed,
        now,
      }),
    ).toBe(true);
    expect(
      watchNeedsSync({
        setting: { ...synced, enabled: false, syncedKey: null },
        plan,
        rows: [],
        now,
      }),
    ).toBe(false);
  });
});
