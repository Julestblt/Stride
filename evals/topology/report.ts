import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arms, type Arm, type ArmResult } from "./arms";
import { criteria, judgeIds, type JudgeId, type Verdict } from "./judge";

const results = join(__dirname, "results");

type PlanRecord = ArmResult & { scenario: string; arm: Arm; rep: number };
type Judgment = {
  judge: JudgeId;
  scenario: string;
  rep: number;
  labels: Record<string, Arm>;
  missing: Arm[];
  verdict: Verdict;
};

function readJson<T>(directory: string): T[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map(
      (file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as T,
    );
}

const mean = (values: number[]) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : NaN;
const fixed = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "–";

const plans = readJson<PlanRecord>(join(results, "plans"));
const invalid = (evaluation: PlanRecord["final"]) =>
  evaluation.errors.length + evaluation.blocking.length > 0;

const deterministic = arms.map((arm) => {
  const own = plans.filter((plan) => plan.arm === arm);
  return {
    arm,
    plans: own.length,
    invalidAfterRepair: own.filter((plan) => invalid(plan.final)).length,
    firstAttemptValid: own.filter((plan) => !invalid(plan.firstAttempt)).length,
    warnings: mean(own.map((plan) => plan.final.warnings.length)),
    s6Quality: own
      .filter((plan) => plan.scenario === "S6")
      .reduce((total, plan) => total + plan.final.qualityDespiteHealth, 0),
    calls: mean(own.map((plan) => plan.usage.calls)),
    inputTokens: mean(own.map((plan) => plan.usage.inputTokens)),
    outputTokens: mean(own.map((plan) => plan.usage.outputTokens)),
    cost: mean(own.map((plan) => plan.usage.costUsd)),
    minutes: mean(own.map((plan) => plan.usage.milliseconds / 60000)),
  };
});

const calibration = judgeIds.map((judge) => {
  const entries = readJson<{
    judge: JudgeId;
    defect: string;
    detected: boolean;
  }>(join(results, "calibration")).filter((entry) => entry.judge === judge);
  const detected = entries.filter((entry) => entry.detected).length;
  return {
    judge,
    detected,
    total: entries.length,
    missed: entries
      .filter((entry) => !entry.detected)
      .map((entry) => entry.defect),
    calibrated: detected >= 3,
  };
});

type TripletScore = {
  rank: number;
  rubric: number;
  unsafe: number;
  defects: string[];
};

function aggregate(judge: JudgeId) {
  const judgments = readJson<Judgment>(join(results, "judgments", judge));
  const triplets = new Map<string, Map<Arm, TripletScore[]>>();
  for (const judgment of judgments) {
    const key = `${judgment.scenario}-r${judgment.rep}`;
    const byArm = triplets.get(key) ?? new Map<Arm, TripletScore[]>();
    triplets.set(key, byArm);
    const ranked = judgment.verdict.ranking.map(
      (label) => judgment.labels[label],
    );
    for (const plan of judgment.verdict.plans) {
      const arm = judgment.labels[plan.label];
      if (!arm) continue;
      const position = ranked.indexOf(arm);
      byArm.set(arm, [
        ...(byArm.get(arm) ?? []),
        {
          rank: position < 0 ? 3 : position + 1,
          rubric: mean(criteria.map((criterion) => plan.scores[criterion])),
          unsafe: plan.unsafe ? 1 : 0,
          defects: plan.defects,
        },
      ]);
    }
    for (const arm of judgment.missing)
      byArm.set(arm, [
        ...(byArm.get(arm) ?? []),
        { rank: 3, rubric: 1, unsafe: 0, defects: ["missing"] },
      ]);
  }
  const perTriplet = [...triplets.entries()].map(([key, byArm]) => ({
    key,
    arms: Object.fromEntries(
      arms.map((arm) => {
        const scores = byArm.get(arm) ?? [];
        return [
          arm,
          {
            rank: mean(scores.map((score) => score.rank)),
            rubric: mean(scores.map((score) => score.rubric)),
            unsafe: scores.reduce((total, score) => total + score.unsafe, 0),
            defects: scores.flatMap((score) => score.defects),
          },
        ];
      }),
    ) as Record<
      Arm,
      { rank: number; rubric: number; unsafe: number; defects: string[] }
    >,
  }));
  return { judge, triplets: perTriplet };
}

const judged = judgeIds.map(aggregate);
const pairs: [Arm, Arm][] = [
  ["C", "A"],
  ["B", "A"],
  ["B", "C"],
];

function wins(judge: (typeof judged)[number], complex: Arm, simple: Arm) {
  return judge.triplets.filter(
    (triplet) => triplet.arms[complex].rank < triplet.arms[simple].rank,
  ).length;
}

const calibratedJudges = judged.filter(
  (judge) =>
    calibration.find((entry) => entry.judge === judge.judge)?.calibrated,
);

function rubricMean(arm: Arm, pool = calibratedJudges) {
  return mean(
    pool.flatMap((judge) =>
      judge.triplets.map((triplet) => triplet.arms[arm].rubric),
    ),
  );
}

const eligible = deterministic
  .filter((row) => row.s6Quality === 0 && row.invalidAfterRepair <= 1)
  .map((row) => row.arm);

function clearlyBetter(complex: Arm, simple: Arm) {
  const agreeing = calibratedJudges.filter(
    (judge) => wins(judge, complex, simple) >= 12,
  ).length;
  return agreeing >= 2 && rubricMean(complex) - rubricMean(simple) >= 0.3;
}

const order: Arm[] = ["A", "C", "B"];
let selected = order.find((arm) => eligible.includes(arm)) ?? null;
let note = "";
if (
  selected &&
  eligible.includes("C") &&
  selected === "A" &&
  clearlyBetter("C", "A")
)
  selected = "C";
if (selected && eligible.includes("B") && selected !== "B") {
  const beatsAll = (["A", "C"] as Arm[])
    .filter((arm) => eligible.includes(arm))
    .every((arm) => clearlyBetter("B", arm));
  if (beatsAll) {
    const cost = (arm: Arm) =>
      deterministic.find((row) => row.arm === arm)?.cost ?? NaN;
    if (cost("B") <= 1.5 * cost(selected)) selected = "B";
    else
      note = `B is clearly better but costs ${fixed(cost("B") / cost(selected))}× arm ${selected}: offer B as opt-in "mode approfondi".`;
  }
}

const lines: string[] = [];
lines.push("# Topology benchmark results", "");
lines.push(
  `Plans: ${plans.length}. Generator: Claude Sonnet 5.5 through \`claude -p\`. Cost is the API-equivalent reported by the CLI.`,
  "",
);
lines.push("## Deterministic measures", "");
lines.push(
  "| Arm | Plans | Invalid after repair | Valid first attempt | Warnings / plan | S6 quality sessions | Calls / plan | Input tokens / plan | Output tokens / plan | Cost / plan (USD) | Minutes / plan |",
);
lines.push(
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const row of deterministic)
  lines.push(
    `| ${row.arm} | ${row.plans} | ${row.invalidAfterRepair} | ${row.firstAttemptValid} | ${fixed(row.warnings, 1)} | ${row.s6Quality} | ${fixed(row.calls, 1)} | ${Math.round(row.inputTokens)} | ${Math.round(row.outputTokens)} | ${fixed(row.cost)} | ${fixed(row.minutes, 1)} |`,
  );
lines.push("", "## Judge calibration", "");
lines.push(
  "| Judge | Seeded defects detected | Missed | Counts for the decision |",
);
lines.push("| --- | ---: | --- | --- |");
for (const row of calibration)
  lines.push(
    `| ${row.judge} | ${row.detected}/${row.total} | ${row.missed.join(", ") || "–"} | ${row.calibrated ? "yes" : "no"} |`,
  );
lines.push("", "## Judged quality", "");
lines.push(
  "Mean rubric score (1–5, mean of six criteria), mean rank (1 best) and plans flagged unsafe, per judge.",
  "",
);
lines.push(
  "| Judge | Triplets | A rubric | C rubric | B rubric | A rank | C rank | B rank | Unsafe A/C/B |",
);
lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
for (const judge of judged) {
  const armMean = (arm: Arm, field: "rubric" | "rank") =>
    fixed(mean(judge.triplets.map((triplet) => triplet.arms[arm][field])));
  const unsafe = (arm: Arm) =>
    judge.triplets.filter((triplet) => triplet.arms[arm].unsafe > 0).length;
  lines.push(
    `| ${judge.judge} | ${judge.triplets.length} | ${armMean("A", "rubric")} | ${armMean("C", "rubric")} | ${armMean("B", "rubric")} | ${armMean("A", "rank")} | ${armMean("C", "rank")} | ${armMean("B", "rank")} | ${unsafe("A")}/${unsafe("C")}/${unsafe("B")} |`,
  );
}
lines.push(
  "",
  "Triplets where the more complex arm ranks strictly above the simpler one (ties count against it).",
  "",
);
lines.push(
  `| Judge | ${pairs.map(([complex, simple]) => `${complex} over ${simple}`).join(" | ")} |`,
);
lines.push(`| --- | ${pairs.map(() => "---:").join(" | ")} |`);
for (const judge of judged)
  lines.push(
    `| ${judge.judge} | ${pairs.map(([complex, simple]) => `${wins(judge, complex, simple)}/${judge.triplets.length}`).join(" | ")} |`,
  );
lines.push("", "Per scenario mean rubric across judges (A / C / B):", "");
const scenarioIds = [...new Set(plans.map((plan) => plan.scenario))].sort();
lines.push("| Scenario | A | C | B |", "| --- | ---: | ---: | ---: |");
for (const scenario of scenarioIds) {
  const values = (arm: Arm) =>
    mean(
      judged.flatMap((judge) =>
        judge.triplets
          .filter((triplet) => triplet.key.startsWith(`${scenario}-`))
          .map((triplet) => triplet.arms[arm].rubric),
      ),
    );
  lines.push(
    `| ${scenario} | ${fixed(values("A"))} | ${fixed(values("C"))} | ${fixed(values("B"))} |`,
  );
}
lines.push("", "## Decision rule", "");
lines.push(`- Eligible arms (safety gate): ${eligible.join(", ") || "none"}.`);
lines.push(
  `- Calibrated judges: ${calibratedJudges.map((judge) => judge.judge).join(", ") || "none"}.`,
);
for (const [complex, simple] of pairs)
  lines.push(
    `- ${complex} clearly better than ${simple}: ${clearlyBetter(complex, simple) ? "yes" : "no"} (rubric difference ${fixed(rubricMean(complex) - rubricMean(simple))}).`,
  );
lines.push(
  `- Outcome: **arm ${selected ?? "none"}**.${note ? ` ${note}` : ""}`,
);

const judgedAny = judged.some((judge) => judge.triplets.length > 0);
const kept = judgedAny
  ? lines
  : [
      ...lines.slice(0, lines.indexOf("## Judged quality")),
      "## Judged quality",
      "",
      "Judging was not run, so no quality comparison or decision is reported.",
    ];
const summary = kept.join("\n") + "\n";
writeFileSync(join(results, "summary.md"), summary);
console.log(summary);
