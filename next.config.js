/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next.js 14 for the instrumentation.js hook (Sentry
  // server/edge init) to actually run. Default-on as of Next 15, but
  // still needs this flag on 14.2.5.
  experimental: {
    instrumentationHook: true,
  },
};
module.exports = nextConfig;
