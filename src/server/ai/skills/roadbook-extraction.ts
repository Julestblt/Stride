import "server-only";
import {
  shapeCandidates,
  type RoadbookCandidate,
} from "@/features/races/roadbook";
import { aiModel, completeJson } from "../provider";

const maximumCharacters = 24_000;

const system = [
  "Tu extrais les points de passage d’un roadbook de course à pied.",
  "Tu ne gardes que les ravitaillements, points d’eau, bases de vie, sommets, zones de vigilance et consignes de parcours qui ont un kilomètre écrit dans le texte.",
  "N’invente aucun point, aucun kilomètre et aucune heure : chaque valeur doit figurer dans le texte.",
  "kind vaut aid, water, base, summit, caution ou instruction. cutoff est l’heure limite de passage au format HH:MM, ou null.",
  "services est une liste parmi water, sweet, salty, hot, toilets, assistance, seulement si le texte les cite.",
  "Ignore le départ et l’arrivée.",
  'Réponds uniquement en JSON : {"points":[{"name":"…","km":16.7,"kind":"aid","cutoff":null,"services":["water"]}]}.',
].join("\n");

export async function extractRoadbookWithAi(
  text: string,
): Promise<RoadbookCandidate[] | null> {
  const started = Date.now();
  const result = await completeJson({
    system,
    user: text.slice(0, maximumCharacters),
    maxTokens: 2500,
  });
  let candidates: RoadbookCandidate[] | null = null;
  if (result.ok)
    try {
      candidates = shapeCandidates(JSON.parse(result.content));
    } catch {
      candidates = null;
    }
  console.info(
    JSON.stringify({
      event: "ai.skill",
      skill: "roadbook-extraction",
      model: aiModel,
      outcome: result.ok
        ? candidates
          ? "accepted"
          : "rejected"
        : result.reason,
      points: candidates?.length ?? 0,
      promptTokens: result.ok ? (result.usage?.promptTokens ?? null) : null,
      completionTokens: result.ok
        ? (result.usage?.completionTokens ?? null)
        : null,
      durationMs: Date.now() - started,
    }),
  );
  return candidates;
}
