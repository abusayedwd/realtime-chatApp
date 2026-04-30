/** @type {import('next').NextConfig} */
const backendInternal = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:5000'

/** Hostnames allowed for Server Actions / dev when not using localhost (e.g. http://192.168.x.x:3005). Comma-separated. */
const allowedDevOrigins = [
  ...new Set([
    ...(process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
]
try {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
  if (socketUrl?.startsWith('http')) {
    allowedDevOrigins.push(new URL(socketUrl).hostname)
  }
} catch {
  /* ignore invalid NEXT_PUBLIC_SOCKET_URL */
}

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
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
