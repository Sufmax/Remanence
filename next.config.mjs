/** @type {import('next').NextConfig} */

// Static export configuration.
// The whole game is client-side (canvas + localStorage), so it ships as
// plain static files — no Node server, no Cloudflare Worker needed.
//
// GitHub Pages serves project sites under /<repo>, so we expose a basePath
// via the NEXT_PUBLIC_BASE_PATH env var. Set it when building for Pages:
//   NEXT_PUBLIC_BASE_PATH=/remanence pnpm build
// Leave it empty for a custom domain or local preview.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

const nextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
