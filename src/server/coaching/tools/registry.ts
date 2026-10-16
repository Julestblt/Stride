import "server-only";
import { z } from "zod";
import { readActivePlanTool } from "./active-plan";
import { askAthleteTool } from "./ask-athlete";
import { readAthleteContextTool } from "./athlete-context";
import type { CoachingTool, ToolContext } from "./define";
import { ToolError, toolError, type ToolErrorBody } from "./errors";
import { readHealthReportsTool } from "./health-reports";
import { readPlanHistoryTool } from "./plan-history";
import { readPlanProgressTool } from "./plan-progress";
import { createPlanProposalTool } from "./plan-proposal";
import { submitPlanTool } from "./submit-plan";

export type RegisteredTool = Omit<CoachingTool, "run"> & {
  run?: (context: ToolContext, input: never) => Promise<unknown>;
};

export const coachingTools = [
  readAthleteContextTool,
  submitPlanTool,
  readActivePlanTool,
  readPlanProgressTool,
  readPlanHistoryTool,
  readHealthReportsTool,
  askAthleteTool,
  createPlanProposalTool,
] as const satisfies readonly RegisteredTool[];

export type CoachingToolName = (typeof coachingTools)[number]["name"];

export const agentTools = {
  coach: [
    "read_athlete_context",
    "submit_plan",
    "read_active_plan",
    "read_plan_progress",
    "read_plan_history",
    "read_health_reports",
    "ask_athlete",
    "create_plan_proposal",
  ],
  medical: ["read_athlete_context", "read_health_reports"],
} as const satisfies Record<string, readonly CoachingToolName[]>;

export type AgentName = keyof typeof agentTools;

export type ToolOutcome = { ok: boolean; content: unknown };

const registry = new Map<string, RegisteredTool>(
  coachingTools.map((tool) => [tool.name, tool]),
);

export function toolAllowed(agent: AgentName, name: string) {
  return (agentTools[agent] as readonly string[]).includes(name);
}

export function findTool(name: string) {
  return registry.get(name);
}

function issuesOf(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function parseToolInput<Input extends z.ZodType>(
  tool: { input: Input },
  input: unknown,
): z.output<Input> {
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) throw toolError("invalid_input", issuesOf(parsed.error));
  return parsed.data;
}

function failure(body: ToolErrorBody): ToolOutcome {
  return { ok: false, content: body };
}

export async function runCustomTool(
  context: ToolContext,
  name: string,
  input: unknown,
): Promise<ToolOutcome> {
  const tool = registry.get(name);
  if (!tool) return failure(toolError("unknown_tool").toBody());
  try {
    if (!tool.run) throw new Error(`${name} is handled by the session`);
    const result = await tool.run(
      context,
      parseToolInput(tool, input) as never,
    );
    const output = tool.output.safeParse(result);
    if (!output.success) {
      console.error("Coaching tool output failed its schema", {
        tool: name,
        issues: issuesOf(output.error),
      });
      return failure(toolError("tool_unavailable").toBody());
    }
    return { ok: true, content: output.data };
  } catch (error) {
    if (error instanceof ToolError) return failure(error.toBody());
    console.error("Coaching tool failed", {
      tool: name,
      error: error instanceof Error ? error.message : "unknown",
    });
    return failure(toolError("tool_unavailable").toBody());
  }
}
