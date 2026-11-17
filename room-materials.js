/* The room's surfaces (room-scene.js): materials made in code, with relief.
   Stylised realism: wood that reads as wood, a little simplified, warm, clean.
   The nook's objects (tools-shelf.js) set the level of detail.

   Their maps are painted from numbers (room-materials-paint.js), in a worker
   (room-materials-worker.js) while the page builds the room, so loading does
   not wait for them; without a worker, or if it is late, the page paints
   them itself. Nothing is downloaded. A surface's `ready` resolves once its
   maps are in; room-scene.js waits for settleSurfaces() before it sends any
   texture to the GPU.

   The floor is the room's plank floor (one instanced mesh, one draw call, as
   before). Its boards share one field of grain; each takes its own stretch
   of it, so no two look alike. What belongs to a board (rounded edges, the
   shade in its joints, how it lies) and to the room (wear where people walk,
   shade where the floor meets walls and column bases) is worked out in the
   shader, from the board itself and from one small plan of the room. */
import * as THREE from './vendor/three/three.module.js';
import {paint} from './room-materials-paint.js';

// The worker starts as this module loads, well before the room is built: a
// worker only comes to life while the page's own thread is free, and it is
// not once the build begins (measured: started with the build, it answered
// only after the shaders were compiled, and the room waited for it).
let worker = null, serial = 0;
const waiting = new Map();
try {
  worker = new Worker(new URL('./room-materials-worker.js', import.meta.url), {type: 'module'});
  worker.onmessage = ({data}) => { const done = waiting.get(data.id); waiting.delete(data.id); done?.(data); };
  worker.onerror = worker.onmessageerror = () => { worker = null; for (const done of [...waiting.values()]) done(null); waiting.clear(); };
} catch { worker = null; }
// Paints jobs (room-materials-paint.js paint) in the worker. `answer`
// resolves with {results, ms, worker, waited}; settle() is for when the maps
// are needed now: it paints them on the page unless the worker has answered.
const asked = [];
function painted(jobs) {
  const began = performance.now();
  let finish, done = false;
  const answer = new Promise(resolve => { finish = (results, ms, byWorker) => { if (done) return; done = true; resolve({results, ms, worker: byWorker, waited: performance.now() - began}); }; });
  const here = () => { if (done) return; const {results, ms} = paint(jobs); finish(results, ms, false); };
  if (worker) { const id = ++serial; waiting.set(id, data => data ? finish(data.results, data.ms, true) : here()); worker.postMessage({id, jobs}); }
  else Promise.resolve().then(here);
  const job = {answer, settle: () => { here(); return answer; }};
  asked.push(job); return job;
}
/* For when the maps are needed (room-scene.js, before it sends textures to
   the GPU): a moment for answers already on their way to land, then the page
   paints whatever is still missing itself. Resolves once every map is in. */
export function settleSurfaces() {
  const all = () => Promise.all(asked.map(job => job.answer));
  return Promise.race([all(), new Promise(resolve => setTimeout(resolve, 30))])
    .then(() => { for (const job of asked) job.settle(); return all(); }).then(() => new Promise(resolve => setTimeout(resolve)));
}

