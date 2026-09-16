import type { NextConfig } from "next";

// Photo uploads go straight from the browser to Blob storage (see
// app/api/photos/upload-handler/route.ts), not through a Server Action, so
// there's no need to raise serverActions' default body size limit -- every
// action in this app only ever handles small text/JSON payloads.
const nextConfig: NextConfig = {};

export default nextConfig;
