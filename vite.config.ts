import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // Code splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - cached separately from app code
            'vendor-react': ['react', 'react-dom'],
            'vendor-sandpack': ['@codesandbox/sandpack-react', '@codesandbox/sandpack-themes'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react'],
          },
          // Content-hash for cache busting
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Minification
      minify: 'esbuild',
      // Source maps for production debugging
      sourcemap: true,
      // Target modern browsers for smaller bundles
      target: 'es2020',
    },
  };
});
