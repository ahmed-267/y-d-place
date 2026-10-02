import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {aiProxyPlugin} from './src/vite-api-plugin';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Expose for server-only API middleware (never VITE_ for secrets).
  if (env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  if (env.VITE_OPENROUTER_MODEL) process.env.VITE_OPENROUTER_MODEL = env.VITE_OPENROUTER_MODEL;
  if (env.VITE_OPENROUTER_SITE_URL) process.env.VITE_OPENROUTER_SITE_URL = env.VITE_OPENROUTER_SITE_URL;
  if (env.VITE_OPENROUTER_APP_NAME) process.env.VITE_OPENROUTER_APP_NAME = env.VITE_OPENROUTER_APP_NAME;
  if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  if (env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
  if (env.STRIPE_WEBHOOK_SECRET) process.env.STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
  if (env.STRIPE_PRICE_PRO) process.env.STRIPE_PRICE_PRO = env.STRIPE_PRICE_PRO;
  if (env.APP_URL) process.env.APP_URL = env.APP_URL;

  return {
    plugins: [react(), tailwindcss(), aiProxyPlugin()],
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
