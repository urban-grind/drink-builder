import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only. Next blocks the dev client unless the page's host is listed,
  // so a phone on a LAN address or an ngrok URL otherwise stays static HTML
  // and taps never reach React. Production ignores this list.
  allowedDevOrigins: [
    "127.0.0.1",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.ngrok.dev",
    "10.*.*.*",
    "192.168.*.*",
    "172.*.*.*",
    "*.local",
  ],
  serverExternalPackages: ["@resvg/resvg-js", "linkedom", "sharp", "heic-convert"],
};

export default nextConfig;
