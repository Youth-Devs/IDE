/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive can race on renames in .next/cache and corrupt webpack cache packs.
      config.cache = false;
    }

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@xterm/addon-fit': 'xterm-addon-fit',
    };

    return config;
  },
};

export default nextConfig;
