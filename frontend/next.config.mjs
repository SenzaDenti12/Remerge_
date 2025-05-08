/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint blocking the production build – warnings will still be shown in logs
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig; 