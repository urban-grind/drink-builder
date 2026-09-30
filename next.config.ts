import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1 while Next treats localhost as the
  // origin. Without this, the browser blocks the dev client and the page
  // stays as static HTML — clicks never reach React.
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@resvg/resvg-js", "linkedom", "sharp", "heic-convert"],
};

export default nextConfig;