// A texture of bytes to come, as the room's maps are sampled; fill() gives it them.
function dataTexture(W, H, {srgb = false, anisotropy = 1, repeat = true} = {}) {
  const map = new THREE.DataTexture(null, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (srgb) map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  map.generateMipmaps = repeat; map.anisotropy = anisotropy;
  return map;
}
const fill = (map, data) => { map.image = {data, width: map.image.width, height: map.image.height}; map.needsUpdate = true; };

/* The floor plan's settings (room-materials-paint.js paintFloorPlan), from
   the room: plan coordinates, the chamber's centre at the origin.
   chamber: room-chamber.js's (bays, tuning, hw, corner); tower, stair:
   room-tower.js's; paths: scene-camera.js's ways, table-centred, which
   `forward` (room-scene.js placement) brings to the plan; rug: its radius.
   Wear lies along the ways the smoke draws, round the rug, out to the
   tower's stair, and where people stop: inside the door, at the entry,
   before the nook and at the window. */
const CLEAR_RANGE = 1.6;
export function floorPlanSpec({extent, chamber, tower, stair, paths, forward, rug = 1.9, size = 256}) {
  const plan = ([x, z]) => [x, z + forward], A = chamber.tuning.apothem;
  const mouth = chamber.bays.find(b => b.kind === 'tower'), win = chamber.bays.find(b => b.kind === 'window');
  // Round the rug, a little unevenly; more on the door's side.
  const ring = Array.from({length: 49}, (_, i) => { const a = i / 48 * Math.PI * 2, r = rug + .42 + .08 * Math.sin(3 * a + 1); return plan([r * Math.cos(a), r * Math.sin(a)]); });
  const foot = [tower.x + (stair.inner + .5) * Math.cos(stair.from + .25), tower.z + (stair.inner + .5) * Math.sin(stair.from + .25)];
  const lanes = [
    {points: paths.trunk.map(plan), width: 1.25, weight: .74},
    {points: [paths.trunk[paths.fork], ...paths.branch].map(plan), width: 1.05, weight: .62},
    {points: ring, width: 1.05, weight: .5}, {points: ring.slice(4, 22), width: .9, weight: .3},
    {points: [plan([mouth.out.x * (rug + .4), mouth.out.z * (rug + .4)]), [mouth.out.x * (A - .2), mouth.out.z * (A - .2)], [mouth.out.x * (A + .7), mouth.out.z * (A + .7)], foot], width: 1, weight: .6},
  ];
  const spots = [[...plan(paths.trunk[3]), 1, .5], [...plan(paths.trunk[paths.trunk.length - 4]), .9, .5],
    [win.out.x * (A - .75), win.out.z * (A - .75), .9, .45], [...plan(paths.trunk[1]), .8, .4]];
  return {kind: 'floorPlan', extent, size, seed: 2903, range: CLEAR_RANGE, lanes, spots, room: {
    apothem: A, sides: chamber.tuning.sides, wall: chamber.tuning.wall, half: chamber.hw, columnAt: chamber.corner - .07, base: .23, mouth: mouth.k,
    // The plinth (room-chamber.js) stands 35 mm out, broken where an opening comes down to the floor.
    plinth: .035,
    bays: chamber.bays.map(b => ({ox: b.out.x, oz: b.out.z, rx: b.right.x, rz: b.right.z, open: b.kind === 'tower' || b.kind === 'door' ? b.open.halfWidth : 0,
      bare: b.open.sill === 0 ? b.open.halfWidth : 0})),
    tower: {x: tower.x, z: tower.z, r: tower.r, mouthDirection: tower.mouthDirection, mouthWidth: tower.mouthWidth},
    stair: {from: stair.from, step: stair.step, inner: stair.inner}}};
}
// The floor's oak: a field 0.9 m across and 2.6 m along the grain.
export const floorGrain = {kind: 'wood', W: 512, H: 1024, seed: 7331, across: .9, along: 2.6,
  tones: [[104, 76, 50], [158, 121, 82], [58, 37, 23]]};
floorGrain.pixel = [floorGrain.across / floorGrain.W, floorGrain.along / floorGrain.H];
// Asked for at once: it needs nothing from the room.
const floorGrainPainted = painted({grain: floorGrain});

/* The plank floor's material, for room-scene.js's instanced boards (a unit
   square each, scaled to its width and length and laid in the plan).
   Returns {material, plankColour(tint, hue), look, ready, stats}.
   look: the material's own uniforms, live-tunable (studyRoom.floor):
     uWear      how far the walked ways are worn pale and smooth (0 none)
     uContact   how dark the floor goes where it meets walls and bases
     uJoints    how dark and deep the joints between boards read */
export function createFloorSurface({anisotropy = 8, colour = '#ffffff', ...room}) {
  const {W, H, across, along} = floorGrain, planSpec = floorPlanSpec(room), {x0, z0, x1, z1} = planSpec.extent;
  const map = dataTexture(W, H, {srgb: true, anisotropy}), normalMap = dataTexture(W, H, {anisotropy});
  const planMap = dataTexture(planSpec.size, planSpec.size, {repeat: false}), stats = {textures: 3};
  const planPainted = painted({plan: planSpec});
  const ready = Promise.all([floorGrainPainted.answer, planPainted.answer]).then(([grain, plan]) => {
    fill(map, grain.results.grain.colour); fill(normalMap, grain.results.grain.normal); fill(planMap, plan.results.plan.data);
    Object.assign(stats, {worker: grain.worker && plan.worker, ms: {...grain.ms, ...plan.ms}, waited: {grain: grain.waited, plan: plan.waited}});
  });
  const look = {uFloorPlan: {value: planMap}, uFloorFrame: {value: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0))},
    uWear: {value: 1}, uContact: {value: 1}, uJoints: {value: 1}};
  const material = new THREE.MeshStandardMaterial({color: colour, map, normalMap, roughness: 1});
  // Found with the material's other textures by room-scene.js's warm-up, which
  // sends each to the GPU on a frame of its own.
  material.planMap = planMap;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, look);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform vec4 uFloorFrame;
      varying vec2 vBoardAt, vBoardHalf, vPlanAt; varying vec3 vBoardSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        // This board: its size and place (the instance), a point on it in
        // metres from its middle, and three numbers of its own.
        vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz)), middle = instanceMatrix[3].xz;
        vBoardHalf = size * .5; vBoardAt = position.xz * size;
        vBoardSeed = fract(sin(vec3(dot(middle, vec2(127.1, 311.7)), dot(middle, vec2(269.5, 183.3)), dot(middle, vec2(419.2, 371.9)))) * 43758.5453);
        vPlanAt = ((instanceMatrix * vec4(position, 1.)).xz - uFloorFrame.xy) * uFloorFrame.zw;
        // Its own stretch of the grain; every other board turned end for end.
        vec2 grain = vec2(vBoardAt.x / ${across.toFixed(3)} + vBoardSeed.x, vBoardAt.y * (vBoardSeed.z > .5 ? 1. : -1.) / ${along.toFixed(3)} + vBoardSeed.y * 7.);
        #ifdef USE_MAP
          vMapUv = grain;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = grain;
        #endif
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uFloorPlan; uniform float uWear, uContact, uJoints;
      varying vec2 vBoardAt, vBoardHalf, vPlanAt; varying vec3 vBoardSeed;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      // Metres in from the board's long edges (x) and its ends (y), and a
      // pixel's size on the board: nothing below is drawn finer than that.
      // (Never below 0: a pixel at the board's very edge may be shaded from just past it.)
      vec2 boardEdge = max(vBoardHalf - abs(vBoardAt), 0.), boardPixel = max(fwidth(vBoardAt), vec2(1e-5));
      vec4 floorPlan = texture2D(uFloorPlan, vPlanAt);
      // Joints: shade gathers in them, a finger's width in from each edge.
      vec2 jointWidth = max(vec2(.008), boardPixel * 1.1), jointShade = exp(-boardEdge / jointWidth) * (.008 / jointWidth);
      float joint = 1. - (1. - jointShade.x) * (1. - jointShade.y);
      // Wear: the walked ways, each board taking it a little differently,
      // and less of it down in the joints.
      float boardWear = smoothstep(.2, .8, floorPlan.r * (.72 + .56 * vBoardSeed.x) + (vBoardSeed.y - .5) * .1) * (1. - .6 * joint) * uWear;
      // Contact: a close, dark line where something stands on the floor, and
      // a wide, soft shade about it.
      // (Close by, the fine signed distance; further off, the coarse one.)
      float nearClear = floorPlan.b * .36 - .06;
      float clearance = nearClear < .28 ? max(nearClear, 0.) : floorPlan.g * floorPlan.g * ${CLEAR_RANGE.toFixed(2)};
      float contactShade = 1. - uContact * (.34 * exp(-clearance / .045) + .26 * exp(-clearance / .34));
      diffuseColor.rgb *= mix(vec3(1.), vec3(1.22, 1.2, 1.15), boardWear) * (1. - .5 * joint * uJoints) * contactShade;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      #ifdef USE_MAP
        float openGrain = sampledDiffuseColor.a;
      #else
        float openGrain = .5;
      #endif
      // Matt, open where the grain is; worn boards are smoother; joints are dull.
      roughnessFactor = clamp(mix(.76, 1., openGrain) + (vBoardSeed.z - .5) * .08, 0., 1.) * (1. - .36 * boardWear);
      roughnessFactor = mix(roughnessFactor, 1., joint * .7);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // Rounded edges (the surface falls away toward each joint), and how
        // the board lies: a little out of level, a little cupped.
        vec2 arris = max(vec2(.007), boardPixel * 1.4);
        vec2 fall = clamp(1. - boardEdge / arris, 0., 1.) * (.007 / arris) * .6 * sign(vBoardAt) * uJoints;
        vec2 lie = (vBoardSeed.xy - .5) * .022 + vec2(vBoardAt.x / vBoardHalf.x * (vBoardSeed.z - .5) * .03, 0.);
        normal = normalize(normal + (viewMatrix * vec4(fall.x + lie.x, 0., fall.y + lie.y, 0.)).xyz);
      }`);
  };
  // A board's tint: its brightness as before (room-scene.js's tint, 0..1, by
  // where it lies), and a little of its own hue: redder, or more grey-gold.
  const plankColour = (tint, hue, target = new THREE.Color()) => {
    const v = .68 + tint * .32, h = (hue - .5) * 2;
    return target.setRGB(v * (1 + .07 * h), v * (1 - .012 * h), v * (1 - .1 * h));
  };
  return {material, plankColour, look, ready, stats};
}

/* ---- Timber and trim. The columns, beams, gallery and shelves are dark oak
   of their own, apart from the floor's; the window's, the door's and the
   lancets' frames and the plinth at the walls' foot are dressed stone. Each
   piece comes from room-joinery.js with its texture coordinates in metres
   and its `edges`, which the one shader they all share turns into:
   - rounded edges: the surface turns softly over each free edge, in the
     shading (no chamfers, no triangles), never finer than a pixel;
   - worn edges: a little paler and smoother along them;
   - joints: darker where a piece meets another, or the wall behind it.
   One function for every such material, so they share one program. */
function compileSurface(shader) {
  Object.assign(shader.uniforms, this.userData.look);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
    attribute vec4 edges; varying vec4 vEdges;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
    vEdges = edges;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    uniform float uRound, uEdgeWear, uEdgeWidth, uJoint, uJointWidth; uniform vec2 uRough;
    varying vec4 vEdges;
    // The surface's direction where its height changes across the screen
    // (as a bump map bends it).
    vec3 surfaceBent(vec3 at, vec3 n, vec2 slope, float facing) {
      vec3 sx = dFdx(at), sy = dFdy(at), r1 = cross(sy, n), r2 = cross(n, sx);
      float det = dot(sx, r1) * facing;
      return normalize(abs(det) * n - sign(det) * (slope.x * r1 + slope.y * r2));
    }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
    // Metres to the nearest free edge and to the nearest joint, and a pixel's
    // size there. (z and w are joints, or free edges given as negatives.)
    float freeEdge = min(min(vEdges.x, vEdges.y), min(vEdges.z < 0. ? -vEdges.z : 10., vEdges.w < 0. ? -vEdges.w : 10.));
    float joined = min(vEdges.z < 0. ? 10. : vEdges.z, vEdges.w < 0. ? 10. : vEdges.w);
    float edgePixel = max(fwidth(freeEdge), 1e-5), jointPixel = max(fwidth(joined), 1e-5);
    // (A pixel at the very edge may be shaded from a point just past it,
    // where these run negative: taken no nearer than 0.6 pixel.)
    freeEdge = max(freeEdge, .6 * edgePixel); joined = max(joined, .6 * jointPixel);
    // Never finer than two pixels: further off, wider and fainter, so a worn
    // edge or a seam never breaks into a dotted line.
    float rim = exp(-freeEdge / max(uEdgeWidth, 2. * edgePixel)) * min(1., uEdgeWidth / (2. * edgePixel));
    float seam = exp(-joined / max(uJointWidth, 2. * jointPixel)) * min(1., uJointWidth / (2. * jointPixel));
    diffuseColor.rgb *= (1. + uEdgeWear * rim) * (1. - uJoint * seam);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    #ifdef USE_MAP
      float openGrain = sampledDiffuseColor.a;
    #else
      float openGrain = .5;
    #endif
    roughnessFactor = mix(uRough.x, uRough.y, openGrain) * (1. - .25 * rim);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    {
      // A quarter round of radius uRound: level at that distance in, turned
      // 45 degrees at the edge itself, where the next face takes over. Its
      // slope toward the edge is worked out here; only the way to the edge
      // comes from the screen (the distance is linear over each face, so
      // that is exact, also on a face seen nearly edge on).
      float radius = max(uRound, edgePixel * 2.5), turn = clamp(1. - freeEdge / radius, 0., 1.);
      float slope = uRound * turn / radius;
      normal = surfaceBent(-vViewPosition, normal, vec2(dFdx(freeEdge), dFdy(freeEdge)) * slope, faceDirection);
    }`);
}
function surfaceMaterial(colour, maps, look) {
  const material = new THREE.MeshStandardMaterial({color: colour, map: maps.map, normalMap: maps.normalMap, roughness: 1});
  material.userData.look = Object.fromEntries(Object.entries(look).map(([name, value]) => ['u' + name[0].toUpperCase() + name.slice(1), {value}]));
  material.onBeforeCompile = compileSurface;
  return material;
}
// A painted pair of maps (colour with openness, normals) laid by the metre.
function pairOf(spec, anisotropy) {
  const map = dataTexture(spec.W, spec.H, {srgb: true, anisotropy}), normalMap = dataTexture(spec.W, spec.H, {anisotropy});
  map.repeat.set(1 / spec.across, 1 / spec.along); normalMap.repeat.copy(map.repeat);
  const job = painted({maps: spec});
  job.answer.then(({results}) => { fill(map, results.maps.colour); fill(normalMap, results.maps.normal); });
  return {map, normalMap, job};
}
// The timber's oak: darker and straighter than the floor's, a field 0.55 m
// across and 2.6 m along the grain. The trim's stone: 0.8 m square.
// Its tones keep the old shared wood's mean brightness, a little warmer.
export const timberGrain = {kind: 'wood', W: 256, H: 1024, seed: 4409, across: .55, along: 2.6, flames: 1, relief: .0011,
  tones: [[100, 74, 50], [150, 116, 80], [56, 38, 24]]};
