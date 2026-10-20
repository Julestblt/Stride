import { z } from "zod";

export const shoeCategories = [
  "daily",
  "tempo",
  "race",
  "trail",
  "recovery",
] as const;
export const shoeTerrains = ["road", "trail", "mixed", "track"] as const;
export const shoePlates = ["none", "nylon", "tpu", "carbon"] as const;
export const garminDefaults = ["none", "running", "trail_running"] as const;

export type ShoeCategory = (typeof shoeCategories)[number];
export type ShoeTerrain = (typeof shoeTerrains)[number];
export type ShoePlate = (typeof shoePlates)[number];
export type GarminDefault = (typeof garminDefaults)[number];

export const categoryLabels: Record<ShoeCategory, string> = {
  daily: "Quotidienne",
  tempo: "Quotidienne rapide",
  race: "Course · plaque",
  trail: "Trail",
  recovery: "Récupération",
};

export const terrainLabels: Record<ShoeTerrain, string> = {
  road: "Route",
  trail: "Trail",
  mixed: "Route et chemins",
  track: "Piste",
};

export const plateLabels: Record<ShoePlate, string> = {
  none: "Aucune",
  nylon: "Nylon",
  tpu: "TPU",
  carbon: "Carbone",
};

export const garminDefaultLabels: Record<GarminDefault, string> = {
  none: "Aucune activité",
  running: "Course à pied",
  trail_running: "Trail",
};

export const defaultLifespanKm: Record<ShoeCategory, number> = {
  daily: 800,
  tempo: 700,
  race: 400,
  trail: 700,
  recovery: 800,
};

export const defaultTerrain: Record<ShoeCategory, ShoeTerrain> = {
  daily: "road",
  tempo: "road",
  race: "road",
  trail: "trail",
  recovery: "road",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();
const optionalNumber = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();

export const shoeSpecSchema = z.strictObject({
  brand: text(60),
  model: text(80),
  version: optionalText(20),
  category: z.enum(shoeCategories),
  terrain: z.enum(shoeTerrains),
  foam: optionalText(60),
  stackHeelMm: optionalNumber(5, 60),
  stackForefootMm: optionalNumber(5, 60),
  dropMm: optionalNumber(0, 20),
  weightG: z.number().int().min(80).max(600).nullable(),
  plate: z.enum(shoePlates).nullable(),
  lugDepthMm: optionalNumber(0, 10),
  sizeEu: optionalNumber(30, 52),
  lifespanKm: z.number().int().min(100).max(3000),
  notes: optionalText(500),
});

export type ShoeSpec = z.output<typeof shoeSpecSchema>;

export const isoDateSchema = z.iso.date();

export const newShoeSchema = z.strictObject({
  spec: shoeSpecSchema,
  currentKm: z.number().min(0).max(5000),
  firstUseDate: isoDateSchema,
  garminDefault: z.enum(garminDefaults),
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
