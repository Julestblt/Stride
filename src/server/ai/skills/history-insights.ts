import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { InsightFact, InsightFactKey } from "@/features/insights/facts";
import { aiModel, completeJson, type AiCompletion } from "../provider";

export type PhrasedInsight = {
  key: InsightFactKey;
  text: string;
  source: string;
  origin: "ai" | "facts";
};

const system = [
  "Tu es Stride, un coach de course à pied.",
  "Tu découvres un athlète à partir de constats déjà calculés sur ses données Garmin.",
  "Reformule chaque constat avec tes mots, comme un coach qui le remarque : ne recopie pas la phrase, garde les mêmes valeurs.",
  "Tu peux ajouter une courte nuance qualitative sans chiffre si elle découle directement du constat.",
  "Règles : une phrase par constat, 140 caractères maximum, tutoiement, ton sobre et chaleureux, aucun conseil, aucune promesse, aucun diagnostic.",
  "Garde exactement le sens de chaque constat : l’entraînement inclut le renfo et les autres sports, ne le transforme pas en course.",
  "N’ajoute aucun chiffre absent du constat. Aucun pourcentage.",
  'Réponds uniquement en JSON : {"items":[{"key":"…","text":"…"}]} avec les mêmes clés.',
].join("\n");

const outputSchema = z.object({
  items: z
    .array(z.object({ key: z.string(), text: z.string().min(8).max(180) }))
    .max(8),
});

export const aiCooldownMs = 10 * 60_000;
const cache = new Map<string, { hash: string; items: PhrasedInsight[] }>();
const lastCall = new Map<string, number>();

function numbers(text: string) {
  return (
    text
      .replace(/(\d)[\s\u202f\u00a0](?=\d{3}(?!\d))/g, "$1")
      .replace(/(\d),(\d)/g, "$1.$2")
      .match(/\d+(?:\.\d+)?/g) ?? []
  );
}

export function acceptPhrasing(
  facts: InsightFact[],
  content: string,
): Map<InsightFactKey, string> {
  const accepted = new Map<InsightFactKey, string>();
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return accepted;
  }
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return accepted;
  for (const item of parsed.data.items) {
    const fact = facts.find((candidate) => candidate.key === item.key);
    const text = item.text.trim();
    if (!fact || accepted.has(fact.key) || text.includes("%")) continue;
    const allowed = new Set(numbers(fact.sentence));
    if (numbers(text).every((value) => allowed.has(value)))
      accepted.set(fact.key, text);
  }
  return accepted;
}

function fromFacts(facts: InsightFact[]): PhrasedInsight[] {
  return facts.map((fact) => ({
    key: fact.key,
    text: fact.sentence,
    source: fact.source,
    origin: "facts",
  }));
}

export async function phraseHistoryInsights({
  athlete,
  facts,
  allowAi,
  complete = completeJson,
  now = Date.now(),
}: {
  athlete: string;
  facts: InsightFact[];
  allowAi: boolean;
  complete?: typeof completeJson;
  now?: number;
}): Promise<PhrasedInsight[]> {
  if (facts.length === 0) return [];
  const hash = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  const cached = cache.get(athlete);
  if (cached?.hash === hash) return cached.items;
  if (!allowAi || now - (lastCall.get(athlete) ?? -Infinity) < aiCooldownMs)
    return fromFacts(facts);
  lastCall.set(athlete, now);
  const started = Date.now();
  const result: AiCompletion = await complete({
    system,
    user: JSON.stringify({
      constats: facts.map((fact) => ({
        key: fact.key,
        constat: fact.sentence,
      })),
    }),
    maxTokens: 400,
  });
  const accepted = result.ok
    ? acceptPhrasing(facts, result.content)
    : new Map<InsightFactKey, string>();
  console.info(
    JSON.stringify({
      event: "ai.skill",
      skill: "history-insights",
      model: aiModel,
      outcome: result.ok ? "completed" : result.reason,
      accepted: accepted.size,
      facts: facts.length,
      promptTokens: result.ok ? (result.usage?.promptTokens ?? null) : null,
      completionTokens: result.ok
        ? (result.usage?.completionTokens ?? null)
        : null,
      durationMs: Date.now() - started,
    }),
  );
  const items = facts.map((fact): PhrasedInsight => {
    const text = accepted.get(fact.key);
    return text
      ? { key: fact.key, text, source: fact.source, origin: "ai" }
      : {
          key: fact.key,
          text: fact.sentence,
          source: fact.source,
          origin: "facts",
        };
  });
  if (result.ok) cache.set(athlete, { hash, items });
  return items;
}

export function resetHistoryInsightsCache() {
  cache.clear();
  lastCall.clear();
}
