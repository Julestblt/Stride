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

  it("leads with the plan goal race and the current week", () => {
    const { header } = buildToday(input());
    expect(header.goal).toMatchObject({
      id: "race-a",
      letter: "A",
      days: 17,
    });
    expect(header.week).toBe("S2 / 4 · Base");
    expect(header.next).toMatchObject({ id: "race-c", days: 10 });
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
    expect(session.href).toBe("/plan?seance=s-2026-10-22-1");
  });

  it("points to the next session on a rest day", () => {
    const { session } = buildToday(input({ today: "2026-10-23", panel: null }));
    expect(session).toEqual({
      kind: "rest",
      next: {
        title: "Footing",
        when: "dim. 25 oct.",
        href: "/plan?seance=s-2026-10-25-1",
      },
    });
  });

  it("says when there is no active plan", () => {
    const view = buildToday(
      input({ plan: null, program: null, panel: null, matches: [] }),
    );
    expect(view.session).toEqual({ kind: "none" });
    expect(view.week).toBeNull();
    expect(view.header.week).toBeNull();
    expect(view.header.goal?.id).toBe("race-a");
    expect(view.header.next?.id).toBe("race-c");
  });

  it("reads the day's form from Garmin and names the main cause", () => {
    const { readiness } = buildToday(input());
    expect(readiness).toMatchObject({
      score: 58,
      level: "Modérée",
      tone: "warning",
      context: "moy. 14 j : 70 · c’est le sommeil",
    });
    expect(readiness.rows.map((row) => [row.label, row.value])).toEqual([
      ["Sommeil", "5h52"],
      ["VFC", "46 ms"],
      ["FC repos", "45 bpm"],
    ]);
    expect(readiness.rows[0]).toMatchObject({
      note: "−1h28 vs ta moyenne",
      direction: "down",
      tone: "warning",
    });
    expect(readiness.rows[1].note).toMatch(/^sous ta plage \d+–\d+$/);
  });

  it("has no score without a Garmin readiness", () => {
    const { readiness } = buildToday(
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
    expect(readiness).toMatchObject({ score: null, rows: [] });
  });

  it("summarizes the current week day by day", () => {
    const { week } = buildToday(input());
    expect(week).toMatchObject({
      number: 2,
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

  it("lists the next key session and races in date order", () => {
    const { upcoming } = buildToday(
      input({ today: "2026-10-21", panel: null }),
    );
    expect(upcoming.map((item) => [item.title, item.when])).toEqual([
      ["Seuil · 4 × 6' · 50’", "jeu. 22 oct."],
      ["10K Vincennes", "dim. 1 nov."],
    ]);
    expect(upcoming[1].detail).toBe("Course C · cible 44:30 · J-11");
  });

  it("shows the latest activity with its plan compliance", () => {
    const { latest } = buildToday(input({ today: "2026-10-21", panel: null }));
    expect(latest).toEqual({
      heading: "Hier",
      title: "Footing · 50’",
      family: "easy",
      detail: "8,32 km · 6:02 /km · FC 142",
      compliance: { pct: 98, partial: false },
      verdict: null,
      feelingPrompt: null,
      href: "/activities/activity-1",
    });
  });

  it("adds the debrief verdict and asks for a missing feeling", () => {
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
    const { latest } = buildToday(
      input({ today: "2026-10-21", panel: null, debrief }),
    );
    expect(latest).toMatchObject({
      verdict: {
        tone: "warning",
        title: "Allure trop rapide",
        body: "allure moyenne plus rapide que prévu.",
      },
      feelingPrompt: "activity-1",
    });
    const noted = buildToday(
      input({
        today: "2026-10-21",
        panel: null,
        debrief: debrief && {
          ...debrief,
          feeling: feelingView({ source: "athlete", effort: 6, feel: 75 }),
        },
      }),
    );
    expect(noted.latest?.feelingPrompt).toBeNull();
  });

  it("names an older activity by its date", () => {
    const { latest } = buildToday(
      input({ latest: { ...activity, id: "other", date: "2026-10-12" } }),
    );
    expect(latest).toMatchObject({
      heading: "Dernière activité · lun. 12 oct.",
      title: "Course à pied · 50’",
      compliance: null,
    });
  });
});
