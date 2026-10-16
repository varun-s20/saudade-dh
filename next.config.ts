import type { NextConfig } from "next";

/**
 * Security headers (ARCHITECTURE.md §9.3, DECISIONS D-083). Static Content-Security-Policies: a
 * nonce-based policy would need every page rendered per request, which Cache Components' static
 * shells (and the recipient route's speed) rule out (Next docs: "PPR is incompatible with
 * nonce-based CSP").
 *
 * Two policies, because a page keeps the policy it was loaded with through client-side navigation:
 *   - the public site (home, claim, sender, recipient), which shows the official song embeds;
 *   - the admin (/admin/*), reached only from admin pages, which shows no third-party content and
 *     so gets a stricter one (no 'unsafe-eval', no third-party scripts or frames).
 *
 * Third parties allowed on the public site, and why:
 *   open.spotify.com        Spotify iFrame API script + official song embed (the vinyl world)
 *   *.spotifycdn.com        …the iFrame API loads its code from embed-cdn.spotifycdn.com, and that
 *                           bundle evaluates strings: 'unsafe-eval' is there only for it (without
 *                           it the record can't follow the music). Found by scripts/e2e.mjs, which
 *                           fails on any CSP violation.
 *   embed.music.apple.com   official Apple Music embed
 *   challenges.cloudflare.com  Turnstile bot check, only while the claim breaker is on
 *   Supabase (SUPABASE_URL) signed photo/voice URLs and direct uploads
 *   i.scdn.co, *.spotifycdn.com, *.mzstatic.com  song artwork
 */
const isDev = process.env.NODE_ENV === "development";
const isPreview = process.env.VERCEL_ENV === "preview";

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const storage = originOf(process.env.SUPABASE_URL);
const s = storage ? ` ${storage}` : "";
// Vercel's preview toolbar (comments on preview deployments only).
const live = isPreview ? " https://vercel.live" : "";

const artwork = "https://i.scdn.co https://*.spotifycdn.com https://*.mzstatic.com";

const common = [
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${artwork}${s}${live}`,
  `media-src 'self' data: blob:${s}`,
  `connect-src 'self'${s}${live}${isPreview ? " wss://ws-us3.pusher.com" : ""}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const publicPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://open.spotify.com https://*.spotifycdn.com https://challenges.cloudflare.com${live}`,
  `frame-src https://open.spotify.com https://embed.music.apple.com https://challenges.cloudflare.com${live}`,
  ...common,
].join("; ");

const adminPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${live}`,
  `frame-src ${live.trim() || "'none'"}`,
  ...common,
].join("; ");

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
  // ffmpeg-static resolves its binary by path at runtime: load it with Node's require, and ship the
  // binary with the two routes that transcode voice notes (sharp is external by default).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/sender/media/*/complete": ["./node_modules/ffmpeg-static/ffmpeg*"],
    "/api/cron/*": ["./node_modules/ffmpeg-static/ffmpeg*"],
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
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: publicPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Browsers ignore this over plain http (local dev); add `preload` once the domain is final.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // The private edit link carries its token in the path: never send it anywhere as a referrer.
        source: "/s/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Later entries win for the same header: the admin's stricter policy.
        source: "/admin/:path*",
        headers: [{ key: "Content-Security-Policy", value: adminPolicy }],
      },
      {
        source: "/admin",
        headers: [{ key: "Content-Security-Policy", value: adminPolicy }],
      },
    ];
  },
};

export default nextConfig;
