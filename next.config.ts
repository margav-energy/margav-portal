import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next's default is 1MB, which is too small for this app's file-
      // upload Server Actions — the admin Presenter deck upload
      // (src/app/settings/presenter-deck/actions.ts, now .pptx or .pdf,
      // both of which can run well past 1MB) and the on-site boiler survey
      // photo uploads (src/app/survey/[token]/actions.ts, full-res phone
      // camera photos).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
