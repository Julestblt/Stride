import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emailSchema,
  formInput,
  passwordSchema,
  signInSchema,
  signUpSchema,
  validationState,
  type AuthState,
} from "@/features/auth/schemas";
import { passwordPolicy } from "@/features/auth/password-policy";
import { callbackUrl } from "./environment";

type AuthProvider = Pick<
  SupabaseClient["auth"],
  | "signInWithPassword"
  | "signUp"
  | "resend"
  | "signInWithOtp"
  | "resetPasswordForEmail"
  | "getUser"
  | "updateUser"
  | "signOut"
>;

export const unavailableMessage =
  "Connexion impossible pour le moment. Réessaie dans un instant.";
const inboxMessage =
  "Si cette adresse peut recevoir un lien, regarde dans ta boîte mail et tes spams. Ouvre le lien pour continuer.";

export async function authenticate(
  provider: AuthProvider,
  mode: "sign-in" | "sign-up",
  data: FormData,
  emailRedirectTo?: string,
): Promise<AuthState> {
  const input = formInput(data);
  const result = (mode === "sign-in" ? signInSchema : signUpSchema).safeParse(
    input,
  );
  if (!result.success) return validationState(result.error, input.email);
  const { email, password } = result.data;
  try {
    const response =
      mode === "sign-in"
        ? await provider.signInWithPassword({ email, password })
        : await provider.signUp({
            email,
            password,
            options: {
              data: {
                full_name:
                  "fullName" in result.data ? result.data.fullName : "",
              },
              ...(emailRedirectTo ? { emailRedirectTo } : {}),
            },
          });
    if (response.error?.code === "email_not_confirmed" && mode === "sign-in") {
      const confirmationRedirect =
        emailRedirectTo ?? callbackUrl("/email-confirmed");
      const resent = await provider.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: confirmationRedirect },
      });
      return {
        status: "unconfirmed",
        email,
        sentAt: resent.error ? undefined : Date.now(),
        message: resent.error
          ? "Confirme ton e-mail pour continuer. Ouvre le lien de confirmation le plus récent ou demandes-en un nouveau."
          : "Ton adresse n’est pas encore confirmée. On vient d’envoyer un nouveau lien de confirmation. Ouvre l’e-mail le plus récent pour continuer.",
      };
    }
    if (response.error)
      return {
        status: "error",
        email,
        message:
          mode === "sign-in"
            ? "Connexion impossible. Vérifie ton e-mail et ton mot de passe, ou demande un lien de réinitialisation."
            : "Impossible de créer ton compte. Réessaie, ou connecte-toi si tu as déjà un compte.",
      };
    if (response.data.session) return { status: "authenticated" };
    if (mode === "sign-in")
      return { status: "error", email, message: unavailableMessage };
    return {
      status: "success",
      email,
      sentAt: Date.now(),
    };
  } catch {
    return { status: "error", email, message: unavailableMessage };
  }
}

export async function resendConfirmation(
  provider: AuthProvider,
  data: FormData,
  redirectTo: string,
): Promise<AuthState> {
  const result = emailSchema.safeParse(formInput(data));
  if (!result.success) return validationState(result.error, data.get("email"));
  const { email } = result.data;
  try {
    const response = await provider.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (response.error)
      return {
        status: "error",
        email,
        message:
          "Impossible d’envoyer un nouveau lien. Attends une minute et réessaie.",
      };
    return {
      status: "success",
      email,
      sentAt: Date.now(),
      message:
        "Si cette adresse doit être confirmée, regarde dans ta boîte mail le lien le plus récent.",
    };
  } catch {
    return { status: "error", email, message: unavailableMessage };
  }
}

export async function requestEmail(
  provider: AuthProvider,
  mode: "magic" | "recovery",
  data: FormData,
  redirectTo: string,
): Promise<AuthState> {
  const result = emailSchema.safeParse(formInput(data));
  if (!result.success) return validationState(result.error, data.get("email"));
  const { email } = result.data;
  try {
    const response =
      mode === "magic"
        ? await provider.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
          })
        : await provider.resetPasswordForEmail(email, { redirectTo });
    if (response.error) {
      if (
        mode === "magic" &&
        (response.error.code === "otp_disabled" ||
          response.error.code === "user_not_found")
      )
        return {
          status: "success",
          email,
          message: inboxMessage,
          sentAt: Date.now(),
        };
      return {
        status: "error",
        email,
        message:
          "Impossible de demander un lien. Attends une minute et réessaie.",
      };
    }
    return {
      status: "success",
      email,
      message: inboxMessage,
      sentAt: Date.now(),
    };
  } catch {
    return { status: "error", email, message: unavailableMessage };
  }
}

export async function changePassword(
  provider: AuthProvider,
  data: FormData,
): Promise<AuthState> {
  const result = passwordSchema.safeParse(formInput(data));
  if (!result.success) return validationState(result.error, "");
  try {
    const { data: userData, error: userError } = await provider.getUser();
    if (userError || !userData.user || !userData.user.email_confirmed_at)
      return {
        status: "error",
        message:
          "Connecte-toi ou ouvre un nouveau lien de réinitialisation depuis ta boîte mail avant de choisir un nouveau mot de passe.",
      };
    if (!passwordPolicy(result.data.password, userData.user.email).distinct)
      return {
        status: "error",
        errors: {
          password: "N’utilise ni ton e-mail ni un mot de passe courant.",
        },
      };
    const { error } = await provider.updateUser({
      password: result.data.password,
    });
    if (error)
      return {
        status: "error",
        message:
          "Impossible d’enregistrer ce mot de passe. Essaie-en un autre ou demande un nouveau lien de réinitialisation.",
      };
    try {
      const { error: revokeError } = await provider.signOut({
        scope: "others",
      });
      if (revokeError)
        return {
          status: "success",
          message:
            "Ton mot de passe est enregistré, mais les autres sessions n’ont pas pu être déconnectées. Tu peux continuer avec cette session.",
        };
    } catch {
      return {
        status: "success",
        message:
          "Ton mot de passe est enregistré, mais les autres sessions n’ont pas pu être déconnectées. Tu peux continuer avec cette session.",
      };
    }
    return { status: "authenticated" };
  } catch {
    return { status: "error", message: unavailableMessage };
  }
}
