// whiskedaway.com's site Worker (wrangler.jsonc). Every real file is served straight from dist/
// without running this; page loads (navigations) that match nothing still get the site's
// fallback page. This only runs for the other misses: a script, image or render that isn't there.
// Under /explore/ (the Inn's files) that's a 404, so a missing render or sound fails as missing,
// instead of arriving as a 200 HTML page. Anything else keeps the old fallback.
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/explore/')) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
    }
    return env.ASSETS.fetch(request);
  },
};
