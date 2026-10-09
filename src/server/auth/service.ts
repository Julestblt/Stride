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
  "We couldn't connect right now. Please try again in a moment.";
const inboxMessage =
  "If this email can receive a link, check your inbox and spam folder. Follow the link to continue.";

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
          ? "Confirm your email to continue. Open the newest confirmation link or request another one."
          : "Your address isn't confirmed yet. We sent a new confirmation link. Open the newest email to continue.",
      };
    }
    if (response.error)
      return {
        status: "error",
        email,
        message:
          mode === "sign-in"
            ? "Unable to sign in. Check your email and password, or request a reset link."
            : "Unable to create your account. Try again, or sign in if you already have an account.",
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
          "We couldn't send a new link. Please wait a minute and try again.",
      };
    return {
      status: "success",
      email,
      sentAt: Date.now(),
      message:
        "If this address needs confirmation, check your inbox for the newest link.",
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
          "We couldn't request a link. Please wait a minute and try again.",
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
          "Sign in or open a fresh recovery link from your inbox before choosing a new password.",
      };
    if (!passwordPolicy(result.data.password, userData.user.email).distinct)
      return {
        status: "error",
        errors: { password: "Don't use your email or a common password." },
      };
    const { error } = await provider.updateUser({
      password: result.data.password,
    });
    if (error)
      return {
        status: "error",
        message:
          "Unable to save this password. Try another password or request a fresh recovery link.",
      };
    try {
      const { error: revokeError } = await provider.signOut({
        scope: "others",
      });
      if (revokeError)
        return {
          status: "success",
          message:
            "Your password was saved, but other sessions could not be signed out. You can continue with this session.",
        };
    } catch {
      return {
        status: "success",
        message:
          "Your password was saved, but other sessions could not be signed out. You can continue with this session.",
      };
    }
    return { status: "authenticated" };
  } catch {
    return { status: "error", message: unavailableMessage };
  }
}
