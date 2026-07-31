/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages that ship raw TS.
  transpilePackages: [
    "@cc/shared",
    "@cc/mtg",
    "@cc/deck-validator",
    "@cc/ai",
    "@cc/ui",
    "@cc/database",
  ],
  experimental: {
    typedRoutes: true,
  },
  // Security headers are applied here and hardened in Phase 1 (CC-SEC-001):
  // CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
