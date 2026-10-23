// The sheet contract (code-health-plan.md, step 1): every sheet and dialog in the Inn, opened from its real opener and closed
// every way it offers (Done, ✕, Escape, Back). After each close:
//   - closed:   the sheet is hidden, and Back didn't leave the Inn
//   - inert:    nothing in the page is left inert
//   - history:  the page is on the same history entry it was on before the sheet opened (no step left over, none taken too many)
//   - focus:    focus is back on what opened it
//   - kept:     an answer tapped in the sheet is kept, where the sheet's policy says it should be for that way out
// While it's open (accessibility-review-1.md, section A): the room behind it is inert and focus is inside it. Escape closes
// that one layer and nothing else (A1: it used to shrink the chat too).
// Plus three journeys: sheets over sheets (cook mode and the shopping list over the book, Tell Gemma from the book), the
// Tell Gemma menu into one of its sheets, and a centrepiece's cast finishing while another sheet is open.
//
// Known failures are listed in EXPECTED with a note: they're reported, not failed, until the layer manager fixes them.
// A known failure that passes is a warning, so the list is kept honest. Anything else that fails fails the check.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- what each sheet is, how it opens, and which ways out it has
// open: { room, spot } is a hotspot, focused and pressed with Enter (a keyboard visitor's real path, so focus can return
// to it); { chip } is a bar chip; a function is a journey of real clicks. ways: a selector for Done and ✕ (null: the
// sheet has none). answer: a tap that changes something (null: nothing to keep). keep: the ways out that keep the answer.
const ALL = ['done', 'x', 'escape', 'back'];
const TELL = { root: '#tell', ways: { done: '.tl-done-bottom', x: '.tl-x' }, keep: ALL };   // every way out keeps (Nicole, 24 Oct)
const SWEET = { root: '#sweet-sheet', ways: { done: '.sw-done', x: '.tl-x' }, keep: ALL };
const DIALOG = (root, ok) => ({ root, ways: { done: ok, x: null }, keep: ALL, dialog: true });
export const SHEETS = [
  { id: 'pantry', ...TELL, open: { room: 'cuddlecore', spot: 'pantry-cabinet' }, answer: 'pantry' },
  { id: 'map', ...TELL, open: { room: 'cuddlecore', spot: 'locale-map' }, answer: 'press' },
  { id: 'dietary', ...TELL, open: { room: 'cuddlecore', spot: 'dietary-shelf' }, answer: 'press' },
  { id: 'kitchen', ...TELL, open: { room: 'cuddlecore', spot: 'kettle' }, answer: 'press' },
  { id: 'check-in', ...TELL, open: { room: 'hall-entrance', spot: 'checkin-desk' }, answer: 'press' },
  { id: 'chia mood', root: '#chia-mix', ways: { done: '.mx-done', x: '.tl-x' }, open: { room: 'chiapothecary', spot: 'flasks' }, answer: 'press', keep: ALL },
  { id: 'the Mix', root: '#chia-mix', ways: { done: null, x: '.tl-x' }, open: { room: 'chiapothecary', spot: 'pudding-jars' }, answer: 'press', keep: ALL },
  { id: 'sweetness', ...SWEET, open: { room: 'sweet-spells', spot: 'potion-cabinet' }, answer: 'press' },
  { id: 'cravings', ...SWEET, open: { room: 'sweet-spells', spot: 'spell-books' }, answer: 'press' },
  { id: 'occasion', ...SWEET, open: { room: 'sweet-spells', spot: 'lectern' }, answer: 'press' },
  { id: 'star chart', root: '#star-sheet', ways: { done: '.sc-done', x: '.tl-x' }, open: { room: 'sweet-spells', spot: 'star-chart' }, answer: 'star', keep: ALL,
    fresh: true },   // her reading brings the star's idea out: in a used tab it's been served, so its page opens in the book (by design)
  { id: 'basket', root: '#basket-sheet', ways: { done: null, x: '.bk-close' }, open: { chip: '#btn-book' }, answer: null },
  { id: 'book', root: '#book', ways: { done: null, x: '.bk-close' }, open: { chip: '#btn-mybook' }, answer: null },
  { id: 'inn map', root: '#inn-map', ways: { done: null, x: '.tl-x' }, open: { chip: '#btn-map' }, answer: null },
  { id: 'barometer', ...DIALOG('#weather', '#weather-ok'), open: { room: 'cuddlecore', spot: 'barometer' }, answer: 'weather' },
  { id: 'clock', ...DIALOG('#clockdlg', '#clock-ok'), open: { room: 'cuddlecore', spot: 'clock' }, answer: 'press' },
  { id: 'seasons wheel', ...DIALOG('#seasondlg', '#season-ok'), open: { room: 'glasshouse', spot: 'seasons-wheel' }, answer: 'press' },
];

