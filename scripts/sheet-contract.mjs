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
  { id: 'food map dial', root: '#food-map', ways: { done: '.fm-done', x: '.tl-x' }, open: { room: 'cuddlecore', spot: 'locale-map' }, answer: 'press', keep: ALL },   // the first choice in it is the dial
  { id: 'food map pins', root: '#food-map', ways: { done: '.fm-done', x: '.tl-x' }, open: { room: 'cuddlecore', spot: 'locale-map' }, answer: 'pin', keep: ALL },
  { id: 'dietary', ...TELL, open: { room: 'cuddlecore', spot: 'dietary-shelf' }, answer: 'press' },
  { id: 'how you like it', root: '#hyli', ways: { done: '.hy-done', x: '.tl-x' }, open: { room: 'cuddlecore', spot: 'feels-tray' }, answer: 'press', keep: ALL },
  { id: 'little cage', root: '#hyli', ways: { done: '.hy-done', x: '.tl-x' }, open: { room: 'cuddlecore', spot: 'cage' }, answer: null, keep: ALL },
  { id: 'kitchen', ...TELL, open: { room: 'cuddlecore', spot: 'kettle' }, answer: 'press' },
  { id: 'garden kitchen', ...TELL, open: { room: 'garden-patio', spot: 'gd-bbq' }, answer: 'press',
    fresh: true },   // once Your kitchen has a barbecue, the garden's barbecue brings out an idea instead (explore/garden.js)
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
        localStorage.setItem('wa-chat-offered', '1');   // the sit-down offer is made once; its own journey clears this
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
          if (await page.evaluate(() => window.__layers?.top?.name === 'idea')) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }   // a card the sheet's answer opened is a layer with its own step
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
    for (const J of process.env.SHEETS_ONLY ? [] : JOURNEYS.filter(J => !process.env.JOURNEYS_ONLY || new RegExp(process.env.JOURNEYS_ONLY, 'i').test(J.id))) {   // JOURNEYS_ONLY=tour: just the journeys whose name matches
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
  if (S.answer === 'pin') { await page.click(`${S.root} .fm-t[aria-pressed="false"]`); return true; }   // a pin or a colour from the food map's list
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
  const r = await page.evaluate(`({ inert: ${INERT}, open: ['#tell', '#chia-mix', '#sweet-sheet', '#star-sheet', '#cook', '#book', '#basket-sheet', '#inn-map', '#hyli', '#food-map', '#tour', '#sitdown']
    .filter(s => { const el = document.querySelector(s); return el && !el.hidden; }) })`);
  return [['nothing open', !r.open.length, r.open.join(', ')], ['inert', !r.inert.length, r.inert.join(', ')]];
};
const isOpen = (page, root) => page.evaluate(r => { const el = document.querySelector(r); return !!el && !el.hidden; }, root);
const usable = (page, root) => page.evaluate(r => { const el = document.querySelector(r); return !!el && !el.hidden && !el.closest('[inert]'); }, root);
const marked = async page => page.evaluate(() => { history.replaceState({ ...(history.state || {}), probe: Math.random().toString(36).slice(2, 7) }, ''); return JSON.stringify(history.state); });
// An idea card left open (the star chart's star opens one) is a layer now, with its own history step: close it before comparing
const sameEntry = async (page, want) => { if (await page.evaluate(() => window.__layers?.top?.name === 'idea')) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  const now = await page.evaluate(() => JSON.stringify(history.state)); return [now === want, now === want ? '' : `on ${now}, want ${want}`]; };
const back = async page => { await page.evaluate(() => history.back()); await page.waitForTimeout(700); return page.evaluate(() => !!window.__explore).catch(() => false); };

// A hotspot pressed as a keyboard visitor would: the view turned to it, focused, Enter
const press = async (page, spot) => {
  await page.evaluate(async id => { const ex = window.__explore, s = ex.spot(id); ex.lookTo(s.yaw, s.pitch); await new Promise(r => setTimeout(r, 100)); document.querySelector(`.spot[data-spot="${id}"]`).focus(); }, spot);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  return page.evaluate(() => window.__explore.state.room);
};

