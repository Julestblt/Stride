import { z } from "zod";
import { staffAgents } from "./staff";

const agent = z.enum(staffAgents);
export const itemTextLimit = 7000;

const text = z.string().max(itemTextLimit);

export const proposalScopes = ["new_plan", "session"] as const;

export const opinionSchema = z.object({
  agent,
  verdict: z.string().max(200),
  summary: z.string().max(2000),
});

const bodies = {
  athlete: z.object({ text, consult: agent.nullable().catch(null) }),
  answer: z.object({ toolUseId: z.string(), text }),
  coach: z.object({ text }),
  consult_request: z.object({ thread: z.string(), agent, text }),
  consult_reply: z.object({ thread: z.string(), agent, text }),
  consult_note: z.object({ thread: z.string(), agent, text }),
  consult_end: z.object({ thread: z.string(), agent }),
  read: z.object({
    thread: z.string(),
    agent,
    tool: z.string(),
    label: z.string(),
  }),
  question: z.object({
    toolUseId: z.string(),
    question: text,
    options: z.array(z.string().max(80)).max(5).default([]).catch([]),
    askedFor: agent,
  }),
  proposal: z.object({
    proposalId: z.uuid(),
    scope: z.enum(proposalScopes),
    title: z.string(),
    summary: text.nullable(),
    opinions: z.array(opinionSchema).catch([]),
  }),
  error: z.object({
    code: z.enum(["timeout", "budget_reached", "failed"]),
    text,
  }),
} as const;

export type ThreadItemKind = keyof typeof bodies;

export const threadItemKinds = Object.keys(bodies) as ThreadItemKind[];

export type ThreadItem = {
  [Kind in ThreadItemKind]: { kind: Kind; at: string } & z.output<
    (typeof bodies)[Kind]
  >;
}[ThreadItemKind];

export type ItemOf<Kind extends ThreadItemKind> = Extract<
  ThreadItem,
  { kind: Kind }
>;

export type ProposalOpinion = z.output<typeof opinionSchema>;

export function parseThreadItem(row: {
  kind: string;
  body: unknown;
  created_at: string;
}): ThreadItem | null {
  if (!(row.kind in bodies)) return null;
  const kind = row.kind as ThreadItemKind;
  const parsed = bodies[kind].safeParse(row.body);
  if (!parsed.success) return null;
  return { kind, at: row.created_at, ...parsed.data } as ThreadItem;
}

export function clampItem(item: ThreadItem): ThreadItem {
  const clamped: Record<string, unknown> = { ...item };
  for (const key of ["text", "question", "summary"])
    if (typeof clamped[key] === "string")
      clamped[key] = (clamped[key] as string).slice(0, itemTextLimit);
  return clamped as ThreadItem;
}

export function itemBody(item: ThreadItem): Record<string, unknown> {
  const body: Record<string, unknown> = { ...item };
  delete body.kind;
  delete body.at;
  return body;
}