// Today's known failures (23 Oct, main e7f5e48), reported but not failed. Key: "<sheet> <way>: <what>". The layer manager
// (explore/layers.js, step 2) is meant to empty this list
export const EXPECTED = {};   // empty since every sheet and dialog moved onto layers.js (23 Oct); new known failures go here, with a note

// ---------- page helpers (run in the page)
const PROBE = `(() => {
  const ex = window.__explore;
  return { about: JSON.stringify(ex.visit.all()), weather: ex.state.weather, time: ex.state.time, season: ex.state.season,
           chat: [...ex.state.chat].reverse().find(m => m.who === 'gemma')?.text || '' };   // her newest line (the log keeps 60, so not a count)
})()`;
const INERT = `[...document.querySelectorAll('[inert]')].map(e => e.id || e.className || e.tagName).map(String)`;

export async function sheetContract({ browser, base, root, sizes = [[375, 812], [1280, 800]], step = () => {} }) {
  const results = [];                                          // { size, sheet, way, check, ok, note }
  const atom = pickAtom(root);
  for (const [width, height] of sizes) {
    const size = `${width}x${height}`;
    step(`sheet contract ${size}`);
    const phone = width < 900;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: phone, isMobile: false });
    await ctx.addInitScript(([rec]) => {
      try {
        localStorage.setItem('wa-welcomed', '1');
        if (!sessionStorage.getItem('wa-check')) {
          sessionStorage.setItem('wa-check', '1');
          sessionStorage.setItem('wa-door-done', '1');
          sessionStorage.setItem('wa-explore', JSON.stringify({ time: 'midday', asked: true }));
          // One written recipe in the book, for cook mode and the shopping list; the book's explainer already seen
          localStorage.setItem('wa-book', JSON.stringify({ v: 1, kept: [rec], everKept: true, hint: true, introSeen: true }));
        }
      } catch { /* storage blocked */ }
      // Write-outs answer locally after a moment (the seam writeout.js reads), so a cast can still be writing when a sheet opens
      window.__recipeFetch = async () => { await new Promise(r => setTimeout(r, window.__writeDelay ?? 300));
        return new Response(JSON.stringify({ recipe: { name: 'Test', serves: 2, time: '10 min', ingredients: [{ item: 'oats', amount: '1', unit: 'cup', key: 'oats' }],
          steps: [{ text: 'Stir.' }, { text: 'Serve.' }] } }), { headers: { 'Content-Type': 'application/json' } }); };
    }, [atom]);
    await ctx.route(/whiskedaway-genie|challenges\.cloudflare\.com/, route => route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
    let page = await ctx.newPage();
    const errors = [];
    const onErr = e => errors.push(String(e.message).slice(0, 160));
    page.on('pageerror', onErr);
    page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(20000);                              // a sheet that never opens or closes fails fast, not after 30 s
    const load = async (room = 'cuddlecore') => {
      // after a Back that left the Inn, that navigation may still be landing: let it, then come back in
      for (let i = 0; ; i++) {
        try { await page.goto(`${base}/?room=${room}`, { waitUntil: 'load' }); break; } catch (e) { if (i >= 2) throw e; await page.waitForTimeout(500); }
      }
      await page.waitForFunction(() => window.__explore?.goRoom && window.__explore.spot, null, { timeout: 15000 });
      await page.waitForTimeout(400);
    };
    // A new tab after Back has left the Inn, so the next case starts on a clean history
    const fresh = async () => { const old = page; page = await ctx.newPage(); old.close().catch(() => {});   // never waited on: closing a tab mid-navigation can hang
      page.on('pageerror', onErr); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(20000); await load(); };
    await load();
    let bad = false;                                           // this case failed something: the next one starts in a new tab
    const rec = (sheet, way, check, ok, note = '') => { if (!ok) bad = true; results.push({ size, sheet, way, check, ok, note }); };

    // SHEETS_ONLY=pantry,book runs just those (journeys too, unless SHEETS_ONLY is set): for quick runs while building
    const pick = process.env.SHEETS_ONLY?.split(",");
    for (const S of SHEETS.filter(x => !pick || pick.includes(x.id))) {
      for (const way of ALL) {
        const sel = way === 'done' || way === 'x' ? S.ways[way] : true;
        if (!sel) continue;                                     // this sheet has no such way out
        const wasBad = bad; bad = false;
        if (process.env.SHEETS_VERBOSE) console.log(`  · ${size} ${S.id} ${way}`);
        try { await watchdog(async () => {
          if (wasBad || S.fresh) await fresh();                // fresh: a new tab (a new visit) for each way out
          if (!(await page.evaluate(() => !!window.__explore))) await load();
          await settleClean(page);
          // Escape is tested with the chat at Short, where a second Escape handler would shrink it (A1)
          const chatBefore = way === 'escape' ? await page.evaluate(() => { window.__explore.chatUI.choose?.('short', 'button'); return document.body.dataset.chat; }) : null;
          const opener = await openSheet(page, S);
          if (!opener.ok) { rec(S.id, way, 'opens', false, opener.note); return; }
          if (way === 'escape') {                               // once per sheet: what's true while it's open
            const during = await page.evaluate(root => ({ behind: !!document.getElementById('stage')?.closest('[inert]'),
              inside: !!document.querySelector(root)?.contains(document.activeElement) }), S.root);
            rec(S.id, 'open', 'room behind inert', during.behind);
            rec(S.id, 'open', 'focus inside', during.inside);
          }
          const before = await page.evaluate(PROBE);
          const answered = await answer(page, S);
          const r = await closeBy(page, S, way);
          const chatAfter = chatBefore && !r.left ? await page.evaluate(() => document.body.dataset.chat) : null;   // at once: an idea card coming out later lowers the chat by design
          if (r.left) { rec(S.id, way, 'closed', false, 'Back left the Inn'); return; }
          await page.waitForTimeout(900);                       // her line after a close waits 200 ms, then types 350 ms
          const after = await page.evaluate(([root, openerSel]) => ({
            hidden: (() => { const el = document.querySelector(root); return !el || el.hidden || (el.classList.contains('tool') && !el.classList.contains('open')); })(),
            focus: openerSel ? document.activeElement === document.querySelector(openerSel) : null,
            active: (document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName || '').toString().slice(0, 40),
          }), [S.root, opener.sel]);
          rec(S.id, way, 'closed', after.hidden);
          const inert = await page.evaluate(INERT);
          rec(S.id, way, 'inert', !inert.length, inert.length > 4 ? `${inert.slice(0, 4).join(', ')} and ${inert.length - 4} more` : inert.join(', '));
          const hist = await page.evaluate(() => history.state);
          const balanced = JSON.stringify(hist) === JSON.stringify(opener.state);
          rec(S.id, way, 'history', balanced, balanced ? '' : `on ${JSON.stringify(hist)}, want ${JSON.stringify(opener.state)}`);
          rec(S.id, way, 'focus', after.focus, after.focus ? '' : `focus on ${after.active}`);
          if (chatBefore) {
            rec(S.id, way, 'closes only itself', chatAfter === chatBefore, chatAfter === chatBefore ? '' : `the chat went from ${chatBefore} to ${chatAfter}`);
          }
          if (answered) {
            const now = await page.evaluate(PROBE);
            const kept = S.answer === 'star' ? now.chat !== before.chat : S.answer === 'weather' ? now.weather !== before.weather
              : now.about !== before.about || now.time !== before.time || now.season !== before.season;
            const want = S.keep.includes(way);
            rec(S.id, way, 'kept', kept === want, want ? (kept ? '' : 'the answer was lost') : (kept ? 'kept, though this way out cancels' : ''));
          }
        }); } catch (e) { rec(S.id, way, 'runs', false, String(e.message).split('\n')[0].slice(0, 140)); }
      }
    }

    // ---------- journeys
    for (const J of process.env.SHEETS_ONLY ? [] : JOURNEYS) {
      try {
        if (process.env.SHEETS_VERBOSE) console.log(`  · ${size} ${J.id}`);
        await fresh();
        await settleClean(page);
        const out = await watchdog(() => J.run(page, { atom }), 60000);
        for (const [check, ok, note] of out) rec(J.id, '-', check, ok, note || '');
      } catch (e) { rec(J.id, '-', 'runs', false, String(e.message).split('\n')[0].slice(0, 140)); }
    }
    for (const e of [...new Set(errors)]) rec('page', '-', 'script error', false, e);
    await ctx.close();
  }
  if (process.env.SHEETS_DUMP) (await import('node:fs')).writeFileSync(process.env.SHEETS_DUMP, JSON.stringify(results, null, 1));
  return results;
}

