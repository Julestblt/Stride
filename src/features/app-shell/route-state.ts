const sectionLabels: Record<string, string> = {
  today: "Aujourd’hui",
  coach: "Coach",
  plan: "Plan",
  activities: "Activités",
  progress: "Progression",
  races: "Courses",
  gear: "Matériel",
  nutrition: "Nutrition",
  notifications: "Notifications",
  settings: "Réglages",
};

export function appSectionLabel(pathname: string) {
  return sectionLabels[pathname.split("/")[1] ?? ""] ?? "Stride";
}

export type MissingItem =
  "activity" | "race" | "pair" | "conversation" | "page";

export const missingItems: Record<
  MissingItem,
  {
    title: string;
    message: string;
    action: { href: string; label: string } | null;
  }
> = {
  activity: {
    title: "Activité introuvable",
    message: "Cette activité n’existe pas ou n’est plus dans ton historique.",
    action: { href: "/activities", label: "Voir mes activités" },
  },
  race: {
    title: "Course introuvable",
    message:
      "Cette course n’existe pas ou ne fait plus partie de tes objectifs.",
    action: { href: "/races", label: "Voir mes courses" },
  },
  pair: {
    title: "Paire introuvable",
    message: "Cette paire n’existe pas ou a été retirée de ton matériel.",
    action: { href: "/gear", label: "Voir mon matériel" },
  },
  conversation: {
    title: "Conversation introuvable",
    message: "Cette conversation n’existe pas ou a été supprimée.",
    action: { href: "/coach", label: "Voir mes conversations" },
  },
  page: {
    title: "Page introuvable",
    message: "Le lien est peut-être périmé, ou la page a été déplacée.",
    action: null,
  },
};
