import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "files.cdn.printful.com" },
      // Freshly-generated mockups (mockup-generator task results) come back
      // from Printful's temp upload bucket, a different host from their CDN
      // — not guaranteed permanent, see docs/AGENT_API.md's mockups section.
      { protocol: "https", hostname: "printful-upload.s3-accelerate.amazonaws.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    // Default 1MB is too small for a hero image upload — see
    // MAX_ASSET_BYTES in src/lib/store/assets.ts, which is the real cap.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
