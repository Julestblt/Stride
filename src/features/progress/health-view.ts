import { formatSleep } from "./recovery-view";

export type Tone = "success" | "warning" | "danger" | "muted";

export type HealthKpi = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  tone: Tone;
};

export function formatStage(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : formatSleep(seconds);
}
