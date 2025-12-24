import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable Turbopack (Next.js 16+ default)
  turbopack: {
    root: __dirname,
  },

  // Image optimization settings
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
      {
        protocol: 'https',
        hostname: '*.arweave.net',
      },
    ],
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_RPC_ENDPOINT: process.env.NEXT_PUBLIC_RPC_ENDPOINT,
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
    NEXT_PUBLIC_KERNEL_MINT: process.env.NEXT_PUBLIC_KERNEL_MINT,
    NEXT_PUBLIC_KERNEL_PROGRAM: process.env.NEXT_PUBLIC_KERNEL_PROGRAM,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
