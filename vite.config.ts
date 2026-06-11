import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Allow the app to be reached through a Cloudflare quick tunnel
        // (https://*.trycloudflare.com) for sharing with the team. Vite 6
        // blocks unknown Host headers by default; this whitelists the tunnel.
        allowedHosts: ['.trycloudflare.com'],
        // Force the browser to never cache dev-server responses. Without this,
        // hot-reloads across context-shape changes (UIContext, AuthContext,
        // FleetContext) leave the browser with a stale module graph that
        // survives Ctrl+Shift+R and presents as mysterious login hangs or
        // missing UI - which has bitten us multiple times this session.
        // No production impact: this header only affects `vite dev`.
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
