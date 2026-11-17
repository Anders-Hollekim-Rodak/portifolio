/* The painting behind the room's surfaces (room-materials.js): plain numbers
   in, bytes out. No three.js and no page, so it runs in a worker while the
   room is built (room-materials-worker.js), or on the page if it must.

   Each surface is worked out as a few fields of numbers (tone, fibre, growth
   rings), and its colour map and normal map both come from those same
   fields, so grain, relief and sheen agree. */

const randomSource = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
const TAU = Math.PI * 2;

// Smooth noise that wraps, added into `out` (W by H): nx by ny random values
// between -gain and gain, eased from one to the next.
function addNoise(out, W, H, nx, ny, gain, random) {
  const grid = new Float32Array(nx * ny);
  for (let i = 0; i < grid.length; i++) grid[i] = (random() * 2 - 1) * gain;
  // Across: each pixel's two columns and its place between them.
  const left = new Uint16Array(W), right = new Uint16Array(W), tx = new Float32Array(W), row = new Float32Array(nx);
  for (let x = 0; x < W; x++) { const f = x * nx / W, i = Math.floor(f), t = f - i; left[x] = i % nx; right[x] = (i + 1) % nx; tx[x] = t * t * (3 - 2 * t); }
  for (let y = 0, k = 0; y < H; y++) {
    const f = y * ny / H, j = Math.floor(f), t0 = f - j, t = t0 * t0 * (3 - 2 * t0), a = (j % ny) * nx, b = ((j + 1) % ny) * nx;
    for (let i = 0; i < nx; i++) row[i] = grid[a + i] + (grid[b + i] - grid[a + i]) * t;
    for (let x = 0; x < W; x++, k++) { const l = row[left[x]]; out[k] += l + (row[right[x]] - l) * tx[x]; }
  }
  return out;
}

// A normal map (RGBA bytes) of a height field that wraps; sx, sy: slope per
// unit of height difference between a pixel's two neighbours.
function normalsOf(height, W, H, sx, sy) {
  const normal = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const up = ((y + 1) % H) * W, down = ((y + H - 1) % H) * W, row = y * W;
    for (let x = 0; x < W; x++) {
      const nx = (height[row + (x + W - 1) % W] - height[row + (x + 1) % W]) * sx, ny = (height[down + x] - height[up + x]) * sy;
      const scale = 127 / Math.sqrt(nx * nx + ny * ny + 1), k = (row + x) * 4;
      normal[k] = 128 + nx * scale; normal[k + 1] = 128 + ny * scale; normal[k + 2] = 128 + scale; normal[k + 3] = 255;
    }
  }
  return normal;
}

/* Long-grain wood, W by H pixels, the grain running up the picture; it wraps
   both ways. Returns {colour, normal}: RGBA bytes each; the colour's alpha is
   how open the surface is (0 smooth .. 1 rough).
   - Growth rings: each a soft band that darkens toward a crisp edge, close-set
     in some stretches and open in others. A board is a slice through them:
     where the slice runs along the rings they come through its face as
     flames, nested pointed arches and long eyes; to either side they run out
     into straight grain. All of it sways a little up the board.
   - Fine fibres and short open pores along the grain; broad, soft tone.
   tones: [dark zones, pale zones, the rings' edge], sRGB 0..255.
   pixel: [across, along] metres; relief: metres of height per unit of field;
   flames: how many times across the picture the slice meets the rings so. */
