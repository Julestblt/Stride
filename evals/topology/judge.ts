import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { addDays } from "../../src/features/plans/model/dates";
import type { Arm } from "./arms";
import {
  compactPlanSchema,
  parseReply,
  renderPlan,
  type CompactPlan,
} from "./contract";
import { codex, opencode, pool, type Reply } from "./llm";
import { athleteFacts, scenarioById, type Scenario } from "./scenarios";

export const judges = {
  gpt: (prompt: string) => codex(prompt),
  qwen: (prompt: string) => opencode(prompt, "qwen3.8-max"),
  deepseek: (prompt: string) => opencode(prompt, "deepseek-v4-pro"),
} satisfies Record<string, (prompt: string) => Promise<Reply>>;
export type JudgeId = keyof typeof judges;
export const judgeIds = Object.keys(judges) as JudgeId[];

export const criteria = [
  "appropriateness",
  "progression",
  "specificity",
  "recovery",
  "individualization",
  "clarity",
] as const;
export const defects = [
  "load_spike",
  "missing_taper",
  "back_to_back_quality",
  "quality_despite_health",
  "ignored_availability",
  "unrealistic_target_accepted",
  "unsafe_long_run",
] as const;

const score = z.coerce.number().min(1).max(5);
const verdictSchema = z.object({
  plans: z
    .array(
      z.object({
        label: z.string(),
        scores: z.object(
          Object.fromEntries(
            criteria.map((criterion) => [criterion, score]),
          ) as Record<(typeof criteria)[number], typeof score>,
        ),
        defects: z.array(z.string()),
        unsafe: z.boolean(),
        rationale: z.string(),
      }),
    )
    .min(1),
  ranking: z.array(z.string()),
});
export type Verdict = z.infer<typeof verdictSchema>;

const rubric = `You are an expert endurance running coach reviewing training plans written for one athlete. Judge substance, not length or tone.

Score each plan from 1 to 5 on each criterion:
- appropriateness: fit to the athlete's level, history, availability and goal. 1 = harmful or ignores the athlete; 3 = acceptable but generic; 5 = exactly right for this athlete.
- progression: load management. 1 = dangerous jumps or no structure; 3 = reasonable but uneven; 5 = smooth progression from current load, recovery weeks, sound peak.
- specificity: preparation for this race (distance, terrain, elevation, pace). 1 = generic; 3 = partly specific; 5 = every phase builds toward the race demands.
- recovery: placement of easy days, recovery weeks and taper. 1 = hard days stacked or no taper; 3 = adequate; 5 = optimal spacing and taper.
- individualization: use of the athlete facts (paces, heart rates, health, constraints, target realism). 1 = ignores them; 3 = partly; 5 = fully grounded.
- clarity: the French explanations tell the athlete what to do and why. 1 = confusing; 3 = understandable; 5 = clear and motivating.

Tag each plan with every defect present, using only these codes: ${defects.join(", ")}.
- load_spike: a week or session clearly above what the athlete holds or than the previous weeks.
- missing_taper: no reduced load in the final one to two weeks before the main race.
- back_to_back_quality: hard sessions on consecutive days, including quality the day before or after the long run.
- quality_despite_health: quality or running scheduled despite a pain or illness report that requires stopping or caution.
- ignored_availability: sessions on unavailable days or periods, or beyond the athlete's time limits.
- unrealistic_target_accepted: the plan trains for a target the facts show is unrealistic without saying so.
- unsafe_long_run: a long run too long for the athlete's history.
Set "unsafe" to true if following the plan as written would put the athlete at real risk.`;

function verdictFormat(labels: string[]) {
  return `Return only one JSON object, no prose and no code fence:
{"plans": [${labels.map((label) => `{"label": "${label}", "scores": {${criteria.map((criterion) => `"${criterion}": 1-5`).join(", ")}}, "defects": [codes], "unsafe": boolean, "rationale": "max 60 words"}`).join(", ")}],
 "ranking": [${labels.length > 1 ? "labels from best to worst" : `"${labels[0]}"`}]}`;
}

function judgePrompt(facts: unknown, plans: string[]) {
  const labels = plans.map((_, index) => `Plan ${index + 1}`);
  return `${rubric}\n\nATHLETE FACTS (JSON):\n${JSON.stringify(facts, null, 1)}\n\n${plans
    .map((plan, index) => `===== ${labels[index]} =====\n${plan}`)
    .join(
      "\n\n",
    )}\n\n${labels.length > 1 ? "Compare the plans, then rank them from best to worst. " : ""}${verdictFormat(labels)}`;
}

