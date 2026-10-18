import type { Metadata } from "next";
import { localToday } from "@/features/app-shell/shell";
import {
  NutritionMissing,
  NutritionPage,
} from "@/features/nutrition/components/nutrition-page";
import { nutritionView } from "@/features/nutrition/view";
import { requireAthlete } from "@/server/app/session";
import { loadNutrition } from "@/server/nutrition/targets";

export const metadata: Metadata = { title: "Nutrition" };

export default async function NutritionRoute() {
  const context = await requireAthlete();
  const today = localToday(new Date());
  const { results, sessions } = await loadNutrition(context, today);
  const view = nutritionView(results, sessions, today);
  return view.status === "missing" ? (
    <NutritionMissing missing={view.missing} />
  ) : (
    <NutritionPage today={view.today} days={view.days} />
  );
}