export function paintWood({W, H, seed, tones, pixel, relief = .0009, flames = 2}) {
  const random = randomSource(seed), n = W * H;
  // Tone: broad and soft, longer along the grain. Fibres: a pixel wide, in
  // two lengths. All about -1..1.
  const tone = addNoise(addNoise(new Float32Array(n), W, H, 5, 3, .6, random), W, H, 14, 9, .4, random);
  const fine = addNoise(new Float32Array(n), W, H, W, Math.round(H / 22), 1, random);
  const long = addNoise(new Float32Array(n), W, H, W >> 1, Math.round(H / 90), 1, random);
  // The rings, as darkness along a line through them (four samples a pixel,
  // then averaged over a pixel so their edges stay smooth).
  const fineness = 4, length = 1 << 14, rings = new Float32Array(length), profile = new Float32Array(length);
  for (let p = 0, spacing = 5, target = 5; p < length;) {
    if (random() < .07) target = random() < .5 ? 2.2 + random() * 2.2 : 6 + random() * 9;
    spacing += (target - spacing) * .3;
    const width = Math.max(3, Math.round(spacing * (.7 + .6 * random()) * fineness)), strength = .3 + .7 * random() ** 1.3, power = 1.6 + 3 * random();
    for (let i = 0; i < width && p + i < length; i++) rings[p + i] = strength * (i / width) ** power;
    p += width;
  }
  for (let i = 0; i < length; i++) profile[i] = (rings[i] + rings[(i + 1) % length] + rings[(i + 2) % length] + rings[(i + 3) % length]) / 4;
  // The sway every ring shares (whole waves up the picture, so it wraps).
  const waves = [[7, 1], [3.5, 2], [2, 3], [1.2, 5]].map(([a, k]) => [a * (.6 + .8 * random()), k, random() * TAU]);
  const sway = new Float32Array(H);
  for (let y = 0; y < H; y++) sway[y] = waves.reduce((x, [a, k, p]) => x + a * Math.sin(TAU * k * y / H + p), 0);
  // Where the slice meets the rings: a line up the picture (centre), and how
  // far under the face the rings' own centre lies at each height (depth, in
  // pixels). Where that changes, rings surface and dive: the flames. It fades
  // out to the sides, so between two such lines the grain is straight.
  const centre = new Float32Array(flames), start = new Int32Array(flames), depth = [];
  for (let b = 0; b < flames; b++) {
    centre[b] = W * ((b + .5) / flames + (random() - .5) * .2); start[b] = Math.floor(random() * length);
    const d = new Float32Array(H), base = W * (.03 + .05 * random()), turns = [[.045 + .03 * random(), 1], [.02 + .02 * random(), 2], [.012 * random(), 4]].map(([a, k]) => [a * W, k, random() * TAU]);
    for (let y = 0; y < H; y++) d[y] = turns.reduce((v, [a, k, p]) => v + a * Math.sin(TAU * k * y / H + p), base);
    depth.push(d);
  }
  const reach = W / (2 * flames), fall = new Float32Array(Math.ceil(reach * 1.4) + 2);
  for (let i = 0; i < fall.length; i++) { const t = Math.min(1, Math.max(0, (i - reach * .3) / (reach * .62))); fall[i] = 1 - t * t * (3 - 2 * t); }
  // ---- One pass: rings, then colour, openness and height from all three.
  const colour = new Uint8ClampedArray(n * 4), height = new Float32Array(n);
  const [[dr, dg, db], [pr, pg, pb], [lr, lg, lb]] = tones, mask = length - 1;
  for (let y = 0, i = 0, k = 0; y < H; y++) {
    const shift = sway[y];
    for (let x = 0; x < W; x++, i++, k += 4) {
      const t = tone[i], xs = x - shift + t * 5;
      let dx = 0, near = 1e9, band = 0;
      for (let b = 0; b < flames; b++) { let d = xs - centre[b]; d -= W * Math.round(d / W); const a = d < 0 ? -d : d; if (a < near) { near = a; dx = d; band = b; } }
      const under = depth[band][y] * fall[near < fall.length - 1 ? near | 0 : fall.length - 1];
      const ring = profile[(Math.sqrt(dx * dx + under * under) * fineness + start[band]) & mask];
      // A pore: where the fine fibre peaks. A ring shows a little more or
      // less along its length.
      const f = fine[i], pore = f > .5 ? (f - .5) * 1.6 : 0, fibre = f * .55 + long[i] * .45;
      const r = Math.min(1, ring * (.8 + .3 * long[i]) + pore * .6);
      const v = Math.min(1, Math.max(0, .5 + t * .6 + fibre * .34)), l = r * .7;
      const cr = dr + (pr - dr) * v, cg = dg + (pg - dg) * v, cb = db + (pb - db) * v;
      colour[k] = cr + (lr - cr) * l; colour[k + 1] = cg + (lg - cg) * l; colour[k + 2] = cb + (lb - cb) * l;
      colour[k + 3] = (.42 + fibre * .3 + r * .5) * 255;
      height[i] = fibre * .3 - r + t * .12;
    }
  }
  return {colour: new Uint8Array(colour.buffer), normal: normalsOf(height, W, H, relief / (2 * pixel[0]), relief / (2 * pixel[1]))};
}

/* A plan of the room for its floor: `size` pixels square over the floor's
   extent (plan coordinates, the chamber's centre at the origin).
   red:   wear, where people walk: the given ways (lanes: points, width in
          metres, weight) and where they stop (spots: x, z, radius, weight),
          unevenly, in patches a few boards wide.
   green: how far it is to whatever stands on the floor (walls with their
          plinth, column bases, the stair's foot), as sqrt(metres / range).
   blue:  the same close to them (-0.06 to 0.30 m, 1.4 mm a step), signed:
          negative behind the line where they stand. Filtering then keeps
          that line straight and sharp wherever it crosses the texels; the
          shader shades from it, so the line stays crisp at any size.
   room: the chamber as numbers (room-materials.js floorPlanSpec). */
