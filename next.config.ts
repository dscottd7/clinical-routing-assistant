import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the project root so Next.js/Turbopack doesn't walk up to a parent
  // directory's stray lockfile and treat that as the workspace root. This
  // keeps file tracing and env-file resolution scoped to this repo.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
