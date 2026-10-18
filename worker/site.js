// whiskedaway.com's site Worker (wrangler.jsonc). Every real file is served straight from dist/
// without running this; page loads (navigations) that match nothing still get the site's
// fallback page. This only runs for the other misses: a script, image or render that isn't there.
// Under the Inn's files (/explore/) and the built bundles (/assets/, /archive/assets/) that's a 404,
// so a missing render fails as missing, and a page cached from an older build gets a 404 for its old
// bundle instead of a 200 HTML page that breaks the module. Anything else keeps the old fallback.
const MISSING_IS_404 = ['/explore/', '/assets/', '/archive/assets/'];

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (MISSING_IS_404.some(p => path.startsWith(p))) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
    }
    return env.ASSETS.fetch(request);
  },
};
