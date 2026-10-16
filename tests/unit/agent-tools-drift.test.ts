import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  agentFile,
  agentToolProblems,
  checkAgentTools,
  expectedEntries,
  syncAgentSource,
} from "../../scripts/agent-tools";

describe("agent tool blocks", () => {
  it("match the registry in every agent file", () => {
    expect(checkAgentTools()).toEqual([]);
  });

  it("names the agent and the tool whose block drifted", () => {
    const source = readFileSync(agentFile("coach"), "utf8");
    const edited = source.replace('"maximum":42', '"maximum":90');
    expect(edited).not.toBe(source);
    expect(agentToolProblems("coach", edited)).toEqual([
      "managed-agents/agents/coach.md: read_health_reports differs from the registry",
    ]);
  });

  it("reports missing, unknown and out-of-order tools", () => {
    const [first, second] = expectedEntries("medical");
    const source = [
      "tools:",
      "  # stride-tools:start",
      `  - ${second}`,
      '  - {"type":"custom","name":"run_sql"}',
      "  # stride-tools:end",
    ].join("\n");
    expect(agentToolProblems("medical", source, [first, second])).toEqual([
      "managed-agents/agents/medical.md: read_athlete_context is missing",
      "managed-agents/agents/medical.md: read_health_reports is out of order",
      "managed-agents/agents/medical.md: run_sql is not in the registry",
    ]);
    expect(agentToolProblems("medical", "tools: []")).toEqual([
      "managed-agents/agents/medical.md: the stride-tools markers are missing",
    ]);
  });

  it("reports duplicated entries and custom tools written outside the markers", () => {
    const [first, second] = expectedEntries("medical");
    const source = [
      "tools:",
      "  - type: custom",
      "    name: read_secrets",
      "    description: Hand-written.",
      "  # stride-tools:start",
      `  - ${first}`,
      `  - ${second}`,
      `  - ${second}`,
      "  # stride-tools:end",
      '  - {"type":"custom","name":"run_sql"}',
      "  - type: mcp_toolset",
    ].join("\n");
    expect(agentToolProblems("medical", source, [first, second])).toEqual([
      "managed-agents/agents/medical.md: read_secrets is declared outside the stride-tools markers",
      "managed-agents/agents/medical.md: run_sql is declared outside the stride-tools markers",
      "managed-agents/agents/medical.md: read_health_reports is duplicated",
    ]);
  });

  it("regenerates only the block between the markers", () => {
    const source = [
      "tools:",
      "  - type: agent_toolset_20260401",
      "  # stride-tools:start",
      "  - {}",
      "  # stride-tools:end",
      "  - type: mcp_toolset",
    ].join("\n");
    const synced = syncAgentSource("medical", source);
    expect(synced.split("\n")).toEqual([
      "tools:",
      "  - type: agent_toolset_20260401",
      "  # stride-tools:start",
      ...expectedEntries("medical").map((entry) => `  - ${entry}`),
      "  # stride-tools:end",
      "  - type: mcp_toolset",
    ]);
    expect(agentToolProblems("medical", synced)).toEqual([]);
  });
});