/** fn, or a failure after `ms` (an evaluate that never returns would otherwise hang the whole check) */
function watchdog(fn, ms = 30000) {
  let timer;
  return Promise.race([fn(), new Promise((_, no) => { timer = setTimeout(() => no(new Error(`hung for ${ms / 1000} s`)), ms); })])
    .finally(() => clearTimeout(timer));
}

/** Report: failures not in EXPECTED fail the check; expected ones are listed; expected ones that passed are warnings */
export function judge(results) {
  const key = r => `${r.sheet} ${r.way === '-' ? '' : `${r.way} `}${r.check}`.replace(/\s+/g, ' ');
  const failing = new Map();                                   // key -> [sizes, note]
  for (const r of results.filter(x => !x.ok)) {
    const k = key(r), f = failing.get(k) || { sizes: [], note: r.note };
    f.sizes.push(r.size);
    failing.set(k, f);
  }
  const fails = [], expected = [], fixed = [];
  for (const [k, f] of failing) (EXPECTED[k] ? expected : fails).push(`${k} (${f.sizes.join(', ')})${f.note ? `: ${f.note}` : ''}`);
  for (const k of Object.keys(EXPECTED)) if (!failing.has(k) && results.some(r => key(r) === k)) fixed.push(`${k} now passes: take it off EXPECTED in scripts/sheet-contract.mjs`);
  const cases = new Set(results.map(r => `${r.size} ${r.sheet} ${r.way}`)).size;
  return { cases, checks: results.length, fails, expected: expected.map(e => `${e} [${EXPECTED[e.split(' (')[0]]}]`), fixed };
}

