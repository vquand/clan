import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
      proxy: {
        '/api': { target: 'http://127.0.0.1:8787' },
      },
    },
    plugins: [vinext()],
  };
});
