import { z } from "zod";
export const insightsResponseSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.enum(["volume", "mix", "longest", "recovery"]),
        text: z.string().min(1).max(240),
        source: z.string().min(1).max(80),
        origin: z.enum(["ai", "facts"]),
      }),
    )
    .max(8),
  final: z.boolean(),
});
export type InsightsResponse = z.output<typeof insightsResponseSchema>;
