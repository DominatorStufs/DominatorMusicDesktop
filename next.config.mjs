/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Suppress the known Clerk + Next.js hydration mismatch warning
  reactStrictMode: false,
};

export default nextConfig;
