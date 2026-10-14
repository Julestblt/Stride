import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Usage = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  milliseconds: number;
};

export type Reply = { text: string; usage: Usage };

export const emptyUsage = (): Usage => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  milliseconds: 0,
});

export function addUsage(total: Usage, usage: Usage) {
  total.calls += usage.calls;
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.costUsd += usage.costUsd;
  total.milliseconds += usage.milliseconds;
}

function run(command: string, args: string[], input: string, cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 15 * 60 * 1000);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${command} exited ${code}: ${stderr.slice(-2000)}${stdout.slice(-1000)}`,
          ),
        );
    });
    child.stdin.end(input);
  });
}

async function isolated<T>(work: (directory: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "stride-bench-"));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20_000 * attempt));
    }
  }
}

export function claude(
  system: string,
  prompt: string,
  model = "sonnet",
): Promise<Reply> {
  return withRetry(() =>
    isolated(async (directory) => {
      const systemFile = join(directory, "system.md");
      await writeFile(systemFile, system);
      const started = Date.now();
      const output = await run(
        "claude",
        [
          "-p",
          "--model",
          model,
          "--system-prompt-file",
          systemFile,
          "--tools",
          "",
          "--setting-sources",
          "",
          "--strict-mcp-config",
          "--no-session-persistence",
          "--output-format",
          "json",
        ],
        prompt,
        directory,
      );
      const result = JSON.parse(output);
      if (result.is_error) throw new Error(`claude error: ${result.result}`);
      const usage = result.usage ?? {};
      return {
        text: String(result.result ?? ""),
        usage: {
          calls: 1,
          inputTokens:
            (usage.input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
          costUsd: result.total_cost_usd ?? 0,
          milliseconds: Date.now() - started,
        },
      };
    }),
  );
}

export function codex(prompt: string, model = "gpt-6-luna"): Promise<Reply> {
  return withRetry(() =>
    isolated(async (directory) => {
      const last = join(directory, "last.txt");
      const started = Date.now();
      const output = await run(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "--ephemeral",
          "--ignore-user-config",
          "--ignore-rules",
          "-s",
          "read-only",
          "-m",
          model,
          "-c",
          'model_reasoning_effort="medium"',
          "--json",
          "-o",
          last,
          "-",
        ],
        prompt,
        directory,
      );
      const usage = output
        .split("\n")
        .filter((line) => line.includes('"turn.completed"'))
        .map((line) => JSON.parse(line).usage)
        .reduce(
          (total, entry) => ({
            input: total.input + (entry?.input_tokens ?? 0),
            output: total.output + (entry?.output_tokens ?? 0),
          }),
          { input: 0, output: 0 },
        );
      return {
        text: await readFile(last, "utf8"),
        usage: {
          calls: 1,
          inputTokens: usage.input,
          outputTokens: usage.output,
          costUsd: 0,
          milliseconds: Date.now() - started,
        },
      };
    }),
  );
}

export function opencode(prompt: string, model: string): Promise<Reply> {
  return withRetry(() =>
    isolated(async (directory) => {
      const file = join(directory, "prompt.md");
      await writeFile(file, prompt);
      const started = Date.now();
      const output = await run(
        "opencode",
        [
          "run",
          "-m",
          `opencode-go/${model}`,
          "--format",
          "json",
          "-f",
          file,
          "Follow the instructions in the attached file prompt.md. Do not use any tool. Answer with the requested JSON only.",
        ],
        "",
        directory,
      );
      const events = output
        .split("\n")
        .filter((line) => line.startsWith("{"))
        .map((line) => JSON.parse(line));
      const text = events
        .filter((event) => event.type === "text")
        .map((event) => event.part?.text ?? "")
        .join("");
      if (!text.trim()) throw new Error(`opencode ${model} returned no text`);
      const tokens = events
        .map((event) => event.part?.tokens)
        .filter(Boolean)
        .reduce(
          (total, entry) => ({
            input: total.input + (entry.input ?? 0) + (entry.cache?.read ?? 0),
            output: total.output + (entry.output ?? 0),
          }),
          { input: 0, output: 0 },
        );
      return {
        text,
        usage: {
          calls: 1,
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          costUsd: 0,
          milliseconds: Date.now() - started,
        },
      };
    }),
  );
}

export async function pool<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await work(item);
    }),
  );
}
