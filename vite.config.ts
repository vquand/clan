import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.API_URL || env.NEXT_PUBLIC_API_URL;
  const apiOrigin = apiUrl ? new URL(apiUrl).origin : undefined;
  const isCodexSeatbeltSandbox =
    process.env.CODEX_SANDBOX === 'seatbelt';

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
      ...(apiOrigin
        ? {
            proxy: {
              '/api': {
                target: apiOrigin,
                changeOrigin: true,
                secure: apiOrigin.startsWith('https://'),
              },
            },
          }
        : {}),
    },
    plugins: [vinext()],
  };
});
