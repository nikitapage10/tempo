/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // WebGL / wasm client-only packages
        config.externals.push("three", "@ffmpeg/ffmpeg", "@ffmpeg/util");
      }
    }
    return config;
  },
};

export default nextConfig;