export const trimStone = {kind: 'stone', W: 256, H: 256, seed: 9127, across: .8, along: .8, pits: 110,
  tones: [[150, 146, 138], [212, 207, 196]]};
for (const spec of [timberGrain, trimStone]) spec.pixel = [spec.across / spec.W, spec.along / spec.H];
// Asked for as the module loads, like the floor's grain: they need nothing
// from the room. (Their sampling's anisotropy is set when the room asks.)
const early = {timber: pairOf(timberGrain, 1), stone: pairOf(trimStone, 1)};

/* The room's timber, trim and plinth materials. colours: each material's
   own tint over its map ({timber, trim, plinth}).
   Each material's look is live-tunable through material.userData.look
   (studyRoom.surfaces): uRound (metres), uEdgeWear, uEdgeWidth (metres),
   uJoint, uJointWidth (metres), uRough (smooth, open). */
export function createRoomSurfaces({anisotropy = 4, colours}) {
  const {timber, stone} = early, stats = {textures: 4};
  for (const pair of [timber, stone]) pair.map.anisotropy = pair.normalMap.anisotropy = anisotropy;
  Promise.all([timber.job.answer, stone.job.answer]).then(([a, b]) => Object.assign(stats, {worker: a.worker && b.worker, ms: {timber: a.ms.maps, stone: b.ms.maps}}));
  return {stats,
    timber: surfaceMaterial(colours.timber, timber, {round: .008, edgeWear: .26, edgeWidth: .006, joint: .5, jointWidth: .045, rough: new THREE.Vector2(.62, .96)}),
    trim: surfaceMaterial(colours.trim, stone, {round: .007, edgeWear: .1, edgeWidth: .006, joint: .42, jointWidth: .03, rough: new THREE.Vector2(.8, 1)}),
    plinth: surfaceMaterial(colours.plinth, stone, {round: .006, edgeWear: .08, edgeWidth: .006, joint: .5, jointWidth: .035, rough: new THREE.Vector2(.82, 1)})};
}

