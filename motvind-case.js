// ==========================================================================
// MOTVIND NORGE — the case page the pile's Motvind card opens in the portal
// (#app-motvind). Built from the Figma design «motvind norge v2» (node
// 158:859): a top bar, a contents list on the left, one page at a time in the
// middle and Forrige / Neste with a row of dots below it, over the landscape.
// The main path is Oppgaven, Hva jeg gjorde and Neste prosjekt; the process
// lies in the folder «Prosessen», closed until the visitor opens it.
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
  // The landscape's layers, back to front (motvind-case.css).
  const LANDSCAPE = ['landskap-01-himmel.webp', 'landskap-01-fjell.webp', 'korn.webp'].map((file) => ASSETS + file);
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
  // row above it. `process`: the page lies in the folder «Prosessen», an
  // optional deep dive. It is closed by default, and Neste passes it by until
  // it is opened (the author's choice, 2026-11-21). Text is from Figma and
  // the author; «emosjonelt» and the last line of the challenge were
  // corrected with the author's approval (2026-11-20).
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
    // The author's six points (2026-11-21), on Figma's Funn card. The
    // insight has the gold edge of Figma's «Valg» box; Bourdieu is Figma's
    // Teori chip, with its tooltip.
    {id: 'hva-jeg-gjorde', group: 'oppgaven', title: 'Hva jeg gjorde', toc: 'Hva jeg gjorde', blocks: [
      {type: 'question', text: 'Hva jeg gjorde'},
      {type: 'cards', items: [
        {text: 'Kartla fire organisasjoner i kjernekraftdebatten, og vi valgte Motvind som kunde.'},
        {text: 'Analyserte Motvinds Instagram og kommentarfelt: hvem som engasjerer seg, og hva som får sterkest respons.'},
        {text: 'Leste lederen, ordvalgene og bildene deres for å forstå hva de står for.'},
        {text: 'Landet på én innsikt: Motvind kjemper ikke for en energikilde, men for retten til natur.', accent: true},
        {text: 'Plasserte målgruppene i Bourdieus sosiale rom.', chip: {text: 'Bourdieu', tip: 'Sosialt rom: målgruppekartet med tre personaer.'}},
        {text: 'Innsikten ble fundamentet for gruppens posisjoneringsstrategi.'},
      ]},
      {type: 'process', text: 'Se prosessen'},
    ]},
    {id: 'innsikten', group: 'innsikten', process: true, title: 'Innsikten', toc: '1.  Innsikten'},
    {id: 'debatten-i-tall', group: 'innsikten', process: true, title: 'Debatten i tall', toc: '1.1  Debatten i tall', icon: 'tall'},
    {id: 'avsenderne', group: 'innsikten', process: true, title: 'Avsenderne', toc: '1.2  Avsenderne', icon: 'avsenderne'},
    {id: 'avsenderne-naert', group: 'innsikten', process: true, title: 'Avsenderne på nært hold'},
    {id: 'folgerne', group: 'innsikten', process: true, title: 'Følgerne', toc: '1.3  Følgerne', icon: 'folgerne'},
    {id: 'kulturen', group: 'innsikten', process: true, title: 'Kulturen', toc: '1.4  Kulturen', icon: 'kulturen'},
    {id: 'valget', group: 'valget', process: true, title: 'Valget', toc: '2.  Valget og svaret'},
    {id: 'svaret', group: 'valget', process: true, title: 'Svaret på utfordringen'},
    {id: 'neste-prosjekt', group: 'oppgaven', title: 'Neste prosjekt', toc: 'Neste prosjekt'},
  ];
  // Parked until the author has placed them (2026-11-21): not in the list,
  // the dots or the order. Their chapters keep their colours in GROUPS.
  // {id: 'hva-det-ble-til', group: 'ble-til', title: 'Hva det ble til', toc: '3.  Hva det ble til'},
  // {id: 'annerledes', group: 'annerledes', title: 'Hva jeg ville gjort annerledes', toc: '4.  Hva jeg ville gjort annerledes'},

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
    // Figma's Funn card, numbered; `accent` gives it the «Valg» box's gold
    // edge, `chip` a Teori chip whose tooltip shows on hover and focus.
    cards: (b) => el('ol', {class: 'mv-cards'}, b.items.map((item, i) => {
      const number = String(i + 1).padStart(2, '0');
      const tipId = item.chip && `motvindTip${i + 1}`;
      return el('li', {class: `mv-card${item.accent ? ' mv-card--accent' : ''}`},
        el('p', {class: 'mv-card-label', 'aria-hidden': 'true'}, number),
        el('p', {class: 'mv-card-text'}, item.text),
        item.chip && el('span', {class: 'mv-chip-wrap'},
          el('button', {class: 'mv-chip', type: 'button', 'aria-describedby': tipId}, item.chip.text),
          el('span', {class: 'mv-chip-tip', id: tipId, role: 'tooltip'}, item.chip.tip)));
    })),
    // Opens the folder «Prosessen» and goes to its first page.
    process: (b) => el('button', {class: 'mv-step mv-step--next mv-process-open', type: 'button', 'data-open-process': true},
      el('span', {class: 'mv-step-text'}, `${b.text}  `), el('span', {'aria-hidden': 'true'}, '→')),
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
  // The process's rows lie in the folder «Prosessen», which opens and closes
  // as a disclosure (a button with aria-expanded over its list).
  const folderList = el('ol', {class: 'mv-toc-list mv-toc-folder-list', id: 'motvindProcess', hidden: true});
  const folderToggle = el('button', {class: 'mv-toc-folder-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'motvindProcess'},
    el('span', {class: 'mv-toc-chevron', 'aria-hidden': 'true'}),
    el('span', {class: 'mv-toc-folder-text'},
      el('span', {class: 'mv-toc-folder-name'}, 'Prosessen'),
      el('span', {class: 'mv-toc-folder-note'}, 'Valgfritt dypdykk')));
  const rows = [];
  const rowOf = new Map();
  let folderPlaced = false;
  MOTVIND_PAGES.forEach((p) => {
    if (p.process && !folderPlaced) {
      tocList.append(el('li', {class: 'mv-toc-folder'}, folderToggle, folderList));
      folderPlaced = true;
    }
    if (p.toc) {
      const group = GROUPS[p.group];
      const marker = p.icon
        ? el('img', {class: 'mv-toc-icon', src: `${ASSETS}ikon-${p.icon}.svg`, width: '16', height: '16', alt: ''})
        : el('span', {class: 'mv-toc-bar', 'aria-hidden': 'true'});
      const button = el('button', {class: `mv-toc-item${p.icon ? ' mv-toc-item--sub' : ''}`, type: 'button',
        'data-goto': p.id, style: `--mv-rgb: ${group.rgb}`}, marker, el('span', {class: 'mv-toc-text'}, p.toc));
      (p.process ? folderList : tocList).append(el('li', {}, button));
      rows.push({page: p, button});
    }
    rowOf.set(p.id, rows[rows.length - 1]);
  });

  // The dots, grouped by chapter; a framed chapter's dots share a pill. The
  // process's dots stand together, and show while it is in the order.
  const dotOf = new Map();
  const processDots = el('span', {class: 'mv-dots-process'});
  let groupBox = null;
  let lastGroup = null;
  let processPlaced = false;
  MOTVIND_PAGES.forEach((p) => {
    const group = GROUPS[p.group];
    const parent = p.process ? processDots : dots;
    if (p.process && !processPlaced) { dots.append(processDots); processPlaced = true; }
    const dot = el('button', {class: 'mv-dot', type: 'button', 'data-goto': p.id, style: `--mv-rgb: ${group.rgb}`},
      el('span', {class: 'mv-dot-mark'}));
    dotOf.set(p.id, dot);
    if (p.group !== lastGroup) {
      if (lastGroup) parent.append(el('span', {class: 'mv-dot-gap', 'aria-hidden': 'true'}));
      groupBox = group.framed ? el('span', {class: 'mv-dot-group', 'data-group': p.group, style: `--mv-rgb: ${group.rgb}`}) : null;
      if (groupBox) parent.append(groupBox);
      lastGroup = p.group;
    }
    (groupBox || parent).append(dot);
  });

  // ---- Showing a page. The order is the pages without the process, or with
  // it while its folder is open or one of its pages is shown.
  const pageById = new Map(MOTVIND_PAGES.map((p) => [p.id, p]));
  const firstProcess = MOTVIND_PAGES.find((p) => p.process);
  let currentId = MOTVIND_PAGES[0].id;
  let processOpen = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const order = () => MOTVIND_PAGES.filter((p) => !p.process || processOpen || pageById.get(currentId).process);

  function render(id, {announce = true, focus = null} = {}) {
    const p = pageById.get(id) || MOTVIND_PAGES[0];
    currentId = p.id;
    // A page of the process, however it is reached, opens its folder.
    if (p.process) processOpen = true;
    page.dataset.placeholder = String(!p.blocks);
    page.replaceChildren(...(p.blocks ? p.blocks.map((b) => BLOCKS[b.type](b)) : placeholder(p)));
    page.setAttribute('aria-label', p.title);
    page.scrollTop = 0;
    page.classList.remove('is-entering');
    if (!reduced.matches) { void page.offsetWidth; page.classList.add('is-entering'); }
    update({announce});
    if (focus === 'heading') page.querySelector('[data-heading]')?.focus({preventScroll: true});
  }

  // The frame around the page: contents list, folder, dots, Forrige / Neste.
  function update({announce = false} = {}) {
    const p = pageById.get(currentId);
    const group = GROUPS[p.group];
    const list = order();
    const at = list.indexOf(p);
    view.dataset.page = p.id;
    view.style.setProperty('--mv-group-rgb', group.rgb);

    const lit = rowOf.get(p.id);
    rows.forEach((row) => {
      const here = row === lit;
      const sameGroup = row.page.group === p.group;
      row.button.toggleAttribute('aria-current', false);
      if (here) row.button.setAttribute('aria-current', 'page');
      // A process chapter's row lights while one of its pages is open; a
      // sub-page row only for its own page. Sub-page icons: lit, in the open
      // chapter, or not. The main path's rows (Oppgaven, Hva jeg gjorde,
      // Neste prosjekt) share a colour but each lights only for itself.
      const chapter = !row.page.icon && sameGroup && !!row.page.process;
      row.button.classList.toggle('is-lit', here || chapter);
      row.button.dataset.near = row.page.icon && sameGroup && !here ? 'true' : 'false';
    });
    folderToggle.setAttribute('aria-expanded', String(processOpen));
    folderToggle.classList.toggle('is-lit', !!p.process);
    folderList.hidden = !processOpen;

    processDots.hidden = !list.some((q) => q.process);
    MOTVIND_PAGES.forEach((q) => {
      const dot = dotOf.get(q.id);
      const i = list.indexOf(q);
      dot.dataset.state = i < 0 || i > at ? 'future' : i < at ? 'past' : 'current';
      dot.toggleAttribute('aria-current', false);
      if (i === at) dot.setAttribute('aria-current', 'page');
      dot.setAttribute('aria-label', `Side ${i + 1} av ${list.length}: ${q.title}`);
    });
    dots.querySelectorAll('.mv-dot-group').forEach((box) => box.classList.toggle('is-open', box.dataset.group === p.group));

    const first = at === 0;
    const last = at === list.length - 1;
    prev.classList.toggle('is-hidden', first);
    next.classList.toggle('is-hidden', last);
    // A step button that has just gone away hands its focus to the other one.
    const active = document.activeElement;
    if ((active === prev && first) || (active === next && last)) (active === prev ? next : prev).focus({preventScroll: true});

    if (announce) status.textContent = `Side ${at + 1} av ${list.length}: ${p.title}`;
  }

  function go(id, options) {
    if (!pageById.has(id) || id === currentId) return;
    render(id, options);
  }
  function step(delta) {
    const list = order();
    const target = list[list.indexOf(pageById.get(currentId)) + delta];
    if (target) render(target.id);
  }
  // The folder, from its row in the list; the page shown stays.
  function setProcess(open) {
    processOpen = open;
    update();
  }

  function setToc(open, {focus = false} = {}) {
    view.classList.toggle('is-toc-open', open);
    tocToggle.setAttribute('aria-expanded', String(open));
    if (open && focus) (tocList.querySelector('[aria-current]') || tocList.querySelector('button'))?.focus({preventScroll: true});
  }

  // Clicks: contents rows, the challenge's link and «Se prosessen» take focus
  // to the new page's heading; the dots and Forrige / Neste keep it where it is.
  root.addEventListener('click', (event) => {
    // Where the list lies over the page, a click beside it folds it away.
    if (view.classList.contains('is-toc-open') && !event.target.closest('.mv-side, .mv-toc-toggle')) setToc(false);
    const chip = event.target.closest('.mv-chip');
    root.querySelectorAll('.mv-chip.is-open').forEach((open) => { if (open !== chip) open.classList.remove('is-open'); });
    if (chip) { chip.classList.toggle('is-open'); return; }
    if (event.target.closest('.mv-toc-folder-toggle')) { setProcess(!processOpen); return; }
    if (event.target.closest('[data-open-process]')) { processOpen = true; render(firstProcess.id, {focus: 'heading'}); return; }
    const stepButton = event.target.closest('[data-step]');
    if (stepButton) { step(Number(stepButton.dataset.step)); return; }
    const target = event.target.closest('[data-goto]');
    if (!target) return;
    const fromToc = !!target.closest('.mv-toc');
    const fromDots = target.classList.contains('mv-dot');
    if (fromToc) setToc(false);
    go(target.dataset.goto, {focus: fromDots ? null : 'heading'});
  });
  tocToggle.addEventListener('click', () => setToc(!view.classList.contains('is-toc-open'), {focus: true}));

  // Keys, while the case is open: ←/→ turn the page, Home/End go to the
  // first and last in the order, Escape closes a chip's tooltip or the
  // contents list where it folds away.
  document.addEventListener('keydown', (event) => {
    if (!view.classList.contains('active') || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target !== document.body && !view.contains(target)) return;
    if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const steps = {ArrowLeft: -1, ArrowRight: 1};
    if (event.key in steps) {
      event.preventDefault();
      step(steps[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const list = order();
      go(list[event.key === 'Home' ? 0 : list.length - 1].id);
    } else if (event.key === 'Escape' && root.querySelector('.mv-chip.is-open')) {
      event.preventDefault();
      root.querySelectorAll('.mv-chip.is-open').forEach((open) => open.classList.remove('is-open'));
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
    LANDSCAPE.forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
    });
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

  // Each time the case opens it starts at Oppgaven, with «Prosessen» closed.
  // A visitor who threw the card from the keyboard is taken to the heading.
  let wasOpen = false;
  new MutationObserver(() => {
    const open = view.classList.contains('active');
    if (open === wasOpen) return;
    wasOpen = open;
    if (!open) { setToc(false); return; }
    warm();
    fit();
    processOpen = false;
    render(MOTVIND_PAGES[0].id, {announce: false, focus: keyboardThrow ? 'heading' : null});
    keyboardThrow = false;
  }).observe(view, {attributes: true, attributeFilter: ['class']});

  render(MOTVIND_PAGES[0].id, {announce: false});

  // For tests and for adding pages: the data, the order now, and a way to
  // turn to a page.
  window.motvindCase = {
    pages: MOTVIND_PAGES, groups: GROUPS, go: (id) => go(id),
    get current() { return currentId; },
    get order() { return order().map((p) => p.id); },
    get processOpen() { return processOpen; },
  };
})();
