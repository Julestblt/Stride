import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Stride",
    short_name: "Stride",
    description: "Ton coach running personnel, sur route et en trail.",
    lang: "fr",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#080907",
    theme_color: "#080907",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
