import type { GearActionResult } from "@/server/gear/actions";

export function parseKm(text: string): number | null {
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 5000 ? value : null;
}

export function parseOptionalNumber(
  text: string,
  min: number,
  max: number,
): number | null | undefined {
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function parseShoeSize(text: string): number | null | undefined {
  const normalized = text.trim().replace(",", ".").replace(/\s+/g, " ");
  if (normalized === "") return null;
  const fraction = /^(\d{2})(?:\s*(⅓|⅔|½|1\/3|2\/3|1\/2))?$/.exec(normalized);
  const parts: Record<string, number> = {
    "⅓": 1 / 3,
    "1/3": 1 / 3,
    "⅔": 2 / 3,
    "2/3": 2 / 3,
    "½": 0.5,
    "1/2": 0.5,
  };
  const value = fraction
    ? Number(fraction[1]) + (fraction[2] ? parts[fraction[2]] : 0)
    : Number(normalized);
  return Number.isFinite(value) && value >= 30 && value <= 52
    ? Math.round(value * 10) / 10
    : undefined;
}

const fieldLabels: Record<string, string> = {
  brand: "la marque",
  model: "le modèle",
  category: "le type",
  terrain: "le terrain",
  lifespanKm: "la durée de vie (entre 100 et 3 000 km)",
  sizeEu: "la pointure (par exemple 42 ou 42 2/3)",
  firstUse: "la date de première sortie (JJ/MM/AAAA, pas dans le futur)",
  currentKm: "le total actuel en km",
};

export function invalidFieldsMessage(keys: string[]) {
  const labels = keys.map((key) => fieldLabels[key] ?? key);
  return `À corriger : ${labels.join(", ")}.`;
}

export function gearErrorMessage(result: GearActionResult) {
  switch (result.status) {
    case "saved":
      return "";
    case "invalid":
      return "Stride n’a pas pu enregistrer ces valeurs. Recharge la page et réessaie.";
    case "session-expired":
      return "Ta session a expiré. Reconnecte-toi puis réessaie.";
    case "reconnect":
      return "Garmin demande une reconnexion : va dans Réglages › Connexions.";
    case "not-found":
      return "Cette paire n’existe plus dans Garmin. Recharge la page.";
    case "pair-too-recent":
      return "Garmin refuse : cette paire a été mise en service après la sortie. Avance sa date de première utilisation.";
    case "garmin-unavailable":
      return "Garmin ne répond pas. Rien n’a été enregistré, réessaie dans un instant.";
    case "error":
      return "L’enregistrement a échoué. Réessaie.";
  }
}
