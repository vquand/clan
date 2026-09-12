export function buildVercelConfig(rawApiOrigin) {
  if (!rawApiOrigin?.trim()) {
    throw new Error('API_URL must be configured for the Vercel deployment');
  }

  let apiOrigin;
  try {
    apiOrigin = new URL(rawApiOrigin.trim());
  } catch {
    throw new Error('API_URL must be a valid HTTPS origin');
  }
  if (
    apiOrigin.protocol !== 'https:' ||
    apiOrigin.username ||
    apiOrigin.password ||
    apiOrigin.pathname !== '/' ||
    apiOrigin.search ||
    apiOrigin.hash
  ) {
    throw new Error('API_URL must be a valid HTTPS origin');
  }

  return {
    framework: null,
    installCommand: 'npm ci',
    buildCommand: 'npm run build',
    outputDirectory: 'dist/client',
    rewrites: [
      {
        source: '/api/:path*',
        destination: `${apiOrigin.origin}/api/:path*`,
      },
    ],
  };
}
