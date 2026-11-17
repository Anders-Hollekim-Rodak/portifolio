# Room materials: status

2026-11-17. Branch `feature/room-materials`, worktree `verification/room-materials`, from `main` `bb170e0`. Not merged, not pushed.

The brief (the user, 2026-11-16): the room reads as "low poly, early game". Refine what is there into stylised realism: materials that feel real (wood, stone, plaster with structure, joints and wear), a little simplified, warm, not dirty. Forms, places, light and composition stay. Four surfaces, in three steps, each shown to the user before the next: the floor; columns and trim; walls. The nook's objects (`tools-shelf.js`) set the level of detail.

**Where it stands:** step 1, the floor, is done and approved by the user (2026-11-17). Step 2, columns, timber and trim, is done and waits for the user's review (2026-11-17). Step 3, the walls, is not started.

## Done: the floor

- Every board takes its own stretch of one field of oak grain (0.9 m by 2.6 m), every other one turned end for end. Before, all boards showed the same stretched stripes.
- The grain is growth rings as soft bands with a crisp edge, flames where the slice runs along the rings, fine fibres and pores. Colour, roughness and a normal map come from the same field.
- Joints: rounded board edges and shade in the joint, drawn in the shader and never finer than a pixel. Each board lies a little out of level.
- Wear along the ways people walk (the smoke's paths, round the rug, inside the door, before the nook, at the window, out to the stair): a little paler and smoother.
- Contact: the floor darkens toward walls, column bases and the stair's foot, from a small plan of the room (distance to whatever stands on the floor).
- Board brightness lies where it lay; boards now also differ a little in hue.
- Live-tunable: `studyRoom.floor.configure({wear, contact, joints})`, each 0 (none), 1 (as designed) or more.

Unchanged: geometry (the same instanced boards, one draw call), every light, shadow, beam and dust mote, the vault, the shelves' contents, the portal, the table, the rug and the banners.

## Done: columns, timber and trim (step 2)

- **Own timber.** Columns, ribs, beams, the gallery, the shelves and the desk are darker, straighter oak than the floor's (a 0.55 x 2.6 m field), laid along each piece in metres: up a column, along a beam, round a rail. Nothing stretches; each corner of the room takes its own stretch of it. Its tones keep the old shared wood's brightness, a little warmer.
- **Round where round.** The great column shafts have 24 faces (were 10). The bases are turned: plinth, torus, scotia, torus and neck, within the plain eight-sided drum they replace (0.23 m at the foot, 0.28 m high). The capital's bell flares in a curve, closed underneath; the abacus has rounded edges. Bases, bells and shafts are whole: from the tower and the niches their backs show.
- **Soft edges, no chamfers.** Every piece of joinery carries the distance to its edges (`room-joinery.js`). The one shader for timber, trim and plinth rounds the free edges in the shading (a quarter round of about 8 mm, never finer than two pixels), wears them a little paler and smoother, and darkens where a piece meets another or the wall. No triangles are added for it.
- **Mouldings with a profile.** The plinth (stone: upright face, shoulder, cove), the cornice under the vault (roll, cove, rounded fascia) and the gallery's front (bead and cove, seen from behind too) are mouldings, each within the size of the plain block it replaces.
- **Stone frames.** The frames of the great window, the door and the lancets, the sills, the impost stones and the stair's newel are dressed stone (pale, faintly uneven, a few small pits), their facets shaded as the curved surfaces they stand for. Their arrises are rounded; they darken where they meet the wall and in the frame's inner corner.
- **Small rounds.** The gallery's and the tower's balusters are closed at their ends; the stair rail's bronze posts have 8 faces (were 6).
- **The floor against the plinth.** The floor's contact shade now follows the plinth's face, and is stored signed and finer near the walls: the jagged dark line along the walls' foot is gone.
- Live-tunable: `studyRoom.surfaces.configure('timber' | 'trim' | 'plinth', {round, edgeWear, edgeWidth, joint, jointWidth})`.

Not touched: the vault's cells and boss; the ribs' shape (they share the columns' mesh and so their new timber: asked the user); the lights; the shelves' contents; the portal, the table, the rugs and the banners; the chair (it still has the old shared wood texture); the stair's steps.

## Files

| File | What |
| --- | --- |
| `room-materials.js` | New. The floor's material and shader; the shared shader and maps for timber, trim and plinth (`createRoomSurfaces`); asks for every map and hands them over when painted (`settleSurfaces`). |
| `room-joinery.js` | New. Pieces of joinery as geometry with their grain and edges: sawn beams, shafts, mouldings from a section, turned pieces, tubes, slabs, and dressed and softened stone. |
| `room-chamber.js` | Its timber, gallery, cornice, plinth, columns, bases and capitals made as joinery (same places and sizes). |
| `room-architecture.js` | The stone frames carry their edges; their blocks are rounded; the rail's posts have 8 faces. |
| `room-materials-paint.js` | New. The painting: plain numbers in, bytes out (wood grain, dressed stone, the floor's plan). No three.js, no page. |
| `room-materials-worker.js` | New. Runs the painting off the page's thread. |
| `room-scene.js` | The boards, the timber, the trim and the plinth use the new materials (the old wood texture still serves the chair, the table, the door and the tower's roof); the tower's timber made as joinery; texture uploads wait for every map; `studyRoom.floor`, `studyRoom.surfaces`. |
| `index.html` | Preloads `room-materials.js`, `room-materials-paint.js` and `room-joinery.js`. |
| `tests/room-materials-shots.mjs` | New. Still frames from fixed angles for before/after (`--views=floor,timber,walls`, `--format=webp`), with each frame's mean brightness. |
| `dev/room-materials-preview.html` | New, a development aid: the painted maps as pictures. |

## How the maps are made

Painted in code, nothing downloaded: 512 x 1024 colour (alpha: roughness) and normal map for the grain, 256 x 256 plan (red: wear, green: clearance). The painting takes 0.1 to 0.3 s, so it runs in a worker that starts when the module loads, before the room is built. Measured: the maps are in about 5 s before the shaders have compiled, so the room never waits for them. If the worker is missing or late, the page paints them itself (about 0.15 s) when it needs them.

A first version drew the grain on a 2D canvas. That took about 0.4 s on the page's thread and looked drawn; it was replaced.

## Checks

On mains power, 2026-11-16, headless Chrome on the GPU:

- Passed on this branch: `architecture-check`, `table-check`, `cloth-check`, `lighting-check --gpu`, `portal-check --environment-only` (room budget, clay view), `navigation-check`, `first-person-check`, `interior-check --shots-only`, `shelf-tools-check`. No console or shader errors.
- Per frame, before and after: draw calls 41 / 35 / 35 (entry, chair, shelf), triangles 46,057 at the entry, shader programs 31. All unchanged. Textures 33 to 36.
- Mean brightness of the whole frame: entry +1.8 %, chair +0.8 %, shelf -1.5 %. The walked ways are lighter (the boards inside the door by about a fifth), the edges darker.
- Before and after from nine angles: https://claude.ai/artifact/J9g5V33yeWc4sDX3svkBXn (private to the user). Regenerate locally with `node tests/room-materials-shots.mjs --out=after --views=floor`, and with `PORTFOLIO_TEST_ROOT` set to a `main` checkout for the before.

### Step 2, checked

On battery, 2026-11-17 (the suites pass on battery; timings there are noisy):

- Passed: the same nine suites as for the floor. The room's budget check (`portal-check --environment-only`): 35 draw calls, 47,065 triangles from the chair (was 42,641; the budget is 50,000). The architecture's own budget: 2,694 triangles (its limit 2,700).
- Shader programs 31 to 32 (one shared by timber, trim and plinth); textures 36 to 40.
- Mean brightness of the whole frame against `main`: entry +2.7 % (the floor's share 1.8), chair +1.3 %, shelf +0.4 %; the close views of timber and trim -1.7 % to +2.5 %.
- Frame cost, old and new materials (floor, timber, trim, plinth) swapped on one page, two samples each: entry 7.9 / 9.7 ms against 9.2 / 9.7 ms, chair 8.7 / 9.1 against 8.2 / 9.0, shelf 7.4 / 7.2 against 7.5 / 8.1. Up to 1.3 ms more, often none.
- Before and after from eleven angles: https://claude.ai/artifact/4Kh8KEaLr5tUx4kxbXUnQ4 (private to the user). Regenerate with `node tests/room-materials-shots.mjs --out=after --views=timber`.
- **To do:** `performance-check` before and after on mains power, interleaved, as for the floor.

## Performance (step 1, the floor)

Frame cost, measured on one page with the old and the new floor material swapped every ten frames (120 frames each, median, `render` plus `gl.finish`, 1440 x 900). The laptop was on battery; both materials ran under the same conditions:

| View | Old floor | New floor |
| --- | --- | --- |
| Entry | 9.3 ms | 9.8 ms |
| Chair | 8.4 ms | 8.2 ms |
| Shelf | 6.2 ms | 6.8 ms |

About half a millisecond more for a full frame, against 16.7 ms for 60 frames a second.

`tests/performance-check.mjs`, baseline (`PORTFOLIO_TEST_ROOT` on `main`) and branch interleaved, two rounds, on mains power (2026-11-17):

| Run | Room ready (under the profiler) | Frames a second (entry / chair / shelf) | Room draw, CPU per frame |
| --- | --- | --- | --- |
| before 1 | 17.86 s | 60.0 / 60.1 / 60.3 | 1.81 / 1.04 / 2.32 ms |
| after 1 | 10.11 s | 60.2 / 60.2 / 60.3 | 1.67 / 0.86 / 1.33 ms |
| before 2 | 13.15 s | 60.4 / 60.4 / 60.0 | 1.60 / 1.12 / 1.94 ms |
| after 2 | 10.84 s | 60.2 / 60.3 / 60.3 | 1.48 / 0.86 / 1.08 ms |

60 frames a second before and after, 95 % of frames within 17.2 ms in every run. The load is not slower; the spread between runs of the same code is too wide to say more than that. Shader programs 31 in all four; the JS heap holds 5 MB more (the three maps' bytes).

The same check on battery earlier that day was unusable (9.5 s and 20.5 s for the same code, a timeout on the baseline) and is not counted.

## Remaining

1. The floor was reviewed by the user on 2026-11-17: the wear and the grain stay as they are, go on to step 2.
2. Step 2 is done. Asked the user (2026-11-17): is the timber dark and warm enough; may the vault's ribs keep the columns' new timber; may the stair's handrail be rounded (it is still five-sided close up: rounding it needs the architecture's test budget raised from 2,700 to 2,900 triangles); go on to the walls?
   Also: `performance-check` before and after step 2 on mains power.
3. Step 3: walls (plaster or stone with real structure, darker toward the floor and into corners, the blind arches' edges as edges).
4. Not checked: WebGL 1 (the shader avoids WebGL 2 only syntax, but no WebGL 1 device was tried); Firefox and Safari; a real phone.