export function paintFloorPlan({extent: {x0, z0, x1, z1}, size, seed, range, lanes, spots, room}) {
  const w = x1 - x0, d = z1 - z0, count = size * size, random = randomSource(seed);
  const xOf = i => x0 + (i + .5) / size * w, zOf = j => z0 + (j + .5) / size * d;
  const far = (x, z) => Math.sqrt(x * x + z * z);
  const toSegment = (x, z, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, l = ex * ex + ez * ez, t = l ? Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / l)) : 0; return far(x - ax - ex * t, z - az - ez * t); };
  // ---- Wear. A lane is soft: full along its line, gone at half its width.
  // Each lane is laid whole (its own nearest point), then blended in.
  const wear = new Float32Array(count), own = new Float32Array(count);
  const lay = (points, width, weight) => {
    own.fill(0); const half = width / 2;
    for (let s = 0; s < Math.max(1, points.length - 1); s++) {
      const [ax, az] = points[s], [bx, bz] = points[Math.min(points.length - 1, s + 1)];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - half - x0) / w * size)), i1 = Math.min(size - 1, Math.ceil((Math.max(ax, bx) + half - x0) / w * size));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - half - z0) / d * size)), j1 = Math.min(size - 1, Math.ceil((Math.max(az, bz) + half - z0) / d * size));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = toSegment(xOf(i), zOf(j), ax, az, bx, bz) / half; if (q >= 1) continue;
        const f = (1 - q * q) ** 2, k = j * size + i; if (f > own[k]) own[k] = f;
      }
    }
    for (let k = 0; k < count; k++) if (own[k]) wear[k] = 1 - (1 - wear[k]) * (1 - weight * own[k]);
  };
  for (const {points, width, weight} of lanes) lay(points, width, weight);
  for (const [x, z, r, weight] of spots) lay([[x, z]], 2 * r, weight);
  const patches = addNoise(addNoise(new Float32Array(count), size, size, 22, 19, .6, random), size, size, 7, 6, .4, random);

  // ---- Clearance. The chamber is its wall planes (the nearest bay's and its
  // neighbours' are all that can be near); a bay open to the floor counts
  // only by its jambs. A column stands at each corner. Beyond the tower's
  // mouth, the tower's own round wall and the stair's foot.
  // (Distances are signed: negative inside what stands there.) The plinth
  // stands out from the walls wherever an opening does not come down to the floor.
  const {apothem: A, sides, wall: T, half, columnAt, base, plinth = 0, bays, mouth, tower, stair} = room, step = TAU / sides;
  const columns = Array.from({length: sides}, (_, i) => { const a = -Math.PI / 2 - step / 2 + i * step; return {x: columnAt * Math.cos(a), z: columnAt * Math.sin(a)}; });
  // The newel at the stair's foot, and the first riser with the flight's open edge beside it.
  const at = (phi, rho) => [tower.x + rho * Math.cos(phi), tower.z + rho * Math.sin(phi)];
  const newel = at(stair.from, stair.inner + .03), edges = [[...at(stair.from, stair.inner), ...at(stair.from, tower.r)]];
  for (let i = 0; i < 3; i++) edges.push([...at(stair.from - i * stair.step, stair.inner), ...at(stair.from - (i + 1) * stair.step, stair.inner)]);
  const mouthBay = bays[mouth], end = A + T + .1;
  function clearance(x, z) {
    const tu = x * mouthBay.rx + z * mouthBay.rz, ta = x * mouthBay.ox + z * mouthBay.oz;
    let c = Infinity;
    if (ta >= A && Math.abs(tu) < half + .2) {
      // In the mouth or the tower: the jambs' blocks (to a hand beyond the wall), then the drum.
      const side = mouthBay.open - Math.abs(tu);
      c = ta <= end ? side : far(Math.max(0, side), ta - end);
      const dx = x - tower.x, dz = z - tower.z, toward = Math.atan2(dz, dx) - tower.mouthDirection;
      if (Math.abs(Math.atan2(Math.sin(toward), Math.cos(toward))) > tower.mouthWidth) c = Math.min(c, tower.r - far(dx, dz));
      for (const [ax, az, bx, bz] of edges) c = Math.min(c, toSegment(x, z, ax, az, bx, bz));
      c = Math.min(c, far(x - newel[0], z - newel[1]) - .08);
      for (const k of [mouth, mouth + 1]) c = Math.min(c, far(x - columns[k % sides].x, z - columns[k % sides].z) - base);
      return c;
    }
    const turn = (Math.atan2(z, x) + Math.PI / 2) / step, nearest = Math.round(turn);
    for (let k = nearest - 1; k <= nearest + 1; k++) {
      const b = bays[((k % sides) + sides) % sides], along = x * b.ox + z * b.oz, u = Math.abs(x * b.rx + z * b.rz);
      let gap = A - along - (u < (b.bare || 0) ? 0 : plinth);
      if (b.open && u < b.open) gap = along < A ? far(b.open - u, A - along) : b.open - u;
      if (gap < c) c = gap;
    }
    if (c <= -.1) return c;
    const column = columns[((Math.round(turn + .5) % sides) + sides) % sides];
    return Math.min(c, far(x - column.x, z - column.z) - base);
  }
  const data = new Uint8Array(count * 4);
  for (let j = 0, k = 0, q = 0; j < size; j++) {
    const z = zOf(j);
    for (let i = 0; i < size; i++, k++, q += 4) {
      data[q] = 255 * Math.min(1, wear[k] * (.8 + .28 * patches[k])) + .5;
      const c = clearance(xOf(i), z);
      data[q + 1] = 255 * Math.sqrt(Math.min(1, Math.max(0, c) / range)) + .5;
      data[q + 2] = 255 * Math.min(1, Math.max(0, (c + .06) / .36)) + .5;
      data[q + 3] = 255;
    }
  }
  return {data};
}

