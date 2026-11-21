# Motvind Norge case

When the pile's Motvind card is thrown into the portal, it opens
`#app-motvind`, built from the Figma design «motvind norge v2»
(file `xD3aQv1iHE0be9mRo2KzHD`, node `158:859`). The code is in
`motvind-case.js` and `motvind-case.css`, and the assets are in
`assets/motvind/`.

## What is built (step 1)

- **The frame.** It has three parts:
  - the top bar, with the portal's own «← Tilbake» (`data-close`), the title
    and «Få tilbake kort» (`#portalRetrieve`);
  - the contents list on the left, with every chapter and sub-page;
  - Forrige, the dots and Neste below the page.
- **Page 01 «Oppgaven»** (frame `158:1148`). Its text is taken from Figma,
  with two corrections the author approved on 2026-11-20:
  - «emsojonelt» became «emosjonelt»;
  - the last line of the challenge became «Da landet vi på dem som lever tett
    på norsk natur.»

  Figma has a double space after «overbevist»; it shows as one.
- **The other ten pages** show their title and «Denne siden kommer snart.»
  They come in Figma's order: 1 Innsikten, 1.1–1.4 (two pages under 1.2), 04
  Valget, 05 Svaret, 07 and 08.
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
To build a page, give its entry `blocks`. The block types are in `BLOCKS`:

- `kicker`
- `note`
- `question`
- `lead`
- `callout` (with `lines` and an optional `link` to another page id)

Add a type to `BLOCKS` when a page needs a new one.

Page ids follow the content, not the Figma frame numbers:

| Id | Figma frame |
| --- | --- |
| `oppgaven` | 01 Oppgaven |
| `innsikten` | 1 Innsikten |
| `debatten-i-tall` | 1.1 Debatten i tall |
| `avsenderne` | 1.2 Avsenderne |
| `avsenderne-naert` | 1.2 Avsenderne på nært hold |
| `folgerne` | 1.3 Følgerne |
| `kulturen` | 1.4 Kulturen |
| `valget` | 04 Valget |
| `svaret` | 05 Svaret på utfordringen |
| `hva-det-ble-til` | 07 Hva det ble til |
| `annerledes` | 08 Hva jeg ville gjort annerledes |

`avsenderne-naert` and `svaret` have no row of their own in the contents list.
They light the row above them.

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

- ← and → turn the page.
- Home and End go to the first and last page.
- Escape folds the contents list away where it lies over the page.
- A card thrown from the keyboard takes the focus to the page's heading.
- Under reduced motion there is no page entrance and no dot transition.

## Tests

`node tests/portal-check.mjs --motvind-only` runs the case at four sizes:
1920 × 1080, 1920 × 910, 1366 × 768 and 390 × 844. It saves screenshots
`.qa/motvind-*.png`.

## Parked (not in step 1)

- The pages 1 Innsikten, 1.1–1.4, 04, 05, 07 and 08.
- The turning org cards (`Motvind/Org … (v2)`).
- A landscape that changes from page to page, and its parallax (the
  `Panorama`, `Turbiner` and `Ild` layers).
- Et dukkehjem.

## Decided (2026-11-20)

- The moon stays under the contents list until the landscape is split into
  layers.
- Forrige and Neste keep their faint glass.
