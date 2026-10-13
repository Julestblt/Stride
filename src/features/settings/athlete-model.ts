import {
  isAnswered,
  profileFields,
  type ProfileValues,
} from "@/features/onboarding/profile";
import { displayTimeZone } from "@/features/app-shell/shell";

export type AthleteModelShares = {
  garmin: number;
  athlete: number;
  estimate: number;
  openQuestions: number;
};

export function athleteModelShares(values: ProfileValues): AthleteModelShares {
  let garmin = 0;
  let athlete = 0;
  for (const field of profileFields) {
    if (!isAnswered(values, field)) continue;
    if (values.value_sources[field]?.source === "garmin") garmin += 1;
    else athlete += 1;
  }
  const total = profileFields.length;
  const garminShare = Math.round((garmin / total) * 100);
  const athleteShare = Math.round((athlete / total) * 100);
  return {
    garmin: garminShare,
    athlete: athleteShare,
    estimate: 100 - garminShare - athleteShare,
    openQuestions: total - garmin - athlete,
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
