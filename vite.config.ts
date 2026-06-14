import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // The reliable way to expose a key on Vercel is a VITE_-prefixed var, which
    // Vite reads natively into import.meta.env (same path the working Supabase
    // keys use). We still resolve a value here for the legacy process.env.API_KEY
    // the older AI features read — preferring VITE_GEMINI_API_KEY, then the
    // unprefixed GEMINI_API_KEY, from the build env or a local .env.
    const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
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
      plugins: [react(), cloudflare()],
      define: {
        // Legacy AI features read process.env.API_KEY. We do NOT define
        // import.meta.env.VITE_GEMINI_API_KEY here — Vite injects that natively
        // from a VITE_-prefixed env var, and defining it would override the
        // native value with a possibly-empty build-time string.
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});