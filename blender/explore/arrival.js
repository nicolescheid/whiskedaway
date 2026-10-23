// Arrival (moved out of explore.html, architecture step 3): Gemma's first words in a visit (arrive): the check-in offer at
// the foyer desk with its pill on phones (checkinPill, endCheckinOffer, faceDesk), or her guess at the visitor's weather
// (confirmGuess); and settle, the ease out of the front door film's lens. The first-visit tour (tour.js) starts from here.
// Shared through `inn` (docs/code-map.md).

export function install(inn) {
  Object.assign(inn, { checkinPill, arrive, settle, endCheckinOffer });   // its functions, for the other modules (hoisted)
  // ---------- arrival: Gemma asks once about the visitor's weather
  // Gemma checks her guess at the visitor's weather, rather than asking from scratch (docs/gemma-voice-guide.md:
  // "love" only in the greeting, and nothing that only works by day)
  const GUESSED = {
    rain: "Hello, love. Looks like rain where you are. Is that right?",
    fair: "Hello, love. Clear skies where you are, by the look of it. Is that right?",
    change: "Hello, love. Grey and still where you are, by the look of it. Is that right?",
    stormy: "Hello, love. Sounds wild out where you are. Is that right?",
    'very-dry': "Hello, love. Hot and dry where you are, by the look of it. Is that right?",
  };
  function confirmGuess(also) {
    inn.chatLine('gemma', GUESSED[inn.state.weather]);
    inn.setChips([{ label: "That's right", do: ['confirm'] }, ...also]);
  }
  // In through the front door, the first stop is the check-in desk: Gemma offers it, and the weather confirm is one of
  // its rows (checkin-views.md). Walking past is fine
  const OPENER = () => Object.assign({ line: 'Hello, love. Want to check in? It helps me pick for you.', yes: 'Check in', no: 'Later' },
    inn.LINES.checkin?.opener);   // the content editor's words (gemma-lines.json checkin.opener)
  // On a portrait phone the chat sits at Line, which hides the chips, so the offer is a small pill on that row
  // (checkin-ux.md §3). It goes once the sheet is opened or Later is chosen, and doesn't come back that visit
  function checkinPill() {
    const row = document.querySelector('#chatwin .cw-line');
    if (!row) return;
    let pill = row.querySelector('.cw-checkin');
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'cw-checkin';
      pill.onclick = e => { e.stopPropagation(); inn.CHIP_ACTS.checkin(); };   // not the row's own tap, which opens the chat
      row.appendChild(pill);
    }
    pill.textContent = OPENER().yes;
    pill.hidden = !inn.state.checkinPill;
    inn.$('chatwin').classList.toggle('has-checkin-pill', !!inn.state.checkinPill);
    if (inn.state.checkinPill) inn.chatUI.setAsking(false);   // the offer never raises the chat (it would cover the desk)
  }
  // After the film's hand-over (facing down the hall), make sure the desk shows (checkin-ux.md §5): a portrait phone turns
  // to the notice board and the desk; a wider screen that doesn't quite reach the desk turns a little, so the hall and
  // the whole desk both show. Screens that already see it don't move
  const PHONE_FOYER_VIEW = { yaw: 52, pitch: -16 }, WIDE_FOYER_YAW = 20;
  function faceDesk() {
    const d = inn.spots['checkin-desk'];
    if (!d) return;
    if (innerWidth < innerHeight) return inn.lookTo(PHONE_FOYER_VIEW.yaw, PHONE_FOYER_VIEW.pitch);
    const half = Math.atan(Math.tan(inn.camera.fov * Math.PI / 360) * inn.camera.aspect) * 180 / Math.PI;   // half the view, across
    if (Math.abs(((d.yaw - inn.look.yaw + 540) % 360) - 180) > half - 16) inn.lookTo(WIDE_FOYER_YAW, inn.look.pitch);   // 16: room for the desk's label beside its dot
  }
  function arrive() {
    if (inn.state.asked || inn.state.trail.length) return;
    if (inn.state.room === 'hall-entrance') {
      inn.state.asked = true;
      inn.store.save(inn.state);
      inn.chatLine('gemma', OPENER().line);
      inn.setChips([{ label: OPENER().yes, do: ['checkin'] }, { label: OPENER().no, do: ['later'] }]);
      inn.state.checkinPill = true;
      inn.store.save(inn.state);
      checkinPill();
      inn.chatUI.setAsking(false);                           // keep the chat at Line: raised to Short it would cover the desk
      setTimeout(faceDesk, inn.reduceMotion() ? 0 : 1100);   // after the film's hand-over has settled
      return;
    }
    const guessed = inn.state.weatherFrom === 'local' && GUESSED[inn.state.weather];
    if (inn.state.room === 'cuddlecore' && guessed) {
      inn.state.asked = true;
      inn.store.save(inn.state);
      confirmGuess([{ label: 'Turn the barometer', do: ['barometer'] }]);
    } else if (guessed) {
      inn.state.asked = true;
      inn.store.save(inn.state);
      confirmGuess(Object.entries(inn.world.weathers).filter(([id]) => id !== inn.state.weather).map(([id, w]) => ({ label: w.chip || w.label, do: ['weather', id] })));
    } else if (inn.state.room === 'cuddlecore') {
      inn.state.asked = true;
      inn.store.save(inn.state);
      inn.chatLine('gemma', "Hello, love. What's the weather like for you today?");
      inn.setChips([{ label: 'Turn the barometer', do: ['barometer'] }]);
      inn.applyReveal([{ object: 'barometer' }]);
    } else if (inn.state.room === 'hall-entrance') {
      // In through the front door: the barometer is in the kitchen, so the weathers are right there in the chat
      inn.state.asked = true;
      inn.store.save(inn.state);
      inn.chatLine('gemma', "Hello, love. What's the weather like for you today?");
      inn.setChips(Object.entries(inn.world.weathers).map(([id, w]) => ({ label: w.chip || w.label, do: ['weather', id] })));
    } else {
      inn.introduce();
    }
  }
  // The film ends looking level down the hall through a narrower lens: start there, then ease out to the usual view
  function settle(fromFov) {
    const to = innerWidth < 720 ? 82 : 72, t0 = performance.now(), dur = inn.reduceMotion() ? 0 : 1600;
    inn.look.yaw = inn.room().yaw ?? 0;
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k * k * (3 - 2 * k);
      inn.camera.fov = fromFov + (to - fromFov) * e;
      inn.look.pitch = -6 * e;
      inn.camera.updateProjectionMatrix();
      inn.render();
      if (k < 1) requestAnimationFrame(step);
    };
    inn.look.pitch = 0;
    inn.camera.fov = fromFov;
    inn.camera.updateProjectionMatrix();
    inn.render();
    dur ? requestAnimationFrame(step) : step(t0);   // reduced motion: there at once
  }

  function endCheckinOffer() {
    if (inn.state.chips?.some(c => c.do?.[0] === 'checkin')) inn.setChips([]);   // the offer's chips go with it (the pill path)
    if (!inn.state.checkinPill) return;
    inn.state.checkinPill = false;
    inn.store.save(inn.state);
    checkinPill();
  }
}
