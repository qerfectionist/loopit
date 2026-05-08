import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('@sentry'))        return 'vendor-sentry';
          if (id.includes('framer-motion'))  return 'vendor-framer';
          if (id.includes('@tanstack'))      return 'vendor-query';
          if (id.includes('@supabase'))      return 'vendor-supabase';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('react-router-dom')
          )                                  return 'vendor-react';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
