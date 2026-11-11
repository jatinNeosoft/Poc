/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dev server to be opened through a Cloudflare quick tunnel (phone / tester access)
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
