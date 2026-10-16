import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV !== "production";

// Next's App Router bootstraps with inline scripts, so script-src needs
// 'unsafe-inline' without a nonce pipeline (see docs/DECISIONS.md D-009).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}${isDev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Cache Components is deliberately off: every private read must be authorized
  // against current membership/grant state on each request (docs/DECISIONS.md D-008).
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    // Client router cache (in the viewer's own browser memory only): revisiting
    // a module within 30s is instant, and a hover-prefetched page stays usable
    // for 60s. Every mutation calls revalidatePath, which clears it, so the
    // staleness bound applies only to other people's changes (DECISIONS D-031).
    staleTimes: { dynamic: 30, static: 60 },
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
