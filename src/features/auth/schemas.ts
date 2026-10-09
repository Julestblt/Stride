import { z } from "zod";
import { passwordPolicy } from "./password-policy";

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
});

export const signInSchema = emailSchema.extend({
  password: z.string().min(1, "Enter your password.").max(128),
});

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(128, "Use no more than 128 characters."),
    confirmation: z.string(),
  })
  .superRefine(({ password, confirmation }, context) => {
    if (!passwordPolicy(password).distinct)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Choose a less common password.",
      });
    if (password !== confirmation)
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Passwords don't match yet.",
      });
  });

export const signUpSchema = emailSchema
  .extend({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Use no more than 100 characters."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(128, "Use no more than 128 characters."),
    confirmation: z.string(),
  })
  .superRefine(({ email, password, confirmation }, context) => {
    if (!passwordPolicy(password, email).distinct)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Don't use your email or a common password.",
      });
    if (password !== confirmation)
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Passwords don't match yet.",
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
