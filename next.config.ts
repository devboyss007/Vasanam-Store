import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // The admin pages and downloads must never be cached by a shared proxy.
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default config;
