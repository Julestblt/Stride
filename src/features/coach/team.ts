import { zonedEpoch } from "@/features/races/sun";
import type { SpecialistAgent, StaffAgent, StaffMember } from "./staff";

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
      `${member.feminine ? "Ta première interlocutrice" : "Ton premier interlocuteur"}. ${member.pronoun} construit et adapte ton plan, répond à tes questions et passe la main au bon spécialiste quand ta demande le nécessite.`,
    listTitle: "Son rôle",
    duties: () => [
      "Lit chaque message et passe la main au bon spécialiste",
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
  director: {
    tagline: "Directeur sportif",
    summary: () =>
      "Ta saison dans son ensemble : le rôle de chaque course, l'espacement entre elles et ce qui est réaliste sur l'année.",
    listTitle: "Consulté quand",
    duties: () => [
      "Tu ajoutes, retires ou changes une course",
      "Un objectif semble hors de portée",
      "Deux courses se rapprochent trop",
    ],
    reads: ["Courses", "Plan", "Charge", "Faisabilité"],
  },
  strategist: {
    tagline: "Stratège de course",
    summary: () =>
      "Le parcours, ton objectif sur ce parcours et ta gestion de course : allures, montées, nuit et ravitaillements.",
    listTitle: "Consulté quand",
    duties: () => [
      "Tu parles du parcours ou de ton objectif",
      "Tu prépares ton allure de course",
      "La météo change la semaine de course",
    ],
    reads: ["Profil du parcours", "Météo", "Seuils", "Résultats"],
  },
  nutritionist: {
    tagline: "Nutritionniste",
    summary: () =>
      "Énergie et glucides selon tes séances, charge glucidique avant course et ravitaillement pendant l'effort.",
    listTitle: "Consulté quand",
    duties: () => [
      "Tu demandes quoi manger avant ou après une séance",
      "Les jours avant une course longue",
      "Tu prépares ton plan de ravitaillement",
    ],
    reads: ["Profil", "Séances prévues", "Calories actives"],
  },
};

export type StaffUsage = {
  conversations: number;
  opinions: Record<SpecialistAgent, number>;
};

export function monthStart(now: Date, timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  return new Date(zonedEpoch(`${today.slice(0, 8)}01`, 0, timeZone));
}

export function conversationsLabel(count: number) {
  return count === 1 ? "conversation ce mois" : "conversations ce mois";
}

export const opinionsLabel = "avis ce mois";
