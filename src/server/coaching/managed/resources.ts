import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import lock from "../../../../managed-agents/claude-lock.json";

const lockSchema = z.object({
  origin: z.object({ workspace_id: z.string().min(1) }),
  resources: z.object({
    "./agents/coach.md": z.object({ id: z.string().startsWith("agent_") }),
    "./environments/coaching.yaml": z.object({
      id: z.string().startsWith("env_"),
    }),
  }),
});

const parsed = lockSchema.parse(lock);

export const managedResources = {
  workspaceId: parsed.origin.workspace_id,
  coachAgentId: parsed.resources["./agents/coach.md"].id,
  environmentId: parsed.resources["./environments/coaching.yaml"].id,
  garminMcpUrl: "https://garmin-mcp.julez.cat/mcp",
};

let client: Anthropic | null = null;

export function managedClient() {
  client ??= new Anthropic();
  return client;
}

export function consoleSessionUrl(sessionId: string) {
  return `https://platform.claude.com/workspaces/${managedResources.workspaceId}/sessions/${sessionId}`;
}