// ---------- the steps
function pickAtom(root) {
  const w = JSON.parse(readFileSync(join(root, 'blender/explore/cuddlecore-world.json'), 'utf8'));
  const a = w.atoms.find(x => x.kind === 'recipe idea') || w.atoms[0];
  return { id: a.id, title: a.title, room: a.room, kind: a.kind, key_ingredients: a.key_ingredients, why: '', kept: Date.now(), visit: 'contract',
           full: { name: a.title, serves: 2, time: '10 min', ingredients: [{ item: 'oats', amount: '1', unit: 'cup', key: 'oats' }, { item: 'milk', amount: '1', unit: 'cup', key: 'milk' }],
                   steps: [{ text: 'Stir.' }, { text: 'Serve.' }], tip: '' } };
}

/** Before each case: no sheet open, nothing inert, and a fresh history entry to come back to */
async function settleClean(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
}

async function openSheet(page, S) {
  const o = S.open;
  if (o.room) {
    const ok = await page.evaluate(async ([room, id]) => {
      const ex = window.__explore, wait = ms => new Promise(r => setTimeout(r, ms));
      if (ex.state.room !== room) { ex.goRoom(room); await wait(500); }
      const s = ex.spot(id);
      if (!s) return `no hotspot ${id} in ${room}`;
      ex.lookTo(s.yaw, s.pitch);
      await wait(100);
      const el = document.querySelector(`.spot[data-spot="${id}"]`);
      if (!el || el.style.display === 'none') return `hotspot ${id} not on screen`;
      history.replaceState({ ...(history.state || {}), probe: Math.random().toString(36).slice(2, 7) }, '');
      el.focus();
      return '';
    }, [o.room, o.spot]);
    if (ok) return { ok: false, note: ok };
    const state = await page.evaluate(() => history.state);
    await page.keyboard.press('Enter');
    const sel = `.spot[data-spot="${o.spot}"]`;
    return (await shown(page, S.root)) ? { ok: true, sel, state } : { ok: false, note: `${S.root} didn't open` };
  }
  const state = await page.evaluate(() => { history.replaceState({ ...(history.state || {}), probe: Math.random().toString(36).slice(2, 7) }, ''); return history.state; });
  await page.click(o.chip);
  return (await shown(page, S.root)) ? { ok: true, sel: o.chip, state } : { ok: false, note: `${S.root} didn't open` };
}

