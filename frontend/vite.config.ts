import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The UI and API are always deployed together on Vercel.
  define: process.env.VERCEL === '1'
    ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') }
    : undefined,
})
