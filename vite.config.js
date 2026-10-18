import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// The React Inn is the archive now (docs/front-door-spec.md): built into dist/archive/ and served at
// whiskedaway.com/archive/. The home page is the 360° Inn, put together by scripts/build-site.mjs,
// which also copies public/ to the site root.
export default defineConfig({
  plugins: [react()],
  base: '/archive/',
  publicDir: false,
  build: { outDir: 'dist/archive', emptyOutDir: true },
})
