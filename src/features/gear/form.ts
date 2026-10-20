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

export function gearErrorMessage(result: GearActionResult) {
  switch (result.status) {
    case "saved":
      return "";
    case "invalid":
      return "Vérifie les champs en rouge.";
    case "session-expired":
      return "Ta session a expiré. Reconnecte-toi puis réessaie.";
    case "reconnect":
      return "Garmin demande une reconnexion : va dans Réglages › Connexions.";
    case "not-found":
      return "Cette paire n’existe plus dans Garmin. Recharge la page.";
    case "garmin-unavailable":
      return "Garmin ne répond pas. Rien n’a été enregistré, réessaie dans un instant.";
    case "error":
      return "L’enregistrement a échoué. Réessaie.";
  }
}
