/* Living orb architecture. Exterior-only OffscreenCanvas renderer.
   All geometry, currents and choreography run in this worker. No room imports.
   Time is visible animation time; formation finishes at 6.6 s before entry.
   CPU/GPU resources belong exclusively to this worker. */
'use strict';
const FORMATION = 6.6, ENTRY = {approach:2.6, arrival:2, curtains:1.4, walk:5};
const TAU = Math.PI*2;
// One scale for the whole building, that of the room inside it
// (room-chamber.js, room-tower.js): 0.246 to a metre, so the chamber's outer
// wall (4.35 m from its centre) is the body's widest, 1.07. The room's floor,
// the door's sill, is y -0.78 here.
const S = .246, FLOOR = -.78;
const at = metres => FLOOR + metres*S;
// The body is drawn 0.291 to a metre upward (its walls rise to the room's
// springing, 3.9 m, its dome to the vault's crown) and brought down to the one
// scale as it is placed (squash), so its formation keeps its shape and timing.
const K = S/.291, squash = y => FLOOR + (y-FLOOR)*K;
// The orb's core over the dome: as drawn, and where it stands.
const CORE = [-.06,1.72,.08], CORE_AT = [CORE[0],squash(CORE[1]),CORE[2]];
// The stair tower: its drum (1.70 m inside, a 0.35 m wall) stands 5.69 m from
// the chamber's centre, back right (-30 degrees), from below the floor up to
// its roof at 7 m; a tall, concave spire above.
const TOWER = [4.926*S, 0, -2.844*S], TOWER_R = 2.05*S, TOWER_BASE = FLOOR-.3, TOWER_ROOF = at(7), TOWER_TIP = at(11.7);
// The doorway: the room's own (room-chamber.js OPEN.door), 0.74 m either side
// of its axis, straight jambs to 1.26 m, then two quadratic curves to its
// peak at 2.54 m, drawn as the room draws it, so the two meet exactly. It is
// at the end of the room's passage (the wall, and a metre beyond it): 5.35 m
// from the chamber's centre (`plane`), the face of a porch grown out of the
// body (PORCH), whose passage runs back into the body to `back`.
const DOOR = {a:.74*S, sill:FLOOR, shoulder:at(1.26), peak:at(2.54), plane:5.35*S, back:3.7*S};
const PORCH = {a:1.18*S, sill:FLOOR, shoulder:at(1.8), peak:at(3.5)}, FRAME = {a:.86*S, sill:FLOOR, shoulder:at(1.26), peak:at(2.72)};
const control = w => w.shoulder + .6*(w.peak-w.shoulder);
// The terrace before the door: dressed stone, its top at the floor's level.
const PLATFORM = {z:DOOR.plane-.01, length:1.72};
// The room's terms (scene-camera.js wayIn and entryView): x right, y up from
// the floor and z toward the door, in metres, with the table at the origin
// and the chamber's centre at z 0.3 (room-scene.js placement); yaw (left
// positive) and tilt (down positive) in degrees; lens, where the view's
// centre sits, a share of its height. The walk in starts on the landing
// (LANDING m before the door) and ends on the entry's own view, sent by the
// gate; the room's camera follows this one all the way.
const ROOM_Z = .3, DOOR_Z = 5.35 + ROOM_Z, LANDING = 2.6;
const world = (x,y,z) => [x*S, at(y), (z-ROOM_Z)*S];
let entry = {x:0, y:1.7, z:3.4, yaw:0, tilt:4.8, lens:.5, fov:72};
// GLSL literals.
// (Negative values in parentheses: "y--0.5" would read as a decrement.)
const f = v => (v<0?'('+(+v).toFixed(4)+')':(+v).toFixed(4)), v3 = a => 'vec3('+a.map(f).join(',')+')';
let gl, pg, meshes, canvas, width=1,height=1,screenW=1,screenH=1,dpr=1;
let disposed=false, paused=false, reduced=false, first=true, formed=false, flight=null, sentView='', lighter=false;
let time=0,last=null,rate=1,handle=0, lastDraw=-100,phase='',statsAt=0;
let metrics={frames:0,frameGaps:[],cpuMs:[],gpuMs:[],triangles:0,drawCalls:0}, query=null, ext=null;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const forward=(yaw,tilt)=>{const y=yaw*Math.PI/180,t=tilt*Math.PI/180;return[-Math.sin(y)*Math.cos(t),-Math.sin(t),-Math.cos(y)*Math.cos(t)];};
const send=(type,detail={})=>postMessage({type,...detail});
function setPhase(value){if(phase!==value){phase=value;send('phase',{phase,time});}}
function lathe(radius,top,bottom,rows,segments,center=[0,0,0]){
 const p=[],n=[],ix=[];
 for(let i=0;i<=rows;i++){
  const y=top+(bottom-top)*i/rows,r=Math.max(0,radius(y)),e=.002;
  const slope=(Math.max(0,radius(y+e))-Math.max(0,radius(y-e)))/(2*e);
  for(let j=0;j<=segments;j++){
   const a=j/segments*TAU,c=Math.cos(a),s=Math.sin(a),nn=norm([c,-slope,s]);
   p.push(center[0]+r*c,center[1]+y,center[2]+r*s);n.push(...nn);
  }
 }
 for(let i=0;i<rows;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;ix.push(a,b,a+1,a+1,b,b+1);}
 return {p,n,ix};
}
function bodyRadius(y){
 if(y>.38)return 1.07*Math.sqrt(Math.max(0,1-((y-.38)/.91)**2));
 if(y>-.79){
  const belly=1.07-.12*((y-.38)/1.17)**2;
  // A string course where the gallery's floor is inside (2.85 m), and a lip
  // at the floor's, inside the socle.
  const lip=.025*Math.exp(-(((y-.0494)/.045)**2))+.035*Math.exp(-(((y+.77)/.05)**2));
  return belly+lip;
 }
 const u=clamp((-y-.79)/.5);
 return .95*Math.pow(1-u,.68);
}
function towerRadius(y){
 // The roof: a tall, concave spire flaring out over the drum at its eaves.
 if(y>TOWER_ROOF)return TOWER_R*1.13*Math.pow(clamp((TOWER_TIP-y)/(TOWER_TIP-TOWER_ROOF)),1.75)+.003;
 // Below the floor it rounds off underneath, as the body does.
 if(y<FLOOR)return TOWER_R*1.03*Math.pow(clamp((y-TOWER_BASE)/(FLOOR-TOWER_BASE)),.68);
 // The drum, narrowing a little as it rises, with a band where the upper
 // floor is inside (2.85 m) and a cornice under the eaves.
 const u=clamp((y-FLOOR)/(TOWER_ROOF-FLOOR));
 const band=.016*Math.exp(-(((y-at(2.85))/.018)**2)),cornice=.024*Math.exp(-(((y-TOWER_ROOF+.035)/.03)**2));
 return TOWER_R*(1.03-.07*u)+band+cornice;
}
// A pointed arch as the room draws it (room-chamber.js outline): from the
// sill's left end up the jamb, over the two quadratic curves and down.
function arch(w=DOOR,steps=18){
 const c=control(w),y=t=>w.shoulder*(1-t)**2+2*c*t*(1-t)+w.peak*t*t,pts=[[-w.a,w.sill],[-w.a,w.shoulder]];
 for(let i=1;i<=steps;i++){const t=i/steps;pts.push([-w.a*(1-t*t),y(t)]);}
 for(let i=steps-1;i>=0;i--){const t=i/steps;pts.push([w.a*(1-t*t),y(t)]);}
 pts.push([w.a,w.sill]);return pts;
}
// Its top at x from the axis.
function archTop(w,x){const t=Math.sqrt(Math.max(0,1-Math.abs(x)/w.a));return w.shoulder*(1-t)**2+2*control(w)*t*(1-t)+w.peak*t*t;}
// A strip of faces along an outline, from depth z0 to z1.
function extrude(pts,z0,z1,into,mesh={p:[],n:[],ix:[]}){
 const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
 for(let i=0;i<pts.length-1;i++){
  const [x,y]=pts[i],[xx,yy]=pts[i+1],b=mesh.p.length/3;let nn=norm([y-yy,xx-x,0]);
  if((nn[0]*((x+xx)/2-cx)+nn[1]*((y+yy)/2-cy)<0)!==into)nn=nn.map(v=>-v);
  mesh.p.push(x,y,z0,xx,yy,z0,x,y,z1,xx,yy,z1);for(let k=0;k<4;k++)mesh.n.push(...nn);mesh.ix.push(b,b+2,b+1,b+1,b+2,b+3);
 }
 return mesh;
}
// The porch: its outer surface of glass from inside the body out to the
// door's face, or (face) that face, of stone: a ring between its outline and
// the doorway's.
function porch(face){
 const outer=arch(PORCH),inner=arch(DOOR),mesh=face?{p:[],n:[],ix:[]}:extrude(outer,DOOR.back,DOOR.plane,false);
 if(!face)return mesh;
 const b=mesh.p.length/3;
 for(let i=0;i<outer.length;i++){mesh.p.push(outer[i][0],outer[i][1],DOOR.plane,inner[i][0],inner[i][1],DOOR.plane);mesh.n.push(0,0,1,0,0,1);}
 for(let i=0;i<outer.length-1;i++){const a=b+2*i;mesh.ix.push(a,a+1,a+2,a+2,a+1,a+3);}
 return mesh;
}
// The passage through it: the doorway's outline back into the body, closed
// there in the same dark stone.
function passage(){
 const pts=arch(DOOR),mesh=extrude(pts,DOOR.plane,DOOR.back,true),b=mesh.p.length/3;
 mesh.p.push(0,(DOOR.sill+DOOR.shoulder)/2,DOOR.back);mesh.n.push(0,0,1);
 for(const [x,y] of pts){mesh.p.push(x,y,DOOR.back);mesh.n.push(0,0,1);}
 for(let i=0;i<pts.length;i++)mesh.ix.push(b,b+1+i,b+1+(i+1)%pts.length);
 return mesh;
}
// The doorway's frame: a round moulding standing on the porch's face.
function frame(){
 const pts=arch(FRAME),p=[],n=[],ix=[],rings=10,r=.021;
 pts.forEach(([x,y],i)=>{
  const b=pts[Math.max(0,i-1)],a=pts[Math.min(pts.length-1,i+1)],nn=norm([a[1]-b[1],b[0]-a[0],0]);
  for(let k=0;k<=rings;k++){const t=k/rings*TAU,c=Math.cos(t),s=Math.sin(t);p.push(x+nn[0]*r*c,y+nn[1]*r*c,DOOR.plane+.004+r*s);n.push(nn[0]*c,nn[1]*c,s);}
 });
 for(let i=0;i<pts.length-1;i++)for(let k=0;k<rings;k++){const a=i*(rings+1)+k,b=a+rings+1;ix.push(a,b,a+1,a+1,b,b+1);}
 return{p,n,ix};
}
function curtain(side){
 const p=[],n=[],ix=[],cols=36,rows=42;
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const u=j/cols,x=side*DOOR.a*u,top=archTop(DOOR,x),v=i/rows;
  p.push(x,top+(DOOR.sill-top)*v,DOOR.plane-.02);n.push(0,0,1);
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
 return{p,n,ix};
}
// Normals of a grid of points (rows+1 rings of cols+1, the last column the
// first again), facing away from inside(i), a point within ring i.
function gridNormals(p,rows,cols,inside){
 const at=(i,j)=>{const k=3*(i*(cols+1)+(j+cols)%cols);return[p[k],p[k+1],p[k+2]];},n=[];
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const across=sub(at(i,j+1),at(i,j-1)),along=sub(at(Math.min(rows,i+1),j),at(Math.max(0,i-1),j)),o=sub(at(i,j),inside(i));
  let nn=norm(cross(across,along));if(nn[0]*o[0]+nn[1]*o[1]+nn[2]*o[2]<0)nn=nn.map(v=>-v);
  n.push(...nn);
 }
 return n;
}
// The terrace before the door: a slab of dressed stone, its paved top at the
// floor's level (the walk in stands on it) with a rounded edge, and under it
// rough rock tapering into the void as the body's keel does. It runs back
// under the porch into the socle, widens, and ends round.
const terraceHalf=v=>{v=clamp(v);return Math.max(.002,(.38+.13*Math.sin(Math.min(v/.6,1)*Math.PI/2))*(v>.62?Math.sqrt(Math.max(0,1-((v-.62)/.38)**2)):1));};
function platform(){
 const p=[],ix=[],rows=64,cols=72,{z,length}=PLATFORM,from=DOOR.back+.04,mid=FLOOR-.03,shape=[];
 for(let i=0;i<=rows;i++){
  const zz=from+(z+length-from)*i/rows,v=clamp((zz-z)/length),w=terraceHalf(v);
  const deep=(.10+.22*Math.sin(Math.min(1,v*1.1)*Math.PI*.9))*Math.min(1,w/.3)+.03;
  shape.push([0,mid-deep*.3,zz]);
  for(let j=0;j<=cols;j++){
   const a=j/cols*TAU,c=Math.cos(a),s=Math.sin(a);
   if(s>=0){p.push(w*Math.sign(c)*Math.pow(Math.abs(c),.42),mid+.03*Math.pow(s,.16),zz);continue;}
   const rough=1+(-s)*(.2*Math.sin(v*23+a*5)*Math.sin(v*9-a*3)+.1*Math.sin(v*41+a*11));
   p.push(w*Math.sign(c)*Math.pow(Math.abs(c),.7),mid-deep*Math.pow(-s,.85)*rough,zz);
  }
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
 return{p,n:gridNormals(p,rows,cols,i=>shape[i]),ix};
}
// ---- Concept B, the liquid sanctuary: the shell of living orb-glass held in
// a frame of the room's own materials (room-chamber.js, room-scene.js): a
// ribbed dome, its bronze ribs over the chamber's corners meeting in a ring
// at its crown; bronze bands where the gallery's floor and the vault's
// springing are; a stone socle it stands in; a portal of stone orders on
// colonnettes; windows sunk into the glass in bronze frames on stone sills;
// a bronze setting under the core; lanterns on the terrace. Each piece grows
// with the part it belongs to (deform's part) and is drawn in its material
// (mat: 0 glass, 1 bronze, 2 stone, 3 a lantern's lit glass). Those on the
// body are built in its own coordinates (0.291 to a metre upward, before
// squash), so they grow and breathe with it.
const BODY_UP=.291,OLD=m=>FLOOR+m*BODY_UP,DEG=Math.PI/180;
// Bay k's direction in plan (room-chamber.js): -90 + 30k degrees; the door's
// is bay 6 (+z), the great window's bay 0, the tower's bay 2.
const BAY=k=>(-90+30*k)*DEG;
const onBody=(a,m,out=0)=>{const y=OLD(m),r=bodyRadius(y)+out;return[r*Math.cos(a),y,r*Math.sin(a)];};
const bodyNormal=(a,m)=>{const y=OLD(m),e=.002,slope=(bodyRadius(y+e)-bodyRadius(y-e))/(2*e);return norm([Math.cos(a),-slope,Math.sin(a)]);};
// Grown, the tower is turned as it rises (deform: 1.5 radians over its
// height) and drawn out to an ellipse. Where a point on its drum is built, to
// be seen in direction a; and how far round the drum a unit there is.
const TWIST=1.5,STRETCH=[1.08,.94];
function turned(a,y){
 const psi=Math.atan2(Math.sin(a)/STRETCH[1],Math.cos(a)/STRETCH[0]);
 return{phi:psi+TWIST*clamp((y-TOWER_BASE)/(TOWER_TIP-TOWER_BASE)),span:towerRadius(y)*Math.hypot(STRETCH[0]*Math.cos(psi),STRETCH[1]*Math.sin(psi))};
}
const onTower=(a,y,out=0)=>{const {phi}=turned(a,y),r=towerRadius(y)+out;return[TOWER[0]+r*Math.cos(phi),y,TOWER[2]+r*Math.sin(phi)];};
const towerNormal=(a,y)=>{const {phi}=turned(a,y);return[Math.cos(phi),0,Math.sin(phi)];};
// A point at the one scale, given in the body's coordinates (the core is
// moved there, not squashed, and its setting must meet it).
const unsquash=([x,y,z])=>[x,FLOOR+(y-FLOOR)/K,z];
// The windows, metres: a clerestory over the gallery in nine bays, and the
// room's great window behind (room-chamber.js, bay 0).
const CLERESTORY={a:.24,sill:2.98,shoulder:3.36,peak:3.78},GREAT={a:.82,sill:.8,shoulder:3.6,peak:4.9};
const WINDOWS=[...[1,3,4,5,7,8,9,10,11].map(k=>({k,...CLERESTORY})),{k:0,...GREAT}];
// The tower's lancets, where the room has them (room-tower.js): stepped up
// round its drum over the stair, the directions they face from its axis.
const TOWER_WINDOWS=[[45.114,1.13],[3.514,1.7],[-38.086,2.46]].map(([d,sill])=>({at:d*DEG,a:.18,sill,shoulder:sill+1.5,peak:sill+1.85}));
// A frame's outline, pad metres outside an opening's (as the room's contour).
const around=(w,pad)=>({...w,a:w.a+pad,peak:w.peak+pad});
// Two lanterns at the terrace's outer end, either side of the way in (x, z).
const LANTERNS=[-1,1].map(side=>[side*1.45*S,DOOR.plane+4.6*S]);
const w4=w=>'vec4('+[w.a,w.sill,w.shoulder,w.peak].map(f).join(',')+')';
// A round moulding along a line of points (its section carried along it).
function tube(pts,radius,rings=8,mesh={p:[],n:[],ix:[]}){
 const b=mesh.p.length/3;let u=null;
 for(let i=0;i<pts.length;i++){
  const t=norm(sub(pts[Math.min(pts.length-1,i+1)],pts[Math.max(0,i-1)]));
  u=u?norm(sub(u,t.map(v=>v*(u[0]*t[0]+u[1]*t[1]+u[2]*t[2])))):norm(cross(t,Math.abs(t[1])<.9?[0,1,0]:[1,0,0]));
  const v=cross(t,u);
  for(let k=0;k<=rings;k++){
   const q=k/rings*TAU,c=Math.cos(q),s=Math.sin(q),d=[u[0]*c+v[0]*s,u[1]*c+v[1]*s,u[2]*c+v[2]*s];
   mesh.p.push(pts[i][0]+d[0]*radius,pts[i][1]+d[1]*radius,pts[i][2]+d[2]*radius);mesh.n.push(...d);
  }
 }
 for(let i=0;i<pts.length-1;i++)for(let k=0;k<rings;k++){const a=b+i*(rings+1)+k,c=a+rings+1;mesh.ix.push(a,c,a+1,a+1,c,c+1);}
 return mesh;
}
// A flat moulding along a line of points on a surface (outs: the surface's
// outward direction at each), half hw wide across it (or hw(share of the way
// along)) and th thick, standing a little proud of it; e < 1 squares its
// section off. Closed at its ends.
function strap(pts,outs,hw,th,mesh={p:[],n:[],ix:[]},e=1,rings=12){
 const b=mesh.p.length/3,width=typeof hw==='function'?hw:()=>hw,last=pts.length-1,rows=[[0,0],...pts.map((_,i)=>[i,1]),[last,0]];
 const power=(x,k)=>Math.sign(x)*Math.abs(x)**k;
 for(const [i,scale] of rows){
  const t=norm(sub(pts[Math.min(last,i+1)],pts[Math.max(0,i-1)])),side=norm(cross(t,outs[i])),up=cross(side,t),w=width(i/last),centre=add(pts[i],up,th*.6);
  for(let k=0;k<=rings;k++){
   const q=k/rings*TAU,c=Math.cos(q),s=Math.sin(q);
   mesh.p.push(...add(add(centre,side,power(c,e)*w*scale),up,power(s,e)*th*scale));
   mesh.n.push(...norm(add(side.map(v=>v*power(c,2-e)/w),up,power(s,2-e)/th)));
  }
 }
 for(let i=0;i<rows.length-1;i++)for(let k=0;k<rings;k++){const a=b+i*(rings+1)+k,c=a+rings+1;mesh.ix.push(a,c,a+1,a+1,c,c+1);}
 return mesh;
}
function merge(into,mesh){
 const b=into.p.length/3;
 for(const v of mesh.p)into.p.push(v);for(const v of mesh.n)into.n.push(v);for(const i of mesh.ix)into.ix.push(i+b);
 return into;
}
// The directions round an axis, in runs broken where an opening is (gaps:
// [direction, half-angle]); draw(run) for each.
function ring(gaps,draw,segments=168){
 const open=a=>gaps.some(([c,h])=>Math.abs(Math.atan2(Math.sin(a-c),Math.cos(a-c)))<h);
 let run=[];const flush=()=>{if(run.length>1)draw(run);run=[];};
 const start=gaps.length?gaps[0][0]:0;
 for(let i=0;i<=segments;i++){const a=start+i/segments*TAU;if(open(a))flush();else run.push(a);}
 flush();
}
// A short turned piece (capital, base, knop) on a vertical axis: a profile
// closed at both ends.
const turnedPiece=(x,z,y0,y1,radius,segments=16)=>lathe(y=>radius*Math.pow(Math.max(0,1-Math.abs((2*y-y0-y1)/(y1-y0))**6),.25),y1,y0,8,segments,[x,0,z]);
// The socle's section: a weathered top running out of the glass, a rounded
// cap, a slightly battered face, a flared foot, and back into the glass under
// it (m: metres from the floor; body: the glass's radius there).
function socle(m,body,face){
 if(m>=.58)return body+(face-body)*smooth((.64-m)/.06);
 if(m>=.46)return face+.016*Math.sqrt(Math.max(0,1-((m-.52)/.06)**2));
 if(m>=-.26)return face+.008*clamp((.46-m)/.72);
 if(m>=-.34)return face+.008+.02*Math.sqrt(Math.max(0,1-((m+.30)/.04)**2));
 return body+(face+.008-body)*smooth((m+.4)/.06);
}
// A window's bronze frame round its opening and its stone sill, on a wall
// (place(u, m, out): the point u metres across and m up, out proud of the
// wall; normal(u, m): the wall's outward direction).
function windowFrame(w,place,normal,bronze,stone,pad,hw,th){
 const outline=arch(around(w,pad),16);
 strap(outline.map(([u,m])=>place(u,m,0)),outline.map(([u,m])=>normal(u,m)),hw,th,bronze,.55,10);
 const sill=Array.from({length:13},(_,i)=>[-(w.a+pad+.08)+2*(w.a+pad+.08)*i/12,w.sill-.05]);
 strap(sill.map(([u,m])=>place(u,m,.002)),sill.map(([u,m])=>normal(u,m)),.013,.011,stone,.45,10);
}
// The body's frame (bronze) and socle (stone).
function sanctuary(){
 const bronze={p:[],n:[],ix:[]},stone={p:[],n:[],ix:[]},top=7.08;
 // The dome's twelve ribs, from the springing band to a ring round its crown,
 // narrowing as they rise; drawn by angle over the dome, so they curve evenly.
 const dome=Math.asin(clamp((OLD(top)-.38)/.91));
 for(let k=0;k<12;k++){
  const a=BAY(k)+15*DEG,ms=Array.from({length:41},(_,i)=>(.38+.91*Math.sin(dome*i/40)-FLOOR)/BODY_UP);
  strap(ms.map(m=>onBody(a,m)),ms.map(m=>bodyNormal(a,m)),t=>.017-.008*t,.006,bronze,.6);
 }
 tube(Array.from({length:49},(_,i)=>{const a=i/48*TAU,r=bodyRadius(OLD(top))+.006;return[r*Math.cos(a),OLD(top)+.003,r*Math.sin(a)];}),.012,8,bronze);
 // Bands where the gallery's floor (2.85 m, on the glass's string course)
 // and the vault's springing are; the great window breaks both, the porch's
 // roof the lower.
 const great=[BAY(0),12.5*DEG];
 for(const [m,gaps] of [[2.85,[great,[BAY(6),9*DEG]]],[3.99,[great]]])
  ring(gaps,run=>strap(run.map(a=>onBody(a,m)),run.map(a=>bodyNormal(a,m)),.013,.006,bronze,.6));
 // The windows' frames and sills.
 for(const w of WINDOWS){
  const a0=BAY(w.k),angle=(u,m)=>a0+u*S/bodyRadius(OLD(m));
  windowFrame(w,(u,m,out)=>onBody(angle(u,m),m,out),(u,m)=>bodyNormal(angle(u,m),m),bronze,stone,w.k?.06:.085,w.k?.02:.026,w.k?.006:.007);
 }
 // The core's setting: a ring under it and six prongs holding it, floating
 // with it (built at the one scale, see unsquash).
 const [cx,cy,cz]=CORE_AT,under=cy-.118;
 tube(Array.from({length:49},(_,i)=>{const a=i/48*TAU;return unsquash([cx+.135*Math.cos(a),under,cz+.135*Math.sin(a)]);}),.01,7,bronze);
 for(let k=0;k<6;k++){
  const lon=k/6*TAU;
  tube(Array.from({length:10},(_,i)=>{const lat=(-42+56*i/9)*DEG,R=.18;return unsquash([cx+R*Math.cos(lat)*Math.cos(lon),cy+R*Math.sin(lat),cz+R*Math.cos(lat)*Math.sin(lon)]);}),.0065,6,bronze);
 }
 // The socle: dressed stone round the shell's foot, from under the floor to
 // 0.64 m (the doorway is cut through it as through the glass).
 merge(stone,lathe(y=>socle((y-FLOOR)/BODY_UP,bodyRadius(y),1.03),OLD(.64),OLD(-.4),40,168));
 return{bronze,stone};
}
// The tower's fittings: bronze bands (the lower broken by its lancets), the
// lancets' frames and sills, a finial, and its socle.
function towerFittings(){
 const bronze={p:[],n:[],ix:[]},stone={p:[],n:[],ix:[]},band=at(2.85),eaves=TOWER_ROOF-.03;
 const drum=y=>a=>[TOWER[0]+towerRadius(y)*Math.cos(a),y,TOWER[2]+towerRadius(y)*Math.sin(a)];
 ring(TOWER_WINDOWS.map(w=>{const {phi,span}=turned(w.at,band);return[phi,(w.a+.14)*S/span];}),
  run=>strap(run.map(drum(band)),run.map(a=>[Math.cos(a),0,Math.sin(a)]),.012,.006,bronze,.6),112);
 ring([],run=>strap(run.map(drum(eaves)),run.map(a=>[Math.cos(a),0,Math.sin(a)]),.012,.006,bronze,.6),112);
 for(const w of TOWER_WINDOWS){
  const angle=(u,m)=>w.at+u*S/turned(w.at,at(m)).span;
  windowFrame(w,(u,m,out)=>onTower(angle(u,m),at(m),out),(u,m)=>towerNormal(angle(u,m),at(m)),bronze,stone,.055,.017,.006);
 }
 // The finial: a bronze knop on the spire's tip, and a spike.
 merge(bronze,turnedPiece(TOWER[0],TOWER[2],TOWER_TIP-.008,TOWER_TIP+.036,.019,14));
 tube([[TOWER[0],TOWER_TIP+.03,TOWER[2]],[TOWER[0],TOWER_TIP+.13,TOWER[2]]],.004,6,bronze);
 merge(stone,lathe(y=>socle((y-FLOOR)/S,towerRadius(y),TOWER_R*1.03+.03),at(.64),at(-.4),40,112,[TOWER[0],0,TOWER[2]]));
 return{bronze,stone};
}
// The portal: two stone orders round the doorway on the porch's face, outside
// its bronze roll (FRAME) as the room's frames step out (contour), the outer
// standing further forward; each on a colonnette with a bronze capital and a
// stone base.
function portal(){
 const stone={p:[],n:[],ix:[]},bronze={p:[],n:[],ix:[]},door={a:.86,sill:0,shoulder:1.26,peak:2.72};
 for(const [pad,forward] of [[.14,.009],[.255,.02]]){
  const w=around(door,pad),z=DOOR.plane+forward,pts=arch(w,22).slice(1,-1).map(([u,m])=>[u*S,at(m),z]);
  strap(pts,pts.map(()=>[0,0,1]),.0135,.011,stone,.45,12);
  for(const side of [-1,1]){
   const x=side*w.a*S,zc=z+.006;
   tube([[x,FLOOR+.03,zc],[x,at(w.shoulder-.12),zc]],.012,10,stone);
   merge(bronze,turnedPiece(x,zc,at(w.shoulder-.16),at(w.shoulder+.01),.019));
   merge(stone,turnedPiece(x,zc,FLOOR-.004,at(.2),.019));
  }
 }
 return{stone,bronze};
}
// The terrace's channel of living glass, down its middle from the door (the
// fittings' shader edges it in bronze): 0.4 m wide, ending round 5.4 m out.
function runner(){
 const p=[],n=[],ix=[],rows=60,y=FLOOR+.0012;
 for(let i=0;i<=rows;i++){
  const m=.05+5.35*i/rows,half=m<=5.2?.2:Math.sqrt(Math.max(0,.04-(m-5.2)**2));
  p.push(-half*S,y,DOOR.plane+m*S,half*S,y,DOOR.plane+m*S);n.push(0,1,0,0,1,0);
 }
 for(let i=0;i<rows;i++){const a=2*i;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
 return{p,n,ix};
}
// The lanterns: a stone foot, a bronze post, a six-sided lantern of lit glass
// (mat 3) under a bronze cap.
function lanterns(){
 const bronze={p:[],n:[],ix:[]},stone={p:[],n:[],ix:[]},glass={p:[],n:[],ix:[]};
 for(const [x,z] of LANTERNS){
  merge(stone,turnedPiece(x,z,FLOOR-.004,at(.28),.03,12));
  tube([[x,at(.2),z],[x,at(1.62),z]],.0075,8,bronze);
  merge(bronze,turnedPiece(x,z,at(1.56),at(1.64),.026,12));
  merge(glass,lathe(y=>.02+.004*(y-at(1.62))/(at(1.92)-at(1.62)),at(1.92),at(1.62),4,6,[x,0,z]));
  merge(bronze,lathe(y=>.029*clamp((at(2.04)-y)/(at(2.04)-at(1.9))),at(2.04),at(1.9),6,6,[x,0,z]));
  merge(bronze,turnedPiece(x,z,at(2.02),at(2.1),.006,8));
 }
 return{bronze,stone,glass};
}
// The great window's tracery (room-architecture.js) for the shader: the
// central mullion, the fork, the pointed eye, the slim mullions and the four
// small heads, as segments on its right half (metres from its axis: from,
// to, the rod's radius, broadened a little to read from outside).
function traceryGLSL(w){
 const r=w.a,join=w.shoulder-.06,eye=w.peak-.22,spring=.36,c=control(w),head=join-.2,rise=.26;
 const branch=[r*(1-spring*spring),w.shoulder*(1-spring)**2+2*c*spring*(1-spring)+w.peak*spring*spring];
 const segs=[[0,w.sill,0,join,.016],[0,join,.22,join+.16,.012],[.22,join+.16,...branch,.012],
  [0,eye+.1,.057,eye,.011],[.057,eye,0,eye-.1,.011],[0,eye+.1,0,w.peak,.008],[r/2,w.sill,r/2,head,.011]];
 for(const [u0,u1] of [[0,r/2],[r/2,r]]){
  const span=u1-u0,mid=(u0+u1)/2,pts=[[u0,head],[u0+span*.12,head+rise*.62],[mid,head+rise],[u1-span*.12,head+rise*.62],[u1,head]];
  for(let i=0;i<4;i++)segs.push([...pts[i],...pts[i+1],.009]);
 }
 return segs.map(([ax,ay,bx,by,rr])=>` d=min(d,seg(p,vec2(${f(ax)},${f(ay)}),vec2(${f(bx)},${f(by)}))-${f(rr*1.5)});`).join('\n');
}
const COMMON=`
float sat(float x){return clamp(x,0.,1.);}
float ease(float x){x=sat(x);return x*x*(3.-2.*x);}
float organic(vec3 p){return sin(p.x*2.8+sin(p.y*2.1))*sin(p.y*2.4+sin(p.z*2.7))*sin(p.z*2.2+sin(p.x*2.3));}
// The doorway, as arch() draws it: negative inside.
float doorHalf(float y){
 if(y<=${f(DOOR.shoulder)})return ${f(DOOR.a)};
 if(y>=${f(DOOR.peak)})return 0.;
 float qa=${f(DOOR.shoulder-2*control(DOOR)+DOOR.peak)},qb=${f(2*(control(DOOR)-DOOR.shoulder))},qc=${f(DOOR.shoulder)}-y;
 float t=(-qb+sqrt(max(0.,qb*qb-4.*qa*qc)))/(2.*qa);
 return ${f(DOOR.a)}*(1.-t*t);
}
float doorway(vec2 p){return max(max(abs(p.x)-doorHalf(p.y),${f(DOOR.sill)}-p.y),p.y-${f(DOOR.peak)});}
`;
const VERTEX=`precision highp float;
attribute vec3 position,normal;
uniform mat4 vp;
uniform float time,age,part,curtains,stillness,mat;
varying vec3 P,N,O;
${COMMON}
vec3 deform(vec3 p){
 float dome=ease((age-.65)/1.85),walls=ease((age-2.1)/1.9),tower=ease((age-3.05)/2.1),entry=ease((age-4.85)/.65),landing=ease((age-5.45)/1.15);
 float rhythm=pow(.5-.5*cos(time*.78),2.)*(1.-stillness);
 float life=.034*rhythm;
 if(part<.5){
  float roof=step(.38,p.y);
  p.xz*=max(.001,dome);
  p.y=mix(1.50,mix(.38,p.y,roof+(1.-roof)*walls),dome);
  // The socle comes out of the glass as the walls reach it.
  if(mat>1.5)p.xz*=.84+.16*walls;
  float anchor=exp(-pow(position.x/.46,4.))*smoothstep(.5,.85,position.z)*(1.-smoothstep(.40,.70,abs(position.y+.2)));
  // The glass and its frame breathe, held still at the socle and the crown.
  float bodyLife=life*(1.-anchor)*smoothstep(${f(OLD(.6))},${f(OLD(1.8))},position.y)*(1.-smoothstep(1.12,1.3,position.y));
  float ripple=sin(position.y*5.-time*1.15+position.x*1.6)*.5+sin(position.z*3.+time*.64)*.5;
  p.xz*=1.+bodyLife*(.6+ripple);
  p.y+=bodyLife*.55*sin(position.x*2.4+time*.7)*smoothstep(-.78,.2,position.y);
  p.y=${f(FLOOR)}+(p.y-${f(FLOOR)})*${f(K)};
 }else if(part<1.5){
  vec3 q=p-${v3(TOWER)};
  float h=sat((q.y-${f(TOWER_BASE)})/${f(TOWER_TIP-TOWER_BASE)}),grow=ease(tower*1.3-h*.3);
  float twist=(1.-tower)*5.*h*h+life*7.*h+1.5*h;
  float c=cos(twist),s=sin(twist);
  q.xz=mat2(c,-s,s,c)*q.xz*vec2(1.08,.94)*max(.001,grow);
  q.xz+=vec2(sin(h*7.5+time*.25*rhythm),cos(h*7.5+time*.25*rhythm))*.085*h*h*tower;
  q.y=mix(-.35,q.y,tower);
  p=q+${v3(TOWER)};
 }else if(part<3.5||part>8.5){
  // The doorway, its passage and porch open out from the door's axis.
  p.x*=max(.001,entry);p.y=mix(${f(DOOR.sill)},p.y,entry);
 }else if(part<4.5){
  p.x*=max(.001,landing);p.z=mix(${f(PLATFORM.z)},p.z,landing);
  float tip=sat((position.z-${f(PLATFORM.z)})/${f(PLATFORM.length)});
  p.y+=(1.-landing)*sin(tip*3.14159)*.45;
 }else if(part<5.5){
  float pulse=1.+.065*sin(time*1.5)*(1.-stillness);
  p=(p-${v3(CORE)})*pulse+${v3(CORE_AT)};
 }else if(part<7.5){
  float side=part<6.5?-1.:1.;
  float u=abs(p.x)/${f(DOOR.a)},v=sat((p.y-${f(DOOR.sill)})/${f(DOOR.peak-DOOR.sill)});
  // Gather each fitted panel toward its own jamb, with a slack scalloped edge.
  float opening=ease(curtains);
  p.x=side*mix(abs(p.x),${f(DOOR.a*.88)}+abs(p.x)*.21,opening);
  p.y+=opening*.075*(1.-u)*(1.-v);
  p.z+=.018*sin(u*17.+v*1.1)+.012*sin(time*1.5+u*8.+v*3.)*(1.-stillness)*(1.-v);
  p.x+=side*.007*sin(time*1.2+v*5.)*(1.-stillness)*(1.-u)*(1.-v);
 }else{
  float u=sat((position.y-1.22)/.38);
  p.x-=.06*u;
  p.y=mix(1.56,p.y,dome);
  p.xz*=.55+.45*(1.-ease((age-5.2)/1.4));
  p.y=${f(FLOOR)}+(p.y-${f(FLOOR)})*${f(K)};
 }
 return p;
}
void main(){
 O=position;P=deform(position);
 vec3 n=normalize(normal),t=normalize(cross(n,abs(n.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.))),b=cross(n,t);
 N=normalize(cross(deform(position+t*.003)-P,deform(position+b*.003)-P));
 gl_Position=vp*vec4(P,1.);
}
`;
// The fragment shaders' common head and opening. The glass, and the
// fittings (bronze, stone, a lantern's lit glass), are drawn by two programs:
// each compiles quicker than one would, and the two side by side.
const FS_HEAD=`#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 P,N,O;
uniform vec3 eye;
uniform float time,age,part,curtains,reveal,stillness,mat;
${COMMON}
vec3 tonemap(vec3 c){return pow(1.-exp(-max(c,0.)*1.1),vec3(.4545));}
// The night, as the glass and the bronze reflect it: violet overhead, a teal
// glow low round the horizon (the gate's void).
vec3 night(vec3 R){
 vec3 c=mix(vec3(.008,.007,.018),vec3(.028,.018,.055),smoothstep(-.2,.9,R.y));
 return c+vec3(.010,.040,.040)*exp(-R.y*R.y*12.);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`;
const FS_OPEN=` float entrance=ease((age-4.85)/.65);
 // (All but the curtains and the core's translucent feed.)
 bool solid=part<5.5||part>8.5;
 // The doorway is cut through the body's front shell (its own coordinates
 // brought to the one scale), where the porch's passage runs through it.
 if(part<.5&&O.z>.20&&doorway(vec2(O.x/max(.001,entrance),${f(FLOOR)}+(O.y-${f(FLOOR)})*${f(K)}))<0.)discard;
 // Through the door, the visitor is inside: the room takes over the view.
 if(eye.z<${f(DOOR.plane)}&&solid)discard;
 // Once the curtains part, all that is seen through the doorway gives way to
 // the room (loading-gate.js cuts the same arch out of the gate's backdrop).
 if(reveal>.001&&solid){
  vec3 ray=P-eye;float t=(${f(DOOR.plane)}-eye.z)/ray.z;
  if(t>0.&&t<1.&&doorway((eye+ray*t).xy)<0.)discard;
 }
 if(part<1.5&&age<.651)discard;
 if(part>.5&&part<1.5&&age<3.06)discard;
 if(part>1.5&&part<3.5&&age<4.86)discard;
 if(part>8.5&&age<4.86)discard;
 if(part>3.5&&part<4.5&&age<5.46)discard;
 if(part>5.5&&part<7.5&&age<5.35)discard;
 if(part>7.5&&part<8.5&&age<.66)discard;
 vec3 V=normalize(eye-P),nn=normalize(N);
 if(dot(nn,V)<0.)nn=-nn;
 vec3 n=nn;
 float ndv=max(.0,dot(n,V)),fres=pow(1.-ndv,4.);
`;
const FRAGMENT=`${FS_HEAD}
vec3 current(vec3 q,float layer){
 float spin=time*(.095-layer*.016)+q.y*.8+length(q)*.48;
 float c=cos(spin),s=sin(spin);q.xz=mat2(c,-s,s,c)*q.xz;
 float warp=organic(q*.83+vec3(0.,time*.035,layer*1.7));
 vec2 whorl=q.xy-vec2(-.18,.35);float radius=length(whorl);
 float angle=atan(whorl.y,whorl.x)+q.z*.55;
 float f=sin(angle*2.+radius*11.+warp*1.5-time*.23+layer*1.1);
 float ribbon=pow(1.-abs(f),12.);
 float broad=pow(1.-abs(f),3.);
 float cloud=.5+.5*organic(q*1.12+vec3(3.2,layer,time*.027));
 vec3 tint=mix(vec3(.025,.34,.28),vec3(.15,.07,.28),smoothstep(.3,.9,cloud)*.65);
 return tint*(ribbon*.95+broad*.08)*(.25+.75*cloud)+vec3(.009,.039,.034)*cloud*cloud;
}
// A pointed opening's half-width at height y (arch(), metres; w: its
// half-width, sill, shoulder and peak), and the opening (negative inside).
float archHalf(float y,vec4 w){
 if(y<=w.z)return w.x;
 if(y>=w.w)return 0.;
 float c=w.z+.6*(w.w-w.z),qa=w.z-2.*c+w.w,qb=2.*(c-w.z);
 float t=(-qb+sqrt(max(0.,qb*qb-4.*qa*(w.z-y))))/(2.*qa);
 return w.x*(1.-t*t);
}
float opening(vec2 p,vec4 w){return max(max(abs(p.x)-archHalf(p.y,w),w.y-p.y),p.y-w.w);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*sat(dot(pa,ba)/dot(ba,ba)));}
// The great window's tracery, seen from outside: the distance from its rods.
float tracery(vec2 p){
 p.x=abs(p.x);float d=9.;
${traceryGLSL(GREAT)}
 return d;
}
// A window's glass from outside, lit from the room (seen at p; slope: how
// the eye's line runs on into the room, a metre deeper). The clerestory's is
// coloured, warm low and violet in its head, brightest where the room's light
// is, leaded in small diamonds. Through the great window's clear glass and
// tracery the room itself: dim, its lantern high in the middle and the
// candles' light low, each as deep in as it is. aa: a pixel, in metres.
vec3 pane(vec2 p,vec2 slope,vec4 w,float great,float aa){
 float k=sat((p.y-w.y)/(w.w-w.y)),d,flicker=1.+(.05*sin(time*3.1+sin(time*1.7)*2.)+.03*sin(time*7.3))*(1.-stillness);
 vec3 c;
 if(great>.5){
  vec2 lantern=(p+slope*4.-vec2(0.,4.6))/vec2(.45,.55),candles=(p+slope*3.-vec2(0.,1.3))/vec2(1.1,.6);
  c=mix(vec3(.085,.045,.022),vec3(.04,.028,.075),smoothstep(.2,.9,k));
  c+=vec3(.75,.42,.12)*exp(-dot(lantern,lantern))*flicker+vec3(.42,.2,.05)*exp(-dot(candles,candles))*flicker;
  c+=vec3(.05,.12,.09)*smoothstep(.55,1.,k)*.6;
  d=tracery(p);
 }else{
  c=mix(vec3(.50,.25,.065),vec3(.13,.06,.20),smoothstep(.25,1.,k));
  vec2 hot=(p+slope*2.4-vec2(0.,w.y+(w.w-w.y)*.28))/vec2(w.x*2.2,(w.w-w.y)*.7);
  c*=(.5+.75*exp(-dot(hot,hot)))*flicker;
  vec2 s=vec2(p.x/.11+p.y/.19,-p.x/.11+p.y/.19),g=(.5-abs(fract(s)-.5))/10.5;
  d=min(g.x,g.y)-.006;
  float h=hash(floor(s));
  c*=vec3(1.,.88+.24*h,.95-.25*h)*(.85+.3*hash(floor(s)+7.));
 }
 return mix(vec3(.010,.008,.006),c,smoothstep(-aa,aa,d));
}
// A window sunk into the wall. face: the point on the wall's face (metres
// across and up); ray: the eye's line; wall: the wall's outward direction;
// the pane deep behind the face, its stone reveal seen where the line meets
// the niche's sides first. Returns its colour and how much it covers; edge:
// how far outside the opening the point is.
vec4 niche(vec2 face,vec3 ray,vec3 wall,vec4 w,float deep,float great,float aa,out float edge){
 edge=opening(face,w);
 float cover=1.-smoothstep(-aa,aa,edge);
 if(cover<=0.)return vec4(0.);
 vec3 side=vec3(-wall.z,0.,wall.x);
 vec2 slope=vec2(dot(ray,side),ray.y)/max(.16,-dot(ray,wall)),p=face+slope*deep;
 float back=opening(p,w),at=sat(-edge/max(.0001,back-edge));
 vec3 reveal=vec3(.011,.010,.009)+vec3(.30,.14,.035)*at*at*at*.45;
 vec3 glass=pane(p,slope,w,great,aa*1.3);
 return vec4(mix(reveal,glass,1.-smoothstep(-aa*1.5,aa*1.5,back)),cover);
}
void main(){
${FS_OPEN}
 if(part>5.5&&part<7.5){
  float u=abs(O.x)/${f(DOOR.a)},v=sat((O.y-${f(DOOR.sill)})/${f(DOOR.peak-DOOR.sill)});
  float pleat=.5+.5*sin(u*17.+v*1.1),rim=pow(1.-ndv,2.);
  float thread=.5+.5*sin(u*380.);
  vec3 silk=mix(vec3(.016,.024,.035),vec3(.052,.073,.082),pleat*.65);
  silk+=vec3(.16,.12,.065)*pow(pleat,10.)*.18+vec3(.14,.25,.24)*rim*.3;
  silk*=.96+.04*thread;
  float hem=1.-smoothstep(.0,.014,min(v,1.-v));
  silk+=vec3(.26,.24,.15)*hem*.24;
  float a=.88+pleat*.09;
  gl_FragColor=vec4(tonemap(silk)*a,a);return;
 }
 if(part>4.5&&part<5.5){
  vec3 q=(O-${v3(CORE)})*5.8;
  float field=organic(q+vec3(time*.22,-time*.16,0.));
  float veins=pow(1.-abs(sin(q.y*3.+field*2.8+time*.4)),4.);
  float soft=1.-.35*ease((age-5.)/1.6);
  vec3 gold=mix(vec3(.7,.16,.008),vec3(1.8,.95,.16),.45+.45*field);
  gold+=vec3(1.,.63,.13)*veins*.6;
  gold*=soft*(.65+.35*ndv);
  gl_FragColor=vec4(tonemap(gold),1.);return;
 }
 if(part>7.5&&part<8.5){
  float a=.28+.4*(1.-ease((age-5.)/1.6));
  vec3 c=mix(vec3(.04,.3,.23),vec3(.5,.3,.045),ease((O.y-1.22)/.32));
  gl_FragColor=vec4(tonemap(c)*a,a);return;
 }
 vec3 q=O;
 if(part>.5&&part<1.5)q=(O-${v3(TOWER)})*vec3(1.6,1.0,1.6);
 // The passage through the porch: dark stone, as the room's own door passage.
 if(part>2.5&&part<3.5){
  float grain=.5+.5*organic(O*14.);
  vec3 stone=vec3(.016,.017,.020)*(.75+.5*grain)+vec3(.05,.045,.034)*pow(1.-ndv,3.)*.5;
  gl_FragColor=vec4(tonemap(stone),1.);return;
 }
 if(part>3.5&&part<4.5)q=O*vec3(1.,2.,1.);
 // The living surface: the glass is never quite still, so what is seen
 // through it and its highlights waver.
 vec3 wave=vec3(sin(O.y*34.+time*.5+sin(O.x*11.+O.z*7.)*1.4),sin(O.x*23.-O.z*19.+time*.3),sin(O.z*29.-time*.45+sin(O.y*13.)*1.2));
 vec3 n2=normalize(n+(wave-n*dot(wave,n))*.05);
 vec3 rd=refract(-V,n2,.76);
 // Refracted material layers, no per-pixel volume march: spread further
 // apart in depth, so the currents part as the eye moves (depth), the near
 // ones brighter.
 vec3 inner=current(q+rd*.05,0.)*.78+current(q+rd*.38,1.)*.34+current(q+rd*.86,2.)*.19;
 inner+=current(q+rd*1.32,3.)*.10+current(q+rd*1.85,4.)*.05;
 float pocket=.5+.5*organic(q*2.1+vec3(time*.02,3.2,0.));
 inner*=.30+1.15*pocket*pocket;
 inner+=vec3(.013,.07,.05)*exp(-dot(q-vec3(0.,.35,0.),q-vec3(0.,.35,0.))*1.7);
 // The glass is thick: where it is seen straight on, light gathers in its
 // depth; toward its edges it darkens before the rim catches the sky.
 inner+=vec3(.006,.030,.025)*pow(ndv,1.6);
 inner*=.72+.28*smoothstep(.05,.55,ndv);
 vec3 L=normalize(vec3(-.65,1.,1.)),H=normalize(L+V);
 float highlight=pow(max(dot(n2,H),0.),260.)*.8+pow(max(dot(n2,H),0.),48.)*.055;
 vec3 color=inner*(1.-fres*.75)+vec3(.0015,.004,.004);
 color+=vec3(.65,.76,.70)*highlight;
 color+=mix(vec3(.018,.17,.12),vec3(.13,.055,.22),smoothstep(-.6,.6,n.x))*fres*.95;
 color+=vec3(.15,.085,.014)*max(0.,dot(n,normalize(${v3(CORE_AT)}-P)))*.085;
 color+=night(reflect(-V,n2))*fres*2.;
 // The channel in the terrace glows, its light running in to the door.
 if(part>3.5&&part<4.5)color+=vec3(.015,.10,.085)*(.55+.45*sin(time*1.3+O.z*14.));
 // Blown by hand: each cell of the dome between its ribs a little
 // different; the glass darkening into its ribs, its bands and its socle,
 // and the light in it gathering at its foot.
 if(part<.5){
  float cell=(atan(O.z,O.x)+${f(75*DEG)})/${f(30*DEG)},m=(O.y-${f(FLOOR)})/${f(BODY_UP)};
  float rib=abs(cell-floor(cell+.5))*${f(30*DEG)}*length(O.xz)/${f(S)},band=min(abs(m-2.85),abs(m-3.99));
  if(m>3.99){float h=hash(vec2(floor(cell),9.));color*=(.88+.24*h)*(.72+.28*smoothstep(.0,.32,rib));color+=vec3(.012,0.,.02)*step(.72,h);}
  color*=(.78+.22*smoothstep(.0,.28,band))*(.7+.3*smoothstep(.64,.95,m));
  color+=vec3(.008,.05,.042)*exp(-max(0.,m-.64)*2.2)*step(.64,m);
 }
 // The windows, sunk into the glass: the clerestory in the bays round the
 // body and the room's great window behind (none at the tower's bay or the
 // door's), and the tower's lancets up its stair. Light spills round them.
 // (The window nearest the point is found first, and drawn once: one niche
 // in the shader keeps it quick to compile.)
 vec4 win=vec4(0.),w=vec4(0.,0.,0.,-1.);float edge=9.,deep=.22,great=0.,aa=1.;
 vec2 face=vec2(0.);vec3 wall=vec3(0.,0.,1.);
 if(part<.5){
  float phi=atan(O.z,O.x),k=mod(floor((phi+${f(Math.PI/2+Math.PI/12)})/${f(Math.PI/6)}),12.);
  float d=phi-(${f(-Math.PI/2)}+k*${f(Math.PI/6)});d-=${f(TAU)}*floor((d+${f(Math.PI)})/${f(TAU)});
  face=vec2(d*length(O.xz)/${f(S)},(O.y-${f(FLOOR)})/${f(BODY_UP)});
  aa=length(fwidth(face));
  wall=normalize(vec3(P.x,0.,P.z));
  if(k<.5){w=${w4(GREAT)};deep=.30;great=1.;}
  else if(abs(k-2.)>.5&&abs(k-6.)>.5)w=${w4(CLERESTORY)};
 }else if(part<1.5){
  vec3 o=O-${v3(TOWER)};
  float h=sat((O.y-${f(TOWER_BASE)})/${f(TOWER_TIP-TOWER_BASE)}),psi=atan(o.z,o.x)-${f(TWIST)}*h;
  vec2 e=vec2(${f(STRETCH[0])}*cos(psi),${f(STRETCH[1])}*sin(psi));
  float dir=atan(e.y,e.x),r=length(o.xz)*length(e),m=(O.y-${f(FLOOR)})/${f(S)};
  aa=length(fwidth(vec2(dir*r/${f(S)},m)));
  wall=vec3(cos(dir),0.,sin(dir));deep=.24;
${TOWER_WINDOWS.map(t=>`  {float d=dir-${f(t.at)};d-=${f(TAU)}*floor((d+${f(Math.PI)})/${f(TAU)});
   if(abs(d*r)<${f(.6*S)}){face=vec2(d*r/${f(S)},m);w=${w4(t)};}}`).join('\n')}
 }
 if(w.w>0.)win=niche(face,-V,wall,w,deep,great,aa,edge);
 color=mix(color,win.rgb,win.a);
 color+=vec3(.34,.16,.04)*exp(-max(edge,0.)*7.)*.06*(1.-win.a);
 // Golden capillary at the active growth front, gone when settled.
 float front=age<2.5?1.50-(age-.65)/1.85*1.12:.38-(age-2.1)/1.9*1.66;
 front=${f(FLOOR)}+(front-${f(FLOOR)})*${f(K)};
 float feeding=(1.-ease((age-5.2)/1.1))*ease((age-.65)/.4);
 color+=vec3(.25,.19,.04)*exp(-pow((P.y-front)/${f(.055*K)},2.))*feeding*.25;
 gl_FragColor=vec4(tonemap(color),1.);
}
`;
// The fittings: bronze, stone, and a lantern's lit glass (mat 1-3).
const FITTINGS=`${FS_HEAD}
// The room's bronze (room-scene.js architecturalMetal: #827354, half metal),
// worn and greening in places: the key's highlight and the night in it, and
// the glass's light on the side that faces the glass (inward).
vec3 bronze(vec3 n,vec3 V,vec3 inward){
 vec3 L=normalize(vec3(-.65,1.,1.)),R=reflect(-V,n);
 // (Green runs down it in streaks.)
 float verd=smoothstep(.6,.95,.5+.5*organic(O*vec3(40.,7.,40.)))*.35;
 vec3 base=mix(vec3(.36,.25,.11),vec3(.12,.23,.18),verd);
 float rl=max(dot(R,L),0.);
 vec3 c=base*(.03+.26*max(dot(n,L),0.))+base*pow(rl,22.)*1.3+vec3(1.,.86,.62)*pow(rl,160.)*.4;
 c+=night(R)*base*2.5;
 c+=base*vec3(.10,.55,.45)*.35*max(0.,dot(n,inward));
 vec3 g=${v3(CORE_AT)}-P;
 c+=base*vec3(2.4,1.3,.3)*max(0.,dot(n,normalize(g)))*exp(-length(g)*5.);
 return c;
}
// How far inside the terrace's outline a point of its plan (x, z) is
// (terraceHalf).
float terrace(vec2 o){
 float v=max(0.,(o.y-${f(PLATFORM.z)})/${f(PLATFORM.length)});
 if(v<=.62)return .38+.13*sin(min(v/.6,1.)*1.5708)-abs(o.x);
 return (1.-length(vec2(o.x/.51,(v-.62)/.38)))*.51;
}
void main(){
${FS_OPEN}
 // Down the middle of the terrace's top, a channel of the living glass
 // (drawn with the glass: runner()), edged in bronze, from the door.
 float look=mat;
 vec2 t=vec2(O.x,O.z-${f(DOOR.plane)})/${f(S)};
 bool top=part>3.5&&part<4.5&&abs(O.y-${f(FLOOR)})<.004;
 if(top&&mat>1.5){
  float run=t.y<.05?9.:length(vec2(t.x,max(0.,t.y-5.2)));
  if(run>.19&&run<.245)look=1.;
 }
 if(mat>2.5){
  // A lantern's glass, lit within: six panes in bronze, brightest round the
  // flame.
  vec2 o=O.xz-vec2(sign(O.x)*${f(LANTERNS[1][0])},${f(LANTERNS[1][1])});
  float side=fract(atan(o.y,o.x)/${f(Math.PI/3)}),h=(O.y-${f(at(1.62))})/${f(at(1.92)-at(1.62))};
  float rim=min(min(side,1.-side)*${f(Math.PI/3*.021)},min(h,1.-h)*${f(at(1.92)-at(1.62))});
  float flame=exp(-pow((h-.38)/.28,2.))*(.9+.1*sin(time*5.3+O.x*40.)*(1.-stillness));
  vec3 c=mix(vec3(.5,.22,.05),vec3(1.5,.86,.32),flame);
  c=mix(vec3(.025,.018,.01),c,smoothstep(.0012,.0024,rim));
  gl_FragColor=vec4(tonemap(c),1.);return;
 }
 if(look>.5&&look<1.5){
  vec3 axis=part>.5&&part<1.5?${v3(TOWER)}:vec3(0.);
  vec3 inward=part>3.5&&part<4.5?vec3(0.,1.,0.):part>1.5?vec3(0.,0.,-1.):normalize(vec3(axis.x-P.x,.0001,axis.z-P.z));
  gl_FragColor=vec4(tonemap(bronze(n,V,inward)),1.);return;
 }
 if(look>1.5){
  // Dressed stone, as the room's (room-scene.js: warm grey, fine grain), at
  // night: the key from above left, a little of the glass's teal. Each stone
  // its own tone. Its joints, metres: one course of blocks round the socles,
  // the porch's voussoirs over its jambs' courses, the terrace's flags
  // inside a kerb; none on the mouldings. Under the terrace, rough rock.
  float grain=.5+.3*organic(O*43.)+.2*organic(O*13.+3.1),j=9.,tone=.5;
  bool rock=part>3.5&&part<4.5&&O.y<${f(FLOOR-.035)};
  if(part<1.5){
   vec3 o=part<.5?O:O-${v3(TOWER)};
   float m=(O.y-${f(FLOOR)})/(part<.5?${f(BODY_UP)}:${f(S)}),along=atan(o.z,o.x)*(part<.5?${f(1.04/S/1.25)}:${f(TOWER_R*1.06/S/1.25)});
   if(m>-.26&&m<.44){j=(.5-abs(fract(along)-.5))*1.25;tone=hash(vec2(floor(along),part));}
  }else if(part>8.5){
   vec2 p=vec2(O.x,O.y-${f(FLOOR)})/${f(S)},c=p-vec2(0.,1.15);
   float a=atan(c.y,c.x)/${f(Math.PI/17)};
   if(p.y>1.4){j=(.5-abs(fract(a)-.5))*${f(Math.PI/17)}*length(c);tone=hash(vec2(floor(a),3.));}
   else{j=(.5-abs(fract(p.y/.3)-.5))*.3;tone=hash(vec2(floor(p.y/.3),sign(p.x)));}
  }else if(top){
   float inside=terrace(O.xz)/${f(S)},v=(O.z-${f(PLATFORM.z)})/${f(PLATFORM.length)};
   if(inside<.2){
    // The kerb, in lengths of 0.6 m along the edge.
    float along=v<=.62?t.y:${f((.62*PLATFORM.length+PLATFORM.z-DOOR.plane)/S)}+(1.5708-atan(abs(O.x)/.51,(v-.62)/.38))*${f(.58/S)};
    j=min((.5-abs(fract(along/.6)-.5))*.6,abs(inside-.2));tone=hash(vec2(floor(along/.6),5.));
   }else{
    float row=floor(t.y/.78),col=floor(t.x/1.05+row*.37);
    j=min(min((.5-abs(fract(t.y/.78)-.5))*.78,(.5-abs(fract(t.x/1.05+row*.37)-.5))*1.05),abs(inside-.2));tone=hash(vec2(row,col));
   }
  }
  float joint=1.-smoothstep(.004,.006+fwidth(j)*1.2,j);
  vec3 L=normalize(vec3(-.65,1.,1.)),base=vec3(.142,.124,.102)*(.7+.42*grain)*(.86+.28*tone)*(1.-.5*joint);
  vec3 c=base*(.5*max(dot(n,L),0.)+.12*(.5+.5*n.y)+.03)+base*vec3(.08,.36,.30)*.12;
  c+=vec3(.05,.045,.06)*pow(1.-ndv,3.)*.2;
  if(top){
   // The room's warm light before the door, more as the curtains part, and
   // the lanterns' round their feet.
   vec2 l=vec2(abs(t.x)-${f(LANTERNS[1][0]/S)},t.y-${f((LANTERNS[1][1]-DOOR.plane)/S)});
   c+=base*(vec3(.9,.45,.12)*exp(-dot(t,t)/1.6)*(.25+.75*curtains)*.55+vec3(1.,.55,.18)*exp(-dot(l,l)/1.1)*.7);
  }
  if(rock){
   float strata=.5+.5*sin(O.y*140.+organic(O*7.)*3.);
   c=base*(.04+.15*max(dot(n,L),0.))*(.7+.3*strata)+vec3(.006,.05,.042)*pow(1.-abs(organic(O*8.+vec3(0.,time*.04,0.))),60.)*.35;
  }
  gl_FragColor=vec4(tonemap(c),1.);return;
 }
}
`;


// The gate's void (loading-gate.css: its three gradients, its two layers of
// stars), drawn here from the flight on where nothing else is, so the
// doorway can open through it to the room: the page then needs no cut of its
// own, which it would repaint whole with every step.
const SKY_VS=`precision highp float;attribute vec2 pos;void main(){gl_Position=vec4(pos,1.,1.);}`;
const SKY_FS=`precision highp float;
uniform vec2 screen;uniform float scale,time,alpha;
float ring(vec2 p,vec2 at,vec2 r){return length((p-at)/r);}
float star(vec2 p,vec2 tile,vec2 at,float r){vec2 q=mod(p,tile)-tile*at;return max(0.,1.-length(q)/r);}
void main(){
 vec2 p=vec2(gl_FragCoord.x/scale,screen.y-gl_FragCoord.y/scale);
 float d=ring(p,screen*vec2(.5,.52),screen*vec2(.7,.62));
 vec3 c=d<.52?mix(vec3(.0706,.0471,.1333),vec3(.0314,.0235,.0588),d/.52):mix(vec3(.0314,.0235,.0588),vec3(.0118,.0078,.0235),min(1.,(d-.52)/.48));
 c=mix(c,vec3(.2,.098,.3216),.0784*max(0.,1.-ring(p,screen*vec2(.72,.66),screen*vec2(.44,.36))/.7));
 c=mix(c,vec3(.102,.2275,.2275),.1098*max(0.,1.-ring(p,screen*vec2(.3,.34),screen*vec2(.38,.3))/.7));
 vec2 a=vec2(420.,380.),b=vec2(260.,290.);
 float near=.55+.45*(.5-.5*cos(time*6.2832/11.)),far=.55+.45*(.5-.5*cos((time+6.)*6.2832/15.));
 vec3 s=vec3(.847,.91,1.)*.8*star(p,a,vec2(.12,.18),1.)+vec3(.784,.941,1.)*.667*star(p,a,vec2(.67,.09),1.)
  +vec3(.902,.847,1.)*.733*star(p,a,vec2(.38,.72),1.4)+vec3(1.)*.6*star(p,a,vec2(.84,.46),1.)
  +vec3(.749,.961,.902)*.667*star(p,a,vec2(.23,.58),1.)+vec3(1.)*.667*star(p,a,vec2(.54,.33),1.2);
 vec3 t=vec3(1.)*.4*star(p,b,vec2(.08,.64),1.)+vec3(.839,.784,1.)*.4*star(p,b,vec2(.46,.12),1.)
  +vec3(.784,1.,.941)*.4*star(p,b,vec2(.77,.81),1.)+vec3(1.)*.333*star(p,b,vec2(.91,.23),1.);
 c=mix(c,min(vec3(1.),c+s),near);c=mix(c,min(vec3(1.),c+t),far);
 gl_FragColor=vec4(c*alpha,alpha);
}`;
// The doorway's opening, cleared through to the room behind once the curtains part.
const HOLE_VS=`precision highp float;attribute vec3 position;uniform mat4 vp;void main(){gl_Position=vp*vec4(position,1.);}`;
const HOLE_FS=`precision highp float;void main(){gl_FragColor=vec4(0.);}`;
function hole(){
 const pts=arch(DOOR),p=[0,(DOOR.sill+DOOR.peak)/2,DOOR.plane],ix=[];
 for(const [x,y] of pts)p.push(x,y,DOOR.plane);
 for(let i=0;i<pts.length;i++)ix.push(0,1+i,1+(i+1)%pts.length);
 return{p,n:p.map(()=>0),ix};
}
const HALO_VS=`precision highp float;attribute vec2 pos;varying vec2 uv;uniform vec2 center,size;void main(){uv=pos;gl_Position=vec4(center+pos*size,0.,1.);}`;
const HALO_FS=`precision highp float;varying vec2 uv;uniform float strength;void main(){float r=dot(uv,uv);float a=exp(-r*5.)*smoothstep(1.,.7,sqrt(r))*strength;gl_FragColor=vec4(vec3(.9,.46,.045)*a,0.);}`;
function shader(kind,src){const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);return s;}
// Programs are all compiled and linked first, and only then asked whether
// they succeeded (linked), so they can be compiled side by side.
function program(v,f){
 const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
 return{p,vs,fs};
}
function linked({p,vs,fs}){
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error([vs,fs].map(s=>gl.getShaderInfoLog(s)).join(' ')+gl.getProgramInfoLog(p));
 gl.deleteShader(vs);gl.deleteShader(fs);
 const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
 return{p,u,a:gl.getAttribLocation(p,'position'),n:gl.getAttribLocation(p,'normal'),pos:gl.getAttribLocation(p,'pos')};
}
function upload(data){
 const buffer=(target,value)=>{const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,value,gl.STATIC_DRAW);return b;};
 metrics.triangles+=data.ix.length/3;
 return{p:buffer(gl.ARRAY_BUFFER,new Float32Array(data.p)),n:buffer(gl.ARRAY_BUFFER,new Float32Array(data.n)),ix:buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(data.ix)),count:data.ix.length};
}
function resize(){
 // Crisp silhouettes at CSS resolution; moderate supersampling on high-DPR displays.
 // On the way in the room draws behind the doorway too, and the two share
 // the GPU: the glass, soft and close by then, is drawn at 70 % (from the
 // middle of the approach, where the eye moves fastest).
 const k=Math.min(dpr,1.5,Math.sqrt(1600000/(screenW*screenH)))*(lighter?.7:1);
 width=canvas.width=Math.round(screenW*k);height=canvas.height=Math.round(screenH*k);
 send('size',{width,height,cssWidth:screenW,cssHeight:screenH,scale:k});
}
// A view (vertical fov) whose centre sits at `lens` of its height from the
// top: the room's lens shift (scene-camera.js), so the two frames agree.
function matrix(eye,target,fov,lens=.5){
 const f=norm(sub(target,eye)),r=norm(cross(f,[0,1,0])),u=cross(r,f),t=1/Math.tan(fov/2),near=.015,far=40;
 const view=[r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,
 -r.reduce((s,v,i)=>s+v*eye[i],0),-u.reduce((s,v,i)=>s+v*eye[i],0),f.reduce((s,v,i)=>s+v*eye[i],0),1];
 const proj=[t/(width/height),0,0,0,0,t,0,0,0,2*lens-1,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],m=new Float32Array(16);
 for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)m[c*4+row]+=proj[k*4+row]*view[c*4+k];
 return m;
}
function project(p,m){
 const c=[0,0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++)c[i]+=m[j*4+i]*(j===3?1:p[j]);
 return[(c[0]/c[3]*.5+.5)*screenW,(.5-c[1]/c[3]*.5)*screenH,c[3]];
}
function inside(points,x,y){
 let c=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}
 return c;
}
// The share of the way walked at share u of the walk's time: setting off
// over its first `a`, coming to rest over its last `b`, an even pace between,
// as the room's own walks go (scene-camera.js).
function walked(u,a=.2,b=.3){
 const rise=x=>x*x*x-x*x*x*x/2;u=clamp(u);
 const d=u<a?a*rise(u/a):u<=1-b?a/2+u-a:1-b-a/2+b*(.5-rise((1-u)/b));
 return d/(1-a/2-b/2);
}
// The landing before the door, at the entry's eye height, looking as the entry does.
const landing=()=>({x:0,y:entry.y,z:DOOR_Z+LANDING,yaw:0,tilt:entry.tilt,lens:.5});
function pose(){
 const rhythm=reduced?0:Math.pow(.5-.5*Math.cos(time*.78),2);
 // (Framed on the body and the tower together.)
 const far=[-.02+Math.sin(time*.21)*.10*rhythm,.40+Math.sin(time*.35)*.055*rhythm,6.7],look=[.28,.40,0];
 const fov=Math.max(.68,2*Math.atan(1.86/(screenW/screenH*6.7)));
 if(!flight)return{eye:far,target:look,fov,lens:.5,curtain:0,reveal:0,fade:0,sky:0,view:null};
 const t=time-flight.start,sky=smooth(t/.6),A=ENTRY.approach,B=A+ENTRY.arrival,C=B+ENTRY.curtains,D=C+ENTRY.walk,lens=entry.fov*Math.PI/180;
 // A view in the room's terms, here (looking on to the doorway from outside).
 const seen=v=>{const eye=world(v.x,v.y,v.z);return{eye,target:add(eye,forward(v.yaw,v.tilt),Math.max(.5,v.z-DOOR_Z+.5)*S),fov:lens,lens:v.lens};};
 const start=landing();
 if(t<A){
  setPhase('approach');const u=smooth(t/A),end=seen(start);
  if(!lighter&&t>A/2){lighter=true;resize();}
  // The room's camera already waits on the landing, unseen: its first view
  // from outside (with all it has never drawn from its entry) is drawn now,
  // while the building flies on in this thread, not as the curtains part.
  return{eye:lerp(flight.eye,end.eye,u),target:lerp(flight.target,end.target,u),fov:flight.fov+(lens-flight.fov)*u,lens:.5,curtain:0,reveal:0,fade:0,sky,view:start,waiting:true};
 }
 let view=start,opening=0,reveal=0;
 if(t<B)setPhase('arrival');
 else if(t<C){setPhase('curtains');opening=smooth((t-B)/ENTRY.curtains);reveal=1;}
 else{
  // Through the doorway and the passage to the entry: the room's own view at
  // the end, turned and framed as the entry is.
  setPhase('walk');opening=1;reveal=1;
  const s=walked((t-C)/ENTRY.walk),k=smooth(s);
  view={x:start.x+(entry.x-start.x)*s,y:start.y+(entry.y-start.y)*s,z:start.z+(entry.z-start.z)*s,
   yaw:start.yaw+(entry.yaw-start.yaw)*k,tilt:start.tilt+(entry.tilt-start.tilt)*k,lens:start.lens+(entry.lens-start.lens)*k};
  if(t>=D&&!flight.done){flight.done=true;send('flown',{time});}
 }
 return{...seen(view),curtain:opening,reveal,fade:view.z<DOOR_Z?1:0,sky,view};
}
function part(mesh,id,material=0,g=pg.glass){
 gl.uniform1f(g.u.part,id);gl.uniform1f(g.u.mat,material);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.p);gl.enableVertexAttribArray(g.a);gl.vertexAttribPointer(g.a,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.n);gl.enableVertexAttribArray(g.n);gl.vertexAttribPointer(g.n,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ix);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);metrics.drawCalls++;
}
function report(){send('stats',{...metrics,phase,time,width,height,reduced,paused,formation:FORMATION,entry:ENTRY});}
// The fittings (bronze, stone, the lanterns) are built, and their program
// compiled, once the first frame is out: the formation begins with the core
// alone. While it animates they are drawn from when their program is
// compiled (in parallel where the browser can), so neither holds a frame
// back; a frame asked for on its own (wait: a settled view, a seek, a
// snapshot) waits for them.
let fittings=null,parallel=null;
function fit(wait){
 if(!fittings){
  if(first&&!wait)return false;
  const shell=sanctuary(),drum=towerFittings(),door=portal(),lamps=lanterns();
  fittings={made:program(VERTEX,FITTINGS),meshes:{face:upload(porch(true)),frame:upload(frame()),platform:upload(platform()),
   ribs:upload(shell.bronze),socle:upload(shell.stone),drumBronze:upload(drum.bronze),drumStone:upload(drum.stone),orders:upload(door.stone),capitals:upload(door.bronze),
   lanternBronze:upload(lamps.bronze),lanternStone:upload(lamps.stone),lanternGlass:upload(lamps.glass)}};
 }
 if(!pg.fittings){
  if(!wait&&parallel&&!gl.getProgramParameter(fittings.made.p,parallel.COMPLETION_STATUS_KHR))return false;
  pg.fittings=linked(fittings.made);Object.assign(meshes,fittings.meshes);
 }
 return true;
}
function render(wait=true){
 const begun=performance.now(),age=reduced?FORMATION:time,fitted=fit(wait||reduced);
 if(!flight){
  setPhase(age<.65?'core':age<2.5?'dome':age<3.65?'walls':age<5.15?'tower':age<5.5?'entrance':age<FORMATION?'landing':'waiting');
 }
 const camera=pose(),m=matrix(camera.eye,camera.target,camera.fov,camera.lens);
 // The doorway on screen (CSS pixels), where the room is seen. Covered: it
 // fills the view (or the eye is through it).
 let points=null,covered=false;
 if(camera.view){
  points=arch().map(([x,y])=>project([x,y,DOOR.plane],m));
  covered=camera.fade>=1||!points.every(p=>p[2]>.001)||[[0,0],[screenW,0],[0,screenH],[screenW,screenH]].every(([x,y])=>inside(points,x,y));
 }
 // The room's camera follows this one from the landing on (scene-camera.js
 // wayIn; it waits there through the approach), so the room is seen through
 // the doorway from where the visitor is; until the doorway fills the view,
 // the room need only draw within it (clip).
 if(camera.view){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.max(0,Math.floor(Math.min(...xs))-2),y=Math.max(0,Math.floor(Math.min(...ys))-2);
  const clip=covered||camera.waiting?null:{x,y,width:Math.max(0,Math.min(screenW,Math.ceil(Math.max(...xs))+2)-x),height:Math.max(0,Math.min(screenH,Math.ceil(Math.max(...ys))+2)-y)};
  const view={...camera.view,clip},key=JSON.stringify(view);
  if(key!==sentView){sentView=key;send('view',{view});}
 }
 if(ext&&query&&ext.getQueryObjectEXT(query,ext.QUERY_RESULT_AVAILABLE_EXT)){
  if(!gl.getParameter(ext.GPU_DISJOINT_EXT)){metrics.gpuMs.push(ext.getQueryObjectEXT(query,ext.QUERY_RESULT_EXT)/1e6);if(metrics.gpuMs.length>120)metrics.gpuMs.shift();}
  ext.deleteQueryEXT(query);query=null;
 }
 // Past the door the room is the whole view: nothing of the building is left
 // to draw, and the gate is transparent (loading-gate.js). The canvas is then
 // left alone: a new frame each time, even an empty one, would only take the
 // room's.
 const through=camera.fade>=1;
 if(!through){gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
 metrics.drawCalls=0;
 const measured=!through&&ext&&!query&&metrics.frames%30===0;
 if(measured){query=ext.createQueryEXT();ext.beginQueryEXT(ext.TIME_ELAPSED_EXT,query);}
 if(!through){
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
  const use=g=>{
   gl.useProgram(g.p);gl.uniformMatrix4fv(g.u.vp,false,m);
   gl.uniform3fv(g.u.eye,camera.eye);gl.uniform1f(g.u.time,reduced?8:time);gl.uniform1f(g.u.age,age);
   gl.uniform1f(g.u.curtains,camera.curtain);gl.uniform1f(g.u.reveal,camera.reveal);gl.uniform1f(g.u.stillness,reduced?1:0);
  };
  const g=pg.glass,t=pg.fittings;use(g);
  // Lathe triangles wind inward: cull their front-facing (inside) surfaces.
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);
  part(meshes.body,0);part(meshes.tower,1);part(meshes.core,5);
  gl.disable(gl.CULL_FACE);
  part(meshes.porch,9);part(meshes.tunnel,3);part(meshes.runner,4);
  // The frame the glass is held in, and the stone it stands in.
  if(fitted){
   gl.disableVertexAttribArray(g.n);use(t);
   part(meshes.face,9,2,t);part(meshes.frame,2,1,t);part(meshes.platform,4,2,t);
   part(meshes.ribs,0,1,t);part(meshes.socle,0,2,t);part(meshes.drumBronze,1,1,t);part(meshes.drumStone,1,2,t);part(meshes.orders,2,2,t);part(meshes.capitals,2,1,t);
   part(meshes.lanternBronze,4,1,t);part(meshes.lanternStone,4,2,t);part(meshes.lanternGlass,4,3,t);
   gl.disableVertexAttribArray(t.n);gl.useProgram(g.p);
  }
  gl.disableVertexAttribArray(g.n);
  if(camera.sky>0){
   // The void, behind all of it; then, while the doorway is open, the
   // doorway cleared (what stands before its plane stays: its frame, and the
   // curtains drawn next).
   const s=pg.sky;gl.useProgram(s.p);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
   if(camera.sky<1){gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
   gl.bindBuffer(gl.ARRAY_BUFFER,meshes.quad);gl.enableVertexAttribArray(s.pos);gl.vertexAttribPointer(s.pos,2,gl.FLOAT,false,0,0);
   gl.uniform2f(s.u.screen,screenW,screenH);gl.uniform1f(s.u.scale,width/screenW);gl.uniform1f(s.u.time,time);gl.uniform1f(s.u.alpha,camera.sky);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);metrics.drawCalls++;gl.disable(gl.BLEND);gl.disableVertexAttribArray(s.pos);
   if(camera.reveal){
    const h=pg.hole;gl.useProgram(h.p);gl.uniformMatrix4fv(h.u.vp,false,m);gl.depthFunc(gl.LESS);
    gl.bindBuffer(gl.ARRAY_BUFFER,meshes.hole.p);gl.enableVertexAttribArray(h.a);gl.vertexAttribPointer(h.a,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,meshes.hole.ix);gl.drawElements(gl.TRIANGLES,meshes.hole.count,gl.UNSIGNED_SHORT,0);metrics.drawCalls++;
    gl.disableVertexAttribArray(h.a);
   }
   gl.depthFunc(gl.LESS);gl.depthMask(true);gl.useProgram(g.p);
  }
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  part(meshes.left,6);part(meshes.right,7);part(meshes.feed,8);
  gl.disable(gl.DEPTH_TEST);gl.blendFunc(gl.ONE,gl.ONE);
  const c=project(CORE_AT,m);
  if(c[2]>0){
   const s=pg.halo,r=70*(screenH/900);
   gl.useProgram(s.p);gl.bindBuffer(gl.ARRAY_BUFFER,meshes.quad);gl.enableVertexAttribArray(s.pos);gl.vertexAttribPointer(s.pos,2,gl.FLOAT,false,0,0);
   gl.uniform2f(s.u.center,c[0]/screenW*2-1,1-c[1]/screenH*2);
   gl.uniform2f(s.u.size,r/screenW*2,r/screenH*2);
   gl.uniform1f(s.u.strength,(.26+.025*Math.sin(time*1.5))*(1-.5*smooth((age-5)/1.6)));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  gl.depthMask(true);gl.disable(gl.BLEND);
 }
 if(measured)ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
 if(camera.reveal){
  // The doorway on screen (CSS pixels): the gate's own void gives way to this
  // one, and is transparent once the eye is through (fade).
  send('aperture',{points:covered?null:points.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]),covered,fade:camera.fade,phase});
 }
 metrics.frames++;metrics.cpuMs.push(performance.now()-begun);if(metrics.cpuMs.length>300)metrics.cpuMs.shift();
 if(first){first=false;send('drawn');}
 if(age>=FORMATION&&!formed){formed=true;send('formed',{seconds:age});}
 if(time-statsAt>1){statsAt=time;report();}
}
function schedule(){if(disposed||paused||(reduced&&!first&&!flight))return;handle=requestAnimationFrame(loop);}
function loop(now){
 if(disposed||paused)return;
 const dt=last===null?0:(now-last)/1000;last=now;time+=Math.min(dt,.08)*rate;
 const interval=flight?1000/60:1000/30;
 if(now-lastDraw>=interval-2){
  if(lastDraw>0){metrics.frameGaps.push(now-lastDraw);if(metrics.frameGaps.length>300)metrics.frameGaps.shift();}
  lastDraw=now;render(false);
 }
 schedule();
}
function stop(){disposed=true;cancelAnimationFrame(handle);if(gl){if(fittings&&!pg?.fittings){gl.deleteProgram(fittings.made.p);Object.assign(meshes,fittings.meshes);}for(const m of Object.values(meshes||{}))if(m?.p){gl.deleteBuffer(m.p);gl.deleteBuffer(m.n);gl.deleteBuffer(m.ix);}gl.deleteBuffer(meshes?.quad);for(const p of Object.values(pg||{}))gl.deleteProgram(p.p);if(query)ext?.deleteQueryEXT(query);gl.getExtension('WEBGL_lose_context')?.loseContext();}send('disposed');close();}
// The entry's view (scene-camera.js entryView), where the walk in ends.
function setEntry(view){if(view&&['x','y','z','yaw','tilt','lens'].every(k=>Number.isFinite(view[k])))entry={...entry,...view};}
onmessage=({data:d})=>{
 try{
  if(d.type==='init'){
   canvas=d.canvas;screenW=d.width;screenH=d.height;dpr=d.dpr||1;reduced=!!d.reduced;
   gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,depth:true,powerPreference:'low-power'});
   if(!gl||!gl.getExtension('OES_standard_derivatives'))throw Error('Worker WebGL with derivatives unavailable');
   ext=gl.getExtension('EXT_disjoint_timer_query');resize();
   parallel=gl.getExtension('KHR_parallel_shader_compile');
   const made={glass:program(VERTEX,FRAGMENT),halo:program(HALO_VS,HALO_FS),sky:program(SKY_VS,SKY_FS),hole:program(HOLE_VS,HOLE_FS)};
   pg=Object.fromEntries(Object.entries(made).map(([name,made])=>[name,linked(made)]));
   meshes={body:upload(lathe(bodyRadius,1.289,-1.288,144,128)),tower:upload(lathe(towerRadius,TOWER_TIP,TOWER_BASE,140,96,TOWER)),
    core:upload(lathe(y=>Math.sqrt(Math.max(0,.17**2-y*y)),.17,-.17,40,64,CORE)),
    feed:upload(lathe(y=>.006+.014*Math.sin((y-1.22)/.38*Math.PI),1.60,1.22,28,24)),
    porch:upload(porch()),tunnel:upload(passage()),runner:upload(runner()),left:upload(curtain(-1)),right:upload(curtain(1)),hole:upload(hole())};
   meshes.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,meshes.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   render(reduced);schedule();
  }else if(d.type==='resize'){screenW=d.width;screenH=d.height;dpr=d.dpr||1;resize();if(paused||reduced)render();}
  else if(d.type==='fly'){
   setEntry(d.entry);
   const p=pose();flight={start:time,eye:p.eye,target:p.target,fov:p.fov};paused=false;last=null;cancelAnimationFrame(handle);schedule();
  }else if(d.type==='entry')setEntry(d.entry);
  else if(d.type==='pause'){paused=true;cancelAnimationFrame(handle);last=null;report();}
  else if(d.type==='play'){if(paused){paused=false;last=null;lastDraw=-100;schedule();}}
  else if(d.type==='still'){reduced=!!d.value;last=null;cancelAnimationFrame(handle);render();schedule();}
  else if(d.type==='seek'){paused=true;cancelAnimationFrame(handle);time=Math.max(0,d.value);last=null;render();report();}
  else if(d.type==='seekFlight'&&flight){paused=true;cancelAnimationFrame(handle);time=flight.start+Math.max(0,d.value);last=null;lastDraw=-100;render();report();}
  else if(d.type==='rate'){rate=clamp(+d.value||1,.01,8);}
  else if(d.type==='snapshot'){render();canvas.convertToBlob({type:'image/webp',quality:.93}).then(blob=>send('snapshot',{blob}));}
  else if(d.type==='dispose')stop();
 }catch(error){send('failed',{message:error?.message||String(error)});cancelAnimationFrame(handle);}
};
