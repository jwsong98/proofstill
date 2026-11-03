import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const envDir = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const target = env.BACKEND_URL || 'http://127.0.0.1:8000';
  return {
    plugins: [tailwindcss()], envDir,
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: {
        '^/api(?:/|$)': { target, changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') || '/' },
        '/health': { target, changeOrigin: true },
      },
    },
  };
});
