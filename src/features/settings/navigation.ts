export const settingsSections = [
  { slug: "", label: "Overview", group: "You" },
  { slug: "profile", label: "Profile", group: "You" },
  { slug: "training", label: "Training", group: "You" },
  { slug: "goals", label: "Goals and races", group: "You" },
  { slug: "connections", label: "Connections", group: "Data" },
  { slug: "privacy", label: "Data and privacy", group: "Data" },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["slug"];

export function settingsHref(slug: SettingsSection) {
  return slug ? `/settings/${slug}` : "/settings";
}
