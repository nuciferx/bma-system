import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ให้ server components ใช้ Node.js builtins ได้ (fs, path สำหรับ generator)
  serverExternalPackages: ['docxtemplater', 'pizzip', 'docx'],
  experimental: {
    // @ts-expect-error — valid Vercel option, not yet in NextConfig types
    serverBodySizeLimit: '20mb',
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
}

export default nextConfig
