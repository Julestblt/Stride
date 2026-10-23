import {
  Barlow_Condensed,
  IBM_Plex_Mono,
  Instrument_Sans,
} from "next/font/google";
import { cn } from "@/lib/utils";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const fontVariables = cn(
  instrumentSans.variable,
  barlowCondensed.variable,
  ibmPlexMono.variable,
);
