import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ให้ server components ใช้ Node.js builtins ได้ (fs, path สำหรับ generator)
  serverExternalPackages: ['docxtemplater', 'pizzip', 'docx'],
}

export default nextConfig
