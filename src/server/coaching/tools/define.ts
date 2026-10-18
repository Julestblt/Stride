import type { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

export type ToolContext = OnboardingContext & {
  coachSessionId?: string | null;
};

export type ToolClass = "read" | "compute" | "propose" | "record";
export type DataClass = "training" | "health" | "plan";

export type CoachingTool<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
> = {
  name: string;
  description: string;
  class: ToolClass;
  dataClasses: readonly DataClass[];
  input: Input;
  output: Output;
  run?: (
    context: ToolContext,
    input: z.output<Input>,
  ) => Promise<z.input<Output>>;
};

export function defineTool<Input extends z.ZodType, Output extends z.ZodType>(
  tool: CoachingTool<Input, Output>,
): CoachingTool<Input, Output> {
  return tool;
}
