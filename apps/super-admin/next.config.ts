import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  /** Снижает шум dev-only багов React manifest / Next DevTools (SegmentViewNode) в dev */
  devIndicators: false,
};

export default nextConfig;
