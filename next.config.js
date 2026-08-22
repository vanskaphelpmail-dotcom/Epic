/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  serverExternalPackages: ['bwip-js', 'pdfkit', '@neondatabase/serverless', '@prisma/adapter-neon', 'ws'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' }
    ]
  }
};

module.exports = nextConfig;
