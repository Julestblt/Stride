import { z } from "zod";

export const shoeCategories = ["daily", "tempo", "race", "recovery"] as const;
export const shoeTerrains = ["road", "trail", "mixed"] as const;
export const suggestedFields = ["category", "terrain", "description"] as const;
export const garminDefaults = ["none", "running", "trail_running"] as const;

export type ShoeCategory = (typeof shoeCategories)[number];
export type ShoeTerrain = (typeof shoeTerrains)[number];
export type SuggestedField = (typeof suggestedFields)[number];
export type GarminDefault = (typeof garminDefaults)[number];

export const categoryLabels: Record<ShoeCategory, string> = {
  daily: "Quotidienne",
  tempo: "Rapide / tempo",
  race: "Course carbone",
  recovery: "Récupération",
};

export const terrainLabels: Record<ShoeTerrain, string> = {
  road: "Route",
  trail: "Trail",
  mixed: "Mixte",
};

export const garminDefaultLabels: Record<GarminDefault, string> = {
  none: "Aucune activité",
  running: "Course à pied",
  trail_running: "Trail",
};

export function defaultLifespanKm(
  category: ShoeCategory,
  terrain: ShoeTerrain,
) {
  if (category === "race") return 400;
  if (category === "tempo" || terrain === "trail") return 700;
  return 800;
}

export function defaultGarminActivity(terrain: ShoeTerrain): GarminDefault {
  return terrain === "trail" ? "trail_running" : "running";
}

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

export const shoeSpecSchema = z.strictObject({
  brand: text(60),
  model: text(80),
  version: optionalText(20),
  category: z.enum(shoeCategories),
  terrain: z.enum(shoeTerrains),
  description: optionalText(240),
  sizeEu: z.number().min(30).max(52).nullable(),
  lifespanKm: z.number().int().min(100).max(3000),
});

export type ShoeSpec = z.output<typeof shoeSpecSchema>;

export const isoDateSchema = z.iso.date();

export const suggestedFieldsSchema = z
  .array(z.enum(suggestedFields))
  .max(12)
  .transform((fields) =>
    suggestedFields.filter((field) => fields.includes(field)),
  );

export const newShoeSchema = z.strictObject({
  spec: shoeSpecSchema,
  currentKm: z.number().min(0).max(5000),
  firstUseDate: isoDateSchema,
  garminDefault: z.enum(garminDefaults),
  suggested: suggestedFieldsSchema,
});

export type NewShoe = z.output<typeof newShoeSchema>;

export const importShoeSchema = z.strictObject({
  garminGearUuid: z.string().regex(/^[0-9a-f]{32}$/),
  brand: text(60),
  model: text(80),
  category: z.enum(shoeCategories),
  terrain: z.enum(shoeTerrains),
  lifespanKm: z.number().int().min(100).max(3000),
  currentKm: z.number().min(0).max(5000),
});

export type ImportShoe = z.output<typeof importShoeSchema>;

export const importShoesSchema = z.array(importShoeSchema).min(1).max(30);

export function garminGearName(
  spec: Pick<ShoeSpec, "brand" | "model" | "version">,
) {
  return [spec.brand, spec.model, spec.version].filter(Boolean).join(" ");
}
