// ==========================================================================
// MOTVIND NORGE — the case page the pile's Motvind card opens in the portal
// (#app-motvind). Built from the Figma design «motvind norge v2» (node
// 158:859): a top bar, a contents list on the left, one page at a time in the
// middle and Forrige / Neste with a row of dots below it, over the landscape.
//
// The pages are data (MOTVIND_PAGES): a page lists its blocks, rendered by
// the block types in BLOCKS. A page without blocks shows a placeholder. New
// pages are added one at a time by giving them blocks, with the same template.
// The old long case text stays in script.js (PROJECT_DETAILS.motvind).
// ==========================================================================
(function () {
  const view = document.getElementById('app-motvind');
  const root = document.getElementById('motvindPages');
  if (!view || !root) return;

  const ASSETS = 'assets/motvind/';
  const LANDSCAPE = ASSETS + 'landskap-01.webp';
  // Fraunces (the titles) and Space Grotesk 400 are only used here: their
  // stylesheet is added once the case is on its way, not with the site.
  const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,600,0,1&family=Space+Grotesk:wght@400&display=swap';

  // The four chapters and their colours (Figma: the bars, dots and labels).
  // `framed`: its dots sit in a pill of their own, as Innsikten's do.
  const GROUPS = {
    oppgaven: {rgb: '212, 178, 91'},
    innsikten: {rgb: '119, 171, 167', framed: true},
    valget: {rgb: '242, 121, 71'},
    'ble-til': {rgb: '166, 196, 110'},
    annerledes: {rgb: '199, 154, 176'},
  };

  // In reading order, one dot each. `toc` is the page's row in the contents
  // list (with `icon`, an indented sub-page); a page without one lights the
  // row above it. Text is from Figma; «emosjonelt» and the last line of the
  // challenge were corrected with the author's approval (2026-11-20).
  const MOTVIND_PAGES = [
    {id: 'oppgaven', group: 'oppgaven', title: 'Oppgaven', toc: 'Oppgaven', blocks: [
      {type: 'kicker', text: 'RVK2101 · GRUPPEOPPGAVE, FIRE PERSONER · MIN DEL: RESEARCH OG INNSIKT'},
      {type: 'note', text: 'Faget Reklame og visuell kommunikasjon (RVK2101), våren 2026. Leveransene var posisjoneringsstrategi, reklamefilmskisse og pitch. Motvind Norge var kunde i oppgaven, men var ikke selv med.'},
      {type: 'question', text: 'Hvordan posisjonerer man kjernekraft mot en målgruppe som er åpen, men ikke overbevist?'},
      {type: 'lead', text: 'Vi var et fiktivt byrå på fire og skulle velge én av fire organisasjoner i kjernekraftdebatten som kunde. Min del var innsikt, tolkning og strategi.'},
      {type: 'callout', label: 'UTFORDRINGEN', lines: [
        'Debatten var i bevegelse.',
        'For å løse oppgaven tenkte jeg vi ikke kunne forsøke å vinne over de som ikke er overbevist  med enda flere energiargumenter,',
        'men heller gi dem en historie som kan treffe dem emosjonelt nært.',
        'Da landet vi på dem som lever tett på norsk natur.',
      ], link: {text: 'Se hvordan vi svarte på den', page: 'svaret'}},
    ]},
    {id: 'innsikten', group: 'innsikten', title: 'Innsikten', toc: '1.  Innsikten'},
    {id: 'debatten-i-tall', group: 'innsikten', title: 'Debatten i tall', toc: '1.1  Debatten i tall', icon: 'tall'},
    {id: 'avsenderne', group: 'innsikten', title: 'Avsenderne', toc: '1.2  Avsenderne', icon: 'avsenderne'},
    {id: 'avsenderne-naert', group: 'innsikten', title: 'Avsenderne på nært hold'},
    {id: 'folgerne', group: 'innsikten', title: 'Følgerne', toc: '1.3  Følgerne', icon: 'folgerne'},
    {id: 'kulturen', group: 'innsikten', title: 'Kulturen', toc: '1.4  Kulturen', icon: 'kulturen'},
    {id: 'valget', group: 'valget', title: 'Valget', toc: '2.  Valget og svaret'},
    {id: 'svaret', group: 'valget', title: 'Svaret på utfordringen'},
    {id: 'hva-det-ble-til', group: 'ble-til', title: 'Hva det ble til', toc: '3.  Hva det ble til'},
    {id: 'annerledes', group: 'annerledes', title: 'Hva jeg ville gjort annerledes', toc: '4.  Hva jeg ville gjort annerledes'},
  ];

  // ---- A small element builder: (tag, attributes, ...children). Text is
  // always set as text, never as HTML.
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'style') node.style.cssText = value;
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  // ---- The block types a page is made of. `heading` marks the block the
  // page's focus goes to when it is opened from the contents list.
  const BLOCKS = {
    kicker: (b) => el('p', {class: 'mv-kicker'}, b.text),
    note: (b) => el('p', {class: 'mv-note'}, b.text),
    question: (b) => el('h3', {class: 'mv-question', tabindex: '-1', 'data-heading': true}, b.text),
    lead: (b) => el('p', {class: 'mv-lead'}, b.text),
    callout: (b) => el('div', {class: 'mv-callout'},
      el('p', {class: 'mv-kicker'}, b.label),
      el('p', {class: 'mv-callout-text'}, b.lines.map((line) => el('span', {class: 'mv-line'}, line))),
      b.link && el('button', {class: 'mv-callout-link', type: 'button', 'data-goto': b.link.page}, b.link.text)),
  };

  // A page not built yet: its title and a line saying so.
  function placeholder(page) {
    return [
      el('h3', {class: 'mv-question mv-question--placeholder', tabindex: '-1', 'data-heading': true}, page.title),
      el('p', {class: 'mv-lead'}, 'Denne siden kommer snart.'),
    ];
  }

  // ---- The frame: contents list, the page, Forrige / dots / Neste.
  const tocLabel = el('p', {class: 'mv-toc-label', id: 'motvindTocLabel'}, 'INNHOLD');
  const tocList = el('ol', {class: 'mv-toc-list'});
  const toc = el('nav', {class: 'mv-toc', id: 'motvindToc', 'aria-labelledby': 'motvindTocLabel'}, tocLabel, tocList);
  const tocToggle = el('button', {class: 'mv-toc-toggle', type: 'button', 'aria-controls': 'motvindToc', 'aria-expanded': 'false'}, 'Innhold');
  const page = el('article', {class: 'mv-page'});
  const prev = el('button', {class: 'mv-step mv-step--prev', type: 'button', 'data-step': '-1'},
    el('span', {'aria-hidden': 'true'}, '←'), el('span', {class: 'mv-step-text'}, '  Forrige'));
  const next = el('button', {class: 'mv-step mv-step--next', type: 'button', 'data-step': '1'},
    el('span', {class: 'mv-step-text'}, 'Neste  '), el('span', {'aria-hidden': 'true'}, '→'));
  const dots = el('div', {class: 'mv-dots'});
  const status = el('p', {class: 'mv-status', 'aria-live': 'polite'});
  const main = el('div', {class: 'mv-main'}, tocToggle, page,
    el('nav', {class: 'mv-pager', 'aria-label': 'Bla i casen'}, prev, dots, next), status);
  root.append(el('div', {class: 'mv-side'}, toc), main);

  // Contents rows: a page with `toc` gets one; the rest light the row above.
  const rows = [];
  const rowOf = new Map();
  MOTVIND_PAGES.forEach((p) => {
    if (p.toc) {
      const group = GROUPS[p.group];
      const marker = p.icon
        ? el('img', {class: 'mv-toc-icon', src: `${ASSETS}ikon-${p.icon}.svg`, width: '16', height: '16', alt: ''})
        : el('span', {class: 'mv-toc-bar', 'aria-hidden': 'true'});
      const button = el('button', {class: `mv-toc-item${p.icon ? ' mv-toc-item--sub' : ''}`, type: 'button',
        'data-goto': p.id, style: `--mv-rgb: ${group.rgb}`}, marker, el('span', {class: 'mv-toc-text'}, p.toc));
      tocList.append(el('li', {}, button));
      rows.push({page: p, button});
    }
    rowOf.set(p.id, rows[rows.length - 1]);
  });

  // The dots, grouped by chapter; a framed chapter's dots share a pill.
  const dotButtons = [];
  let groupBox = null;
  let lastGroup = null;
  MOTVIND_PAGES.forEach((p, i) => {
    const group = GROUPS[p.group];
    const dot = el('button', {class: 'mv-dot', type: 'button', 'data-goto': p.id, style: `--mv-rgb: ${group.rgb}`,
      'aria-label': `Side ${i + 1} av ${MOTVIND_PAGES.length}: ${p.title}`}, el('span', {class: 'mv-dot-mark'}));
    dotButtons.push(dot);
    if (p.group !== lastGroup) {
      if (lastGroup) dots.append(el('span', {class: 'mv-dot-gap', 'aria-hidden': 'true'}));
      groupBox = group.framed ? el('span', {class: 'mv-dot-group', 'data-group': p.group, style: `--mv-rgb: ${group.rgb}`}) : null;
      if (groupBox) dots.append(groupBox);
      lastGroup = p.group;
    }
    (groupBox || dots).append(dot);
  });

  // ---- Showing a page.
  let current = 0;
  const indexOf = (id) => MOTVIND_PAGES.findIndex((p) => p.id === id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function render(index, {announce = true, focus = null} = {}) {
    current = Math.max(0, Math.min(MOTVIND_PAGES.length - 1, index));
    const p = MOTVIND_PAGES[current];
    const group = GROUPS[p.group];
    view.dataset.page = p.id;
    view.style.setProperty('--mv-group-rgb', group.rgb);

    page.dataset.placeholder = String(!p.blocks);
    page.replaceChildren(...(p.blocks ? p.blocks.map((b) => BLOCKS[b.type](b)) : placeholder(p)));
    page.setAttribute('aria-label', p.title);
    page.scrollTop = 0;
    page.classList.remove('is-entering');
    if (!reduced.matches) { void page.offsetWidth; page.classList.add('is-entering'); }

    const lit = rowOf.get(p.id);
    rows.forEach((row) => {
      const here = row === lit;
      const sameGroup = row.page.group === p.group;
      row.button.toggleAttribute('aria-current', false);
      if (here) row.button.setAttribute('aria-current', 'page');
      // A chapter row lights while one of its pages is open; a sub-page row
      // only for its own page. Sub-page icons: lit, in the open chapter, or not.
      row.button.classList.toggle('is-lit', here || (!row.page.icon && sameGroup));
      row.button.dataset.near = row.page.icon && sameGroup && !here ? 'true' : 'false';
    });

    dotButtons.forEach((dot, i) => {
      dot.dataset.state = i < current ? 'past' : i === current ? 'current' : 'future';
      dot.toggleAttribute('aria-current', false);
      if (i === current) dot.setAttribute('aria-current', 'page');
    });
    dots.querySelectorAll('.mv-dot-group').forEach((box) => box.classList.toggle('is-open', box.dataset.group === p.group));

    prev.classList.toggle('is-hidden', current === 0);
    next.classList.toggle('is-hidden', current === MOTVIND_PAGES.length - 1);
    // A step button that has just gone away hands its focus to the other one.
    const active = document.activeElement;
    if ((active === prev && current === 0) || (active === next && current === MOTVIND_PAGES.length - 1)) {
      (active === prev ? next : prev).focus({preventScroll: true});
    }

    if (announce) status.textContent = `Side ${current + 1} av ${MOTVIND_PAGES.length}: ${p.title}`;
    if (focus === 'heading') page.querySelector('[data-heading]')?.focus({preventScroll: true});
  }

  function go(index, options) {
    if (index < 0 || index >= MOTVIND_PAGES.length || index === current) return;
    render(index, options);
  }

  function setToc(open, {focus = false} = {}) {
    view.classList.toggle('is-toc-open', open);
    tocToggle.setAttribute('aria-expanded', String(open));
    if (open && focus) (tocList.querySelector('[aria-current]') || tocList.querySelector('button'))?.focus({preventScroll: true});
  }

  // Clicks: contents rows and the challenge's link take focus to the new
  // page's heading; the dots and Forrige / Neste keep it where it is.
  root.addEventListener('click', (event) => {
    // Where the list lies over the page, a click beside it folds it away.
    if (view.classList.contains('is-toc-open') && !event.target.closest('.mv-side, .mv-toc-toggle')) setToc(false);
    const step = event.target.closest('[data-step]');
    if (step) { go(current + Number(step.dataset.step)); return; }
    const target = event.target.closest('[data-goto]');
    if (!target) return;
    const fromToc = !!target.closest('.mv-toc');
    const fromDots = target.classList.contains('mv-dot');
    if (fromToc) setToc(false);
    go(indexOf(target.dataset.goto), {focus: fromDots ? null : 'heading'});
  });
  tocToggle.addEventListener('click', () => setToc(!view.classList.contains('is-toc-open'), {focus: true}));

  // Keys, while the case is open: ←/→ turn the page, Home/End go to the
  // first and last, Escape closes the contents list where it folds away.
  document.addEventListener('keydown', (event) => {
    if (!view.classList.contains('active') || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target !== document.body && !view.contains(target)) return;
    if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const moves = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: MOTVIND_PAGES.length - 1};
    if (event.key in moves) {
      event.preventDefault();
      go(moves[event.key]);
    } else if (event.key === 'Escape' && view.classList.contains('is-toc-open')) {
      event.preventDefault();
      setToc(false);
      tocToggle.focus({preventScroll: true});
    }
  });

  // ---- Fonts and landscape: fetched once the case is on its way (its card
  // picked up or thrown from the keyboard), or at the latest when it opens.
  let warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    document.head.append(el('link', {rel: 'stylesheet', href: FONTS}));
    const image = new Image();
    image.decoding = 'async';
    image.src = LANDSCAPE;
    if (document.fonts?.load) {
      ['600 40px Fraunces', '400 14px "Space Grotesk"', '500 15px "Space Grotesk"', '700 11px "Space Grotesk"']
        .forEach((font) => document.fonts.load(font).catch(() => {}));
    }
  }
  // Whether the card was last thrown from the keyboard (Enter or Space on it).
  let keyboardThrow = false;
  const warmOn = (event) => {
    if (!event.target.closest?.('[data-pile-app="motvind"]')) return;
    warm();
    if (event.type === 'pointerdown') keyboardThrow = false;
    else if (event.key === 'Enter' || event.key === ' ') keyboardThrow = true;
  };
  document.addEventListener('pointerdown', warmOn, true);
  document.addEventListener('keydown', warmOn, true);

  // The portal lifts its page toward the eye, which draws it larger than its
  // CSS pixels (scene-camera.js reader). The case is zoomed back by as much,
  // so its sizes are the Figma design's own on screen; motvind-case.css
  // reads --mv-zoom, on the portal page so «Få tilbake kort» has it too.
  // The landscape (1824 x 992 in Figma) covers the panel from its right foot.
  // Where the contents list stands, it is drawn at least large enough that
  // its moon (380 px from the left, 20 px across) lies under the list's glass
  // rather than cut by its edge or behind the page's first lines.
  const SCENE = {width: 1824, height: 992, moonX: 380, moonR: 20};
  const side = root.querySelector('.mv-side');
  const portalPage = view.closest('.portal-page');
  function fit() {
    if (!portalPage || !view.classList.contains('active')) return;
    const shown = portalPage.getBoundingClientRect().width;
    if (!(shown > 0) || !portalPage.offsetWidth) return;
    const zoom = (portalPage.offsetWidth / shown).toFixed(3);
    if (portalPage.style.getPropertyValue('--mv-zoom') !== zoom) portalPage.style.setProperty('--mv-zoom', zoom);
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    const listed = getComputedStyle(side).position !== 'absolute';
    const under = listed ? (w - side.offsetWidth + SCENE.moonR) / (SCENE.width - SCENE.moonX) : 0;
    const scale = Math.max(w / SCENE.width, h / SCENE.height, under);
    view.style.setProperty('--mv-scene-width', Math.ceil(SCENE.width * scale) + 'px');
  }
  let fitting = 0;
  addEventListener('resize', () => { if (!fitting) fitting = requestAnimationFrame(() => { fitting = 0; fit(); }); });

  // Each time the case opens it starts at Oppgaven. A visitor who threw the
  // card from the keyboard is taken to the page's heading.
  let wasOpen = false;
  new MutationObserver(() => {
    const open = view.classList.contains('active');
    if (open === wasOpen) return;
    wasOpen = open;
    if (!open) { setToc(false); return; }
    warm();
    fit();
    render(0, {announce: false, focus: keyboardThrow ? 'heading' : null});
    keyboardThrow = false;
  }).observe(view, {attributes: true, attributeFilter: ['class']});

  render(0, {announce: false});

  // For tests and for adding pages: the data and a way to turn to a page.
  window.motvindCase = {pages: MOTVIND_PAGES, groups: GROUPS, go: (id) => go(indexOf(id)), get current() { return MOTVIND_PAGES[current].id; }};
})();
