import { z } from "zod";

const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  })
  .refine(
    ({ NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }) =>
      Boolean(NEXT_PUBLIC_SUPABASE_URL) ===
      Boolean(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    {
      message: "Supabase URL and publishable key must be configured together",
    },
  );

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

type PublicEnvironmentInput = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

export function parsePublicEnvironment(
  input: PublicEnvironmentInput,
): PublicEnvironment {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: input.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
