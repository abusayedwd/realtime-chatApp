/** @type {import('next').NextConfig} */
const backendInternal = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:5000'

const allowedDevOrigins = ['10.10.11.118', 'http://10.10.11.118:3005']
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

  /** When NEXT_PUBLIC_* points at this Next dev server (HTTPS ngrok → :3005), proxy API/socket/uploads to local Express. */
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendInternal}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backendInternal}/socket.io/:path*` },
      { source: '/uploads/:path*', destination: `${backendInternal}/uploads/:path*` },
    ]
  },
}

export default nextConfig
