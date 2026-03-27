import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@recall/contracts', '@recall/design-tokens'],
  experimental: {
    optimizePackageImports: ['firebase'],
  },
};

export default nextConfig;
