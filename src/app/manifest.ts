import type { MetadataRoute } from "next";

// Cycle 11: web app manifest (served at /manifest.webmanifest; Next
// auto-injects <link rel="manifest">). Standalone install with the
// Wenger navy chrome so the home-screen app feels native.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wenger Field Notes",
    short_name: "Field Notes",
    description:
      "Field visit notes for the Wenger Corporation California sales team.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash background matches the icon's solid blue (#00365A — the
    // exact circle blue sampled from the source). theme_color stays
    // Wenger navy (the in-app header).
    background_color: "#00365A",
    theme_color: "#0A3758",
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
