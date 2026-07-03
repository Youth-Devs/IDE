/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive can race on renames in .next/cache and corrupt webpack cache packs.
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