// The first-visit tour (tour.js): a layer over the live room. Started here from the bell's Show me round (a real opener; the
// arrival offer needs a first visit, which these tabs aren't)
const tourStart = async page => {
  await page.evaluate(async () => { const ex = window.__explore; if (ex.state.room !== 'hall-entrance') { ex.goRoom('hall-entrance'); await new Promise(r => setTimeout(r, 500)); } });
  await page.click('#btn-bell');
  await page.waitForTimeout(300);
  await page.click('#welcome-tour');
  return shown(page, '#tour');
};
const tourAt = page => page.evaluate(() => window.__explore.tour.stop);
// The tour walks now (turns of 1.3-2.2 s, a fade through doors): wait for it to settle rather than for a fixed time
const tourSettled = page => page.waitForFunction(() => !window.__explore.tour.walking, null, { timeout: 15000 }).catch(() => {});

const JOURNEYS = [
  // The whole tour: seven stops through the hall, the Chiapothecary and the Conservatory, back to the foyer desk; the room
  // stays live behind it, the walk adds nothing to the trail, and Check in opens the check-in
  { id: 'the tour, start to desk', async run(page) {
    const out = [], entry = await marked(page);
    out.push(['Show me round starts the tour', await tourStart(page)]);
    const trail = await page.evaluate(() => window.__explore.state.trail.length);   // after the walk to the foyer, which is a real move
    out.push(['the room stays live behind it', await page.evaluate(() => !document.getElementById('stage')?.closest('[inert]'))]);
    out.push(['focus on Next', await page.evaluate(() => document.activeElement?.classList.contains('tr-next'))]);
    out.push(['her chat moves on as it starts', await page.evaluate(() => { const ex = window.__explore; return [...ex.state.chat].reverse().find(m => m.who === 'gemma')?.text === (ex.lines.tour?.started || 'This way, then.'); })]);
    const rooms = [];
    for (let i = 0; i < 6; i++) { await tourSettled(page); rooms.push(await page.evaluate(() => window.__explore.state.room)); await page.click('#tour .tr-next'); await page.waitForTimeout(100); }
    await tourSettled(page);
    rooms.push(await page.evaluate(() => window.__explore.state.room));
    const want = ['hall-middle', 'hall-middle', 'hall-middle', 'hall-middle', 'chiapothecary', 'glasshouse', 'hall-entrance'];
    out.push(['walks the seven stops', JSON.stringify(rooms) === JSON.stringify(want), rooms.join(' > ')]);
    out.push(['the door it talks about glows', await page.evaluate(() => document.querySelector('.spot.tour-glow')?.dataset.spot === 'checkin-desk')]);
    out.push(['nothing added to the trail', await page.evaluate(n => window.__explore.state.trail.length === n, trail)]);
    await page.click('#tour .tr-next');                    // Check in
    out.push(['Check in opens the check-in', await shown(page, '#tell')]);
    await page.click('#tell .tl-x');
    await page.waitForTimeout(500);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // Freebies (25 Oct): a complete card goes into the book as it is, free, outside the daily allowance; closing an idea card
  // keeps nothing; the phone's Back closes an open idea card instead of leaving the page
  { id: 'a complete card goes into the book free', async run(page) {
    const out = [], entry = await marked(page);
    const left0 = await page.evaluate(() => window.__explore.writer.left);
    await page.evaluate(() => window.__explore.keepIdea('boil-an-egg', '', 'button'));
    await page.click('#btn-book');
    out.push(['the basket opens', await shown(page, '#basket-sheet')]);
    out.push(['the card says it is free, as it is', await page.evaluate(() => /Free, as it is/.test(document.querySelector('#basket-sheet .bs-list')?.textContent || ''))]);
    await page.click('#basket-sheet [data-tick="boil-an-egg"]');
    out.push(['one button, with the split line', await page.evaluate(() => /Add to my book/.test(document.querySelector('#basket-sheet .bs-write')?.textContent || '') && /as it is/.test(document.querySelector('#basket-sheet .bs-split')?.textContent || ''))]);
    await page.click('#basket-sheet .bs-write');
    await page.waitForTimeout(800);
    out.push(['it is in the book as written-shape, flagged as it is', await page.evaluate(() => window.__explore.book.get('boil-an-egg')?.full?.asIs === true)]);
    out.push(['the allowance is untouched', await page.evaluate(l => window.__explore.writer.left === l, left0), `was ${left0}`]);
    await page.click('#basket-sheet .bk-close');
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__explore.bookView.open('boil-an-egg', { from: 'chip' }));
    out.push(['its page shows the how-to and the Write it out instead button', await shown(page, '#book') && await page.evaluate(() => /How to/.test(document.querySelector('#book')?.textContent || '') && /Write it out for me instead/.test(document.querySelector('#book')?.textContent || ''))]);
    await page.click('#book .bk-close');
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__explore.book.remove('boil-an-egg'));
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  { id: 'the idea card: Back and Escape close it, keeping nothing', async run(page) {
    const out = [], entry = await marked(page);
    const basketN = () => page.evaluate(() => JSON.parse(localStorage.getItem('wa-basket') || '{}')?.items?.length ?? JSON.parse(localStorage.getItem('wa-basket') || '[]').length ?? 0);
    const n0 = await basketN();
    for (const way of ['back', 'escape']) {
      await page.evaluate(() => { const i = window.__explore.ideas; i.add({ atom: 'which-knife', why: '' }, null, { force: true }); i.open('which-knife'); });
      await page.waitForTimeout(400);
      out.push([`the card opens (${way})`, await page.evaluate(() => window.__explore.ideas.openAtom === 'which-knife')]);
      if (way === 'back') out.push(['Back stays in the Inn (idea)', await back(page)]); else { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
      out.push([`${way} closes the card`, await page.evaluate(() => window.__explore.ideas.openAtom === null)]);
      out.push([`${way} kept nothing`, (await basketN()) === n0]);
      await page.evaluate(() => window.__explore.ideas.remove('which-knife'));
    }
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // QA 6 B1 and F3: the first-visit offer is a card that stays on screen (not chat chips that can sit under the human-check
  // box), it's marked offered once it's up, No and Escape decline it, Yes starts the tour, and Escape or Back out of the tour
  // puts you back in the room you started in
  { id: 'the tour offer card, and Escape returns you home', async run(page) {
    const out = [], entry = await marked(page);
    const offer = () => page.evaluate(() => { localStorage.removeItem('wa-tour-offered'); return window.__explore.tour.offer(); });
    out.push(['a first visit gets the offer', await offer()]);
    out.push(['it shows as a card', await shown(page, '#tour')]);
    out.push(['marked offered once it is up', await page.evaluate(() => localStorage.getItem('wa-tour-offered') === '1')]);
    out.push(['both answers are on screen', await page.evaluate(() => [...document.querySelectorAll('#tour .tr-btns button')].every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight; }))]);
    await page.click('#tour .tr-skip');
    await page.waitForTimeout(400);
    out.push(['No declines it with the check-in offer', !await isOpen(page, '#tour') && await page.evaluate(() => window.__explore.state.chips.some(c => c.do[0] === 'checkin'))]);
    out.push(['an unanswered offer is let go by a tap elsewhere', await (async () => {
      await offer(); await shown(page, '#tour');
      await page.evaluate(() => window.__explore.touch?.('door-flourish'));
      await page.waitForTimeout(400);
      return !await isOpen(page, '#tour');
    })()]);
    await page.evaluate(() => window.__explore.goRoom('hall-entrance'));
    await page.waitForTimeout(600);
    const home = await page.evaluate(() => window.__explore.state.room);
    await offer(); await shown(page, '#tour');
    await page.click('#tour .tr-next');
    out.push(['Yes starts the tour', await page.evaluate(() => window.__explore.tour.stop === 1)]);
    await page.click('#tour .tr-next');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    out.push(['Escape ends it', !await isOpen(page, '#tour')]);
    out.push(['and puts you back where you started', await page.evaluate(h => window.__explore.state.room === h, home), home]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // The top bar's Tour button runs the same tour; the ideas explainer's beats (explainer.js) each come once and stay quiet
  // while the tour runs
  { id: 'the top bar tour button and the explainer beats', async run(page) {
    const out = [], entry = await marked(page);
    out.push(['the Tour button fits the bar and is 44 px to tap on a phone', await page.evaluate(() => { const b = document.getElementById('btn-tour'); const r = b.getBoundingClientRect(); return (innerWidth > 560 || r.width + 6 >= 44) && r.right <= innerWidth && r.top >= 0; })]);
    await page.click('#btn-tour');
    out.push(['it starts the tour', await shown(page, '#tour')]);
    out.push(['no beat speaks over the tour', await page.evaluate(() => { const ex = window.__explore; return ex.state.chat.filter(m => m.who === 'gemma').every(m => !/my ideas for you|write up to/.test(m.text)); })]);
    await page.click('#tour .tr-skip');
    await page.waitForTimeout(500);
    const first = await page.evaluate(() => window.__explore.explain.basketAdd());   // true if it spoke
    const again = await page.evaluate(() => window.__explore.explain.basketAdd());
    out.push(['the basket beat plays once', again === false, `first ${first}, again ${again}`]);
    await page.waitForTimeout(500);
    out.push(['it names the allowance from the code, not a typed number', await page.evaluate(() => { const t = window.__explore.state.chat.filter(m => m.who === 'gemma').map(m => m.text).join(' '); return !/\d a day/.test(t); })]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // Skip, Escape and Back end it where you stand, with the check-in offer; a door tapped mid-tour walks you in
  { id: 'the tour: skip, escape, back, a door', async run(page) {
    const out = [];
    for (const way of ['skip', 'escape', 'back', 'door']) {
      const entry = await marked(page);
      if (!await tourStart(page)) { out.push([`the tour starts (${way})`, false]); continue; }
      await page.click('#tour .tr-next');
      await tourSettled(page);                                // the slow turn to the next door
      if (way === 'skip') await page.click('#tour .tr-skip');
      else if (way === 'escape') await page.keyboard.press('Escape');
      else if (way === 'back') out.push(['Back stays in the Inn (tour)', await back(page)]);
      else out.push(['the glowing door walks you in', await press(page, 'door-flourish') === 'flourish']);
      await page.waitForTimeout(500);
      out.push([`${way} ends the tour`, !await isOpen(page, '#tour') && (await tourAt(page)) === 0]);
      if (way !== 'door') out.push([`${way}: the check-in offer follows`, await page.evaluate(() => window.__explore.state.chips.some(c => c.do[0] === 'checkin'))]);
      out.push(...(await clean(page)).map(([c, ok, n]) => [`${c} (${way})`, ok, n]));
      const [ok, note] = await sameEntry(page, entry);
      out.push([`history balanced (${way})`, ok, note]);
    }
    return out;
  } },
  // The tour steps inside (26 Oct): a guest who rests at a door sees the room behind it on its own picture, turned to something
  // characteristic, and one who taps Next straight away never loads it; Skip while peeking walks back out to the door
  { id: 'the tour steps inside the room at a door', async run(page) {
    const out = [], entry = await marked(page);
    out.push(['Show me round starts the tour', await tourStart(page)]);
    await page.waitForTimeout(500);
    out.push(['a quick look stays at the door', await page.evaluate(() => window.__explore.state.room === 'hall-middle')]);
    await page.waitForFunction(() => window.__explore.state.room === 'cuddlecore', null, { timeout: 12000 }).catch(() => {});   // the turn, the rest at the door, the walk in
    await tourSettled(page);
    out.push(['resting there steps into Cuddlecore', await page.evaluate(() => window.__explore.state.room === 'cuddlecore')]);
    out.push(['and something there glows', await page.evaluate(() => !!document.querySelector('.spot.tour-glow'))]);
    await page.click('#tour .tr-skip');
    await page.waitForTimeout(500);
    out.push(['Skip while inside walks back out to the hall', await page.evaluate(() => window.__explore.state.room === 'hall-middle')]);
    out.push(['and ends the tour', !await isOpen(page, '#tour')]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
  // Shall we sit down for a chat? (26 Oct, sitdown.js): offered once, Yes walks to Cuddlecore with one glowing object a step,
  // Later leaves it on the bell's card (not there before); Skip, Escape and Back end it (Escape and Back take you home), a tap goes on
  { id: 'sit down for a chat: offer, steps, skip, escape, back', async run(page) {
    const out = [];
    const offer = () => page.evaluate(() => { localStorage.removeItem('wa-chat-offered'); window.__explore.sitdown.offer(); });
    await page.evaluate(async () => { const ex = window.__explore; if (ex.state.room !== 'hall-entrance') { ex.goRoom('hall-entrance'); await new Promise(r => setTimeout(r, 500)); } });
    const home = await page.evaluate(() => window.__explore.state.room);
    {
      const entry = await marked(page);
      await page.evaluate(() => localStorage.removeItem('wa-chat-bell'));
      out.push(['the bell has no chat before Later', await (async () => { await page.click('#btn-bell'); await page.waitForTimeout(300); const ok = await page.evaluate(() => document.getElementById('welcome-chat').hidden); await page.click('#welcome-ok'); await page.waitForTimeout(900); return ok; })()]);
      await offer();
      out.push(['the offer shows as a card', await shown(page, '#sitdown')]);
      out.push(['asked only once a browser', await page.evaluate(() => { const ex = window.__explore; localStorage.setItem('wa-chat-offered', '1'); ex.sitdown.offer(); return !document.getElementById('sitdown').hidden; })]);
      await page.click('#sitdown .tr-skip');                  // Later
      await page.waitForTimeout(400);
      out.push(['Later closes it', !await isOpen(page, '#sitdown')]);
      out.push(['and the bell has it', await (async () => { await page.click('#btn-bell'); await page.waitForTimeout(300); const ok = await page.evaluate(() => !document.getElementById('welcome-chat').hidden); await page.click('#welcome-ok'); await page.waitForTimeout(900); return ok; })()]);
      out.push(...await clean(page));
      const [ok, note] = await sameEntry(page, entry);
      out.push(['history balanced (later)', ok, note]);
    }
    for (const way of ['done', 'skip', 'escape', 'back', 'door']) {
      const entry = await marked(page);
      await page.evaluate(async h => { const ex = window.__explore; if (ex.state.room !== h) { ex.goRoom(h); await new Promise(r => setTimeout(r, 500)); } }, home);
      await offer(); await shown(page, '#sitdown');
      await page.click('#sitdown .tr-next');                  // Yes
      await page.waitForTimeout(1800);                        // the step forward and the fade through the door
      out.push([`Yes walks to Cuddlecore (${way})`, await page.evaluate(() => window.__explore.state.room === 'cuddlecore' && window.__explore.sitdown.step === 1)]);
      out.push([`an object glows (${way})`, await page.evaluate(() => !!document.querySelector('.spot.tour-glow'))]);
      if (way === 'done') {
        let n = 1;
        while (await page.evaluate(() => !document.getElementById('sitdown').classList.contains('last')) && n++ < 8) { await page.click('#sitdown .tr-next'); await page.waitForTimeout(250); }
        out.push(['the last step is her closing line', await page.evaluate(() => /other things around the Inn/.test(document.querySelector('#sitdown .tr-line').textContent))]);
        await page.click('#sitdown .tr-next');
      } else {
        await page.click('#sitdown .tr-next');
        await page.waitForTimeout(250);
        if (way === 'skip') await page.click('#sitdown .tr-skip');
        else if (way === 'escape') await page.keyboard.press('Escape');
        else if (way === 'back') out.push(['Back stays in the Inn (chat)', await back(page)]);
        else out.push(['a glowing object opens its sheet', await press(page, 'locale-map') !== undefined]);
      }
      await page.waitForTimeout(600);
      out.push([`${way} ends the chat`, !await isOpen(page, '#sitdown') && await page.evaluate(() => window.__explore.sitdown.step === 0)]);
      if (way === 'escape' || way === 'back') out.push([`${way} takes you home`, await page.evaluate(h => window.__explore.state.room === h, home)]);
      if (way === 'door') { for (const sel of ['#food-map', '#tell']) if (await isOpen(page, sel)) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); } }
      out.push(...(await clean(page)).map(([c, ok, n]) => [`${c} (${way})`, ok, n]));
      const [ok, note] = await sameEntry(page, entry);
      out.push([`history balanced (${way})`, ok, note]);
    }
    return out;
  } },
  // The garden (24 Oct): out through Flourish's stable door to the patio, down to the camp and back, home through the
  // stable door; and the Inn map walks there now it's built
  { id: 'the garden walk', async run(page) {
    const out = [];
    await page.evaluate(async () => { const ex = window.__explore; if (ex.state.room !== 'flourish') { ex.goRoom('flourish'); await new Promise(r => setTimeout(r, 500)); } });
    for (const [spot, want] of [['fl-back-door', 'garden-patio'], ['gd-to-camp', 'garden-camp'], ['gd-to-patio', 'garden-patio'], ['gd-flourish-door', 'flourish']]) {
      const room = await press(page, spot);
      out.push([`${spot} goes to ${want}`, room === want, `in ${room}`]);
    }
    const entry = await marked(page);
    await page.click('#btn-map');
    await shown(page, '#inn-map');
    out.push(['the garden is open on the Inn map', await page.evaluate(() => { const b = document.querySelector('#inn-map .im-room[data-go="garden-patio"]'); return !!b && !/soon/i.test(b.className + b.textContent); })]);
    await page.click('#inn-map .im-room[data-go="garden-patio"]');
    await page.waitForTimeout(1500);
    const room = await page.evaluate(() => window.__explore.state.room);
    out.push(['the Inn map walks to the garden', room === 'garden-patio', `in ${room}`]);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
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
  // A write-out that can't get the visitor pass (29 Oct): the basket says why, in Gemma's words, and the person check comes to the
  // basket (its own slot) when Turnstile needs the visitor, with nothing spent from the 3 a day. A stand-in Turnstile that asks for
  // a tick; the Worker routes are stubbed by the contract, so the pass never arrives
  { id: 'a write-out waiting on the person check', async run(page) {
    const out = [], entry = await marked(page);
    const kept = await page.evaluate(() => {
      const ex = window.__explore, a = ex.world.atoms.find(x => !x.complete && x.kind === 'recipe idea' && !ex.book.has(x.id)) || ex.world.atoms.find(x => !x.complete && !ex.book.has(x.id));
      if (!a) return null;
      ex.keepIdea(a.id, '', 'button');
      return a.id;
    });
    if (!kept) return [['a leaflet to write', false]];
    const left0 = await page.evaluate(() => window.__explore.writer.left);
    // 1. the seam fails for want of a pass: the line says why (a check is on screen, so it says to tick the box)
    await page.evaluate(() => { window.__checkShowing = true; window.__recipeFetch = async () => { throw new Error('turnstile: no visitor pass'); }; });
    await page.click('#btn-book');
    out.push(['the basket opens', await shown(page, '#basket-sheet')]);
    await page.click(`#basket-sheet [data-tick="${kept}"]`);
    await page.click('#basket-sheet .bs-write');
    await page.waitForFunction(() => document.querySelector('#basket-sheet .bs-fail'), null, { timeout: 4000 }).catch(() => {});
    const line = await page.evaluate(() => document.querySelector('#basket-sheet .bs-fail')?.textContent || '');
    out.push(['it says why: a quick check that you are a person', /a person/i.test(line) && /tick the box/i.test(line), line]);
    out.push(['it is still in the basket and the allowance is untouched', await page.evaluate(([id, l]) => !!document.querySelector('[data-tick="' + id + '"]') && window.__explore.writer.left === l, [kept, left0])]);
    // 2. no check on screen: the same failure asks them to try again and tick a box if one appears
    await page.evaluate(() => { window.__checkShowing = false; });
    await page.click('#basket-sheet .bs-write');
    await page.waitForFunction(() => /try again in a moment/i.test(document.querySelector('#basket-sheet .bs-fail')?.textContent || ''), null, { timeout: 4000 }).catch(() => {});
    out.push(['with no box showing it does not say to tick one', await page.evaluate(() => /try again in a moment/i.test(document.querySelector('#basket-sheet .bs-fail')?.textContent || ''))]);
    // 3. a Turnstile that needs the tick: the real recipeFetch brings the box into the basket's slot, inside the sheet and on screen
    await page.evaluate(() => {
      window.__checkShowing = undefined; window.__recipeFetch = undefined;
      window.__stub = { renders: 0, opts: null };
      window.turnstile = { render(el, opts) { window.__stub.renders++; window.__stub.opts = opts; el.dataset.stub = '1'; el.style.cssText = 'width:300px;height:65px;background:#ddd'; setTimeout(() => opts['before-interactive-callback'](), 20); return 'w' + window.__stub.renders; }, remove() {} };
      sessionStorage.removeItem('wa-genie-pass');
    });
    await page.click('#basket-sheet .bs-write');
    await page.waitForFunction(() => document.querySelector('#basket-sheet .bs-check .wa-check')?.style.display === 'flex', null, { timeout: 4000 }).catch(() => {});
    const where = await page.evaluate(() => {
      const slot = document.querySelector('#basket-sheet .bs-check'), w = slot?.querySelector('[data-stub]')?.getBoundingClientRect();
      return { inSlot: !!w, visible: !!w && !slot.hidden && w.width > 0, onScreen: !!w && w.left >= 0 && w.right <= innerWidth && w.top >= 0 && w.bottom <= innerHeight, inert: !!slot?.closest('[inert]') };
    });
    out.push(['the person check is inside the basket', where.inSlot && where.visible, JSON.stringify(where)]);
    out.push(['it is on screen and not inert', where.onScreen && !where.inert, JSON.stringify(where)]);
    // The stand-in gives up (three errors): the line says to try again, the check goes, nothing is spent
    await page.evaluate(() => { const o = window.__stub.opts; o['error-callback']('x'); o['error-callback']('x'); o['error-callback']('x'); });
    await page.waitForFunction(() => document.querySelector('#basket-sheet .bs-fail') && !document.querySelector('#basket-sheet .bs-check [data-stub]'), null, { timeout: 4000 }).catch(() => {});
    out.push(['the check leaves when it is done and the line shows', await page.evaluate(() => !document.querySelector('#basket-sheet .bs-check [data-stub]') && !!document.querySelector('#basket-sheet .bs-fail'))]);
    out.push(['nothing was spent', await page.evaluate(l => window.__explore.writer.left === l, left0)]);
    await page.evaluate(() => { delete window.turnstile; window.__recipeFetch = async () => new Response('{}'); });
    await page.click('#basket-sheet .bk-close');
    await page.waitForTimeout(400);
    out.push(...await clean(page));
    const [ok, note] = await sameEntry(page, entry);
    out.push(['history balanced', ok, note]);
    return out;
  } },
];
