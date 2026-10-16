import { z } from "zod";
import { defineTool } from "./define";

export const askAthleteTool = defineTool({
  name: "ask_athlete",
  description:
    "Ask the athlete one question and wait for the answer. Use it when you or a specialist need information only the athlete has. The question is shown to the athlete in French; the answer comes back as the result.",
  class: "propose",
  dataClasses: ["plan"],
  input: z.strictObject({
    question: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("The question, in French, as the athlete will read it."),
    asked_for: z.enum(["coach", "medical"]).describe("Who needs the answer."),
  }),
  output: z.string().describe("The athlete's answer, as written."),
});
