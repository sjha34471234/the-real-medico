/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.printify.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'cdn.printify.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  // Suppress hydration warnings from browser extensions
  reactStrictMode: false,
}

module.exports = nextConfig
