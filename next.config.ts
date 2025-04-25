/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/boreholedensitymap',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
