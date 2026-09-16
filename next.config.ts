import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, well under a typical phone photo. uploadPostPhoto
      // (actions/posts.ts) already rejects anything over 8MB itself; this
      // just needs enough headroom above that plus multipart overhead for
      // the request to reach that check in the first place.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
