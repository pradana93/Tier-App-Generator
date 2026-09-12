import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['sql.js'] },
  assetsInclude: ['**/*.wasm'],
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
