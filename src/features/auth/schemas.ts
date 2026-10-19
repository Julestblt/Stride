import { z } from "zod";
import { passwordPolicy } from "./password-policy";

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Saisis une adresse e-mail valide.")
    .max(254),
});

export const signInSchema = emailSchema.extend({
  password: z.string().min(1, "Saisis ton mot de passe.").max(128),
});

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Utilise au moins 10 caractères.")
      .max(128, "Utilise 128 caractères au maximum."),
    confirmation: z.string(),
  })
  .superRefine(({ password, confirmation }, context) => {
    if (!passwordPolicy(password).distinct)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Choisis un mot de passe moins courant.",
      });
    if (password !== confirmation)
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Les mots de passe ne correspondent pas encore.",
      });
  });

export const signUpSchema = emailSchema
  .extend({
    fullName: z
      .string()
      .trim()
      .min(2, "Saisis ton nom complet.")
      .max(100, "Utilise 100 caractères au maximum."),
    password: z
      .string()
      .min(10, "Utilise au moins 10 caractères.")
      .max(128, "Utilise 128 caractères au maximum."),
    confirmation: z.string(),
  })
  .superRefine(({ email, password, confirmation }, context) => {
    if (!passwordPolicy(password, email).distinct)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "N’utilise ni ton e-mail ni un mot de passe courant.",
      });
    if (password !== confirmation)
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Les mots de passe ne correspondent pas encore.",
      });
  });

export type AuthState = {
  status: "idle" | "error" | "success" | "authenticated" | "unconfirmed";
  message?: string;
  email?: string;
  errors?: Partial<
    Record<"fullName" | "email" | "password" | "confirmation", string>
  >;
  sentAt?: number;
};

export type AuthAction = (
  previous: AuthState,
  data: FormData,
) => Promise<AuthState>;
export const initialAuthState: AuthState = { status: "idle" };

export function formInput(data: FormData) {
  return {
    fullName: data.get("fullName"),
    email: data.get("email"),
    password: data.get("password"),
    confirmation: data.get("confirmation"),
  };
}

export function validationState(error: z.ZodError, email: unknown): AuthState {
  const errors: NonNullable<AuthState["errors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      field === "fullName" ||
      field === "email" ||
      field === "password" ||
      field === "confirmation"
    )
      errors[field] ??= issue.message;
  }
  return {
    status: "error",
    errors,
    email: typeof email === "string" ? email.slice(0, 254) : "",
  };
}
