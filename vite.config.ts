import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs.plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['react-signature-canvas', 'trim-canvas'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Access DISABLE_HMR via the loaded env variable instead of process.env
      hmr: env.DISABLE_HMR !== 'true',
    },
  };
});
