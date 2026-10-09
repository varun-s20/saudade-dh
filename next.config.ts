import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keep dev screenshots identical to what the client sees.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Song artwork from the official providers' CDNs (metadata only; audio is never hosted).
    remotePatterns: [
      { protocol: "https", hostname: "*.spotifycdn.com" },
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.mzstatic.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Private product: keep every route out of search indexes (CLIENT_GUIDE §7).
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Microphone is needed by the sender's voice editor (same origin only).
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