/* ---- The walls: lime plaster. Each piece of wall carries its bay
   (room-chamber.js): the opening it holds (half-width, sill, shoulder, peak:
   bayOpen) and the bay itself (its outward direction, the stone frame's
   width round the opening, and what meets it: bayFrame). From these the
   shader works out, for each point, where it is on the bay:
   - on the wall's face, its distance to the opening: the opening's edge is
     rounded over and a little worn, unless a stone frame covers it, which
     then shades the wall where it meets it;
   - in a reveal, how deep into the wall it is: the edge rounds over into it,
     and it darkens going in, so an arch reads as a cut edge, not a drawn line;
   - on a niche's back, its distance to the reveals round it: darker into
     those corners;
   - everywhere, how close it is to the floor, to the columns at the bay's
     corners, to the vault above, to the gallery and the cornice: a little
     darker there, so the wall is built in, not stood against them.
   Nothing here changes a light: the shade only takes away. */
// The plaster: a field 2.4 m square; tones keep the old walls' brightness.
export const wallPlaster = {kind: 'plaster', W: 512, H: 512, seed: 6151, across: 2.4, along: 2.4,
  tones: [[96, 90, 82], [134, 127, 116]]};
wallPlaster.pixel = [wallPlaster.across / wallPlaster.W, wallPlaster.along / wallPlaster.H];
const earlyPlaster = pairOf(wallPlaster, 1);

