export const staffAgents = ["coach", "medical"] as const;

export type StaffAgent = (typeof staffAgents)[number];

export type StaffMember = {
  agent: StaffAgent;
  name: string;
  role: string;
  alt: string;
  consulted: string;
};

export const staff: Record<StaffAgent, StaffMember> = {
  coach: {
    agent: "coach",
    name: "Claire",
    role: "Coach",
    alt: "Claire, coach",
    consulted: "consultée",
  },
  medical: {
    agent: "medical",
    name: "Inès",
    role: "Médecin",
    alt: "Inès, médecin",
    consulted: "consultée",
  },
};

const managedNames: Record<string, StaffAgent> = {
  "Stride Coach": "coach",
  "Stride Medical": "medical",
};

export function agentOfManagedName(name: string | null | undefined) {
  return managedNames[name ?? ""] ?? null;
}

export function staffJoin(agents: readonly StaffAgent[]) {
  const names = agents.map((agent) => staff[agent].name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}
