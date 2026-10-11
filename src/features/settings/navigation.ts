export const settingsSections = [
  { slug: "", label: "Vue d’ensemble", group: "You" },
  { slug: "profile", label: "Profil", group: "You" },
  { slug: "training", label: "Entraînement et coach", group: "You" },
  { slug: "goals", label: "Objectifs et courses", group: "You" },
  { slug: "connections", label: "Connexions", group: "Data" },
  { slug: "privacy", label: "Données et confidentialité", group: "Data" },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["slug"];

export function settingsHref(slug: SettingsSection) {
  return slug ? `/settings/${slug}` : "/settings";
}
