import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev the Inn is served at / as on the live site (quick-check, 28 Oct): the page is blender/explore.html, and <base> points
// its relative paths (explore/, out/, ../src/lib/) at blender/, the way build-site.mjs points them at /explore/ in the build.
// Vite's `base` is /archive/, so it only answers under that prefix: / is rewritten to /archive/blender/explore.html (which was the
// only address that worked in dev before). The archive stays at /archive/.
const innAtRoot = () => ({
  name: 'inn-at-root',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) req.url = '/archive/blender/explore.html' + u.search;
      next();
    });
  },
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => (ctx.path.startsWith('/blender/explore.html') && !html.includes('<base ') ? html.replace('<head>', '<head><base href="/archive/blender/">') : html),
  },
})

// https://vitejs.dev/config/
// The React Inn is the archive now (docs/front-door-spec.md): built into dist/archive/ and served at
// whiskedaway.com/archive/. The home page is the 360° Inn, put together by scripts/build-site.mjs,
// which also copies public/ to the site root.
export default defineConfig({
  plugins: [react(), innAtRoot()],
  base: '/archive/',
  publicDir: false,
  build: { outDir: 'dist/archive', emptyOutDir: true },
})