async function shown(page, root) {
  try {
    await page.waitForFunction(r => { const el = document.querySelector(r); return el && !el.hidden && (!el.classList.contains('tool') || el.classList.contains('open')); }, root, { timeout: 2500 });
    await page.waitForTimeout(250);                             // the 200 ms fade
    return true;
  } catch { return false; }
}

/** Tap something in the sheet that changes an answer; true if there was one to tap. It must be a change from what's already
 *  kept: a way out that keeps is told apart from one that cancels by the answer changing, and the cases share a page */
async function answer(page, S) {
  if (!S.answer) return false;
  if (S.answer === 'pantry') {                                  // a word not in the pantry yet (the last way out kept the one before)
    const have = await page.evaluate(root => [...document.querySelectorAll(`${root} .tl-chip`)].map(x => x.firstChild.textContent.trim()), S.root);
    await page.fill(`${S.root} .tl-input`, ['lentils', 'barley', 'quinoa', 'chickpeas', 'couscous'].find(w => !have.includes(w)));
    return true;
  }
  if (S.answer === 'star') { await page.click(`${S.root} .sc-star`); await page.waitForTimeout(300); return true; }
  // the first unpressed choice in the sheet's body (not a close, Done, Back or Next); where that's past a limit (the map's three
  // cuisines) and doesn't press, the first pressed one unpressed instead
  const did = await page.evaluate(root => {
    const el = document.querySelector(root);
    const pick = p => [...el.querySelectorAll(`button[aria-pressed="${p}"]`)].find(x => x.offsetParent && !x.closest('header, footer, .tl-foot') && !x.disabled);
    const b = pick('false');
    if (!b) return false;
    b.click();
    if (b.isConnected && b.getAttribute('aria-pressed') === 'false') pick('true')?.click();
    return true;
  }, S.root);
  await page.waitForTimeout(150);
  return did;
}

async function closeBy(page, S, way) {
  if (way === 'done' || way === 'x') {
    const sel = `${S.root} ${S.ways[way]}`;
    await page.evaluate(s => { const b = [...document.querySelectorAll(s)].find(x => x.offsetParent) || document.querySelector(s); b.click(); }, sel);
  } else if (way === 'escape') {
    await page.keyboard.press('Escape');
  } else {
    // A different document after Back (a page further back, or about:blank) means Back left the Inn
    try { await page.evaluate(() => { window.__sameDoc = true; setTimeout(() => history.back()); }); } catch { return { left: true }; }
    await page.waitForTimeout(700);
    const left = await page.evaluate(() => !window.__sameDoc).catch(() => true);
    if (left) return { left: true };
  }
  return {};
}

// ---------- journeys: [check, ok, note] rows
const clean = async page => {
  const r = await page.evaluate(`({ inert: ${INERT}, open: ['#tell', '#chia-mix', '#sweet-sheet', '#star-sheet', '#cook', '#book', '#basket-sheet', '#inn-map']
    .filter(s => { const el = document.querySelector(s); return el && !el.hidden; }) })`);
  return [['nothing open', !r.open.length, r.open.join(', ')], ['inert', !r.inert.length, r.inert.join(', ')]];
};
const isOpen = (page, root) => page.evaluate(r => { const el = document.querySelector(r); return !!el && !el.hidden; }, root);
const usable = (page, root) => page.evaluate(r => { const el = document.querySelector(r); return !!el && !el.hidden && !el.closest('[inert]'); }, root);
const marked = async page => page.evaluate(() => { history.replaceState({ ...(history.state || {}), probe: Math.random().toString(36).slice(2, 7) }, ''); return JSON.stringify(history.state); });
const sameEntry = async (page, want) => { const now = await page.evaluate(() => JSON.stringify(history.state)); return [now === want, now === want ? '' : `on ${now}, want ${want}`]; };
const back = async page => { await page.evaluate(() => history.back()); await page.waitForTimeout(700); return page.evaluate(() => !!window.__explore).catch(() => false); };

