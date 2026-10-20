import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { groundedSpec, type PageSpec } from "@/features/gear/product-page";

export const shoeSpecModel = "claude-haiku-5-5";

const quoted = <T extends z.ZodType>(value: T) =>
  z.object({ value, evidence: z.string() }).nullable();

const extractionSchema = z.object({
  fields: z.object({
    brand: quoted(z.string()),
    model: quoted(z.string()),
    version: quoted(z.string()),
    category: quoted(z.enum(["daily", "tempo", "race", "trail", "recovery"])),
    terrain: quoted(z.enum(["road", "trail", "mixed", "track"])),
    foam: quoted(z.string()),
    stackHeelMm: quoted(z.number()),
    stackForefootMm: quoted(z.number()),
    dropMm: quoted(z.number()),
    weightG: quoted(z.number()),
    plate: quoted(z.enum(["none", "nylon", "tpu", "carbon"])),
    lugDepthMm: quoted(z.number()),
  }),
});

const system = [
  "Tu lis la page produit d’une chaussure de course à pied et tu remplis sa fiche technique.",
  "Pour chaque champ, renvoie value et evidence. evidence est un extrait copié mot pour mot de la page, de 2 à 120 caractères, qui contient la valeur.",
  "Si la page ne donne pas une valeur, renvoie null pour ce champ. N’invente rien et ne complète pas avec tes connaissances.",
  "brand : la marque. model : le nom du modèle sans la marque ni le numéro de version. version : le numéro ou la génération (par exemple 7 ou v3), ou null.",
  "category : daily (entraînement quotidien), tempo (quotidienne rapide, séances), race (compétition, souvent avec plaque), trail ou recovery (amorti maximal pour récupérer).",
  "terrain : road, trail, mixed ou track.",
  "foam : le nom de la mousse. stackHeelMm et stackForefootMm : hauteurs en mm. dropMm : le drop en mm. weightG : le poids en grammes. lugDepthMm : la profondeur des crampons en mm.",
  "plate : none, nylon, tpu ou carbon, seulement si la page parle de la plaque.",
].join("\n");

let client: Anthropic | null = null;

function anthropic() {
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return client;
}

type Outcome = "accepted" | "refused" | "failed";

export async function extractShoeSpec(text: string): Promise<PageSpec | null> {
  const started = Date.now();
  let outcome: Outcome = "failed";
  let spec: PageSpec | null = null;
  let usage: { input_tokens: number; output_tokens: number } | null = null;
  try {
    const response = await anthropic().messages.parse({
      model: shoeSpecModel,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: text }],
      output_config: {
        effort: "low",
        format: zodOutputFormat(extractionSchema),
      },
    });
    usage = response.usage;
    if (response.stop_reason === "refusal") outcome = "refused";
    else if (response.parsed_output) {
      spec = groundedSpec(response.parsed_output, text);
      outcome = "accepted";
    }
  } catch (error) {
    outcome = "failed";
    if (error instanceof Anthropic.APIError)
      console.warn(
        JSON.stringify({
          event: "ai.skill.error",
          skill: "shoe-spec-extraction",
          status: error.status ?? null,
        }),
      );
  }
  console.info(
    JSON.stringify({
      event: "ai.skill",
      skill: "shoe-spec-extraction",
      model: shoeSpecModel,
      outcome,
      fields: spec ? Object.keys(spec).length : 0,
      promptTokens: usage?.input_tokens ?? null,
      completionTokens: usage?.output_tokens ?? null,
      durationMs: Date.now() - started,
    }),
  );
  return spec;
}
