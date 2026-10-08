"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/client";
import {
  authCookieOptions,
  cookieIsSecure,
  persistenceCookie,
} from "@/server/supabase/cookie-policy";
import { callbackUrl } from "./environment";
import {
  authenticate,
  changePassword,
  requestEmail,
  unavailableMessage,
} from "./service";
import {
  emailSchema,
  formInput,
  passwordSchema,
  signInSchema,
  signUpSchema,
  validationState,
  type AuthState,
} from "@/features/auth/schemas";

async function runAuthentication(
  mode: "sign-in" | "sign-up",
  data: FormData,
): Promise<AuthState> {
  const validation = (
    mode === "sign-in" ? signInSchema : signUpSchema
  ).safeParse(formInput(data));
  if (!validation.success)
    return validationState(validation.error, data.get("email"));
  let result: AuthState;
  try {
    const persistent = mode === "sign-in" && data.get("remember") === "on";
    const client = await createSupabaseServerClient({
      writable: true,
      persistent,
    });
    const emailRedirectTo = mode === "sign-up" ? callbackUrl() : undefined;
    result = await authenticate(client.auth, mode, data, emailRedirectTo);
    if (result.status === "authenticated" || result.status === "success") {
      const store = await cookies();
      store.set(
        persistenceCookie,
        persistent ? "persistent" : "session",
        authCookieOptions(
          persistent ? { maxAge: 60 * 60 * 24 * 400 } : {},
          persistent,
          cookieIsSecure(),
        ),
      );
    }
  } catch {
    result = {
      status: "error",
      email: validation.data.email,
      message: unavailableMessage,
    };
  }
  if (result.status === "authenticated") redirect("/");
  return result;
}

export async function signIn(_previous: AuthState, data: FormData) {
  return runAuthentication("sign-in", data);
}

export async function signUp(_previous: AuthState, data: FormData) {
  return runAuthentication("sign-up", data);
}

async function sendEmail(
  mode: "magic" | "recovery",
  data: FormData,
): Promise<AuthState> {
  const validation = emailSchema.safeParse(formInput(data));
  if (!validation.success)
    return validationState(validation.error, data.get("email"));
  try {
    const destination = callbackUrl(
      mode === "recovery" ? "/reset-password" : "/",
    );
    const persistent = mode === "magic" && data.get("remember") === "on";
    const client = await createSupabaseServerClient({
      writable: true,
      persistent,
    });
    const result = await requestEmail(client.auth, mode, data, destination);
    if (result.status === "success") {
      const store = await cookies();
      store.set(
        persistenceCookie,
        persistent ? "persistent" : "session",
        authCookieOptions(
          persistent ? { maxAge: 60 * 60 * 24 * 400 } : {},
          persistent,
          cookieIsSecure(),
        ),
      );
    }
    return result;
  } catch {
    return {
      status: "error",
      email: validation.data.email,
      message: unavailableMessage,
    };
  }
}

export async function sendMagicLink(_previous: AuthState, data: FormData) {
  return sendEmail("magic", data);
}

export async function sendRecoveryLink(_previous: AuthState, data: FormData) {
  return sendEmail("recovery", data);
}

export async function savePassword(
  _previous: AuthState,
  data: FormData,
): Promise<AuthState> {
  const validation = passwordSchema.safeParse(formInput(data));
  if (!validation.success) return validationState(validation.error, "");
  let result: AuthState;
  try {
    const client = await createSupabaseServerClient({ writable: true });
    result = await changePassword(client.auth, data);
  } catch {
    result = { status: "error", message: unavailableMessage };
  }
  if (result.status === "authenticated") redirect("/");
  return result;
}
