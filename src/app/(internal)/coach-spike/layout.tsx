import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coach (spike) | Stride",
  robots: { index: false, follow: false },
};

export default function CoachSpikeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
