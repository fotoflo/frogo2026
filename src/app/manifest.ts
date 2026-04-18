import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frogo Remote",
    short_name: "Frogo",
    description: "Phone remote for Frogo.tv",
    start_url: "/pair",
    display: "standalone",
    background_color: "#0e0e0e",
    theme_color: "#0e0e0e",
    icons: [
      {
        src: "/images/frogo/frogo-logo-200.png",
        sizes: "200x200",
        type: "image/png",
      },
      {
        src: "/images/frogo/frogo-icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
