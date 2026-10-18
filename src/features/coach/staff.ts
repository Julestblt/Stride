import { z } from "zod";

export const staffAgents = [
  "coach",
  "medical",
  "director",
  "strategist",
  "nutritionist",
] as const;

export type StaffAgent = (typeof staffAgents)[number];

export const staffFaceOptions = {
  coach: ["claire", "thomas"],
  medical: ["ines", "karim"],
  director: ["marc", "sophie"],
  strategist: ["hugo", "nadia"],
  nutritionist: ["lea", "yanis"],
} as const satisfies Record<StaffAgent, readonly [string, string]>;

export type StaffFaces = {
  [Agent in StaffAgent]: (typeof staffFaceOptions)[Agent][number];
};

export type StaffFace = StaffFaces[StaffAgent];

export const defaultStaffFaces: StaffFaces = {
  coach: "claire",
  medical: "ines",
  director: "marc",
  strategist: "hugo",
  nutritionist: "lea",
};

export const staffFacesSchema = z.object({
  coach: z.enum(staffFaceOptions.coach).catch(defaultStaffFaces.coach),
  medical: z.enum(staffFaceOptions.medical).catch(defaultStaffFaces.medical),
  director: z.enum(staffFaceOptions.director).catch(defaultStaffFaces.director),
  strategist: z
    .enum(staffFaceOptions.strategist)
    .catch(defaultStaffFaces.strategist),
  nutritionist: z
    .enum(staffFaceOptions.nutritionist)
    .catch(defaultStaffFaces.nutritionist),
});

export const staffFaceChoiceSchema = z.discriminatedUnion("agent", [
  z.strictObject({
    agent: z.literal("coach"),
    face: z.enum(staffFaceOptions.coach),
  }),
  z.strictObject({
    agent: z.literal("medical"),
    face: z.enum(staffFaceOptions.medical),
  }),
  z.strictObject({
    agent: z.literal("director"),
    face: z.enum(staffFaceOptions.director),
  }),
  z.strictObject({
    agent: z.literal("strategist"),
    face: z.enum(staffFaceOptions.strategist),
  }),
  z.strictObject({
    agent: z.literal("nutritionist"),
    face: z.enum(staffFaceOptions.nutritionist),
  }),
]);

export type StaffFaceChoice = z.output<typeof staffFaceChoiceSchema>;

const people: Record<StaffFace, { name: string; feminine: boolean }> = {
  claire: { name: "Claire", feminine: true },
  thomas: { name: "Thomas", feminine: false },
  ines: { name: "Inès", feminine: true },
  karim: { name: "Karim", feminine: false },
  marc: { name: "Marc", feminine: false },
  sophie: { name: "Sophie", feminine: true },
  hugo: { name: "Hugo", feminine: false },
  nadia: { name: "Nadia", feminine: true },
  lea: { name: "Léa", feminine: true },
  yanis: { name: "Yanis", feminine: false },
};

const roles: Record<StaffAgent, { role: string; title: string }> = {
  coach: { role: "Coach", title: "coach" },
  medical: { role: "Médecin", title: "médecin" },
  director: { role: "Directeur sportif", title: "directeur sportif" },
  strategist: { role: "Stratège de course", title: "stratège de course" },
  nutritionist: { role: "Nutritionniste", title: "nutritionniste" },
};

export type StaffMember = {
  agent: StaffAgent;
  face: StaffFace;
  name: string;
  role: string;
  alt: string;
  consulted: string;
  mentioned: string;
  pronoun: "Elle" | "Il";
  feminine: boolean;
};

export type Staff = Record<StaffAgent, StaffMember>;

export function staffMember(agent: StaffAgent, face: StaffFace): StaffMember {
  const { name, feminine } = people[face];
  return {
    agent,
    face,
    name,
    role: roles[agent].role,
    alt: `${name}, ${roles[agent].title}`,
    consulted: feminine ? "consultée" : "consulté",
    mentioned: feminine ? "mentionnée" : "mentionné",
    pronoun: feminine ? "Elle" : "Il",
    feminine,
  };
}

export function staffOf(faces: StaffFaces): Staff {
  return {
    coach: staffMember("coach", faces.coach),
    medical: staffMember("medical", faces.medical),
    director: staffMember("director", faces.director),
    strategist: staffMember("strategist", faces.strategist),
    nutritionist: staffMember("nutritionist", faces.nutritionist),
  };
}

export const defaultStaff = staffOf(defaultStaffFaces);

export const staffFaceColumns = {
  coach: "coach_face",
  medical: "medical_face",
  director: "director_face",
  strategist: "strategist_face",
  nutritionist: "nutritionist_face",
} as const satisfies Record<StaffAgent, string>;

type StaffFaceRow = Partial<
  Record<(typeof staffFaceColumns)[StaffAgent], string | null>
>;

export function staffFacesOf(row: StaffFaceRow | null): StaffFaces {
  return staffFacesSchema.parse(
    Object.fromEntries(
      staffAgents.map((agent) => [agent, row?.[staffFaceColumns[agent]]]),
    ),
  );
}

const managedNames: Record<string, StaffAgent> = {
  "Stride Coach": "coach",
  "Stride Medical": "medical",
  "Stride Sports Director": "director",
  "Stride Course Strategist": "strategist",
  "Stride Nutritionist": "nutritionist",
};

export const specialistAgents = [
  "medical",
  "director",
  "strategist",
  "nutritionist",
] as const satisfies readonly StaffAgent[];

export type SpecialistAgent = (typeof specialistAgents)[number];

export const managedNameOf: Record<StaffAgent, string> = {
  coach: "Stride Coach",
  medical: "Stride Medical",
  director: "Stride Sports Director",
  strategist: "Stride Course Strategist",
  nutritionist: "Stride Nutritionist",
};

export function agentOfManagedName(name: string | null | undefined) {
  return managedNames[name ?? ""] ?? null;
}

export function staffJoin(staff: Staff, agents: readonly StaffAgent[]) {
  const names = agents.map((agent) => staff[agent].name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

export function groupLine(staff: Staff, athlete: string | null) {
  const names = staffAgents
    .map((agent) => `${roles[agent].title} ${staff[agent].name}`)
    .join(", ");
  return athlete
    ? `Noms dans ce groupe : ${names}, athlète ${athlete}.`
    : `Noms dans ce groupe : ${names}.`;
}
