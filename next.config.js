/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // ✅ Printify CDN — allows next/image to optimize these
        protocol: 'https',
        hostname: 'images.printify.com',
      },
      {
        // ✅ Covers any other Printify CDN subdomains
        protocol: 'https',
        hostname: '**.printify.com',
      },
      {
        // ✅ Placeholder fallback image used in getFeaturedProducts
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
    // ✅ Serve AVIF first, then WebP — 50-70% smaller than JPEG on mobile
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig
