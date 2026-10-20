import { z } from "zod";
import { shoeCategories, shoeTerrains } from "./model";

export const shoeSuggestionSchema = z.object({
  known: z.boolean(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  version: z.string().nullable(),
  category: z.enum(shoeCategories).nullable(),
  terrain: z.enum(shoeTerrains).nullable(),
  description: z.string().nullable(),
});

export type ShoeSuggestion = {
  brand: string | null;
  model: string | null;
  version: string | null;
  category: (typeof shoeCategories)[number] | null;
  terrain: (typeof shoeTerrains)[number] | null;
  description: string | null;
};

function clean(value: string | null, max: number) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text && text.length <= max ? text : null;
}

export function shoeSuggestion(
  raw: z.output<typeof shoeSuggestionSchema>,
): ShoeSuggestion | null {
  if (!raw.known) return null;
  const description = clean(raw.description, 240);
  const suggestion = {
    brand: clean(raw.brand, 60),
    model: clean(raw.model, 80),
    version: clean(raw.version, 20),
    category: raw.category,
    terrain: raw.terrain,
    description:
      description && !/[.!?…]$/.test(description)
        ? `${description}.`
        : description,
  };
  return suggestion.category || suggestion.terrain || suggestion.description
    ? suggestion
    : null;
}
