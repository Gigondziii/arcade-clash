import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Default (no host set) resolved "localhost" to IPv6-only (::1) on
    // this machine, so browsers trying IPv4 127.0.0.1 first got
    // ECONNREFUSED. Binding explicitly covers both.
    host: true,
  },
})
