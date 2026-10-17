import { z } from "zod";
import { defineTool } from "./define";

export const askAthleteTool = defineTool({
  name: "ask_athlete",
  description:
    "Ask the athlete one question in the group conversation and wait for the answer, which comes back to you as the result. The question is shown in French under your name. When the answer can be chosen, give 2 to 5 short answer options; the athlete can always write another answer. Never combine several questions in one.",
  class: "propose",
  dataClasses: ["plan"],
  input: z.strictObject({
    question: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .describe("One question, in French, as the athlete will read it."),
    options: z
      .array(z.string().trim().min(1).max(60))
      .min(2)
      .max(5)
      .optional()
      .describe(
        "Short French answer options the athlete can pick, each a complete answer on its own.",
      ),
  }),
  output: z.string().describe("The athlete's answer, as chosen or written."),
});
