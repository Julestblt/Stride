import {
  isAnswered,
  profileFields,
  type ProfileValues,
} from "@/features/onboarding/profile";
import { displayTimeZone } from "@/features/app-shell/shell";
import type { AthleteProfileView } from "@/features/onboarding/athlete-profile";

export type AthleteModelShares = {
  garmin: number;
  athlete: number;
  estimate: number;
  openQuestions: number;
};

export function athleteModelShares(
  view: AthleteProfileView,
  values: ProfileValues,
): AthleteModelShares {
  const facts = view.sections.flatMap((section) => section.facts);
  const observed = facts.filter((fact) => fact.value !== null);
  const garmin = observed.filter((fact) => fact.source === "garmin").length;
  const athlete = observed.filter((fact) => fact.source === "athlete").length;
  const estimate =
    facts.length -
    observed.length +
    (view.heartRateZones ? 1 : 0) +
    view.habits.items.length;
  const total = garmin + athlete + estimate;
  const garminShare = total === 0 ? 0 : Math.round((garmin / total) * 100);
  const athleteShare = total === 0 ? 0 : Math.round((athlete / total) * 100);
  const missingFocus = facts.some(
    (fact) => fact.key === "focus" && fact.value === null,
  );
  return {
    garmin: garminShare,
    athlete: athleteShare,
    estimate: 100 - garminShare - athleteShare,
    openQuestions:
      profileFields.filter((field) => !isAnswered(values, field)).length +
      (missingFocus ? 1 : 0),
  };
}

const memberSince = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: displayTimeZone,
});

export function formatMemberSince(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : memberSince.format(date);
}
