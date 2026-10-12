export const sleepStages = ["deep", "light", "rem", "awake"] as const;
export type SleepStage = (typeof sleepStages)[number];

export type TimedValue = [number, number | null];

export type WellnessSleep = {
  start: number;
  end: number;
  stages: { start: number; end: number; stage: SleepStage }[];
  deepSeconds: number | null;
  lightSeconds: number | null;
  remSeconds: number | null;
  awakeSeconds: number | null;
  awakeCount: number | null;
  score: number | null;
  respirationAverage: number | null;
  spo2Average: number | null;
  spo2Lowest: number | null;
  hrvAverage: number | null;
};

export type WellnessDay = {
  date: string;
  sleep: WellnessSleep | null;
  heartRate: TimedValue[];
  stress: TimedValue[];
  bodyBattery: TimedValue[];
  steps: TimedValue[];
  summary: {
    restingHeartRate: number | null;
    stepsTotal: number | null;
    stepsGoal: number | null;
    stressAverage: number | null;
    stressMax: number | null;
    bodyBatteryWake: number | null;
    bodyBatteryCharged: number | null;
    bodyBatteryDrained: number | null;
    bodyBatteryHighest: number | null;
    bodyBatteryLowest: number | null;
    bodyBatteryLatest: number | null;
  };
};
