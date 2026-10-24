import { describe, expect, it } from "vitest";
import { addDays } from "@/features/progress/period";
import {
  recoveryModel,
  type Readiness,
  type RecoveryNight,
} from "@/features/progress/recovery";
import { queueNext, queueOrder } from "@/features/today/queue";
import {
  formIndicators,
  todayVerdict,
  type FormIndicator,
  type VerdictInput,
} from "@/features/today/verdict";

const today = "2026-10-22";

function readiness(score: number): Readiness {
  return {
    today: score,
    average: 70,
    level:
      score >= 75
        ? "high"
        : score >= 50
          ? "moderate"
          : score >= 25
            ? "low"
            : "poor",
    trend: "stable",
  };
}

function indicator(
  key: FormIndicator["key"],
  status: FormIndicator["status"],
): FormIndicator {
  return {
    key,
    label: key,
    value: "",
    status,
    statusLabel: "",
    note: "",
    band: null,
    marker: null,
    threshold: null,
    alert:
      status === "crossed"
        ? {
            motif: "VFC sous ta plage depuis 2 jours",
            detail: "VFC sous ta plage 2 jours de suite",
          }
        : null,
  };
}

const quality = {
  kind: "session",
  sessionKey: "s-1",
  title: "Seuil · 4 × 6’",
  quality: true,
  href: "/plan?session=s-1",
} as const;

function verdict(overrides: Partial<VerdictInput> = {}) {
  return todayVerdict({
    readiness: readiness(82),
    indicators: [indicator("hrv", "normal"), indicator("load", "normal")],
    pain: false,
    session: quality,
    ...overrides,
  });
}

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
      restingHeartRate: 45 + (index % 3) - 1,
      ...values(age),
    };
  });
}

function indicators(
  values: (age: number) => Partial<RecoveryNight>,
  ratio = 1.1,
) {
  return formIndicators(
    recoveryModel({
      nights: nights(values),
      load: [{ day: today, acute: ratio * 100, chronic: 100 }],
      checkin: null,
      races: [],
      today,
    }),
  );
}

describe("today verdict", () => {
  it("keeps a quality session on a high form", () => {
    expect(verdict()).toMatchObject({
      tone: "success",
      label: "Séance maintenue",
      text: "Tu es prêt : déroule la séance comme prévue.",
      motif: null,
      compat: {
        answer: "Oui",
        detail: "Tous les indicateurs dans ta plage.",
      },
    });
    expect(verdict()?.actions.map((action) => action.label)).toEqual([
      "Voir les étapes",
    ]);
  });

  it("asks for caution and offers a lighter version on a moderate form", () => {
    const result = verdict({
      readiness: readiness(58),
      indicators: [indicator("hrv", "watch"), indicator("sleep", "watch")],
    });
    expect(result).toMatchObject({
      label: "Avec prudence",
      compat: {
        answer: "Avec prudence",
        detail: "2 indicateurs à surveiller, aucun seuil franchi.",
      },
    });
    expect(result?.actions[1]).toMatchObject({
      key: "lighter",
      label: "Demander une version allégée",
    });
    expect(result?.actions[1].href).toMatch(
      /^\/coach\/new\?text=.*session=s-1$/,
    );
  });

  it("keeps an easy session on a moderate form", () => {
    expect(
      verdict({
        readiness: readiness(58),
        session: { ...quality, quality: false },
      })?.label,
    ).toBe("Séance maintenue");
  });

  it("sends a quality session to review below 50 and names the score", () => {
    const result = verdict({ readiness: readiness(41) });
    expect(result).toMatchObject({
      tone: "danger",
      label: "À revoir",
      text: "Ta forme est sous 50 avant une séance intense.",
      motif: "Forme 41",
      compat: { answer: "Non" },
    });
    expect(result?.actions.map((action) => action.label)).toEqual([
      "Revoir la séance avec le coach",
      "Garder la séance",
    ]);
    expect(result?.actions[0].primary).toBe(true);
  });

  it("proposes rest on a poor form before an easy session", () => {
    expect(
      verdict({
        readiness: readiness(20),
        session: { ...quality, quality: false },
      }),
    ).toMatchObject({
      label: "À revoir",
      text: "Ta forme est très basse : repos proposé, ou un footing très court à l’aise.",
    });
  });

  it("names the first alert before a quality session", () => {
    const crossed = verdict({
      indicators: [indicator("hrv", "crossed"), indicator("load", "normal")],
    });
    const review = new URL(
      crossed!.actions[0].href,
      "https://stride.test",
    ).searchParams.get("text");
    expect(review).toBe(
      "Revois avec moi la séance « Seuil · 4 × 6’ » : VFC sous ta plage depuis 2 jours · forme 82.",
    );
    expect(crossed).toMatchObject({
      label: "À revoir",
      motif: "VFC sous ta plage depuis 2 jours · forme 82",
      compat: {
        detail: "1 seuil franchi : VFC sous ta plage 2 jours de suite.",
      },
    });
    expect(verdict({ pain: true, readiness: readiness(68) })).toMatchObject({
      label: "À revoir",
      text: "Tu as une douleur active : pas d’intensité avant d’en parler.",
      motif: "Douleur active signalée dans Santé · forme 68",
    });
    expect(verdict({ readiness: readiness(41), pain: true })?.motif).toBe(
      "Forme 41 · Douleur active signalée dans Santé",
    );
  });

  it("says the form is unknown without a Garmin readiness", () => {
    expect(verdict({ readiness: null, indicators: [] })).toMatchObject({
      tone: "muted",
      label: "Forme inconnue",
      sync: true,
      compat: { answer: "Inconnue" },
    });
  });

  it("recovers on a rest day and has no verdict without a plan", () => {
    expect(verdict({ session: { kind: "rest" } })).toMatchObject({
      label: "Récupère",
      text: "Pas de séance prévue : profite de ta forme sans forcer.",
      compat: null,
    });
    expect(verdict({ session: { kind: "none" } })).toBeNull();
  });
});

