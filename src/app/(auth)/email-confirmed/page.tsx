import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { createSupabaseServerClient } from "@/server/supabase/client";

export const metadata: Metadata = { title: "Email confirmed · Stride" };

export default async function EmailConfirmedPage() {
  await connection();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) redirect("/sign-in");
  const name =
    typeof data.user.user_metadata.full_name === "string"
      ? data.user.user_metadata.full_name.trim().split(/\s+/)[0].slice(0, 40)
      : "";
  return (
    <AuthShell signup>
      <div className="flex flex-1 flex-col gap-6 md:flex-none">
        <div
          className="grid size-14 place-items-center rounded-full border border-success/30 bg-success/10 text-2xl text-success"
          aria-hidden="true"
        >
          ✓
        </div>
        <p className="font-mono text-xs tracking-widest text-success uppercase">
          Email confirmed
        </p>
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">
          You&apos;re in{name ? `, ${name}` : ""}.
        </h1>
        <p className="text-muted">
          Your address is confirmed and you&apos;re signed in. Your Stride
          experience is ready.
        </p>
        <Button asChild className="mt-auto w-full md:mt-0">
          <Link href="/">Continue to Stride</Link>
        </Button>
        <p className="text-center text-sm text-muted">
          Signed in as {data.user.email}
        </p>
      </div>
    </AuthShell>
  );
}
