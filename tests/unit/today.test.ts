import { describe, expect, it } from "vitest";
import type { Activity } from "@/features/activities/activities";
import { buildDebriefView, feelingView } from "@/features/plans/debrief/view";
import { buildProgram, type ProgramRace } from "@/features/plans/view/program";
import { buildSessionPanel } from "@/features/plans/view/session-panel";
import { addDays } from "@/features/progress/period";
import {
  recoveryModel,
  type RecoveryNight,
} from "@/features/progress/recovery";
import {
  buildToday,
  formatTodayDate,
  todaySessionKey,
  type TodayInput,
  type TodayMatch,
} from "@/features/today/today";
import { planState } from "./plan-fixture";

const today = "2026-10-22";

const races: ProgramRace[] = [
  {
    id: "race-a",
    name: "Marathon de Paris",
    date: "2026-11-08",
    priority: "A",
    targetSeconds: null,
    distanceKm: 42.195,
    elevationGainM: null,
  },
  {
    id: "race-c",
    name: "10K Vincennes",
    date: "2026-11-01",
    priority: "C",
    targetSeconds: 2_670,
    distanceKm: 10,
    elevationGainM: null,
  },
];

function nights(values: (age: number) => Partial<RecoveryNight>) {
  return Array.from({ length: 30 }, (_, index): RecoveryNight => {
    const age = 29 - index;
    return {
      day: addDays(today, -age),
      readiness: 70,
      sleepSeconds: 26_400,
      sleepScore: 82,
      hrv: 58 + (index % 3) - 1,
      hrvStatus: "BALANCED",
      restingHeartRate: 45,
      ...values(age),
    };
  });
}

const activity: Activity = {
  id: "activity-1",
  type: "running",
  name: null,
  routeName: null,
  date: "2026-10-21",
  distanceMeters: 8_320,
  durationSeconds: 3_012,
  elevationGainMeters: null,
  averageHeartRate: 142,
};

function input(overrides: Partial<TodayInput> = {}): TodayInput {
  const state = planState();
  const matches: TodayMatch[] = [
    {
      sessionKey: "s-2026-10-20-1",
      activityId: "activity-1",
      status: "completed",
      compliance: { duration: 0.98 },
    },
  ];
  const sessionKey = todaySessionKey(state, today);
  return {
    today,
    plan: state,
    program: buildProgram({
      state,
      today,
      summary: null,
      matches: matches.map((match) => ({
        ...match,
        compliance: { ...match.compliance, distance: null },
      })),
      proposalKeys: [],
      races,
    }),
    races,
    matches,
    panel: sessionKey
      ? buildSessionPanel({
          state,
          today,
          sessionKey,
          matches: [],
          proposals: [],
          activity: null,
          laps: [],
          series: null,
        })
      : null,
    recovery: recoveryModel({
      nights: nights((age) =>
        age === 0 ? { readiness: 58, sleepSeconds: 21_120, hrv: 46 } : {},
      ),
      load: [],
      checkin: null,
      races: [],
      today,
    }),
    latest: { ...activity, date: "2026-10-20" },
    ...overrides,
  };
}

