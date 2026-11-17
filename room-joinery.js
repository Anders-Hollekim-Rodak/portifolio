/* Joinery and trim: the room's timber and stone pieces as geometry, for
   room-chamber.js and room-scene.js. Geometry only; THREE is passed in, so the
   plan's checks can build the room without a page.

   Every piece carries what the surfaces' shader (room-materials.js) reads:
   - uv, in metres: v along the grain, u across it, each piece starting at a
     place of its own in the texture, so neighbours never match;
   - edges: four distances in metres, linear over each face (NONE where there
     is nothing). x, y: to two of the face's free edges, which the shader
     rounds and wears; z, w: to where the piece meets something (its ends, or
     the wall behind a moulding), which the shader shades, or, given as
     negative numbers, to two more free edges, rounded as x and y are.
   Edges are rounded in the shading, never chamfered: a piece keeps its few
   triangles. Where a form is truly round (a shaft, a turned base, a
   moulding's profile) it is round in the geometry. */
export const NONE = 10;

export function createJoinery(THREE) {
  // Each piece's own start in the texture, by the order pieces are made.
  let serial = 0;
  const start = () => { const s = Math.sin(++serial * 127.1) * 43758.5453, t = Math.sin(serial * 311.7) * 43758.5453; return [(s - Math.floor(s)) * 3, (t - Math.floor(t)) * 7]; };
  const withEdges = (g, edges) => { g.setAttribute('edges', new THREE.BufferAttribute(edges, 4)); return g; };
  const plain = g => withEdges(g, new Float32Array(g.attributes.position.count * 4).fill(NONE));

  /* A sawn piece: a box w, h, d (x, y, z) about the origin. The grain runs
     along its longest side unless given (0, 1 or 2). ends: what each end
     along the grain (-, +) is: true where it meets something (shaded),
     'round' where it is free (its edges rounded all round), false for
     neither. round: whether its long edges are free. The four long faces
     show four different strips of the wood. */
  function beam(w, h, d, {grain, ends = [true, true], round = true} = {}) {
    const g = new THREE.BoxGeometry(w, h, d), size = [w, h, d], p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const along = grain ?? size.indexOf(Math.max(w, h, d)), edges = new Float32Array(p.count * 4), [u0, v0] = start();
    const end = (kind, distance) => kind === 'round' ? -distance - 1e-4 : kind ? distance : NONE;
    for (let i = 0; i < p.count; i++) {
      const at = [p.getX(i), p.getY(i), p.getZ(i)], face = [n.getX(i), n.getY(i), n.getZ(i)].findIndex(v => Math.abs(v) > .5);
      if (face === along) {
        // End grain: seen only where the end is free, and then rounded all round.
        const [a, b] = [0, 1, 2].filter(k => k !== face), free = ends[at[face] > 0 ? 1 : 0] === 'round';
        uv.setXY(i, at[a] + u0, at[b] + v0);
        edges.set(free ? [size[a] / 2 + at[a], size[a] / 2 - at[a], end('round', size[b] / 2 + at[b]), end('round', size[b] / 2 - at[b])] : [NONE, NONE, NONE, NONE], i * 4);
      } else {
        const across = 3 - face - along, ha = size[across] / 2, hb = size[along] / 2;
        uv.setXY(i, at[across] + u0 + face * .37 + (at[face] > 0 ? .19 : 0), at[along] + v0);
        edges.set([round ? ha + at[across] : NONE, round ? ha - at[across] : NONE, end(ends[0], hb + at[along]), end(ends[1], hb - at[along])], i * 4);
      }
    }
    return withEdges(g, edges);
  }

  /* A round shaft about the y axis, open at both ends (they stand in a base
     and a capital, or in rails). from, arc: the part of the round that is
     made, as CylinderGeometry counts angles (0 toward +z, turning to +x). */
  function shaft(radiusTop, radiusBottom, height, segments, {from = 0, arc = Math.PI * 2, ends = [true, true], open = true} = {}) {
    const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, open, from, arc), p = g.attributes.position, uv = g.attributes.uv;
    const edges = new Float32Array(p.count * 4), [u0, v0] = start(), r = (radiusTop + radiusBottom) / 2;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      uv.setXY(i, uv.getX(i) * arc * r + u0, y + v0);
      edges.set([NONE, NONE, ends[0] ? y + height / 2 : NONE, ends[1] ? height / 2 - y : NONE], i * 4);
    }
    return withEdges(g, edges);
  }

  /* A run of moulding along x, `length` long about the origin, standing on
     the wall plane z = 0 and out from it toward -z. profile: its section from
     the foot against the wall, out, up and back to the wall: [out, up] in
     metres, a third entry 'crisp' for a sharp arris (otherwise the surface
     turns softly through the point). Only what shows is made: no back.
     contact: whether the foot and the head lie against something (shaded
     there); caps: which ends (-x, +x) are closed; back: whether it is seen
     from behind too (a board hanging free). The grain runs along it. */
  function moulding(profile, length, {contact = [true, true], caps = [false, false], back = false} = {}) {
    const position = [], normal = [], uv = [], edges = [], [u0, v0] = start(), half = length / 2;
    const segments = profile.slice(1).map(([d1, y1], i) => { const [d0, y0] = profile[i], l = Math.hypot(d1 - d0, y1 - y0) || 1; return {n: [(y1 - y0) / l, -(d1 - d0) / l], l}; });
    const total = segments.reduce((sum, s) => sum + s.l, 0);
    // The surface's direction at each point of the section, for either of its two faces.
    const facing = (i, s) => {
      if (profile[i][2] === 'crisp' || i === 0 || i === profile.length - 1) return segments[s].n;
      const a = segments[i - 1].n, b = segments[i].n, l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      return [(a[0] + b[0]) / l, (a[1] + b[1]) / l];
    };
    let run = 0;
    segments.forEach((segment, s) => {
      const [d0, y0] = profile[s], [d1, y1] = profile[s + 1], n0 = facing(s, s), n1 = facing(s + 1, s), next = run + segment.l;
      const corner = (x, d, y, n, at) => ({p: [x, y, -d], n: [0, n[1], -n[0]], uv: [at + u0, x + v0], e: [NONE, NONE, contact[0] ? at : NONE, contact[1] ? total - at : NONE]});
      const a = corner(-half, d0, y0, n0, run), b = corner(half, d0, y0, n0, run), c = corner(half, d1, y1, n1, next), e = corner(-half, d1, y1, n1, next);
      // Wound to face out from the wall (the section runs out, up and back).
      for (const q of [a, c, b, a, e, c]) { position.push(...q.p); normal.push(...q.n); uv.push(...q.uv); edges.push(...q.e); }
      run = next;
    });
    // An end is a fan about the wall's line at the foot's height.
    const hub = [0, profile[0][1]], first = profile[0][0] > 0 ? 0 : 1;
    caps.forEach((closed, k) => {
      if (!closed) return;
      const x = k ? half : -half, sign = k ? 1 : -1;
      for (let i = first; i < profile.length - 1; i++) {
        const fan = [hub, profile[i], profile[i + 1]].map(([d, y]) => ({p: [x, y, -d], uv: [d + u0, y + v0]}));
        // Seen from outside its end: the section runs out (-z) and up.
        for (const q of sign > 0 ? [fan[0], fan[1], fan[2]] : [fan[0], fan[2], fan[1]]) { position.push(...q.p); normal.push(sign, 0, 0); uv.push(...q.uv); edges.push(NONE, NONE, NONE, NONE); }
      }
    });
    if (back) {
      const y0 = profile[0][1], y1 = profile[profile.length - 1][1];
      for (const [x, y] of [[-half, y0], [half, y1], [-half, y1], [-half, y0], [half, y0], [half, y1]]) {
        position.push(x, y, 0); normal.push(0, 0, 1); uv.push(y + u0 + .4, x + v0); edges.push(NONE, NONE, NONE, NONE);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('edges', new THREE.Float32BufferAttribute(edges, 4));
    return g;
  }

  /* A turned piece about the y axis: its profile [radius, height] from the
     foot up, round where it turns. from, arc: the part of the round made. */
  const turned = (profile, segments, from = 0, arc = Math.PI * 2) =>
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments, from, arc);

  // A tube's texture coordinates brought to metres: round it across the
  // grain, along it with the grain.
  function tube(geometry, radius, length) {
    const uv = geometry.attributes.uv, [u0, v0] = start();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 2 * Math.PI * radius + u0, uv.getX(i) * length + v0);
    return plain(geometry);
  }

  // A flat slab (an extrusion or the like), its grain along the plan
  // direction (gx, gz): the level faces by where they lie, the rest by height.
  function slab(geometry, gx = 1, gz = 0) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv, [u0, v0] = start();
    for (let i = 0; i < p.count; i++) {
      const along = p.getX(i) * gx + p.getZ(i) * gz, across = p.getX(i) * -gz + p.getZ(i) * gx;
      uv.setXY(i, (Math.abs(n.getY(i)) > .5 ? across : p.getY(i)) + u0, along + v0);
    }
    return plain(geometry);
  }

  // Stone has no grain: each triangle is laid flat along the axis it faces,
  // in metres, so the texture runs on from one piece to the next.
  function dressed(geometry) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry, p = g.attributes.position, uv = new Float32Array(p.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      n.subVectors(b, a).cross(c.sub(a)); const x = Math.abs(n.x), y = Math.abs(n.y), z = Math.abs(n.z);
      for (let k = i; k < i + 3; k++) {
        if (y >= x && y >= z) { uv[k * 2] = p.getX(k); uv[k * 2 + 1] = p.getZ(k); }
        else if (x >= z) { uv[k * 2] = p.getZ(k); uv[k * 2 + 1] = p.getY(k); }
        else { uv[k * 2] = p.getX(k); uv[k * 2 + 1] = p.getY(k); }
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g.attributes.edges ? g : plain(g);
  }

  // Faces that meet within `degrees` of one another are shaded as one curved
  // surface; sharper meetings stay crisp. For geometry made of flat facets
  // (the carved frames of room-architecture.js): it reads as cut stone, with
  // no more triangles.
  function soften(geometry, degrees = 50) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry, p = g.attributes.position, limit = Math.cos(degrees * Math.PI / 180);
    const faces = new Float32Array(p.count * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      b.sub(a).cross(c.sub(a));   // area-weighted
      for (let k = i; k < i + 3; k++) faces.set([b.x, b.y, b.z], k * 3);
    }
    const shared = new Map(), key = i => Math.round(p.getX(i) * 2e4) + ',' + Math.round(p.getY(i) * 2e4) + ',' + Math.round(p.getZ(i) * 2e4);
    for (let i = 0; i < p.count; i++) { const k = key(i); if (!shared.has(k)) shared.set(k, []); shared.get(k).push(i); }
    const normal = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const fx = faces[i * 3], fy = faces[i * 3 + 1], fz = faces[i * 3 + 2], fl = Math.hypot(fx, fy, fz) || 1;
      let x = 0, y = 0, z = 0;
      for (const j of shared.get(key(i))) {
        const gx = faces[j * 3], gy = faces[j * 3 + 1], gz = faces[j * 3 + 2], gl = Math.hypot(gx, gy, gz) || 1;
        if ((fx * gx + fy * gy + fz * gz) / (fl * gl) >= limit) { x += gx; y += gy; z += gz; }
      }
      const l = Math.hypot(x, y, z) || 1; normal.set([x / l, y / l, z / l], i * 3);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    return g;
  }

  // The same piece again elsewhere: its own stretch of the texture.
  function shifted(geometry, du, dv) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
    return geometry;
  }

  return {beam, shaft, moulding, turned, tube, slab, dressed, soften, shifted, plain, withEdges};
}
