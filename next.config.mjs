/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep `three` out of the server bundle — it’s WebGL-only (client shader).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("three");
      }
    }
    return config;
  },
};

export default nextConfig;
