import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Share Anything",
    short_name: "ShareAnything",
    description: "Zero-login instant file & text sharing across devices in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
