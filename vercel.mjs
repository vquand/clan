import { buildVercelConfig } from './lib/vercel-config.mjs';

export const config = buildVercelConfig(
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL,
);
