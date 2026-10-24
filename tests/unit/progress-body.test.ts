import { describe, expect, it } from "vitest";
import {
  bodyNights,
  checkinHistory,
  lighterSessionHref,
  readinessAdvice,
  readinessFactors,
  readinessSummary,
  sessionHref,
} from "@/features/progress/body";
import type { HealthDay } from "@/features/progress/health";
import { addDays } from "@/features/progress/period";
import type { Readiness, RecoveryModel } from "@/features/progress/recovery";

const today = "2026-10-14";

const below: Readiness = {
  today: 62,
  average: 73,
  level: "moderate",
  trend: "watch",
};
const fine: Readiness = {
  today: 80,
  average: 78,
  level: "high",
  trend: "stable",
};
const threshold = { sessionKey: "s1", title: "Seuil · 3 × 10 min", hard: true };

function model(values: Partial<RecoveryModel> = {}): RecoveryModel {
  return {
    today,
    readiness: below,
    sleep: null,
    hrv: null,
    restingHeartRate: null,
    load: null,
    checkin: null,
    races: [],
    nextRace: null,
    ...values,
  };
}

describe("readiness advice", () => {
  it("keeps a hard session with a long warm-up when readiness is below usual", () => {
    expect(readinessAdvice(below, threshold)).toEqual({
      text: "Faisable : garde un échauffement long et coupe la dernière fraction si l’allure ne vient pas.",
      lighter: true,
    });
    expect(readinessAdvice(fine, threshold)?.lighter).toBe(false);
  });

  it("follows the Today score thresholds for hard and easy sessions", () => {
    const low: Readiness = { ...below, today: 41, level: "low" };
    const poor: Readiness = { ...below, today: 20, level: "poor" };
    expect(readinessAdvice(low, threshold)).toEqual({
      text: "Ta forme est sous 50 avant une séance intense : revois-la avec le coach.",
      lighter: true,
    });
    expect(
      readinessAdvice({ ...fine, trend: "watch" }, threshold)?.lighter,
    ).toBe(false);
    expect(readinessAdvice(low, { ...threshold, hard: false })?.lighter).toBe(
      false,
    );
    expect(readinessAdvice(poor, { ...threshold, hard: false })).toEqual({
      text: "Ta forme est très basse : repos proposé, ou un footing très court à l’aise.",
      lighter: true,
    });
  });

  it("advises without a session and stays empty without readiness", () => {
    expect(readinessAdvice(below, null)?.text).toBe(
      "Privilégie une sortie facile si tu t’entraînes.",
    );
    expect(readinessAdvice(null, threshold)).toBeNull();
  });

  it("summarises the score against the 14-day average", () => {
    expect(readinessSummary(below)).toEqual({
      score: 62,
      level: "Modéré",
      gap: "11 sous ta moyenne",
      tone: "warning",
    });
  });
});

describe("readiness factors", () => {
  it("orders the signals that weigh most first and omits missing ones", () => {
    const factors = readinessFactors(
      model({
        sleep: {
          last: 22_320,
          lastDay: today,
          average: 25_200,
          score: 70,
          nights: [],
          streak: 2,
          trend: "investigate",
        },
        hrv: {
          last: 58,
          lastDay: today,
          range: { low: 52, high: 66 },
          median: 59,
          points: [],
          position: "within",
          status: null,
          streak: 0,
          trend: "stable",
        },
        load: { ratio: 1.18, average: 1.02 },
        checkin: {
          day: today,
          legs: "heavy",
          soreness: null,
          stress: null,
          updatedAt: null,
        },
      }),
    );
    expect(factors.map((factor) => factor.key)).toEqual([
      "sleep",
      "load",
      "legs",
      "hrv",
    ]);
    expect(factors[0]).toEqual({
      key: "sleep",
      label: "Sommeil · 6h12",
      value: "−48 min",
      tone: "danger",
      reason: "vs ta moyenne 14 nuits · 2e nuit courte",
    });
    expect(factors[1]).toMatchObject({
      label: "Charge · ratio 1,18",
      value: "en hausse",
      tone: "warning",
    });
    expect(factors[3]).toMatchObject({
      value: "normale",
      reason: "dans ta plage 52–66 ms",
    });
  });
});

describe("body history", () => {
  it("lists the last seven mornings of legs answers", () => {
    const history = checkinHistory(
      [
        {
          day: today,
          legs: "heavy",
          soreness: null,
          stress: null,
          updatedAt: null,
        },
        {
          day: addDays(today, -1),
          legs: "heavy",
          soreness: null,
          stress: null,
          updatedAt: null,
        },
        {
          day: addDays(today, -3),
          legs: "fresh",
          soreness: null,
          stress: null,
          updatedAt: null,
        },
      ],
      today,
    );
    expect(history.days).toHaveLength(7);
    expect(history.days.at(-1)).toEqual({
      day: today,
      weekday: "M",
      legs: "heavy",
    });
    expect(history.label).toBe("Jambes : fraîches 1 jour, lourdes 2 jours");
  });

  it("flags short nights against the window average", () => {
    const days: HealthDay[] = Array.from({ length: 14 }, (_, index) => ({
      day: addDays(today, index - 13),
      sleep: index >= 12 ? 21_600 : 26_400,
      deep: 3_600,
      light: 15_000,
      rem: 5_400,
      awake: 600,
      sleepScore: 80,
      hrv: null,
      restingHeartRate: null,
      stress: null,
      batteryWake: null,
      batteryCharged: null,
      batteryDrained: null,
      steps: null,
      recoveryMinutes: null,
      acute: null,
      chronic: null,
      vo2: null,
      focusLowAerobic: null,
      focusHighAerobic: null,
      focusAnaerobic: null,
    }));
    const nights = bodyNights(days, today, 14);
    expect(nights.shortCount).toBe(2);
    expect(nights.nights.at(-1)?.short).toBe(true);
    expect(nights.summary).toBe("moy. 7h09 · score 80 · 2 nuits courtes");
  });
});

describe("Corps actions", () => {
  it("opens the session and asks the Coach for a lighter version", () => {
    const session = {
      sessionKey: "2026-10-14:seuil 1",
      title: "Seuil",
      hard: true,
    };
    expect(sessionHref(session)).toBe("/plan?session=2026-10-14%3Aseuil%201");
    const url = new URL(lighterSessionHref(session), "https://stride.test");
    expect(url.pathname).toBe("/coach/new");
    expect(url.searchParams.get("text")).toBe(
      "Ma forme du jour est sous ma moyenne. Propose-moi une version allégée de « Seuil ».",
    );
    expect(url.searchParams.get("session")).toBe("2026-10-14:seuil 1");
  });
});