const JOURNEYS = [
  // The Inn map: tap a room and you walk there, with the map closed and its history step gone
  { id: 'inn map walks to a room', async run(page) {
    const out = [];
    await page.evaluate(async () => { const ex = window.__explore; if (ex.state.room !== 'cuddlecore') { ex.goRoom('cuddlecore'); await new Promise(r => setTimeout(r, 500)); } });
    const entry = await marked(page);
    await page.click('#btn-map');
    out.push(['the Inn map opens', await shown(page, '#inn-map')]);
    out.push(['the room is inert behind it', await page.evaluate(() => !!document.getElementById('stage')?.closest('[inert]'))]);
    await page.click('#inn-map .im-room[data-go="flourish"]');
    await page.waitForTimeout(1500);                          // its step back, "In you go." and the 0.7 s walk
    const room = await page.evaluate(() => window.__explore.state.room);
    out.push(['walked to Flourish', room === 'flourish', `in ${room}`]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // "In this room": a hotspot from the list closes the map and turns the view to it
  { id: 'inn map: in this room', async run(page) {
    const out = [], entry = await marked(page);
    await page.click('#btn-map');
    await shown(page, '#inn-map');
    const id = await page.evaluate(() => { const b = document.querySelector('#inn-map .im-list button'); b?.click(); return b?.textContent || ''; });
    await page.waitForTimeout(1200);
    out.push(['a hotspot in the list', !!id]);
    out.push(['the view turned to it', await page.evaluate(() => window.__explore.state.trail.at(-1)?.kind === 'map')]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  { id: 'the chat at Full (phones)', async run(page) {
    if ((await page.evaluate(() => innerWidth)) >= 720) return [];   // on a computer Full is just a bigger window, not a sheet
    const out = [], entry = await marked(page);
    for (const way of ['escape', 'back', 'scrim']) {
      await page.evaluate(() => { const c = window.__explore.chatUI; c.choose('short', 'button'); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { document.querySelector('#chatwin .cw-more')?.focus(); window.__explore.chatUI.choose('full', 'button'); });
      await page.waitForTimeout(300);
      out.push([`Full is a sheet (${way})`, await page.evaluate(() => !!document.getElementById('stage')?.closest('[inert]'))]);
      if (way === 'escape') await page.keyboard.press('Escape');
      else if (way === 'back') out.push(['Back stays in the Inn (chat)', await back(page)]);
      else await page.click('.cw-scrim', { position: { x: 20, y: 20 } });   // above the chat, which covers its middle
      await page.waitForTimeout(500);
      const size = await page.evaluate(() => document.body.dataset.chat);
      out.push([`${way} goes back to Short`, size === 'short', `at ${size}`]);
      out.push(...(await clean(page)).map(([c, ok, n]) => [`${c} (${way})`, ok, n]));
      const [ok, note] = await sameEntry(page, entry);
      out.push([`history balanced (${way})`, ok, note]);
    }
    return out;
  } },
  { id: 'opener gone', async run(page) {
    const out = [];
    await page.evaluate(async () => { const ex = window.__explore, s = ex.spot('pantry-cabinet'); ex.lookTo(s.yaw, s.pitch); await new Promise(r => setTimeout(r, 100)); document.querySelector('.spot[data-spot="pantry-cabinet"]').focus(); });
    await page.keyboard.press('Enter');
    out.push(['the pantry opens', await shown(page, '#tell')]);
    await page.evaluate(() => { document.querySelector('.spot[data-spot="pantry-cabinet"]')?.remove(); });   // its hotspot goes, as on a room change
    await page.click('#tell .tl-x');
    await page.waitForTimeout(600);
    const at = await page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'body' : (a.id || a.className || a.tagName).toString().slice(0, 40); });
    out.push(['focus has somewhere to go', at !== 'body', `focus on ${at}`]);
    out.push(...await clean(page));
    return out;
  } },
  { id: 'cook over the book', async run(page, { atom }) {
    const out = [], entry = await marked(page);
    await page.click('#btn-mybook');
    await shown(page, '#book');
    await page.click(`#book [data-open="${atom.id}"]`);
    await page.waitForTimeout(400);
    const bookEntry = await page.evaluate(() => JSON.stringify(history.state));
    for (const way of ['x', 'escape', 'back']) {
      await page.click('#book .bk-cook:not(.bk-need)');
      out.push([`cook opens (${way})`, await shown(page, '#cook')]);
      out.push([`cook usable over the book (${way})`, await usable(page, '#cook')]);
      if (way === 'x') await page.click('#cook .ck-x');
      else if (way === 'escape') await page.keyboard.press('Escape');
      else out.push([`Back stays in the Inn (cook)`, await back(page)]);
      await page.waitForTimeout(500);
      out.push([`cook closed by ${way}, book still open and usable`, await usable(page, '#book')]);
      const [ok, note] = await sameEntry(page, bookEntry);
      out.push([`history back on the book's step (cook ${way})`, ok, note]);
      out.push([`focus back on Cook this (cook ${way})`, await page.evaluate(() => document.activeElement?.matches('.bk-cook'))]);
    }
    await page.click('#book .bk-close');
    await page.waitForTimeout(500);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  { id: 'shopping list in the book', async run(page) {
    const out = [], entry = await marked(page);
    await page.click('#btn-mybook');
    await shown(page, '#book');
    await page.click('#book [data-go="contents"]');
    await page.waitForTimeout(300);
    const bookEntry = await page.evaluate(() => JSON.stringify(history.state));
    for (const way of ['done', 'escape', 'back', 'x']) {
      await page.click('#book .bk-need');
      await page.waitForTimeout(400);
      out.push([`list opens (${way})`, await page.evaluate(() => !!document.querySelector('#book .bk-back'))]);
      if (way === 'done') await page.click('#book .bk-back');
      else if (way === 'escape') await page.keyboard.press('Escape');
      else if (way === 'back') out.push(['Back stays in the Inn (list)', await back(page)]);
      else await page.click('#book .bk-close');
      await page.waitForTimeout(500);
      if (way === 'x') break;
      out.push([`list closed by ${way}: back on Contents`, await page.evaluate(() => !document.querySelector('#book .bk-back') && !!document.querySelector('#book .bk-need'))]);
      const [ok, note] = await sameEntry(page, bookEntry);
      out.push([`history back on the book's step (list ${way})`, ok, note]);
    }
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  { id: 'Tell Gemma from the book', async run(page) {
    const out = [], entry = await marked(page);
    await page.click('#btn-mybook');
    await shown(page, '#book');
    await page.click('#book [data-go="visit"]');
    await page.waitForTimeout(300);
    const menu = await page.$('#book [data-menu]');
    if (!menu) return [['This visit has Tell me about you', false]];
    await menu.click();
    out.push(['Tell Gemma opens over the book', await shown(page, '#tell')]);
    out.push(['the book closed first', !(await isOpen(page, '#book'))]);
    out.push(['Tell Gemma usable', await usable(page, '#tell')]);
    await page.click('#tell [data-k="pantry"]');
    await page.waitForTimeout(300);
    out.push(['menu → pantry', await page.evaluate(() => document.querySelector('#tell')?.dataset.kind === 'pantry')]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  { id: 'a cast finishing under a sheet', async run(page) {
    const out = [], entry = await marked(page);
    const go = await page.evaluate(async () => {
      const ex = window.__explore, wait = ms => new Promise(r => setTimeout(r, ms));
      window.__writeDelay = 3000;
      ex.goRoom('cuddlecore'); await wait(500);
      const s = ex.spot('cauldron'); ex.lookTo(s.yaw, s.pitch); await wait(100);
      document.querySelector('.spot[data-spot="cauldron"]').focus();
      return true;
    });
    if (!go) return [['the pot is there', false]];
    await page.keyboard.press('Enter');
    out.push(['the pot opens the basket', await shown(page, '#basket-sheet')]);
    const write = await page.$('#basket-sheet .bs-write');
    out.push(['Add recipe to my book is offered', !!write]);
    if (!write) return out;
    await write.click();
    await page.waitForTimeout(200);
    await page.click('#basket-sheet .bk-close');
    await page.waitForTimeout(400);
    // While she writes, the visitor opens the pantry
    await page.evaluate(async () => { const ex = window.__explore, s = ex.spot('pantry-cabinet'); ex.lookTo(s.yaw, s.pitch); await new Promise(r => setTimeout(r, 100)); document.querySelector('.spot[data-spot="pantry-cabinet"]').focus(); });
    await page.keyboard.press('Enter');
    out.push(['the pantry opens while she writes', await shown(page, '#tell')]);
    await page.waitForTimeout(3500);                            // the write lands
    out.push(['the pantry stays usable when the write lands', await usable(page, '#tell')]);
    out.push(['nothing opened over the pantry', !(await isOpen(page, '#book')) && !(await isOpen(page, '#basket-sheet'))]);
    await page.click('#tell .tl-x');
    await page.waitForTimeout(1200);
    const bookUp = await isOpen(page, '#book');
    if (bookUp) {                                               // the written recipe opens once nothing else is (whenFree)
      out.push(['the book that opened after is usable', await usable(page, '#book')]);
      await page.click('#book .bk-close');
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => { window.__writeDelay = 300; });
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
];