async function ask(judge: JudgeId, prompt: string, labels: number) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await judges[judge](prompt);
    try {
      const verdict = parseReply(reply.text, verdictSchema);
      if (
        verdict.plans.length !== labels ||
        (labels > 1 && verdict.ranking.length !== labels)
      )
        throw new Error("wrong number of plans in verdict");
      return { verdict, usage: reply.usage };
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError;
}

const resultsDirectory = join(__dirname, "results");

function loadPlan(file: string): CompactPlan | null {
  if (!existsSync(file)) return null;
  const { text } = JSON.parse(readFileSync(file, "utf8"));
  try {
    return parseReply(text, compactPlanSchema);
  } catch {
    return null;
  }
}

function weekMinutes(week: CompactPlan["weeks"][number]) {
  return week.sessions.reduce(
    (total, session) =>
      total +
      session.steps.reduce(
        (sum, step) =>
          sum +
          ("repeat" in step
            ? step.repeat *
              step.steps.reduce((inner, child) => inner + child.minutes, 0)
            : step.minutes),
        0,
      ),
    0,
  );
}

export function seededVariants(base: CompactPlan, scenario: Scenario) {
  const clone = () => structuredClone(base);
  const spike = clone();
  for (const session of spike.weeks[2].sessions)
    for (const step of session.steps)
      if ("repeat" in step)
        step.steps.forEach(
          (child) => (child.minutes = Math.round(child.minutes * 1.7)),
        );
      else step.minutes = Math.round(step.minutes * 1.7);
  const taper = clone();
  const raceWeek = taper.weeks.length - 1;
  const peak = taper.weeks
    .slice(0, raceWeek - 2)
    .reduce((best, week) =>
      weekMinutes(week) > weekMinutes(best) ? week : best,
    );
  for (const index of [raceWeek - 2, raceWeek - 1]) {
    const target = taper.weeks[index];
    const shift = Math.round(
      (new Date(target.weekStart).getTime() -
        new Date(peak.weekStart).getTime()) /
        86_400_000,
    );
    target.phase = "build";
    target.notes = peak.notes;
    target.sessions = structuredClone(peak.sessions).map((session) => ({
      ...session,
      date: addDays(session.date, shift),
    }));
  }
  const stacked = clone();
  for (const week of stacked.weeks.slice(4, 7)) {
    const quality = week.sessions.find((session) =>
      ["threshold", "intervals", "tempo"].includes(session.kind),
    );
    const long = week.sessions.find((session) => session.kind === "long");
    if (!quality || !long) continue;
    const before = addDays(long.date, -1);
    week.sessions = week.sessions.filter((session) => session.date !== before);
    week.sessions.push({ ...structuredClone(quality), date: before });
    week.sessions.sort((first, second) =>
      first.date.localeCompare(second.date),
    );
  }
  const healthFacts = {
    ...athleteFacts(scenario),
    health: {
      conditions: [
        {
          kind: "pain",
          severity: 7,
          status: "active",
          worsening: true,
          note: "Douleur au tendon d'Achille droit depuis le 2026-10-10, en hausse, boiterie au réveil.",
        },
      ],
    },
  };
  return [
    { defect: "load_spike", plan: spike, facts: athleteFacts(scenario) },
    { defect: "missing_taper", plan: taper, facts: athleteFacts(scenario) },
    {
      defect: "back_to_back_quality",
      plan: stacked,
      facts: athleteFacts(scenario),
    },
    { defect: "quality_despite_health", plan: base, facts: healthFacts },
  ];
}

function rotationOrder(scenario: string, rep: number): Arm[] {
  const seed = [...`${scenario}-${rep}`].reduce(
    (total, char) => total * 31 + char.charCodeAt(0),
    7,
  );
  const permutations: Arm[][] = [
    ["A", "B", "C"],
    ["A", "C", "B"],
    ["B", "A", "C"],
    ["B", "C", "A"],
    ["C", "A", "B"],
    ["C", "B", "A"],
  ];
  return permutations[Math.abs(seed) % permutations.length];
}

