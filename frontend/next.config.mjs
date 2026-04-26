/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['10.10.11.118', 'http://10.10.11.118:3005'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
}

export default nextConfig