const WALL_COMMON = `
  uniform vec4 uChamber;   // apothem, a bay's half-width, the springing, the formeret's rise
  uniform vec4 uLevels;    // the gallery's underside and floor, the cornice's foot and top
  uniform float uWallShade, uArris, uArrisWear, uMacro;
  varying vec3 vPlan, vPlanNormal; varying vec4 vOpen, vBay;
  // The pointed arch room-chamber.js draws (open: half-width, sill, shoulder, peak):
  // its height at u from the axis, and its half-width at height y.
  float wallArchTop(vec4 w, float u) {
    float t = sqrt(max(0., 1. - abs(u) / w.x)), c = w.z + .6 * (w.w - w.z);
    return w.z * (1. - t) * (1. - t) + c * 2. * t * (1. - t) + w.w * t * t;
  }
  // Its half-width at height y, and how fast that changes with y.
  vec2 wallArchSide(vec4 w, float y) {
    if (y <= w.z) return vec2(w.x, 0.);
    float c = w.z + .6 * (w.w - w.z), a = w.z - 2. * c + w.w, b = 2. * (c - w.z), yy = min(y, w.w);
    float t = abs(a) < 1e-5 ? (yy - w.z) / b : (-b + sqrt(max(0., b * b - 4. * a * (w.z - yy)))) / (2. * a);
    return vec2(w.x * (1. - t * t), -2. * w.x * t / max(b + 2. * a * t, 1e-4));
  }
  // Distance across the wall's face to an arch's outline from outside it (0
  // within): the gap across to its side over the side's slope, as to a
  // straight line there; above the crown, to the crown. It runs on smoothly
  // everywhere, so the shading never sees an edge where there is none.
  float wallOutside(vec4 w, float u, float y) {
    float au = abs(u);
    if (y < w.y) return au < w.x ? w.y - y : length(vec2(au - w.x, w.y - y));
    vec2 side = wallArchSide(w, y);
    float d = (au - side.x) / sqrt(1. + side.y * side.y);
    if (y > w.w) d = length(vec2(max(d, 0.), y - w.w));
    return max(d, 0.);
  }
  // ... and from inside it, to its sides, its arch and its sill.
  float wallInside(vec4 w, float u, float y) {
    vec2 side = wallArchSide(w, y);
    float d = (side.x - abs(u)) / sqrt(1. + side.y * side.y);
    return max(min(d, w.y > 0. ? y - w.y : 1e3), 0.);
  }
  vec3 wallBent(vec3 at, vec3 n, vec2 slope, float facing) {
    vec3 sx = dFdx(at), sy = dFdy(at), r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * facing;
    return normalize(abs(det) * n - sign(det) * (slope.x * r1 + slope.y * r2));
  }`;

