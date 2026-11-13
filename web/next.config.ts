import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* InVin is a signed-in, per-user app: almost every read is live data. We use the
     standard (non Cache Components) model and cache explicitly where it pays off. */
  // Keep the dev-only Next badge off the sidebar's account row
  devIndicators: { position: "bottom-right" },
  serverExternalPackages: ["@electric-sql/pglite", "puppeteer-core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