describe("form indicators", () => {
  it("places each value on its personal band", () => {
    const items = indicators(() => ({}));
    expect(items.map((item) => [item.key, item.status])).toEqual([
      ["hrv", "normal"],
      ["resting", "normal"],
      ["sleep", "normal"],
      ["load", "normal"],
    ]);
    for (const item of items) {
      expect(item.band).not.toBeNull();
      expect(item.marker).toBeGreaterThanOrEqual(0);
      expect(item.marker).toBeLessThanOrEqual(100);
    }
    expect(items.find((item) => item.key === "sleep")?.threshold).toBeNull();
    expect(items.find((item) => item.key === "resting")?.note).toBe(
      "médiane 45 · seuil +7",
    );
    expect(items.find((item) => item.key === "load")).toMatchObject({
      value: "1,10",
      note: "zone 0,8–1,5 · seuil 1,5",
    });
  });

  it("flags a VFC below range two days in a row and a high resting heart rate", () => {
    const items = indicators(
      (age) =>
        age <= 1 ? { hrv: 44, restingHeartRate: 53, sleepSeconds: 21_000 } : {},
      1.6,
    );
    expect(items.map((item) => [item.key, item.status])).toEqual([
      ["hrv", "crossed"],
      ["resting", "crossed"],
      ["sleep", "watch"],
      ["load", "crossed"],
    ]);
    expect(items[0].note).toMatch(/^plage \d+–\d+ · 2e jour dessous$/);
    expect(items[0].alert?.motif).toBe("VFC sous ta plage depuis 2 jours");
    expect(items[1].alert?.motif).toBe("FC repos +8 bpm");
  });

  it("watches a single VFC night below range", () => {
    const [hrv] = indicators((age) => (age === 0 ? { hrv: 44 } : {}));
    expect(hrv).toMatchObject({ status: "watch", statusLabel: "À surveiller" });
    expect(hrv.note).toMatch(/· seuil 2 j dessous$/);
  });
});

describe("today queue", () => {
  const items = [{ key: "feeling" }, { key: "pair" }, { key: "legs" }];

  it("starts with the first pending question and rotates on later", () => {
    expect(queueOrder(items, null).map((item) => item.key)).toEqual([
      "feeling",
      "pair",
      "legs",
    ]);
    expect(queueOrder(items, "pair").map((item) => item.key)).toEqual([
      "pair",
      "legs",
      "feeling",
    ]);
    expect(queueOrder(items, "gone")[0].key).toBe("feeling");
  });

  it("announces what comes next", () => {
    expect(queueNext(["ta paire d’hier", "tes jambes"])).toBe(
      "Ensuite : ta paire d’hier, puis tes jambes",
    );
    expect(queueNext(["tes jambes"])).toBe("Ensuite : tes jambes ce matin");
    expect(queueNext([])).toBeNull();
  });
});
