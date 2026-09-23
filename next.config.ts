import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module: keep it external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  experimental: {
    // Receipt photos travel through a Server Action, so the default 1 MB body
    // cap would reject most phone camera output. This is sized to one full
    // entry — MAX_FILES_PER_ENTRY × MAX_FILE_BYTES in `src/lib/upload-limits.ts`
    // — plus room for the rest of the form.
    serverActions: { bodySizeLimit: "13mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN, not DENY: the receipt viewer frames /api/files from
          // this same origin. Cross-origin framing stays blocked.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera stays allowed for this origin: "Take a photo" on an entry
          // is a core part of the ledger.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
