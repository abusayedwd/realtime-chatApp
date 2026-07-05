/** @type {import('next').NextConfig} */
const backendInternal = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:5000'

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '2mb' } },

  /** Proxies /api, /socket.io, /uploads on this dev server to Express (LAN-friendly when NEXT_PUBLIC_* use the same host:port as the browser). */
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendInternal}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backendInternal}/socket.io/:path*` },
      { source: '/uploads/:path*', destination: `${backendInternal}/uploads/:path*` },
    ]
  },
}

export default nextConfig
