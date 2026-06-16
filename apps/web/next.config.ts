import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@agent-os/db', '@agent-os/shared'],
};

export default config;
