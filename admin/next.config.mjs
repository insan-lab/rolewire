/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is what the Docker runner stage copies (frontend spec §9). It is opt-in
  // because assembling it requires creating symlinks, which fails with EPERM on Windows unless
  // the shell is elevated — the Dockerfile sets NEXT_OUTPUT_STANDALONE=1, local builds skip it.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint is a separate CI step; a lint error should not block a production build.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
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
