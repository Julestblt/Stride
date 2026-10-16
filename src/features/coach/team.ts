import { zonedEpoch } from "@/features/races/sun";
import type { StaffAgent, StaffMember } from "./staff";

export type TeamProfile = {
  tagline: string;
  summary: (member: StaffMember) => string;
  listTitle: string;
  duties: (member: StaffMember) => readonly string[];
  reads: readonly string[];
};

export const teamProfiles: Record<StaffAgent, TeamProfile> = {
  coach: {
    tagline: "Coach · mène le staff",
    summary: (member) =>
      `${member.feminine ? "Ta seule interlocutrice" : "Ton seul interlocuteur"}. ${member.pronoun} construit et adapte ton plan, répond à tes questions et réunit le staff quand ta demande le nécessite.`,
    listTitle: "Son rôle",
    duties: (member) => [
      `Toutes tes demandes passent par ${member.feminine ? "elle" : "lui"}`,
      "Rédige chaque proposition que tu valides",
    ],
    reads: ["Plan", "Historique", "Forme du jour", "Courses"],
  },
  medical: {
    tagline: "Médecin",
    summary: (member) =>
      `Douleur, maladie, fatigue et risque de blessure. ${member.pronoun} a toujours le dernier mot quand ta santé est en jeu.`,
    listTitle: "Consulté quand",
    duties: () => [
      "Tu signales une douleur ou une maladie",
      "Ta récupération reste basse plusieurs jours",
      "Une demande touche une blessure passée",
    ],
    reads: ["Signalements", "Sommeil", "VFC", "Charge"],
  },
};

export type StaffUsage = { conversations: number; medicalOpinions: number };

export function monthStart(now: Date, timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  return new Date(zonedEpoch(`${today.slice(0, 8)}01`, 0, timeZone));
}

export function conversationsLabel(count: number) {
  return count === 1 ? "conversation ce mois" : "conversations ce mois";
}

export const opinionsLabel = "avis ce mois";
