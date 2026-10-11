import { pointDistance, type Course } from "./course";

export type WalkPortion = { fromM: number; toM: number };

const gradeWindowM = 100;
const mergeGapM = 60;
const minimumPortionM = 80;

export function gradesOf(course: Course) {
  const radius = Math.max(1, Math.round(gradeWindowM / 2 / course.stepM));
  const last = course.points.length - 1;
  return course.points.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(last, index + radius);
    const a = course.points[from][2];
    const b = course.points[to][2];
    const run = pointDistance(course, to) - pointDistance(course, from);
    if (a === null || b === null || run <= 0) return 0;
    return ((b - a) / run) * 100;
  });
}

export function walkPortions(
  course: Course,
  thresholdPercent: number,
  grades = gradesOf(course),
): WalkPortion[] {
  const raw: WalkPortion[] = [];
  let start: number | null = null;
  grades.forEach((grade, index) => {
    if (grade >= thresholdPercent && start === null) start = index;
    if (
      (grade < thresholdPercent || index === grades.length - 1) &&
      start !== null
    ) {
      const end = grade >= thresholdPercent ? index : index - 1;
      raw.push({
        fromM: pointDistance(course, start),
        toM: pointDistance(course, Math.min(grades.length - 1, end + 1)),
      });
      start = null;
    }
  });
  const merged: WalkPortion[] = [];
  for (const portion of raw) {
    const previous = merged[merged.length - 1];
    if (previous && portion.fromM - previous.toM < mergeGapM)
      previous.toM = portion.toM;
    else merged.push({ ...portion });
  }
  return merged.filter(
    (portion) => portion.toM - portion.fromM >= minimumPortionM,
  );
}

export function walkSummary(portions: WalkPortion[]) {
  return {
    count: portions.length,
    distanceM: portions.reduce(
      (sum, portion) => sum + portion.toM - portion.fromM,
      0,
    ),
  };
}

export function walkDistanceBetween(
  portions: WalkPortion[],
  fromM: number,
  toM: number,
) {
  return portions.reduce(
    (sum, portion) =>
      sum +
      Math.max(0, Math.min(portion.toM, toM) - Math.max(portion.fromM, fromM)),
    0,
  );
}
