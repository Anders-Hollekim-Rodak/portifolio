# Room materials: status

2026-11-17. Branch `feature/room-materials`, worktree `verification/room-materials`, from `main` `bb170e0`. Not merged, not pushed.

The brief (the user, 2026-11-16): the room reads as "low poly, early game". Refine what is there into stylised realism: materials that feel real (wood, stone, plaster with structure, joints and wear), a little simplified, warm, not dirty. Forms, places, light and composition stay. Four surfaces, in three steps, each shown to the user before the next: the floor; columns and trim; walls. The nook's objects (`tools-shelf.js`) set the level of detail.

**Stop point:** step 1, the floor, is done and waits for the user's review. Nothing of steps 2 and 3 is started.

## Done: the floor

- Every board takes its own stretch of one field of oak grain (0.9 m by 2.6 m), every other one turned end for end. Before, all boards showed the same stretched stripes.
- The grain is growth rings as soft bands with a crisp edge, flames where the slice runs along the rings, fine fibres and pores. Colour, roughness and a normal map come from the same field.
- Joints: rounded board edges and shade in the joint, drawn in the shader and never finer than a pixel. Each board lies a little out of level.
- Wear along the ways people walk (the smoke's paths, round the rug, inside the door, before the nook, at the window, out to the stair): a little paler and smoother.
- Contact: the floor darkens toward walls, column bases and the stair's foot, from a small plan of the room (distance to whatever stands on the floor).
- Board brightness lies where it lay; boards now also differ a little in hue.
- Live-tunable: `studyRoom.floor.configure({wear, contact, joints})`, each 0 (none), 1 (as designed) or more.

Unchanged: geometry (the same instanced boards, one draw call), every light, shadow, beam and dust mote, the vault, the shelves' contents, the portal, the table, the rug and the banners.

## Files

| File | What |
| --- | --- |
| `room-materials.js` | New. The floor's material and shader; asks for its maps and hands them over when painted. |
| `room-materials-paint.js` | New. The painting: plain numbers in, bytes out (wood grain, the floor's plan). No three.js, no page. |
| `room-materials-worker.js` | New. Runs the painting off the page's thread. |
| `room-scene.js` | The boards use the new material; the old shared `wood` material is gone (the old wood texture still serves timber, chair, table and door); texture uploads wait for the floor's maps; `studyRoom.floor`. |
| `index.html` | Preloads `room-materials.js` and `room-materials-paint.js`. |
| `tests/room-materials-shots.mjs` | New. Still frames from fixed angles for before/after (`--views=floor,timber,walls`), with each frame's mean brightness. |
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

**Not measured yet:** `tests/performance-check.mjs` before and after. One baseline run was taken on mains before any change (`verification/performance/floor-before-1`). The after runs were due on 2026-11-17, when the laptop was on battery, where timings do not count. To do, on mains, interleaved: baseline with `PORTFOLIO_TEST_ROOT` on a `main` checkout, then this branch, twice each.

## Remaining

1. The user's review of the floor: is the wear right, is the grain right close up, go on to step 2?
2. `performance-check` before and after, on mains (above).
3. Step 2: columns, posts, beams and the gallery's front get their own timber (grain that follows each piece, darker in joints, worn edges); column bases shaped, with more segments on what is round; trim with a simple profile and a material of its own; rounded edges, not chamfers. The painting module and worker are ready to take more maps.
4. Step 3: walls (plaster or stone with real structure, darker toward the floor and into corners, the blind arches' edges as edges).
5. Not checked: WebGL 1 (the shader avoids WebGL 2 only syntax, but no WebGL 1 device was tried); Firefox and Safari; a real phone.