async function calibrate(selected: JudgeId[]) {
  const directory = join(resultsDirectory, "calibration");
  await mkdir(directory, { recursive: true });
  const scenario = scenarioById("S0");
  const base = loadPlan(join(resultsDirectory, "tuning", "S0-A-r1.json"));
  if (!base) throw new Error("tuning plan S0-A-r1 is missing");
  const jobs = selected.flatMap((judge) =>
    seededVariants(base, scenario).map((variant) => ({ judge, ...variant })),
  );
  await pool(jobs, 6, async ({ judge, defect, plan, facts }) => {
    const file = join(directory, `${judge}-${defect}.json`);
    if (existsSync(file)) return;
    try {
      const { verdict, usage } = await ask(
        judge,
        judgePrompt(facts, [renderPlan(plan)]),
        1,
      );
      const detected = verdict.plans[0].defects.includes(defect);
      await writeFile(
        file,
        JSON.stringify({ judge, defect, detected, verdict, usage }, null, 1),
      );
      console.log(
        `calibration ${judge} ${defect}: ${detected ? "detected" : "MISSED"} ${verdict.plans[0].defects.join(",")}`,
      );
    } catch (error) {
      console.error(
        `calibration ${judge} ${defect}: FAILED ${(error as Error).message.slice(0, 300)}`,
      );
    }
  });
}

async function compare(selected: JudgeId[], concurrency: number) {
  const plansDirectory = join(resultsDirectory, "plans");
  const files = await readdir(plansDirectory);
  const triplets = [
    ...new Set(files.map((file) => file.replace(/-[ABC]-r(\d)\.json$/, "|$1"))),
  ].map((key) => {
    const [scenario, rep] = key.split("|");
    return { scenario, rep: Number(rep) };
  });
  const jobs = selected.flatMap((judge) =>
    triplets.flatMap(({ scenario, rep }) =>
      [0, 1, 2].map((rotation) => ({ judge, scenario, rep, rotation })),
    ),
  );
  const byJudge = new Map<JudgeId, typeof jobs>();
  for (const job of jobs)
    byJudge.set(job.judge, [...(byJudge.get(job.judge) ?? []), job]);
  await Promise.all(
    [...byJudge.values()].map((judgeJobs) =>
      pool(
        judgeJobs,
        concurrency,
        async ({ judge, scenario, rep, rotation }) => {
          const directory = join(resultsDirectory, "judgments", judge);
          await mkdir(directory, { recursive: true });
          const file = join(
            directory,
            `${scenario}-r${rep}-rot${rotation}.json`,
          );
          if (existsSync(file)) return;
          const base = rotationOrder(scenario, rep);
          const order = [...base.slice(rotation), ...base.slice(0, rotation)];
          const plans = order.map((arm) => ({
            arm,
            plan: loadPlan(
              join(plansDirectory, `${scenario}-${arm}-r${rep}.json`),
            ),
          }));
          const shown = plans.filter((entry) => entry.plan !== null);
          if (shown.length < 2) return;
          try {
            const { verdict, usage } = await ask(
              judge,
              judgePrompt(
                athleteFacts(scenarioById(scenario)),
                shown.map((entry) => renderPlan(entry.plan as CompactPlan)),
              ),
              shown.length,
            );
            const labels = Object.fromEntries(
              shown.map((entry, index) => [`Plan ${index + 1}`, entry.arm]),
            );
            await writeFile(
              file,
              JSON.stringify(
                {
                  judge,
                  scenario,
                  rep,
                  rotation,
                  labels,
                  missing: plans
                    .filter((entry) => !entry.plan)
                    .map((entry) => entry.arm),
                  verdict,
                  usage,
                },
                null,
                1,
              ),
            );
            console.log(
              `judge ${judge} ${scenario} r${rep} rot${rotation}: ${verdict.ranking.map((label) => labels[label] ?? "?").join(">")}`,
            );
          } catch (error) {
            console.error(
              `judge ${judge} ${scenario} r${rep} rot${rotation}: FAILED ${(error as Error).message.slice(0, 300)}`,
            );
          }
        },
      ),
    ),
  );
}

const args = new Map(
  process.argv
    .slice(2)
    .map(
      (argument) => argument.replace(/^--/, "").split("=") as [string, string],
    ),
);
const selected = (args.get("judges")?.split(",") ?? judgeIds) as JudgeId[];
const mode = args.get("mode") ?? "all";
const concurrency = Number(args.get("concurrency") ?? 3);

async function main() {
  if (mode === "calibrate" || mode === "all") await calibrate(selected);
  if (mode === "compare" || mode === "all")
    await compare(selected, concurrency);
}

if (process.argv[1]?.endsWith("judge.ts")) void main();
