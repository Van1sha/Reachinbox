import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default nextConfig;
