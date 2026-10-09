import "server-only";
import { z } from "zod";

export const aiModel = "deepseek-v4.1-flash";
const endpoint = "https://opencode.ai/zen/go/v1/chat/completions";

const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export type AiUsage = { promptTokens: number; completionTokens: number };
export type AiCompletion =
  | { ok: true; content: string; usage: AiUsage | null }
  | { ok: false; reason: "unconfigured" | "failed" };

export function aiConfigured() {
  return Boolean(process.env.OPENCODE_API_KEY);
}

export async function completeJson({
  system,
  user,
  maxTokens,
  send = fetch,
}: {
  system: string;
  user: string;
  maxTokens: number;
  send?: typeof fetch;
}): Promise<AiCompletion> {
  const key = process.env.OPENCODE_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };
  try {
    const response = await send(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "Stride/0.1",
        "x-opencode-session": crypto.randomUUID(),
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: maxTokens,
        temperature: 0.3,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, reason: "failed" };
    const parsed = completionSchema.safeParse(await response.json());
    const content = parsed.success
      ? parsed.data.choices[0].message.content
      : null;
    if (!parsed.success || !content) return { ok: false, reason: "failed" };
    const usage = parsed.data.usage;
    return {
      ok: true,
      content,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          }
        : null,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