describe("today view", () => {
  it("formats the date as JJ/MM/AAAA with the weekday", () => {
    expect(formatTodayDate(today)).toBe("jeu. 22/10/2026");
  });

  it("shows the plan goal race once with its block and next light week", () => {
    const { goal } = buildToday(input());
    expect(goal).toMatchObject({
      id: "race-a",
      letter: "A",
      name: "Marathon de Paris",
      detail: "dim. 08/11/2026 · 42,2 km",
      days: 17,
      block: { name: "Base", week: "S2 / 4" },
      href: "/races/race-a",
    });
  });

  it("shows today's planned session with its key targets", () => {
    const { session } = buildToday(input());
    expect(session.kind).toBe("session");
    if (session.kind !== "session") return;
    expect(session.panel.title).toBe("Seuil · 4 × 6'");
    expect(session.stats.map((stat) => stat.label)).toEqual([
      "Durée",
      "Allure /km",
      "Au seuil",
    ]);
    expect(session.terrain).toBe("Route");
    expect(session.quality).toBe(true);
    expect(session.href).toBe("/plan?session=s-2026-10-22-1");
  });

  it("weighs today's quality session against the day's form", () => {
    const { verdict } = buildToday(input());
    expect(verdict).toMatchObject({
      label: "Avec prudence",
      compat: { question: "Compatible avec Seuil · 4 × 6' ?" },
    });
    expect(buildToday(input({ pain: true })).verdict?.label).toBe("À revoir");
  });

  it("drops the verdict once today's session is done", () => {
    const base = input();
    const done = buildToday(
      input({ panel: base.panel && { ...base.panel, status: "done" } }),
    );
    expect(done.session.kind).toBe("session");
    expect(done.verdict).toBeNull();
  });

  it("points to the next session on a rest day", () => {
    const { session } = buildToday(input({ today: "2026-10-23", panel: null }));
    expect(session).toEqual({
      kind: "rest",
      next: {
        title: "Footing",
        when: "dim. 25/10/2026",
        href: "/plan?session=s-2026-10-25-1",
      },
    });
  });

  it("says when there is no active plan", () => {
    const view = buildToday(
      input({ plan: null, program: null, panel: null, matches: [] }),
    );
    expect(view.session).toEqual({ kind: "none" });
    expect(view.verdict).toBeNull();
    expect(view.week).toBeNull();
    expect(view.goal).toMatchObject({ id: "race-a", block: null });
  });

  it("reads the day's form from Garmin with banded indicators", () => {
    const { form } = buildToday(input());
    expect(form).toMatchObject({
      score: 58,
      level: "Modérée",
      tone: "warning",
      gap: "12 sous ta moyenne 14 j",
    });
    expect(
      form.indicators.map((item) => [item.label, item.value, item.status]),
    ).toEqual([
      ["VFC", "46 ms", "watch"],
      ["FC repos", "45 bpm", "normal"],
      ["Sommeil", "5h52", "watch"],
    ]);
    expect(form.indicators[2].note).toBe("moy. 7h20 · −1h28");
  });

  it("has no score without a Garmin readiness", () => {
    const view = buildToday(
      input({
        recovery: recoveryModel({
          nights: [],
          load: [],
          checkin: null,
          races: [],
          today,
        }),
      }),
    );
    expect(view.form).toMatchObject({ score: null, indicators: [] });
    expect(view.verdict?.label).toBe("Forme inconnue");
    expect(view.queue).toEqual([
      {
        kind: "legs",
        key: "legs",
        label: "tes jambes",
        hint: "Ton ressenti complète la forme du jour.",
      },
    ]);
  });

  it("summarizes the current week day by day", () => {
    const { week } = buildToday(input());
    expect(week).toMatchObject({
      number: 2,
      total: 4,
      blockName: "Base",
      planned: { duration: expect.any(String) },
      href: "/plan?week=2026-10-19",
    });
    expect(week?.days.map((day) => day.letter)).toEqual([
      "L",
      "M",
      "M",
      "J",
      "V",
      "S",
      "D",
    ]);
    expect(week?.days[1]).toMatchObject({ family: "easy", state: "done" });
    expect(week?.days[3]).toMatchObject({ isToday: true, family: "threshold" });
    expect(week?.pct).toBeGreaterThan(0);
  });

  it("queues the feeling, then the pair, then the legs", () => {
    const debrief = buildDebriefView({
      session: planState().sessions.find(
        (item) => item.sessionKey === "s-2026-10-20-1",
      )!,
      activityId: "activity-1",
      laps: [],
      paceRanges: null,
      match: {
        status: "completed",
        compliance: { duration: 0.98, intensity: 0.9 },
      },
      garmin: { rpe: null, feel: null },
      athlete: null,
    });
    const pairQuestion = {
      activityId: "activity-1",
      title: "Quelle paire as-tu portée ?",
      text: "",
      garmin: { id: "shoe-1", name: "Evo SL 3" },
      planned: { id: "shoe-2", name: "Speedgoat 6" },
      context: "",
      options: [],
    };
    const { queue } = buildToday(
      input({
        today: "2026-10-21",
        panel: null,
        debrief,
        pairQuestion,
      }),
    );
    const withSession = buildToday(input({ debrief, pairQuestion })).queue;
    expect(withSession).toHaveLength(3);
    expect(withSession[0]).toMatchObject({
      kind: "feeling",
      activityId: "activity-1",
    });
    expect(queue.map((item) => [item.kind, item.label])).toEqual([
      ["feeling", "ton ressenti d’hier"],
      ["pair", "ta paire d’hier"],
      ["legs", "tes jambes"],
    ]);
    expect(queue[0]).toMatchObject({
      activityId: "activity-1",
      activity: {
        heading: "Hier",
        title: "Footing · 50’",
        family: "easy",
        detail: "8,32 km · 6:02 /km · FC 142",
        compliance: { pct: 98, partial: false },
        href: "/activities/activity-1",
      },
    });
    const noted = buildToday(
      input({
        today: "2026-10-21",
        panel: null,
        debrief: debrief && {
          ...debrief,
          feeling: feelingView({ source: "athlete", effort: 6, feel: 75 }),
        },
        recovery: recoveryModel({
          nights: [],
          load: [],
          checkin: {
            day: "2026-10-21",
            legs: "fresh",
            soreness: null,
            stress: null,
            updatedAt: null,
          },
          races: [],
          today: "2026-10-21",
        }),
      }),
    );
    expect(noted.queue).toEqual([]);
  });
});
