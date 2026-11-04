/* When the room is genuinely ready, for the loading portal to wait on, and
   how far the load has come, for its bar. Loaded first, in <body>. The parts
   it waits for:
   - room:  the room's shaders compiled, its first full frame (room and
            foreground together) drawn, and two more frames after it, so
            nothing the first frame leaves behind lands after entry
            (room-scene.js);
   - water, depth, orb: the portal's own layers (portal-surface.js,
            portal-depth.js, portal-effects.js), their shaders linked or
            fallen back to CSS. They are set up once the room is built
            (beforeScene, below), so they compile beside the room's shaders
            rather than ahead of them, and are ready before the scene begins;
   - font:  Cinzel, the cloth's inscription, settled (loaded or failed); it
            is repainted when it arrives, a visible swap and a stall if late.
   window.siteReady resolves with {state, ms, parts}: state 'ready'; or
   'fallback' when the room has no WebGL and shows its silhouette; or
   'degraded' when a script failed to load or threw while starting, in which
   case the page shows what it has instead of waiting forever. The same
   detail goes out as a 'site-ready' event on window. Nothing here is a
   timer or a guess: every part settles on what actually happened.

   window.siteProgress: the load in four steps, in order, each weighted by its
   usual share of a first visit and moved only by what actually happened:
   - files  'Henter filer': the page's scripts, modules and stylesheets
            fetched (resource timing);
   - build  'Bygger rommet': the room built (room-scene.js);
   - light  'Forbereder lyset': the room's shader programs compiled, counted
            as each finishes, then its first frame;
   - finish 'Nesten klar': the portal's layers, the building ready in its
            thread and the last frames before the scene (loading-gate.js).
   A step that holds the page (the room's build, its first frame) can say
   how long it usually takes (expect): the bar moves on through it on the
   compositor, but never past that step's own end. The value never goes back. */
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
    // A room that settles without saying it was built (no WebGL, a failed
    // script) still lets the portal's layers set up.
    if (name === 'room') build();
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
    // Work that waits for the room to be built (the portal's own layers, and
    // what they show): it runs once the room says so (roomBuilt), or once the
    // room has settled some other way, one piece at a time, between the
    // page's other tasks; at once where there is no loading gate.
    beforeScene(work) { later.push(work); if (built && later.length === 1) idle(next); },
    roomBuilt() { build(); },
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
  let built = false;
  const idle = run => setTimeout(run, 0);
  const next = () => {
    const work = later.shift();
    try { work?.(); } catch (error) { console.warn('Before the scene:', error?.message || error); }
    if (later.length) idle(next);
  };
  const build = () => { if (built) return; built = true; if (later.length) idle(next); };
  const gateless = () => { if (!document.getElementById('loadingGate')) { build(); startExterior(); } };
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

  // ---- Progress (window.siteProgress, above). Each step's share of the
  // bar, from its usual share of a first visit on a laptop's GPU.
  const steps = [
    {name: 'files', label: 'Henter filer', weight: .12},
    {name: 'build', label: 'Bygger rommet', weight: .2},
    {name: 'light', label: 'Forbereder lyset', weight: .58},
    {name: 'finish', label: 'Nesten klar', weight: .1},
  ];
  const fraction = Object.fromEntries(steps.map(step => [step.name, 0])), listeners = new Set();
  let value = 0, hint = null;
  const startOf = name => steps.slice(0, steps.findIndex(step => step.name === name)).reduce((sum, step) => sum + step.weight, 0);
  const current = () => steps.find(step => fraction[step.name] < 1) || steps.at(-1);
  const publish = () => {
    let sum = 0;
    for (const step of steps) sum += step.weight * fraction[step.name];
    value = Math.max(value, Math.min(1, sum));
    const step = current(), detail = {value, step: step.name, label: step.label, expect: hint};
    for (const listen of listeners) { try { listen(detail); } catch {} }
  };
  window.siteProgress = {
    steps: steps.map(({name, label}) => ({name, label})),
    // A step has come this far (0-1). Steps overlap (the building gets ready
    // in its thread while the room compiles), so each counts only itself.
    set(name, part) {
      if (!(name in fraction)) return;
      fraction[name] = Math.max(fraction[name], Math.min(1, part));
      if (hint?.name === name && fraction[name] >= hint.to) hint = null;
      publish();
    },
    // A step about to hold the page for about ms: the bar may move on to
    // `to` of that step meanwhile (never further), and stops there if late.
    expect(name, ms, to = 1) {
      if (!(name in fraction)) return;
      const start = startOf(name), weight = steps.find(step => step.name === name).weight;
      hint = {name, ms, to, value: start + weight * Math.max(fraction[name], to * .97)};
      publish();
    },
    get value() { return value; },
    get step() { return current().name; },
    subscribe(listen) { listeners.add(listen); listen({value, step: current().name, label: current().label, expect: hint}); return () => listeners.delete(listen); },
  };
  // Files: everything the page names (scripts, modules, stylesheets),
  // counted as it arrives. The parser is done once the body's scripts are
  // known, so the list is taken then.
  const loaded = new Set();
  const named = () => [...document.querySelectorAll('script[src], link[rel="modulepreload"], link[rel="stylesheet"]')]
    .map(el => new URL(el.src || el.href, document.baseURI).href);
  const countFiles = () => {
    const wanted = named();
    if (!wanted.length) return;
    const have = wanted.filter(url => loaded.has(url)).length;
    window.siteProgress.set('files', document.readyState === 'loading' ? Math.min(.95, have / wanted.length) : have / wanted.length);
  };
  try {
    new PerformanceObserver(list => { for (const entry of list.getEntries()) loaded.add(entry.name); countFiles(); })
      .observe({type: 'resource', buffered: true});
  } catch { /* No resource timing: the step completes with the parser below. */ }
  // Files the browser served from memory or that report no timing still count once the page is parsed.
  document.addEventListener('DOMContentLoaded', () => { for (const url of named()) loaded.add(url); countFiles(); }, {once: true});
})();
