import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pretty Heavy",
    short_name: "Pretty Heavy",
    description: "5/3/1 training tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f6bfe0",
    theme_color: "#f6bfe0",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
