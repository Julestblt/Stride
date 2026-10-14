import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { arms, runners, type Arm } from "./arms";
import { pool } from "./llm";
import { scenarioById } from "./scenarios";

const args = new Map(
  process.argv
    .slice(2)
    .map(
      (argument) => argument.replace(/^--/, "").split("=") as [string, string],
    ),
);
const scenarioIds = (args.get("scenarios") ?? "S1,S2,S3,S4,S5,S6,S7,S8").split(
  ",",
);
const repetitions = Number(args.get("reps") ?? 2);
const selectedArms = (args.get("arms")?.split(",") ?? arms) as Arm[];
const concurrency = Number(args.get("concurrency") ?? 4);
const directory = join(__dirname, "results", args.get("out") ?? "plans");

async function main() {
  await mkdir(directory, { recursive: true });
  const jobs = scenarioIds.flatMap((scenario) =>
    Array.from({ length: repetitions }, (_, index) =>
      selectedArms.map((arm) => ({ scenario, arm, rep: index + 1 })),
    ).flat(),
  );
  await pool(jobs, concurrency, async ({ scenario, arm, rep }) => {
    const file = join(directory, `${scenario}-${arm}-r${rep}.json`);
    if (existsSync(file)) return;
    const started = Date.now();
    try {
      const result = await runners[arm](scenarioById(scenario));
      await writeFile(
        file,
        JSON.stringify({ scenario, arm, rep, ...result }, null, 1),
      );
      console.log(
        `${scenario} ${arm} r${rep}: calls=${result.usage.calls} cost=$${result.usage.costUsd.toFixed(2)} valid=${result.final.errors.length + result.final.blocking.length === 0} first=${result.firstAttempt.errors.length + result.firstAttempt.blocking.length === 0} warnings=${result.final.warnings.length} ${Math.round((Date.now() - started) / 1000)}s`,
      );
    } catch (error) {
      console.error(
        `${scenario} ${arm} r${rep}: FAILED ${(error as Error).message.slice(0, 500)}`,
      );
    }
  });
}

main();
