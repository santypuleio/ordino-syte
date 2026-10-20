import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_ML_CLIENT_ID': JSON.stringify(env.ML_CLIENT_ID || ''),
      'import.meta.env.VITE_ML_REDIRECT_URI': JSON.stringify(env.ML_REDIRECT_URI || ''),
    },
    server: {
      port: 5174,
      strictPort: true,
      // Túneles locales (ngrok / localtunnel) para probar cámara en el celular
      allowedHosts: true,
    },
  }
})
