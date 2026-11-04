/* The room's plain lights in a loop, for a quicker first visit.
   three.js writes out every light's code once per light ("unrolled"): with
   the room's 12 point lights and 7 spots, each lit material's shader holds
   19 copies of its lighting. Compiling those shaders is most of a first
   visit's load on Windows (ANGLE turns them into HLSL, and the D3D compiler
   and then the graphics driver take seconds over each). Here the lights
   with neither a shadow nor a projected map are lit in an ordinary loop
   instead: the same lights, the same sums, in the same order, from shaders
   a fraction of the size.
   - three.js puts the lights with a shadow or a map first. Those stay
     written out, by three.js's own code, since a shadow map or a light map
     can only be picked by a constant.
   - The rest follow in a loop. Its break is never taken: it only marks the
     loop as one to keep (ANGLE's [loop]), so the D3D compiler does not
     write it out again.
   Imported before anything builds a material, so every program the room's
   renderers compile has it. */
import {ShaderChunk} from './vendor/three/three.module.js';

const plain = (kind, first, count) => `
	for ( int i = ${first}; i < ${count}; i ++ ) {
		if ( i >= ${count} ) break;
		${kind}Light = ${kind}Lights[ i ];
		get${kind[0].toUpperCase() + kind.slice(1)}LightInfo( ${kind}Light, geometryPosition, directLight );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}`;

let chunk = ShaderChunk.lights_fragment_begin;
for (const [kind, first, count] of [['point', 'NUM_POINT_LIGHT_SHADOWS', 'NUM_POINT_LIGHTS'], ['spot', 'NUM_SPOT_LIGHT_COORDS', 'NUM_SPOT_LIGHTS']]) {
  const head = `for ( int i = 0; i < ${count}; i ++ ) {`, start = chunk.indexOf(head), end = chunk.indexOf('#pragma unroll_loop_end', start);
  if (start < 0 || end < 0) continue;
  // three.js's own loop covers the lights with a shadow (or a map), the plain loop the rest.
  const after = end + '#pragma unroll_loop_end'.length;
  chunk = chunk.slice(0, start) + `for ( int i = 0; i < ${first}; i ++ ) {` + chunk.slice(start + head.length, after) + plain(kind, first, count) + chunk.slice(after);
}
ShaderChunk.lights_fragment_begin = chunk;