/* Dressed stone, W by H pixels; it wraps both ways. Returns {colour, normal}
   as paintWood does. Cut and rubbed smooth, not rough: no sand in it.
   - Tone in broad clouds and a finer mottle, both soft.
   - The face is very slightly uneven, as hand-dressed stone is, in shallow
     hollows a hand or two wide: what a lamp's grazing light picks out.
   - A few small pits, and faint drag marks from the tool, one way.
   tones: [dark, pale], sRGB 0..255; pixel: [across, up] metres;
   relief: metres of height per unit of field; pits: how many per square metre. */
export function paintStone({W, H, seed, tones, pixel, relief = .0012, pits = 260, marks = .5}) {
  const random = randomSource(seed), n = W * H, cells = (metres, k) => Math.max(2, Math.round(k * metres));
  const wide = W * pixel[0], high = H * pixel[1];
  // Tone: clouds about 40 cm and 12 cm across; mottle about 3 cm.
  const tone = addNoise(addNoise(new Float32Array(n), W, H, cells(wide, 2.5), cells(high, 2.5), .6, random), W, H, cells(wide, 8), cells(high, 8), .4, random);
  const mottle = addNoise(new Float32Array(n), W, H, cells(wide, 34), cells(high, 34), 1, random);
  // The face's own unevenness (about 15 cm), and the tool's drag marks: long one way, a few millimetres the other.
  const face = addNoise(new Float32Array(n), W, H, cells(wide, 6.5), cells(high, 6.5), 1, random);
  const drag = addNoise(new Float32Array(n), W, H, cells(wide, 90), cells(high, 5), 1, random);
  // Pits: each a small soft hollow.
  const pit = new Float32Array(n);
  for (let k = 0, count = Math.round(pits * wide * high); k < count; k++) {
    const cx = random() * W, cy = random() * H, r = .8 + random() ** 2 * 2.4, deep = .35 + .65 * random(), reach = Math.ceil(r + 1);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const q = Math.hypot(dx, dy) / r; if (q >= 1.4) continue;
      const i = ((Math.round(cy) + dy + H) % H) * W + (Math.round(cx) + dx + W) % W, v = deep * Math.max(0, 1 - q * q / 1.96);
      if (v > pit[i]) pit[i] = v;
    }
  }
  const colour = new Uint8ClampedArray(n * 4), height = new Float32Array(n);
  const [[dr, dg, db], [pr, pg, pb]] = tones;
  for (let i = 0, k = 0; i < n; i++, k += 4) {
    const hollow = pit[i], v = Math.min(1, Math.max(0, .5 + tone[i] * .55 + mottle[i] * .13 + drag[i] * .05 * marks)) * (1 - .2 * hollow);
    colour[k] = dr + (pr - dr) * v; colour[k + 1] = dg + (pg - dg) * v; colour[k + 2] = db + (pb - db) * v;
    colour[k + 3] = (.55 + mottle[i] * .12 + hollow * .4) * 255;
    height[i] = face[i] * 1.6 + mottle[i] * .1 + drag[i] * .12 * marks - hollow * 1.1;
  }
  return {colour: new Uint8Array(colour.buffer), normal: normalsOf(height, W, H, relief / (2 * pixel[0]), relief / (2 * pixel[1]))};
}

const painters = {wood: paintWood, floorPlan: paintFloorPlan, stone: paintStone};
// Paints a set of jobs ({name: {kind, ...its settings}}). Returns the results
// by name, how long each took, and their buffers (to hand over, not copy).
export function paint(jobs) {
  const results = {}, transfer = [], ms = {};
  for (const [name, {kind, ...settings}] of Object.entries(jobs)) {
    const began = performance.now(), result = painters[kind](settings);
    results[name] = result; ms[name] = performance.now() - began;
    for (const value of Object.values(result)) if (value?.buffer) transfer.push(value.buffer);
  }
  return {results, ms, transfer};
}
