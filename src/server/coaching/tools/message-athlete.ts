import { z } from "zod";
import { defineTool } from "./define";

export const messageAthleteTool = defineTool({
  name: "message_athlete",
  description:
    "Post a message to the athlete in the group conversation, shown under your name. Use it for everything the athlete should read from you: your verdict and what to do. Write in French, addressed to the athlete, in at most four short sentences. Your final reply to the coach is never shown to the athlete.",
  class: "propose",
  dataClasses: ["health"],
  input: z.strictObject({
    text: z
      .string()
      .trim()
      .min(1)
      .max(1200)
      .describe("The message, in French, as the athlete will read it."),
  }),
  output: z.object({ shown: z.literal(true) }),
});
