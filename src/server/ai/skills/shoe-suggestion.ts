import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  shoeSuggestion,
  shoeSuggestionSchema,
  type ShoeSuggestion,
} from "@/features/gear/suggestion";

export const shoeSuggestionModel = "claude-haiku-5-5";

const system = [
  "Tu aides un coureur à décrire une paire de chaussures de course à partir de son nom.",
  "Si tu connais la gamme mais pas cette version précise (par exemple une version sortie récemment), décris la gamme et réponds known: true. Si tu ne reconnais ni le modèle ni la gamme, réponds known: false et laisse les autres champs à null. N’invente pas de modèle.",
  "brand : la marque. model : le nom du modèle sans la marque ni la version. version : le numéro ou la génération, ou null.",
  "category : daily (paire de tous les jours), tempo (rapide pour les séances, plaque ou non), race (compétition, plaque carbone) ou recovery (amorti maximal pour les sorties lentes).",
  "terrain : road, trail ou mixed (route et chemins).",
  "description : une seule phrase en français, 20 mots au plus, qui dit à quoi sert la paire et ce qu’on ressent en la portant. Pas de chiffres ni de caractéristiques techniques.",
].join("\n");

let client: Anthropic | null = null;

function anthropic() {
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
}

export type SuggestionResult =
  | { status: "suggested"; suggestion: ShoeSuggestion }
  | { status: "unknown" | "unavailable" };

export async function suggestShoeFromName(
  name: string,
): Promise<SuggestionResult> {
  const started = Date.now();
  let result: SuggestionResult = { status: "unavailable" };
  let usage: { input_tokens: number; output_tokens: number } | null = null;
  try {
    const response = await anthropic().messages.parse({
      model: shoeSuggestionModel,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: name }],
      output_config: {
        effort: "low",
        format: zodOutputFormat(shoeSuggestionSchema),
      },
    });
    usage = response.usage;
    if (response.stop_reason !== "refusal" && response.parsed_output) {
      const suggestion = shoeSuggestion(response.parsed_output);
      result = suggestion
        ? { status: "suggested", suggestion }
        : { status: "unknown" };
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError)
      console.warn(
        JSON.stringify({
          event: "ai.skill.error",
          skill: "shoe-suggestion",
          status: error.status ?? null,
        }),
      );
  }
  console.info(
    JSON.stringify({
      event: "ai.skill",
      skill: "shoe-suggestion",
      model: shoeSuggestionModel,
      outcome: result.status,
      promptTokens: usage?.input_tokens ?? null,
      completionTokens: usage?.output_tokens ?? null,
      durationMs: Date.now() - started,
    }),
  );
  return result;
}
