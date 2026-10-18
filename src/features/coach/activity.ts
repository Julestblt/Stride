import type { StaffMember } from "./staff";

export const composingThresholdMs = 20_000;

export const longWriteNote =
  "Un plan détaillé peut prendre quelques minutes. Tu peux quitter la page : le staff continue et sa réponse t’attendra ici.";

export type WorkingLabel = {
  text: string;
  since: string | null;
  writing: boolean;
};

export function workingLabel(
  member: StaffMember,
  composingSince: string | null,
  now: Date,
): WorkingLabel {
  const elapsed =
    composingSince === null ? 0 : now.getTime() - Date.parse(composingSince);
  if (!(elapsed >= composingThresholdMs))
    return { text: `${member.name} réfléchit…`, since: null, writing: false };
  const minutes = Math.floor(elapsed / 60_000);
  return {
    text: `${member.name} rédige sa réponse…`,
    since: minutes >= 1 ? `depuis ${minutes} min` : null,
    writing: true,
  };
}
