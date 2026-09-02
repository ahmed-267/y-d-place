import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {aiProxyPlugin} from './src/vite-ai-proxy';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Expose for the AI proxy middleware (server-side only).
  if (env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  if (env.VITE_OPENROUTER_API_KEY) process.env.VITE_OPENROUTER_API_KEY = env.VITE_OPENROUTER_API_KEY;
  if (env.VITE_OPENROUTER_MODEL) process.env.VITE_OPENROUTER_MODEL = env.VITE_OPENROUTER_MODEL;

  return {
    plugins: [react(), tailwindcss(), aiProxyPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
