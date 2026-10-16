import { z } from "zod";

export const staffAgents = ["coach", "medical"] as const;

export type StaffAgent = (typeof staffAgents)[number];

export const staffFaceOptions = {
  coach: ["claire", "thomas"],
  medical: ["ines", "karim"],
} as const satisfies Record<StaffAgent, readonly [string, string]>;

export type StaffFaces = {
  [Agent in StaffAgent]: (typeof staffFaceOptions)[Agent][number];
};

export type StaffFace = StaffFaces[StaffAgent];

export const defaultStaffFaces: StaffFaces = {
  coach: "claire",
  medical: "ines",
};

export const staffFacesSchema = z.object({
  coach: z.enum(staffFaceOptions.coach).catch(defaultStaffFaces.coach),
  medical: z.enum(staffFaceOptions.medical).catch(defaultStaffFaces.medical),
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
]);

export type StaffFaceChoice = z.output<typeof staffFaceChoiceSchema>;

const people: Record<StaffFace, { name: string; feminine: boolean }> = {
  claire: { name: "Claire", feminine: true },
  thomas: { name: "Thomas", feminine: false },
  ines: { name: "Inès", feminine: true },
  karim: { name: "Karim", feminine: false },
};

const roles: Record<StaffAgent, { role: string; title: string }> = {
  coach: { role: "Coach", title: "coach" },
  medical: { role: "Médecin", title: "médecin" },
};

export type StaffMember = {
  agent: StaffAgent;
  face: StaffFace;
  name: string;
  role: string;
  alt: string;
  consulted: string;
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
    pronoun: feminine ? "Elle" : "Il",
    feminine,
  };
}

export function staffOf(faces: StaffFaces): Staff {
  return {
    coach: staffMember("coach", faces.coach),
    medical: staffMember("medical", faces.medical),
  };
}

export const defaultStaff = staffOf(defaultStaffFaces);

export function staffFacesOf(
  row: { coach_face?: string | null; medical_face?: string | null } | null,
): StaffFaces {
  return staffFacesSchema.parse({
    coach: row?.coach_face,
    medical: row?.medical_face,
  });
}

const managedNames: Record<string, StaffAgent> = {
  "Stride Coach": "coach",
  "Stride Medical": "medical",
};

export function agentOfManagedName(name: string | null | undefined) {
  return managedNames[name ?? ""] ?? null;
}

export function staffJoin(staff: Staff, agents: readonly StaffAgent[]) {
  const names = agents.map((agent) => staff[agent].name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}