function compileWall(shader) {
  Object.assign(shader.uniforms, this.userData.look);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
    attribute vec4 bayOpen, bayFrame; varying vec3 vPlan, vPlanNormal; varying vec4 vOpen, vBay;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
    vPlan = position; vPlanNormal = normal; vOpen = bayOpen; vBay = bayFrame;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${WALL_COMMON}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
    // Where this point is on its bay: u across it, y up, how deep into the
    // wall behind its face; which face it is on.
    vec2 bayOut = vBay.xy, bayRight = vec2(-bayOut.y, bayOut.x);
    float bayU = dot(vPlan.xz, bayRight), wallY = vPlan.y, intoWall = dot(vPlan.xz, bayOut) - uChamber.x;
    float facingRoom = -dot(vPlanNormal.xz, bayOut);
    bool onBay = vBay.w < 2.5 && dot(bayOut, bayOut) > .5;
    bool onFace = onBay && facingRoom > .7 && intoWall < .01, onBack = onBay && facingRoom > .7 && intoWall >= .01;
    bool inReveal = onBay && abs(facingRoom) <= .7;
    float shade = 1.;
    // Toward the floor, over the plinth (0.14 m).
    shade *= 1. - .26 * exp(-max(wallY - .14, 0.) / .45);
    // How far to the opening's edge (rounded and worn on the face and in its
    // reveal); 10 = none near.
    float arris = 10.;
    if (onBay) {
      // Into the corners where the columns stand, and up under the vault.
      shade *= 1. - .3 * exp(-max(uChamber.y - abs(bayU), 0.) / .22);
      vec4 formeret = vec4(uChamber.y, 0., uChamber.z, uChamber.z + uChamber.w);
      if (abs(bayU) < uChamber.y) shade *= 1. - .3 * exp(-max(wallArchTop(formeret, bayU) - wallY, 0.) / .25);
      // The gallery (not in the window's bay): under its slab and over its floor.
      if (vBay.w != 1.) shade *= 1. - .3 * (wallY < uLevels.x ? exp(-(uLevels.x - wallY) / .14) : exp(-max(wallY - uLevels.y, 0.) / .1));
      // The cornice (not in the window's or the tower's bay).
      if (vBay.w == 0.) shade *= 1. - .25 * (wallY < uLevels.z ? exp(-(uLevels.z - wallY) / .07) : exp(-max(wallY - uLevels.w, 0.) / .1));
      if (onFace) {
        float edge = wallOutside(vOpen, bayU, wallY);
        if (vBay.z > 0.) shade *= 1. - .3 * exp(-max(edge - vBay.z, 0.) / .05);
        else arris = edge;
      }
      if (inReveal) {
        // Deeper into the reveal, darker; its edge rounds over from the face.
        arris = max(intoWall, 0.);
        shade *= 1. - .38 * smoothstep(0., .3, intoWall);
      }
      if (onBack) shade *= (1. - .12) * (1. - .3 * exp(-wallInside(vOpen, bayU, wallY) / .07));
    }
    // (A pixel at the very edge may be shaded from a point just past it; it
    // is taken no nearer than 0.6 pixel, so the edge never sparkles.)
    float arrisPixel = max(fwidth(arris), 1e-5);
    arris = max(arris, .6 * arrisPixel);
    float arrisRim = arris < 5. ? exp(-arris / max(.006, 2. * arrisPixel)) * min(1., .006 / (2. * arrisPixel)) : 0.;
    // The wall on a larger scale than its map repeats: the lime wash's tone
    // taken again, broader and turned.
    #ifdef USE_NORMALMAP
      float broad = texture2D(normalMap, mat2(.17, .11, -.11, .17) * vNormalMapUv + vec2(.31, .57)).a;
    #else
      float broad = .5;
    #endif
    diffuseColor.rgb *= mix(1., shade, uWallShade) * (1. + uMacro * (broad - .5)) * (1. + uArrisWear * arrisRim);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    #ifdef USE_MAP
      roughnessFactor = sampledDiffuseColor.a * (1. - .15 * arrisRim);
    #endif`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    if (arris < 5.) {
      // The opening's edge rounded over (as the timber's, room-joinery.js):
      // the slope worked out here, the way to the edge from the screen.
      float radius = max(uArris, arrisPixel * 2.5), turn = clamp(1. - arris / radius, 0., 1.);
      normal = wallBent(-vViewPosition, normal, vec2(dFdx(arris), dFdy(arris)) * (uArris * turn / radius), faceDirection);
    }`);
}

/* The walls' material. tuning: room-chamber.js's chamberTuning; hw: a bay's
   half-width at the wall's face (chamber.hw). look: live-tunable through
   material.userData.look (studyRoom.walls): uWallShade (0 none, 1 as
   designed), uArris (metres), uArrisWear, uMacro. */
export function createWallSurface({anisotropy = 4, colour, tuning, hw}) {
  const pair = earlyPlaster, G = tuning.gallery, stats = {textures: 2};
  pair.map.anisotropy = pair.normalMap.anisotropy = anisotropy;
  pair.job.answer.then(answer => Object.assign(stats, {worker: answer.worker, ms: answer.ms.maps}));
  const material = new THREE.MeshStandardMaterial({color: colour, map: pair.map, normalMap: pair.normalMap, roughness: 1});
  material.userData.look = {
    uChamber: {value: new THREE.Vector4(tuning.apothem, hw, tuning.spring, tuning.formeret)},
    // The gallery's underside and floor; the cornice's foot and top (room-chamber.js).
    uLevels: {value: new THREE.Vector4(G.floor - G.slab, G.floor, tuning.spring - .18, tuning.spring)},
    uWallShade: {value: 1}, uArris: {value: .014}, uArrisWear: {value: .12}, uMacro: {value: .16}};
  material.onBeforeCompile = compileWall;
  return {material, stats};
}
