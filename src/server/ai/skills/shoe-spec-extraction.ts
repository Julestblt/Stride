import "server-only";
import { groundedSpec, type PageSpec } from "@/features/gear/product-page";
import { aiModel, completeJson } from "../provider";

const system = [
  "Tu lis la page produit d’une chaussure de course à pied et tu remplis sa fiche technique.",
  "Pour chaque champ, renvoie value et evidence. evidence est un extrait copié mot pour mot de la page, de 2 à 120 caractères, qui contient la valeur.",
  "Si la page ne donne pas une valeur, renvoie null pour ce champ. N’invente rien et ne complète pas avec tes connaissances.",
  "brand : la marque. model : le nom du modèle sans la marque ni le numéro de version. version : le numéro ou la génération (par exemple 7 ou v3), ou null.",
  "category vaut daily (entraînement quotidien), tempo (quotidienne rapide, séances), race (compétition, souvent avec plaque), trail ou recovery (amorti maximal pour récupérer).",
  "terrain vaut road, trail, mixed ou track.",
  "foam : le nom de la mousse. stackHeelMm et stackForefootMm : hauteurs en mm. dropMm : le drop en mm. weightG : le poids en grammes. lugDepthMm : la profondeur des crampons en mm.",
  "plate vaut none, nylon, tpu ou carbon, seulement si la page parle de la plaque.",
  'Réponds uniquement en JSON : {"fields":{"brand":{"value":"HOKA","evidence":"HOKA Speedgoat 7"},"dropMm":{"value":5,"evidence":"Drop : 5 mm"},"plate":null}}.',
].join("\n");

export async function extractShoeSpec(text: string): Promise<PageSpec | null> {
  const started = Date.now();
  const result = await completeJson({ system, user: text, maxTokens: 1200 });
  let spec: PageSpec | null = null;
  if (result.ok)
    try {
      spec = groundedSpec(JSON.parse(result.content), text);
    } catch {
      spec = null;
    }
  console.info(
    JSON.stringify({
      event: "ai.skill",
      skill: "shoe-spec-extraction",
      model: aiModel,
      outcome: result.ok ? (spec ? "accepted" : "rejected") : result.reason,
      fields: spec ? Object.keys(spec).length : 0,
      promptTokens: result.ok ? (result.usage?.promptTokens ?? null) : null,
      completionTokens: result.ok
        ? (result.usage?.completionTokens ?? null)
        : null,
      durationMs: Date.now() - started,
    }),
  );
  return spec;
}
