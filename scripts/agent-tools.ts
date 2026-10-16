import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  agentTools,
  coachingTools,
  type AgentName,
} from "@/server/coaching/tools/registry";

export const startMarker = "  # stride-tools:start";
export const endMarker = "  # stride-tools:end";

type Tool = Pick<
  (typeof coachingTools)[number],
  "name" | "description" | "input"
>;

export function agentFile(agent: AgentName) {
  return join("managed-agents", "agents", `${agent}.md`);
}

export function toolEntry(tool: Tool) {
  const inputSchema = z.toJSONSchema(tool.input, {
    io: "input",
    override: ({ jsonSchema }) => {
      if (jsonSchema.format === "date") delete jsonSchema.pattern;
    },
  });
  delete inputSchema.$schema;
  return JSON.stringify({
    type: "custom",
    name: tool.name,
    description: tool.description,
    input_schema: inputSchema,
  });
}

export function expectedEntries(agent: AgentName) {
  return agentTools[agent].map((name) => {
    const tool = coachingTools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`${agent}: ${name} is not in the registry`);
    return toolEntry(tool);
  });
}

function blockBounds(lines: string[]) {
  const start = lines.indexOf(startMarker);
  const end = lines.indexOf(endMarker);
  return start === -1 || end < start ? null : { start, end };
}

function entryName(line: string) {
  try {
    const value: unknown = JSON.parse(line.replace(/^\s*-\s*/, ""));
    return z.object({ name: z.string() }).parse(value).name;
  } catch {
    return line.trim();
  }
}

function outsideCustomTools(
  lines: string[],
  bounds: { start: number; end: number },
) {
  return lines.flatMap((line, index) => {
    if (index >= bounds.start && index <= bounds.end) return [];
    if (!/["']?type["']?\s*:\s*["']?custom\b/.test(line)) return [];
    const inline = /["']?name["']?\s*:\s*["']?([\w-]+)/.exec(line);
    const following = lines
      .slice(index + 1, index + 6)
      .map((next) => /^\s*name:\s*["']?([\w-]+)/.exec(next))
      .find(Boolean);
    return [inline?.[1] ?? following?.[1] ?? "a custom tool"];
  });
}

export function agentToolProblems(
  agent: AgentName,
  source: string,
  expected = expectedEntries(agent),
) {
  const file = agentFile(agent);
  const lines = source.split("\n");
  const bounds = blockBounds(lines);
  if (!bounds) return [`${file}: the stride-tools markers are missing`];
  const actual = lines
    .slice(bounds.start + 1, bounds.end)
    .map((line) => line.replace(/^\s*-\s*/, ""));
  const byName = new Map(actual.map((entry) => [entryName(entry), entry]));
  const problems = outsideCustomTools(lines, bounds).map(
    (name) => `${file}: ${name} is declared outside the stride-tools markers`,
  );
  const seen = new Set<string>();
  for (const entry of actual) {
    const name = entryName(entry);
    if (seen.has(name)) problems.push(`${file}: ${name} is duplicated`);
    seen.add(name);
  }
  expected.forEach((entry, index) => {
    const name = entryName(entry);
    const current = byName.get(name);
    if (current === undefined) problems.push(`${file}: ${name} is missing`);
    else if (current !== entry)
      problems.push(`${file}: ${name} differs from the registry`);
    else if (entryName(actual[index] ?? "") !== name)
      problems.push(`${file}: ${name} is out of order`);
  });
  const names = new Set(expected.map(entryName));
  for (const name of byName.keys())
    if (!names.has(name))
      problems.push(`${file}: ${name} is not in the registry`);
  return problems;
}

export function syncAgentSource(
  agent: AgentName,
  source: string,
  expected = expectedEntries(agent),
) {
  const lines = source.split("\n");
  const bounds = blockBounds(lines);
  if (!bounds)
    throw new Error(
      `${agentFile(agent)}: the stride-tools markers are missing`,
    );
  return [
    ...lines.slice(0, bounds.start + 1),
    ...expected.map((entry) => `  - ${entry}`),
    ...lines.slice(bounds.end),
  ].join("\n");
}

const agents = Object.keys(agentTools) as AgentName[];

export function checkAgentTools(root = process.cwd()) {
  return agents.flatMap((agent) =>
    agentToolProblems(
      agent,
      readFileSync(join(root, agentFile(agent)), "utf8"),
    ),
  );
}

export function writeAgentTools(root = process.cwd()) {
  return agents.flatMap((agent) => {
    const path = join(root, agentFile(agent));
    const source = readFileSync(path, "utf8");
    const next = syncAgentSource(agent, source);
    if (next === source) return [];
    writeFileSync(path, next);
    return [agentFile(agent)];
  });
}

export function main(args: string[]) {
  if (args[0] === "write") {
    const changed = writeAgentTools();
    console.log(
      changed.length
        ? `Updated ${changed.join(", ")}`
        : "Agent tool blocks are up to date.",
    );
    return 0;
  }
  const problems = checkAgentTools();
  if (!problems.length) {
    console.log("Agent tool blocks match the registry.");
    return 0;
  }
  console.error(
    [
      "Agent tool blocks differ from the registry; run npm run agents:tools.",
      ...problems,
    ].join("\n"),
  );
  return 1;
}
