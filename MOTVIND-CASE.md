# Motvind Norge case

When the pile's Motvind card is thrown into the portal, it opens
`#app-motvind`, built from the Figma design «motvind norge v2»
(file `xD3aQv1iHE0be9mRo2KzHD`, node `158:859`). The code is in
`motvind-case.js` and `motvind-case.css`, and the assets are in
`assets/motvind/`.

## What is built

- **The frame.** It has three parts:
  - the top bar, with the portal's own «← Tilbake» (`data-close`), the title
    and «Få tilbake kort» (`#portalRetrieve`);
  - the contents list on the left;
  - Forrige, the dots and Neste below the page.
- **The order** (decided 2026-11-21) runs Oppgaven, Hva jeg gjorde,
  [Prosessen], Neste prosjekt:
  - **Prosessen** is a folder in the contents list. It is closed by default
    and marked «Valgfritt dypdykk». It holds 1. Innsikten (1.1–1.4, with two
    pages under 1.2) and 2. Valget og svaret (Valget, Svaret på
    utfordringen). Its row is a button with `aria-expanded`, so it opens and
    closes by click, Enter or Space.
  - **While it is closed**, Neste and → pass the process by: from Hva jeg
    gjorde they go to Neste prosjekt, and only three dots show.
  - **While it is open**, or while one of its pages is shown, its pages are
    in the order and its dots show.
  - **It opens** from «Se prosessen» on Hva jeg gjorde, from its row in the
    list, or on any of its pages (for example from «Se hvordan vi svarte på
    den»).
  - **It closes again** each time the case is opened.
- **Page 01 «Oppgaven»** (frame `158:1148`). Its text is taken from Figma,
  with two corrections the author approved on 2026-11-20:
  - «emsojonelt» became «emosjonelt»;
  - the last line of the challenge became «Da landet vi på dem som lever tett
    på norsk natur.»

  Figma has a double space after «overbevist»; it shows as one.
- **«Hva jeg gjorde»**. Figma has no frame for it. It holds the author's six
  points (2026-11-21) on Figma's Funn card («Observasjon», `179:840`),
  numbered 01–06, three abreast:
  - the insight (04) has the gold edge of Figma's «Valg» box;
  - card 05 has Figma's Teori chip «Bourdieu» (`179:1010`), whose tooltip
    shows on hover, focus or tap;
  - below the cards, «Se prosessen» opens the folder at 1. Innsikten.
- **«Neste prosjekt»** and the process pages show their title and «Denne
  siden kommer snart.»
- **The landscape** is still, and made of the Figma Scene's own layers
  (re-exported 2026-11-21; the first, single 1x image looked coarse):
  - `landskap-01-himmel.webp` (38 KB): «Himmel» and the two «Kapittelglød».
    It holds only smooth light. It is exported at 2x and reduced to 456 × 248
    with Figma's dithering kept, so it stays free of bands when it is scaled
    up. At 2x as lossy WebP it showed rings, and as SVG it showed Chrome's
    blur in steps;
  - `landskap-01-fjell.webp` (490 KB): everything in front of the sky, at
    2x (3648 × 1984) with transparency. The transparency comes from two
    exports, over black and over white;
  - `korn.webp` (127 KB): Figma's «Korn» image, laid over both at 16 %,
    overlay, as in Figma (`#app-motvind::before`).

  Together they match Figma's own render of the Scene within one colour level
  on average. They are fetched only once the Motvind card is picked up. They
  are anchored at the panel's right foot. Beside the contents list they are
  drawn large enough that the moon lies under the list's glass. In this
  smaller panel the moon would otherwise be cut by the list's edge, or lie
  behind the first lines.
- **Known difference from Figma:** text in the portal is a little softer and
  heavier than in Figma. The page stands tilted in the 3D room and is
  redrawn, and it stays soft even without the lift. The same text drawn flat
  is as sharp as Figma's. This lies in the portal, not in the case.

## Adding a page

`MOTVIND_PAGES` in `motvind-case.js` holds one entry per dot, in reading order.
A page in the folder has `process: true`. To build a page, give its entry
`blocks`. The block types are in `BLOCKS`:

- `kicker`
- `note`
- `question`
- `lead`
- `callout` (with `lines` and an optional `link` to another page id)
- `cards` (Figma's Funn cards: `items` with `text`, and optionally `accent` or a
  `chip` with `text` and `tip`)
- `process` (the button that opens the folder)

Add a type to `BLOCKS` when a page needs a new one.

Page ids follow the content, not the Figma frame numbers:

| Id | Figma frame |
| --- | --- |
| `oppgaven` | 01 Oppgaven |
| `hva-jeg-gjorde` | (none; the author's text, 2026-11-21) |
| `innsikten` | 1 Innsikten |
| `debatten-i-tall` | 1.1 Debatten i tall |
| `avsenderne` | 1.2 Avsenderne |
| `avsenderne-naert` | 1.2 Avsenderne på nært hold |
| `folgerne` | 1.3 Følgerne |
| `kulturen` | 1.4 Kulturen |
| `valget` | 04 Valget |
| `svaret` | 05 Svaret på utfordringen |
| `neste-prosjekt` | (none yet) |

`avsenderne-naert` and `svaret` have no row of their own in the contents list.
They light the row above them.

07 «Hva det ble til» and 08 «Hva jeg ville gjort annerledes» are taken out of
the list, the dots and the order until the author has placed them. Their
entries are kept, commented out, under `MOTVIND_PAGES`.

## Sizes

The portal lifts its page toward the eye (`scene-camera.js`, the reader),
which draws it about 16 % larger than its CSS pixels. The case is zoomed back
by as much (`--mv-zoom`, set by `fit()`), so its sizes on screen are Figma's
own.

The panel follows the reader, not a fixed 1920 × 1080:

- spacing follows the panel's height;
- type follows the page's width, up to the Figma sizes;
- below 760 px the contents list folds away behind an «Innhold» button.

## Keys and motion

- ← and → turn the page, in the order of the moment (without the process
  while it is closed).
- Home and End go to the first and last page.
- Enter and Space on «Prosessen» open and close the folder.
- The Bourdieu chip shows its tooltip on focus, and Escape hides it after a
  tap.
- Escape folds the contents list away where it lies over the page.
- A card thrown from the keyboard takes the focus to the page's heading.
- Under reduced motion there is no page entrance and no dot transition.

## Tests

`node tests/portal-check.mjs --motvind-only` runs the case at four sizes:
1920 × 1080, 1920 × 910, 1366 × 768 and 390 × 844. It saves screenshots
`.qa/motvind-*.png`.

## Parked

- The pages 1 Innsikten, 1.1–1.4, 04, 05, 07 and 08, and the content of
  Neste prosjekt. Where 07 and 08 go is still to be decided with the author.
- The turning org cards (`Motvind/Org … (v2)`).
- A landscape that changes from page to page, and its parallax (the
  `Panorama`, `Turbiner` and `Ild` layers).
- Et dukkehjem.
- Text in the portal is a little softer and heavier than in Figma (the
  portal's tilt, see above). Parked by the author on 2026-11-21 as a task
  of its own, since it touches the portal every page uses.

## Decided (2026-11-20)

- The moon stays under the contents list until the landscape is split into
  layers.
- Forrige and Neste keep their faint glass.

## Decided (2026-11-21)

- The landscape from Figma's own layers (see above) is approved.
- The process lies in the folder «Prosessen», closed by default; Neste passes
  it by while it is closed.
- Neste prosjekt is a placeholder page for now.
- Hva jeg gjorde: six Funn cards, the insight with the gold edge, the
  Bourdieu chip, then «Se prosessen».
