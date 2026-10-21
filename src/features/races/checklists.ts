import { z } from "zod";

export const checklistLists = [
  "gear_mandatory",
  "gear_night",
  "gear_weather",
  "gear_kit",
  "gear_forbidden",
  "nutrition_tested",
  "key_sessions",
  "prep_week",
  "prep_eve",
  "prep_race_day",
] as const;
export type ChecklistList = (typeof checklistLists)[number];

export const itemStatuses = [
  "ready",
  "check",
  "buy",
  "test",
  "weather",
  "forbidden",
] as const;
export type ItemStatus = (typeof itemStatuses)[number];

export const statusLabels: Record<ItemStatus, string> = {
  ready: "Prêt",
  check: "À vérifier",
  buy: "À acheter",
  test: "À tester",
  weather: "Selon météo",
  forbidden: "Interdit",
};

export const gearLists = [
  "gear_mandatory",
  "gear_night",
  "gear_weather",
  "gear_kit",
  "gear_forbidden",
] as const satisfies readonly ChecklistList[];

export const prepLists = [
  "prep_week",
  "prep_eve",
  "prep_race_day",
] as const satisfies readonly ChecklistList[];

export const listTitles: Record<ChecklistList, string> = {
  gear_mandatory: "Obligatoire",
  gear_night: "Pour la nuit",
  gear_weather: "Selon la météo",
  gear_kit: "Chaussures et sac",
  gear_forbidden: "Interdit",
  nutrition_tested: "Ce que tu as déjà testé",
  key_sessions: "Séances clés pour cette course",
  prep_week: "J-7",
  prep_eve: "J-1",
  prep_race_day: "Jour J",
};

export type ChecklistItem = {
  id: string;
  list: ChecklistList;
  label: string;
  detail: string | null;
  status: ItemStatus | null;
  checked: boolean;
  startDate: string | null;
  endDate: string | null;
  position: number;
  revision: number;
  shoeId: string | null;
};

export const checklistColumns =
  "id, list, label, detail, status, checked, start_date, end_date, position, revision, shoe_id";

export const checklistRowSchema = z
  .object({
    id: z.uuid(),
    list: z.enum(checklistLists),
    label: z.string(),
    detail: z.string().nullable(),
    status: z.enum(itemStatuses).nullable(),
    checked: z.boolean(),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    position: z.number().int(),
    revision: z.number().int().positive(),
    shoe_id: z.uuid().nullable().catch(null),
  })
  .transform((row): ChecklistItem => ({
    id: row.id,
    list: row.list,
    label: row.label,
    detail: row.detail,
    status: row.status,
    checked: row.checked,
    startDate: row.start_date,
    endDate: row.end_date,
    position: row.position,
    revision: row.revision,
    shoeId: row.shoe_id ?? null,
  }));

export const checklistInputSchema = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(240).nullable(),
  status: z.enum(itemStatuses).nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
});
export type ChecklistInput = z.infer<typeof checklistInputSchema>;

type Template = { label: string; detail?: string; status?: ItemStatus };

export const checklistTemplates: Partial<Record<ChecklistList, Template[]>> = {
  gear_mandatory: [
    {
      label: "Frontale + batterie de rechange",
      detail: "Autonomie suffisante pour toute la partie de nuit.",
      status: "check",
    },
    { label: "Réserve d’eau 1 L minimum", status: "check" },
    { label: "Gobelet réutilisable", status: "check" },
    { label: "Couverture de survie", status: "check" },
    { label: "Sifflet", status: "check" },
    {
      label: "Téléphone chargé",
      detail: "Numéro de l’organisation enregistré.",
      status: "check",
    },
    { label: "Veste imperméable", status: "check" },
    {
      label: "Réserve alimentaire",
      detail: "Voir l’onglet Nutrition.",
      status: "check",
    },
  ],
  gear_night: [
    { label: "Lampe de secours", status: "check" },
    { label: "Haut manches longues", status: "check" },
    { label: "Gants légers + bandeau", status: "check" },
  ],
  prep_week: [
    { label: "Dernière sortie longue courte, rien de plus" },
    { label: "Tester la tenue complète" },
    { label: "Imprimer le roadbook et la fiche nutrition" },
    { label: "Vérifier les prévisions météo" },
  ],
  prep_eve: [
    { label: "Retrait du dossard" },
    { label: "Charger frontale, montre, batterie, téléphone" },
    { label: "Préparer les gels par tronçon dans des sachets" },
    { label: "Course .fit chargée sur la montre" },
  ],
  prep_race_day: [
    { label: "Petit-déjeuner 3 h avant le départ" },
    { label: "Tenue adaptée à la météo du départ" },
    { label: "Alarme nutrition réglée sur la montre" },
    { label: "Partir plus lentement que l’allure prévue" },
  ],
};

const roadPreparationTemplates: Partial<Record<ChecklistList, Template[]>> = {
  prep_week: [
    { label: "Vérifier le lieu et l’heure du départ" },
    { label: "Prévoir le trajet et le stationnement" },
    { label: "Tester la tenue et les chaussures de course" },
    { label: "Vérifier les prévisions météo" },
  ],
  prep_eve: [
    { label: "Retirer le dossard ou préparer la confirmation d’inscription" },
    { label: "Préparer dossard, épingles, tenue et chaussures" },
    { label: "Charger la montre et le téléphone" },
    { label: "Confirmer le trajet vers le départ" },
  ],
  prep_race_day: [
    { label: "Prendre un petit-déjeuner déjà testé" },
    { label: "Prévoir le temps d’échauffement" },
    { label: "Vérifier la météo et adapter la tenue" },
    { label: "Rejoindre le sas de départ à temps" },
  ],
};

export function checklistTemplateFor(
  kind: "road" | "trail",
  list: ChecklistList,
) {
  return kind === "road"
    ? roadPreparationTemplates[list]
    : checklistTemplates[list];
}

export function gearReadiness(items: ChecklistItem[]) {
  const counted = items.filter(
    (item) => item.list !== "gear_forbidden" && item.status !== "weather",
  );
  return {
    ready: counted.filter((item) => item.checked).length,
    total: counted.length,
  };
}

export function gearSummary(items: ChecklistItem[]) {
  const missing = items.filter(
    (item) => item.status === "buy" && !item.checked,
  );
  const testing = items.filter(
    (item) => item.status === "test" && !item.checked,
  );
  const checking = items.filter(
    (item) => item.status === "check" && !item.checked,
  );
  return { missing, testing, checking };
}
