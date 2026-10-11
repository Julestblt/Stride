import { getOnboardingContext } from "@/server/onboarding/context";

export async function GET() {
  const context = await getOnboardingContext();
  if (!context) return new Response("Unauthorized", { status: 401 });
  const [profile, goal, races] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select(
        "first_name,birth_date,sex,height_cm,weight_kg,primary_terrain,available_weekdays,long_run_day,weekday_session_minutes,training_access,value_sources,updated_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.client
      .from("athlete_goals")
      .select("focus,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.client
      .from("athlete_races")
      .select(
        "name,race_date,distance_km,elevation_gain_m,priority,target_duration_seconds,updated_at",
      )
      .eq("user_id", context.userId),
  ]);
  if (profile.error || goal.error || races.error)
    return new Response("Export unavailable", { status: 503 });
  return new Response(
    JSON.stringify(
      { profile: profile.data, goal: goal.data, races: races.data ?? [] },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stride-settings.json"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
