/* When the room is genuinely ready, for the loading portal to wait on.
   Loaded first, in <head>. The parts it waits for:
   - room:  the room's shaders compiled, its first full frame (room and
            foreground together) drawn, and two more frames after it, so
            nothing the first frame leaves behind lands after entry
            (room-scene.js);
   - water, depth, orb: the portal's own layers (portal-surface.js,
            portal-depth.js, portal-effects.js). Each reports 'deferred' as
            it starts: under the cloth or asleep at first, they are set up
            once the visitor is in (afterEntry, below), long before the cloth
            can come off, so their shaders no longer compete with the room's
            and the building's while the page loads;
   - font:  Cinzel, the cloth's inscription, settled (loaded or failed); it
            is repainted when it arrives, a visible swap and a stall if late.
   window.siteReady resolves with {state, ms, parts}: state 'ready'; or
   'fallback' when the room has no WebGL and shows its silhouette; or
   'degraded' when a script failed to load or threw while starting, in which
   case the page shows what it has instead of waiting forever. The same
   detail goes out as a 'site-ready' event on window. Nothing here is a
   timer or a guess: every part settles on what actually happened. */
(() => {
  const started = performance.now(), parts = new Map();
  let settle, state = 'ready', settled = false;
  window.siteReady = new Promise(resolve => { settle = resolve; });
  const finish = () => {
    if (settled || [...parts.values()].some(part => !part.done)) return;
    settled = true;
    const detail = {state, ms: Math.round(performance.now() - started),
      parts: Object.fromEntries([...parts].map(([name, part]) => [name, part.result]))};
    document.documentElement.dataset.siteReady = state;
    settle(detail);
    dispatchEvent(new CustomEvent('site-ready', {detail}));
  };
  const mark = (name, result) => {
    const part = parts.get(name);
    if (!part || part.done) return;
    part.done = true; part.result = result; part.at = Math.round(performance.now() - started);
    finish();
  };
  for (const name of ['room', 'water', 'depth', 'orb', 'font']) parts.set(name, {done: false});
  window.siteReadiness = {
    // A part is ready (result: 'ready', 'css' for a CSS stand-in, 'fallback').
    done(name, result = 'ready') { if (result === 'fallback') state = state === 'degraded' ? state : 'fallback'; mark(name, result); },
    // A part can never be ready: show the page with what there is.
    fail(name, error) { state = 'degraded'; console.warn('Loading: ' + name + ' failed:', error?.message || error); mark(name, 'failed'); },
    // Settles a part from a promise (resolved: ready; rejected: failed).
    track(name, promise) { Promise.resolve(promise).then(result => this.done(name, result), error => this.fail(name, error)); },
    get parts() { return Object.fromEntries([...parts].map(([name, part]) => [name, {...part}])); },
    // Work wanted only once the visitor is in (the portal's own layers, and
    // what they show): it runs after entry ('site-entered'; at once where
    // there is no loading gate), one piece at a time, while the browser is
    // idle.
    afterEntry(work) { later.push(work); if (entered && later.length === 1) idle(next); },
    // The order of the load, so the building always begins first: it has
    // drawn its first frame in its own thread (loading-exterior-3d.js), or
    // stands in with its fallback, or there is none. The room waits for that
    // before it builds (room-scene.js), at most 5 s: building at once, it
    // starved the building's start, which the gate then gave up on.
    get exterior() { return exterior; },
    exteriorStarted() { startExterior(); },
  };
  let startExterior;
  const exterior = Promise.race([new Promise(resolve => { startExterior = resolve; }), new Promise(resolve => setTimeout(resolve, 5000))]);
  const later = [];
  let entered = false;
  const idle = run => window.requestIdleCallback ? requestIdleCallback(run, {timeout: 1000}) : setTimeout(run, 200);
  const next = () => {
    const work = later.shift();
    try { work?.(); } catch (error) { console.warn('After entry:', error?.message || error); }
    if (later.length) idle(next);
  };
  const enter = () => { if (entered) return; entered = true; if (later.length) idle(next); };
  addEventListener('site-entered', enter, {once: true});
  const gateless = () => { if (!document.getElementById('loadingGate')) { enter(); startExterior(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gateless, {once: true});
  else gateless();
  // An uncaught error before the room is ready means a part may never
  // report: everything still waiting is given up, and the page shows.
  const broken = event => {
    if (settled) return;
    for (const [name, part] of parts) if (!part.done) window.siteReadiness.fail(name, event.error || event.reason || event.message);
  };
  addEventListener('error', broken);
  addEventListener('unhandledrejection', broken);
  // The cloth's inscription font (index.html's Google Fonts link). Asked for
  // once the parser is done: the body's scripts wait for the head's
  // stylesheets, so its @font-face is known by then (DOMContentLoaded would
  // also wait for the room's module scripts to run).
  const loadFont = () => {
    const font = document.fonts?.load('600 64px Cinzel');
    if (font) font.then(faces => window.siteReadiness.done('font', faces.length ? 'ready' : 'missing'), () => window.siteReadiness.done('font', 'missing'));
    else window.siteReadiness.done('font', 'missing');
  };
  if (document.readyState === 'loading') document.addEventListener('readystatechange', loadFont, {once: true});
  else loadFont();
})();
