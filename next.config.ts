import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /dev pages read retained evidence from docs/ at request time and are 404 in
  // production. Their dynamic paths otherwise make the file trace pull in all of docs/.
  outputFileTracingExcludes: {
    "/dev/**": ["./docs/**/*", "./scripts/**/*", "./public/**/*"],
  },
};

export default nextConfig;
