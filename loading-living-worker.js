/* Living orb architecture. Exterior-only OffscreenCanvas renderer.
   All geometry, currents and choreography run in this worker. No room imports.
   Time is visible animation time; formation finishes at 6.6 s before entry.
   CPU/GPU resources belong exclusively to this worker. */
'use strict';
const FORMATION = 6.6, ENTRY = {approach:2.6, arrival:2, curtains:1.4, walk:5};
const TAU = Math.PI*2;
// Door and walk retain the room scale (0.246 per metre) and floor y=-0.78.
// Phase 1 authors the exterior silhouette to Concept B; the outer shell and
// window hierarchy need not be a literal offset of the interior wall mesh.
const S = .246, FLOOR = -.78;
const at = metres => FLOOR + metres*S;
// The body is drawn 0.291 to a metre upward (its walls rise to the room's
// springing, 3.9 m, its dome to the vault's crown) and brought down to the one
// scale as it is placed (squash), so its formation keeps its shape and timing.
const K = S/.291, squash = y => FLOOR + (y-FLOOR)*K;
// The orb's core over the dome: as drawn, and where it stands.
const CORE = [.015,1.64,.08], CORE_AT = [CORE[0],squash(CORE[1]),CORE[2]];
// Slender attached tower, flared foot and a concave, leaning needle spire.
// Its exterior placement/proportions follow the approved concept.
const TOWER = [5.49*S, 0, -2.844*S], TOWER_R = 1.44*S, TOWER_BASE = FLOOR-.38, TOWER_ROOF = at(7.2), TOWER_TIP = at(11.95);
// The doorway: the room's own (room-chamber.js OPEN.door), 0.74 m either side
// of its axis, straight jambs to 1.26 m, then two quadratic curves to its
// peak at 2.54 m, drawn as the room draws it, so the two meet exactly. It is
// at the end of the room's passage (the wall, and a metre beyond it): 5.35 m
// from the chamber's centre (`plane`), the face of a porch grown out of the
// body, whose passage runs back into the body to `back`.
const DOOR = {a:.74*S, sill:FLOOR, shoulder:at(1.26), peak:at(2.54), plane:5.35*S, back:3.7*S};
const FRAME = {a:.86*S, sill:FLOOR, shoulder:at(1.26), peak:at(2.72)};
const control = w => w.shoulder + .6*(w.peak-w.shoulder);
// The mineral landing before the door, its top at the room floor level.
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
let gl, pg, meshes, canvas, noiseTexture, width=1,height=1,screenW=1,screenH=1,dpr=1;
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
// Authored orb profile, in the existing pre-squash body coordinates.
// The whole lower body curves inward; there is no cylindrical wall belt.
function bodyRadius(y){
 const ry=y>.03?1.26:1.48;
 return 1.17*Math.sqrt(Math.max(0,1-((y-.03)/ry)**2));
}
// Two broad, directional folds wrap from the entrance toward the tower.
// The narrow upper crest rolls over a wide hollow, like folded mineral glass.
function bodyFold(a,y){
 const wrap=Math.cos(a),positive=.5*(wrap+Math.sqrt(wrap*wrap+.025)),negative=positive-wrap,crest=.31-.97*positive-.70*negative;
 const envelope=Math.pow(Math.max(0,1-((y-.03)/(y>.03?1.26:1.48))**2),.5);
 const upper=(.045+.19*smooth((wrap+.18)/.5))*Math.exp(-Math.pow((y-crest)/.15,2))-.035*Math.exp(-Math.pow((y-crest+.19)/.19,2));
 const lower=.14*Math.exp(-Math.pow((y-(-.94+.20*wrap))/.12,2));
 return envelope*(upper+lower);
}
function towerRadius(y){
 const eave=TOWER_ROOF;
 if(y>eave){const t=clamp((y-eave)/(TOWER_TIP-eave));return (TOWER_R*.91+.14)*Math.pow(1-t,1.65)+.0005;}
 if(y<TOWER_BASE)return 0;
 if(y<FLOOR){const u=clamp((y-TOWER_BASE)/(FLOOR-TOWER_BASE));return TOWER_R*1.1*Math.sqrt(Math.max(0,1-(1-u)*(1-u)))+.13*Math.exp(-Math.pow((y+.84)/.14,2))*smooth(u/.35);}
 const u=clamp((y-FLOOR)/(eave-FLOOR));
 const neck=TOWER_R*(1.1-.19*u+.035*Math.sin(u*TAU));
 return neck+.14*Math.exp(-Math.pow((y-eave)/.055,2))+.13*Math.exp(-Math.pow((y+.84)/.14,2));
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
// A continuous nested arch: the outer rows meet the orb surface rather than
// ending on a flat applied porch. Doorway coordinates remain the room's own.
function porch(){
 const inner=arch(DOOR,48),outer=arch({a:1.86*S,sill:FLOOR-.015,shoulder:at(1.87),peak:at(3.76)},48),rows=40,cols=inner.length-1,p=[],n=[],ix=[];
 for(let j=0;j<=cols;j++)for(let i=0;i<=rows;i++){
  const t=i/rows,x=inner[j][0]+(outer[j][0]-inner[j][0])*t,y=inner[j][1]+(outer[j][1]-inner[j][1])*t;
  const oy=FLOOR+(y-FLOOR)/K,r=bodyRadius(oy);
  let back=Math.sqrt(Math.max(.01,r*r-x*x));
  for(let pass=0;pass<4;pass++){const rr=r+bodyFold(Math.atan2(back,x),oy);back=Math.sqrt(Math.max(.01,rr*rr-x*x));}
  // Match the shell tangent at the outer edge; no buried intersecting rim.
  back+=.003;
  const envelope=Math.sin(t*Math.PI)**2,shoulder=(.022+.012*Math.sin(t*Math.PI*4))*envelope;
  p.push(x,y,DOOR.plane+.014+(back-DOOR.plane-.014)*smooth(t)+shoulder);n.push(0,0,1);
 }
 for(let j=0;j<cols;j++)for(let i=0;i<rows;i++){const a=j*(rows+1)+i,b=a+rows+1;ix.push(a,a+1,b,b,a+1,b+1);}
 n.fill(0);for(let k=0;k<ix.length;k+=3){const [a,b,c]=ix.slice(k,k+3),v=cross(sub(p.slice(b*3,b*3+3),p.slice(a*3,a*3+3)),sub(p.slice(c*3,c*3+3),p.slice(a*3,a*3+3)));for(const q of[a,b,c])for(let d=0;d<3;d++)n[q*3+d]+=v[d];}
 for(let k=0;k<n.length;k+=3){const v=norm(n.slice(k,k+3));n[k]=v[0];n[k+1]=v[1];n[k+2]=v[2];}return{p,n,ix};
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
 const pts=arch(FRAME),p=[],n=[],ix=[],rings=16,r=.009;
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
// A level mineral tongue with a rounded polished lip and shallow underside.
// The tongue curves left after the doorway; x=0 remains on its level top
// throughout the unchanged published walk from LANDING to the threshold.
const terraceCentre=v=>-.92*Math.pow(clamp(v),1.3);
const terraceHalf=v=>{v=clamp(v);return Math.max(.002,(.38+.13*Math.sin(Math.min(v/.6,1)*Math.PI/2))*(v>.62?Math.sqrt(Math.max(0,1-((v-.62)/.38)**2)):1));};
function platform(){
 const p=[],ix=[],rows=64,cols=72,{z,length}=PLATFORM,from=DOOR.back+.04,mid=FLOOR-.012,shape=[];
 for(let i=0;i<=rows;i++){
  const zz=from+(z+length-from)*i/rows,v=clamp((zz-z)/length),w=terraceHalf(v);
  const deep=(.045+.105*Math.sin(Math.min(1,v)*Math.PI))*Math.min(1,w/.3)+.008;
  const cx=terraceCentre(v);shape.push([cx,mid-deep*.3,zz]);
  for(let j=0;j<=cols;j++){
   const a=j/cols*TAU,c=Math.cos(a),s=Math.sin(a);
   if(s>=0){p.push(cx+w*Math.sign(c)*Math.pow(Math.abs(c),.72),mid+.012*Math.pow(s,.16),zz);continue;}
   const rough=1+.018*Math.sin(v*9+a*3);
   p.push(cx+w*Math.sign(c)*Math.pow(Math.abs(c),.82),mid-deep*Math.pow(-s,.85)*rough,zz);
  }
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
 return{p,n:gridNormals(p,rows,cols,i=>shape[i]),ix};
}
// Concept B: a continuous orb-glass body and tower, mineral window reveals,
// a grown nested entrance and a restrained bronze landing edge. Fittings use
// the existing room scale, formation and shared breathing transform.
const BODY_UP=.291,OLD=m=>FLOOR+m*BODY_UP,DEG=Math.PI/180;
// Bay k's direction in plan (room-chamber.js): -90 + 30k degrees; the door's
// is bay 6 (+z), the great window's bay 0, the tower's bay 2.
const BAY=k=>(-90+30*k)*DEG;
const onBody=(a,m,out=0)=>{const y=OLD(m),r=bodyRadius(y)+bodyFold(a,y)+out;return[r*Math.cos(a),y,r*Math.sin(a)];};
const bodyNormal=(a,m)=>norm(cross(sub(onBody(a+.002,m),onBody(a-.002,m)),sub(onBody(a,m+.002),onBody(a,m-.002)))).map(v=>-v);
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

// Two slender front lancets frame the dome; the great rear window remains.
// These exterior placements are art-directed; the room itself is unchanged.
const CLERESTORY={a:.22,sill:2.45,shoulder:3.42,peak:4.10},GREAT={a:.82,sill:.8,shoulder:3.6,peak:4.9};
const WINDOWS=[...[4.1666667,7.3333333].map(k=>({k,...CLERESTORY})),{k:0,...GREAT}];
// Three staggered exterior lancets establish the tower's vertical hierarchy.
const TOWER_WINDOWS=[[55,5.0],[85,2.9],[40,1.25]].map(([d,sill])=>({at:d*DEG,a:.18,sill,shoulder:sill+1.12,peak:sill+1.67}));
// A frame's outline, pad metres outside an opening's (as the room's contour).
const around=(w,pad)=>({...w,a:w.a+pad,peak:w.peak+pad});

const w4=w=>'vec4('+[w.a,w.sill,w.shoulder,w.peak].map(f).join(',')+')';

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

// A window's moulding and sill, on a wall
// (place(u, m, out): the point u metres across and m up, out proud of the
// wall; normal(u, m): the wall's outward direction).
function windowFrame(w,place,normal,bronze,stone,pad,hw,th){
 const outline=arch(around(w,pad),16);
 strap(outline.map(([u,m])=>place(u,m,0)),outline.map(([u,m])=>normal(u,m)),hw,th,bronze,.55,10);
 const sill=Array.from({length:13},(_,i)=>[-(w.a+pad+.08)+2*(w.a+pad+.08)*i/12,w.sill-.05]);
 strap(sill.map(([u,m])=>place(u,m,.002)),sill.map(([u,m])=>normal(u,m)),.013,.011,stone,.45,10);
}
// Mineral window frames with narrow bronze sills.
function sanctuary(){
 const bronze={p:[],n:[],ix:[]},stone={p:[],n:[],ix:[]};
 for(const w of WINDOWS){const a0=BAY(w.k),angle=(u,m)=>a0+u*S/bodyRadius(OLD(m));windowFrame(w,(u,m,out)=>onBody(angle(u,m),m,out),(u,m)=>bodyNormal(angle(u,m),m),stone,bronze,w.k?.065:.085,w.k?.016:.022,.006);}
 return{bronze,stone};
}
// The tower's three recessed lancet frames.
function towerFittings(){
 const bronze={p:[],n:[],ix:[]},stone={p:[],n:[],ix:[]};
 for(const w of TOWER_WINDOWS){const angle=(u,m)=>w.at+u*S/turned(w.at,at(m)).span;windowFrame(w,(u,m,out)=>onTower(angle(u,m),at(m),out),(u,m)=>towerNormal(angle(u,m),at(m)),stone,bronze,.065,.016,.006);}
 return{bronze,stone};
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

// A continuous chamber/tower skin, built ONCE after the first core frame.
// Smooth union + marching tetrahedra; welded edges, analytic-field normals.
// No per-frame meshing, no volume raymarch, no additional scene light.
const SHELL_BOUNDS={lo:[-1.45,-1.52,-1.60],hi:[2.10,TOWER_TIP+.08,1.52]};
function sanctuaryShell(){
 const step=.045,{lo,hi}=SHELL_BOUNDS;
 const [nx,ny,nz]=hi.map((v,i)=>Math.ceil((v-lo[i])/step)+1),N=nx*ny*nz;
 const values=new Float32Array(N),mesh={p:[],n:[],ix:[]},edges=new Map();
 function field(x,y,z){
  const by=FLOOR+(y-FLOOR)/K,a=Math.atan2(z,x);
  const fold=bodyFold(a,by);
  const radial=Math.hypot(x,z)-fold;
  // Ellipsoidal caps keep field gradients finite at the dome and keel tips.
  const body=(Math.hypot(radial/1.17,(by-.03)/(by>.03?1.26:1.48))-1)*.95;
  const h=clamp((y-TOWER_BASE)/(TOWER_TIP-TOWER_BASE)),r=towerRadius(clamp(y,TOWER_BASE,TOWER_TIP));
  const dx=x-TOWER[0]-Math.sin(h*7.5)*.15*h*h,dz=z-TOWER[2]-Math.cos(h*7.5)*.085*h*h;
  const c=Math.cos(h*TWIST),sn=Math.sin(h*TWIST),tx=c*dx/STRETCH[0]-sn*dz/STRETCH[1],tz=sn*dx/STRETCH[0]+c*dz/STRETCH[1];
  const phi=Math.atan2(tz,tx),wave=.06*Math.cos(phi-.5)*Math.exp(-Math.pow((y-TOWER_ROOF)/.18,2));
  const swell=.012*Math.sin(phi*2+y*3)*Math.sin(h*Math.PI)+towerRadius(clamp(y-wave,TOWER_BASE,TOWER_TIP))-r;
  const tower=Math.max((Math.hypot(tx,tz)-r-swell)*.9,y-TOWER_TIP,TOWER_BASE-y);
  const blend=clamp(.5+.5*(tower-body)/.34);return tower+(body-tower)*blend-.34*blend*(1-blend);
 }
 const point=id=>[lo[0]+(id%nx)*step,lo[1]+(Math.floor(id/nx)%ny)*step,lo[2]+Math.floor(id/(nx*ny))*step];
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)values[x+nx*(y+ny*z)]=field(lo[0]+x*step,lo[1]+y*step,lo[2]+z*step);
 function edge(a,b){
  if(a>b)[a,b]=[b,a];const key=a*N+b;if(edges.has(key))return edges.get(key);
  const p=point(a),q=point(b),t=values[a]/(values[a]-values[b]),v=p.map((x,i)=>x+(q[i]-x)*t),e=.001;
  for(let pass=0;pass<2;pass++){
   const g=[(field(v[0]+e,v[1],v[2])-field(v[0]-e,v[1],v[2]))/(2*e),(field(v[0],v[1]+e,v[2])-field(v[0],v[1]-e,v[2]))/(2*e),(field(v[0],v[1],v[2]+e)-field(v[0],v[1],v[2]-e))/(2*e)];
   const d=field(...v)/Math.max(.001,g[0]*g[0]+g[1]*g[1]+g[2]*g[2]);
   // A narrow crease must not pull a vertex past its original tetrahedron.
   // Limit projection to a quarter-cell to prevent folded/inverted triangles.
   const scale=Math.min(1,step*.25/Math.max(.000001,Math.abs(d)*Math.hypot(...g)));
   for(let k=0;k<3;k++)v[k]-=d*g[k]*scale;
  }
  const n=norm([field(v[0]+e,v[1],v[2])-field(v[0]-e,v[1],v[2]),field(v[0],v[1]+e,v[2])-field(v[0],v[1]-e,v[2]),field(v[0],v[1],v[2]+e)-field(v[0],v[1],v[2]-e)]);
  const index=mesh.p.length/3;mesh.p.push(...v);mesh.n.push(...n);edges.set(key,index);return index;
 }
 function face(a,b,c){
  const at=i=>mesh.p.slice(i*3,i*3+3),normal=[0,1,2].map(d=>mesh.n[a*3+d]+mesh.n[b*3+d]+mesh.n[c*3+d]),turn=cross(sub(at(b),at(a)),sub(at(c),at(a)));
  if(turn.reduce((v,x,i)=>v+x*normal[i],0)>0)[b,c]=[c,b];mesh.ix.push(a,b,c);
 }
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const a=x+nx*(y+ny*z),v=[a,a+1,a+1+nx,a+nx,a+nx*ny,a+1+nx*ny,a+1+nx+nx*ny,a+nx+nx*ny];
  const count=v.reduce((n,i)=>n+(values[i]<0),0);if(count===0||count===8)continue;
  for(const t of tetra){
   const ins=t.map(i=>v[i]).filter(i=>values[i]<0),out=t.map(i=>v[i]).filter(i=>values[i]>=0);
   if(ins.length===1)face(...out.map(b=>edge(ins[0],b)));
   else if(ins.length===3)face(...ins.map(b=>edge(out[0],b)));
   else if(ins.length===2){const a=edge(ins[0],out[0]),b=edge(ins[0],out[1]),c=edge(ins[1],out[0]),d=edge(ins[1],out[1]);face(a,b,c);face(b,d,c);}
  }
 }
 const tipRows=28,tipCols=32,tipBottom=TOWER_TIP-.34;
 const tip=lathe(towerRadius,TOWER_TIP,tipBottom,tipRows,tipCols,TOWER);
 for(let i=0;i<tip.p.length;i+=3){
  const y=tip.p[i+1],h=clamp((y-TOWER_BASE)/(TOWER_TIP-TOWER_BASE)),twist=TWIST*h,c=Math.cos(twist),sn=Math.sin(twist),px=tip.p[i]-TOWER[0],pz=tip.p[i+2]-TOWER[2],phi=Math.atan2(pz,px),rr=Math.hypot(px,pz);
  const swell=.012*Math.sin(phi*2+y*3)*Math.sin(h*Math.PI)+.002*(1-smooth((y-tipBottom)/.13));
  const x=px*(1+swell/Math.max(.001,rr)),z=pz*(1+swell/Math.max(.001,rr));
  tip.p[i]=TOWER[0]+(c*x+sn*z)*STRETCH[0]+Math.sin(h*7.5)*.15*h*h;
  tip.p[i+2]=TOWER[2]+(-sn*x+c*z)*STRETCH[1]+Math.cos(h*7.5)*.085*h*h;
 }
 tip.n=gridNormals(tip.p,tipRows,tipCols,i=>{const y=TOWER_TIP+(tipBottom-TOWER_TIP)*i/tipRows,h=clamp((y-TOWER_BASE)/(TOWER_TIP-TOWER_BASE));return[TOWER[0]+Math.sin(h*7.5)*.15*h*h,y,TOWER[2]+Math.cos(h*7.5)*.085*h*h];});
 merge(mesh,tip);
 if(mesh.p.length/3>=65536)throw Error('Sanctuary exceeds 16-bit mesh budget');return mesh;
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
vec3 skinBreath(vec3 p,vec3 original){
 float rhythm=pow(.5-.5*cos(time*.78),2.)*(1.-stillness);
 float bias=smoothstep(.79,1.30,dot(original.xz,normalize(${v3(TOWER)}.xz)));
 float anchor=exp(-pow(original.x/.46,4.))*smoothstep(.5,.85,original.z)*(1.-smoothstep(.34,.62,abs(original.y+.3)));
 float live=.027*rhythm*(1.-anchor)*smoothstep(-.72,.05,original.y)*(1.-smoothstep(1.65,2.1,original.y));
 vec2 axis=mix(vec2(0.),${v3(TOWER)}.xz,bias);p.xz=axis+(p.xz-axis)*(1.+live*(.45+.35*sin(original.y*5.-time*1.15+original.x*1.6)));return p;
}
vec3 deform(vec3 p){
 float dome=ease((age-.65)/1.85),walls=ease((age-2.1)/1.9),tower=ease((age-3.05)/2.1),entry=ease((age-4.85)/.65),landing=ease((age-5.45)/1.15);
 float rhythm=pow(.5-.5*cos(time*.78),2.)*(1.-stillness);
 float life=.034*rhythm;
 if(part>9.5){
  float bias=smoothstep(.79,1.30,dot(p.xz,normalize(${v3(TOWER)}.xz)));
  vec3 bp=p;float by=(-0.7800)+(p.y-(-0.7800))/0.8454,roof=step(.38,by);
  bp.xz*=max(.001,dome);bp.y=(-0.7800)+(mix(1.50,mix(.38,by,roof+(1.-roof)*walls),dome)-(-0.7800))*0.8454;
  vec3 tp=p-${v3(TOWER)};float h=sat((p.y-${f(TOWER_BASE)})/${f(TOWER_TIP-TOWER_BASE)}),grow=ease(tower*1.3-h*.3),twist=(1.-tower)*4.*h*h;
  float c=cos(twist),s=sin(twist);tp.xz=mat2(c,-s,s,c)*tp.xz*max(.001,grow);tp.y=mix(-.35,p.y,tower);tp.xz+=${v3(TOWER)}.xz;p=mix(bp,tp,bias);
  return skinBreath(p,position);

 }
 if(part<.5){
  float roof=step(.38,p.y);
  p.xz*=max(.001,dome);
  p.y=mix(1.50,mix(.38,p.y,roof+(1.-roof)*walls),dome);
  // Mineral window reveals emerge as the walls reach them.
  if(mat>1.5)p.xz*=.84+.16*walls;
  p.y=(-0.7800)+(p.y-(-0.7800))*0.8454;
  return skinBreath(p,vec3(position.x,(-0.7800)+(position.y-(-0.7800))*0.8454,position.z));

 }else if(part<1.5){
  vec3 q=p-${v3(TOWER)};
  float h=sat((q.y-${f(TOWER_BASE)})/${f(TOWER_TIP-TOWER_BASE)}),grow=ease(tower*1.3-h*.3);
  float twist=(1.-tower)*5.*h*h+1.5*h;
  float c=cos(twist),s=sin(twist);
  q.xz=mat2(c,-s,s,c)*q.xz*vec2(1.08,.94)*max(.001,grow);
  q.xz+=vec2(sin(h*7.5)*.15,cos(h*7.5)*.085)*h*h*tower;
  q.y=mix(-.35,q.y,tower);
  p=q+${v3(TOWER)};return skinBreath(p,p);
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
// fittings (bronze and mineral), are drawn by two programs:
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
 vec3 c=mix(vec3(.0015,.002,.005),vec3(.008,.005,.019),smoothstep(-.2,.9,R.y));
 return c+vec3(.002,.014,.017)*exp(-R.y*R.y*12.);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`;
const FS_OPEN=` float entrance=ease((age-4.85)/.65);
 // (All but the curtains and the core's translucent feed.)
 bool solid=part<5.5||part>8.5;
 // The doorway is cut through the body's front shell (its own coordinates
 // brought to the one scale), where the porch's passage runs through it.
 if((part<.5||part>9.5)&&O.z>.20&&doorway(vec2(O.x/max(.001,entrance),part>9.5?O.y:${f(FLOOR)}+(O.y-${f(FLOOR)})*${f(K)}))<0.)discard;
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
 if(part>8.5&&part<9.5&&age<4.86)discard;
 if(part>9.5&&age<.651)discard;
 if(part>3.5&&part<4.5&&age<5.46)discard;
 if(part>5.5&&part<7.5&&age<5.35)discard;
 if(part>7.5&&part<8.5&&age<.66)discard;
 vec3 V=normalize(eye-P),nn=normalize(N);
 if(dot(nn,V)<0.)nn=-nn;
 vec3 n=nn;
 float ndv=max(.0,dot(n,V)),fres=pow(1.-ndv,4.);
`;
// Shared world-space liquid mineral. Fixed optical strata and a noise atlas
// give depth without surface ray tracing, extra render targets or transparency.
const LIQUID=`
uniform sampler2D noiseMap;
float volumeNoise(vec3 p){
 vec3 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);
 vec2 uv=(i.xy+vec2(37.,17.)*i.z+u.xy+.5)/256.;
 vec2 n=texture2D(noiseMap,uv).rg;return mix(n.x,n.y,u.z);
}
vec4 current(vec3 q){
 float radius=length(q.xy-vec2(-.12,.25));
 float spin=time*.028+1.8/(.8+radius);
 float c=cos(spin),s=sin(spin);q.xy=mat2(c,-s,s,c)*(q.xy-vec2(-.12,.25))+vec2(-.12,.25);
 vec3 drift=vec3(time*.008,-time*.012,time*.007);
 float broad=volumeNoise(q*2.2+drift);
 vec3 w=q*5.8+vec3(broad*2.4,broad*1.8,broad*-1.5);
 float detail=volumeNoise(w+3.2),fine=volumeNoise(w*2.4-1.8);
 float mist=broad*.44+detail*.36+fine*.20;
 // Low-contrast density: the shell transmits light instead of drawing stone-like patches.
 float cloud=.16+.28*mist;
 float vein=pow(1.-abs(detail*.9+fine*1.1-1.),16.)*smoothstep(.32,.78,broad);
 vec3 hue=mix(vec3(.035,.43,.35),vec3(.065,.13,.34),smoothstep(.2,.85,q.x*.22+fine*.6)*.48);
 vec3 glow=hue*(vein*.008+cloud*.007);
 return vec4(glow,cloud);
}
vec3 liquidGlass(vec3 q,vec3 n,vec3 V){
 float ndv=max(0.,dot(n,V)),fres=pow(1.-ndv,4.);
 // Shading only: the approved mesh and silhouette never move here.
 vec3 wave=vec3(sin(O.y*19.+sin(O.x*6.+O.z*4.)+time*.18),sin(O.x*17.-O.z*11.+time*.14),sin(O.z*16.+sin(O.y*7.)-time*.16));
 vec3 n2=normalize(n+(wave-n*dot(wave,n))*.003);
 vec3 rd=refract(-V,n2,.76);
 // Four fixed optical strata: bounded cost, no ray/surface search. As in the
 // real orb, the front mist absorbs and the centre emits into the layers.
 float span=mix(1.85,.62,smoothstep(1.05,1.43,dot(O.xz,normalize(${v3(TOWER)}.xz))));
 if(part>3.5&&part<4.5)span=.28;
 float dt=span/4.,T=1.;vec3 inner=vec3(0.);
 for(int i=0;i<4;i++){
  vec3 at=q+rd*(float(i)+.5)*dt;
  vec4 mist=current(at);
  vec3 heart=at-vec3(.18,.26,-.12);
  float glow=exp(-dot(heart*vec3(1.,1.15,.85),heart*vec3(1.,1.15,.85))*3.2);
  // Quiet refracted currents in the depth, not bright mottling on the skin.
  float pulse=.98+.02*sin(time*.51);
  vec3 light=mist.rgb*(.3+glow*5.)+vec3(.028,.18,.18)*glow*(.12+mist.a*.5)*pulse;
  vec2 h=heart.xy*vec2(1.,.88);float angle=atan(h.y,h.x+1e-5),radius=length(h);
  float curl=exp(-pow((radius-(.34+.085*sin(angle*2.+heart.z*3.+time*.026)))/.052,2.));
  curl*=exp(-pow((heart.z+.1)/.40,2.))*smoothstep(-.18,.38,-h.y+h.x*.35);
  light+=vec3(.030,.24,.23)*curl*.65*pulse;
  inner+=T*light*dt;
  T*=exp(-(.12+mist.a*.85)*dt);
 }
 inner*=.65+.35*smoothstep(.06,.65,ndv);
 vec3 R=reflect(-V,n2),L=normalize(vec3(-.9,3.2,-.15));
 float key=max(0.,dot(R,L));
 float highlight=pow(key,180.)*2.15+pow(key,38.)*.11;
 vec3 color=inner*(1.-fres*.88)+vec3(.0003,.001,.0015);
 color+=vec3(.78,.85,.78)*highlight;
 // Violet grazing light comes from the stair side; aqua from the opposite edge.
 vec3 rim=mix(vec3(.008,.10,.088),vec3(.086,.026,.15),smoothstep(-.35,.65,n.x));
 color+=rim*fres*.48;
 color+=night(R)*(.12+fres*1.5);
 float streak=exp(-pow((R.x+.48)/.032,2.))*smoothstep(.05,.8,R.y);
 color+=vec3(.21,.32,.29)*streak*.065;
 float windowReflection=exp(-pow((R.x+.57)/.065,2.))*smoothstep(.25,.8,R.y);
 color+=vec3(.13,.22,.20)*windowReflection*.18;
 color+=vec3(.13,.062,.012)*max(0.,dot(n,normalize(${v3(CORE_AT)}-P)))*.025;
 // A wide distant source catches the shoulders and sculpted folds.
 float sweep=pow(max(0.,dot(R,normalize(vec3(-1.8,.5,1.)))),90.);
 color+=vec3(.06,.10,.09)*sweep;
 return color;
}
`;
const FRAGMENT=`${FS_HEAD}${LIQUID}
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
  c=mix(vec3(1.3,.65,.29),vec3(.20,.08,.36),smoothstep(.24,.94,k));
  vec2 hot=(p+slope*2.4-vec2(0.,w.y+(w.w-w.y)*.28))/vec2(w.x*2.2,(w.w-w.y)*.7);
  c*=(.30+1.65*exp(-dot(hot,hot)*2.4))*flicker;
  vec2 s=vec2(p.x/.11+p.y/.19,-p.x/.11+p.y/.19),g=(.5-abs(fract(s)-.5))/10.5;
  d=min(g.x,g.y)-.0025;
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
  // Gathered cloth remains inside the real pointed aperture.
  if(doorway(P.xy)>0.)discard;
  float u=abs(O.x)/${f(DOOR.a)},v=sat((O.y-${f(DOOR.sill)})/${f(DOOR.peak-DOOR.sill)});
  float pleat=.5+.5*sin(u*17.+v*1.1),rim=pow(1.-ndv,2.);
  float thread=.5+.5*sin(u*380.);
  vec3 silk=mix(vec3(.005,.004,.011),vec3(.019,.012,.029),pleat*.65);
  silk+=vec3(.19,.15,.20)*pow(pleat,10.)*.14+vec3(.07,.05,.12)*rim*.22;
  silk*=.96+.04*thread;
  float hem=1.-smoothstep(.0,.014,min(v,1.-v));
  silk+=vec3(.20,.15,.10)*hem*.13;
  silk+=vec3(.60,.26,.065)*exp(-u*120.)*(1.-curtains);
  float a=.98;
  gl_FragColor=vec4(tonemap(silk)*a,a);return;
 }
 if(part>4.5&&part<5.5){
  vec3 q=(O-${v3(CORE)})*5.8;
  float field=organic(q+vec3(time*.22,-time*.16,0.));
  float veins=pow(1.-abs(sin(q.y*3.+field*2.8+time*.4)),4.);
  float soft=1.-.35*ease((age-5.)/1.6);
  vec3 gold=mix(vec3(.7,.16,.008),vec3(1.8,.95,.16),.45+.45*field);
  gold+=vec3(1.,.63,.13)*veins*.6;
  gold*=soft*(.65+.35*ndv)*.72;
  gl_FragColor=vec4(tonemap(gold),1.);return;
 }
 if(part>7.5&&part<8.5){
  float a=(.28+.4*(1.-ease((age-5.)/1.6)))*(1.-ease((age-4.9)/1.7));
  vec3 c=mix(vec3(.04,.3,.23),vec3(.5,.3,.045),ease((O.y-1.22)/.32));
  gl_FragColor=vec4(tonemap(c)*a,a);return;
 }
 bool shell=part>9.5;
 bool towerSkin=(part>.5&&part<1.5)||(shell&&dot(O.xz,normalize(${v3(TOWER)}.xz))>1.1);
 // Continuous world coordinates unite the porch, folds and tower.
 vec3 q=O*vec3(1.,1.18,1.);
 // The passage through the porch: dark stone, as the room's own door passage.
 if(part>2.5&&part<3.5){
  float grain=.5+.5*organic(O*14.);
  vec3 stone=vec3(.016,.017,.020)*(.75+.5*grain)+vec3(.05,.045,.034)*pow(1.-ndv,3.)*.5;
  gl_FragColor=vec4(tonemap(stone),1.);return;
 }
 vec3 color=liquidGlass(q,n,V);
 // The windows, sunk into the glass: the clerestory in the bays round the
 // body and the room's great window behind (none at the tower's bay or the
 // door's), and the tower's lancets up its stair. Light spills round them.
 // (The window nearest the point is found first, and drawn once: one niche
 // in the shader keeps it quick to compile.)
 vec4 win=vec4(0.),w=vec4(0.,0.,0.,-1.);float edge=9.,deep=.22,great=0.,aa=1.;
 vec2 face=vec2(0.);vec3 wall=vec3(0.,0.,1.);
 if(part<.5||(shell&&!towerSkin)){
  float phi=atan(O.z,O.x),closest=9.;
  aa=length(fwidth(O))/${f(S)};
  wall=normalize(vec3(P.x,0.,P.z));
${WINDOWS.map(t=>`  {float d=phi-${f(BAY(t.k))};d-=${f(TAU)}*floor((d+${f(Math.PI)})/${f(TAU)});
   if(abs(d)<closest){closest=abs(d);face=vec2(d*length(O.xz)/${f(S)},(O.y-${f(FLOOR)})/(shell?${f(S)}:${f(BODY_UP)}));w=${w4(t)};great=${f(t.k===0?1:0)};deep=${f(t.k===0?.3:.22)};}}`).join('\n')}
 }else if(towerSkin){
  vec3 o=O-${v3(TOWER)};
  float h=sat((O.y-${f(TOWER_BASE)})/${f(TOWER_TIP-TOWER_BASE)});
  if(shell)o.xz-=vec2(sin(h*7.5)*.15,cos(h*7.5)*.085)*h*h;
  float psi=atan(o.z,o.x)-${f(TWIST)}*h;
  vec2 e=vec2(${f(STRETCH[0])}*cos(psi),${f(STRETCH[1])}*sin(psi));
  float dir=shell?atan(o.z,o.x):atan(e.y,e.x),r=length(o.xz)*(shell?1.:length(e)),m=(O.y-${f(FLOOR)})/${f(S)};
  aa=length(fwidth(O))/${f(S)};
  wall=vec3(cos(dir),0.,sin(dir));deep=.24;
${TOWER_WINDOWS.map(t=>`  {float d=dir-${f(t.at)};d-=${f(TAU)}*floor((d+${f(Math.PI)})/${f(TAU)});
   if(abs(d*r)<${f(.6*S)}&&m>${f(t.sill-.15)}&&m<${f(t.peak+.15)}){face=vec2(d*r/${f(S)},m);w=${w4(t)};}}`).join('\n')}
 }
 if(w.w>0.)win=niche(face,-V,wall,w,deep,great,aa,edge);
 color=mix(color,win.rgb,win.a);
 // Fade before the finite niche lookup boundary; avoids rectangular light patches.
 color+=vec3(.34,.16,.06)*exp(-max(edge,0.)*7.)*.10*(1.-win.a)*(1.-smoothstep(.035,.14,max(edge,0.)));
 // Golden capillary at the active growth front, gone when settled.
 float front=age<2.5?1.50-(age-.65)/1.85*1.12:.38-(age-2.1)/1.9*1.66;
 front=${f(FLOOR)}+(front-${f(FLOOR)})*${f(K)};
 float feeding=(1.-ease((age-5.2)/1.1))*ease((age-.65)/.4);
 color+=vec3(.25,.19,.04)*exp(-pow((P.y-front)/${f(.055*K)},2.))*feeding*.25;
 gl_FragColor=vec4(tonemap(color),1.);
}
`;
// The fittings: bronze (mat 1) and polished mineral (mat 2).
const FITTINGS=`${FS_HEAD}${LIQUID}
// The room's bronze (room-scene.js architecturalMetal: #827354, half metal),
// worn and greening in places: the key's highlight and the night in it, and
// the glass's light on the side that faces the glass (inward).
vec3 bronze(vec3 n,vec3 V,vec3 inward){
 vec3 L=normalize(vec3(-.65,1.,1.)),R=reflect(-V,n);
 // (Green runs down it in streaks.)
 float verd=smoothstep(.6,.95,.5+.5*organic(O*vec3(40.,7.,40.)))*.35;
 vec3 base=mix(vec3(.34,.18,.082),vec3(.12,.23,.18),verd*.3);
 float rl=max(dot(R,L),0.);
 vec3 c=base*(.025+.17*max(dot(n,L),0.))+base*pow(rl,22.)*1.3+vec3(1.,.86,.62)*pow(rl,160.)*.4;
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
 o.x+=.92*pow(sat(v),1.3);
 if(v<=.62)return .38+.13*sin(min(v/.6,1.)*1.5708)-abs(o.x);
 return (1.-length(vec2(o.x/.51,(v-.62)/.38)))*.51;
}
void main(){
${FS_OPEN}
 float look=mat;
 vec2 t=vec2(O.x,O.z-${f(DOOR.plane)})/${f(S)};

 if(look>.5&&look<1.5){
  vec3 axis=part>.5&&part<1.5?${v3(TOWER)}:vec3(0.);
  vec3 inward=part>3.5&&part<4.5?vec3(0.,1.,0.):part>1.5?vec3(0.,0.,-1.):normalize(vec3(axis.x-P.x,.0001,axis.z-P.z));
  gl_FragColor=vec4(tonemap(bronze(n,V,inward)),1.);return;
 }
 if(look>1.5){
  if(part<1.5){vec3 c=liquidGlass(O*vec3(1.,1.18,1.),n,V)*.55;gl_FragColor=vec4(tonemap(c),1.);return;}
  if(part>3.5&&part<4.5){
   float edge=terrace(O.xz),lip=exp(-pow((edge-.013)/.008,2.));vec3 R=reflect(-V,n),L=normalize(vec3(-.65,1.,1.));
   vec3 c=liquidGlass(O*vec3(1.,1.18,1.),n,V)*.65;
   // Light inside the landing and elongated reflections from the entrance.
   vec4 veins=current(O*vec3(1.6,.7,1.2)+vec3(0.,.1,0.));
   c+=veins.rgb*.32+vec3(.003,.016,.017)*(1.-smoothstep(-.89,-.79,O.y));
   float reflection=exp(-pow(O.x/.065,2.))*exp(-max(t.y,0.)*.45);
   c+=vec3(.16,.067,.018)*reflection*(.55+.45*curtains);
   c=mix(c,bronze(n,V,vec3(0.,1.,0.)),lip);c+=vec3(.05,.021,.004)*exp(-dot(t,t)/2.3)*(.25+.75*curtains);gl_FragColor=vec4(tonemap(c),1.);return;
  }

 }
 gl_FragColor=vec4(0.,0.,0.,1.);
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
// A repeatable value-noise atlas. R/G hold adjacent z slices; bilinear
// filtering supplies xy, the shader interpolates z. 256 KiB, no download,
// never updated. This replaces dozens of sine hashes per covered pixel.
function makeNoiseMap(){
 const size=256,data=new Uint8Array(size*size*4),seed=new Uint8Array(size*size);let state=0x51f15e;
 for(let i=0;i<seed.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;seed[i]=(state>>>0)>>>24;}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=seed[y*size+x];data[i+1]=seed[((y+17)%size)*size+(x+37)%size];data[i+2]=0;data[i+3]=255;}
 noiseTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,noiseTexture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
}
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
 // Present the entire exterior 10 degrees more frontally. Inverse camera
 // yaw is the rigid presentation rotation; door/room world coordinates stay shared.
 const far=[2.37+Math.sin(time*.21)*.10*rhythm,1.73+Math.sin(time*.35)*.055*rhythm,11.25],look=[-.02,.12,.03];
 const turn=10*Math.PI/180,c=Math.cos(turn),s=Math.sin(turn);
 [far[0],far[2]]=[far[0]*c-far[2]*s,far[0]*s+far[2]*c];
 [look[0],look[2]]=[look[0]*c-look[2]*s,look[0]*s+look[2]*c];
 // Centre the real door seam horizontally, without moving any geometry.
 look[0]=far[0]*(look[2]-DOOR.plane)/(far[2]-DOOR.plane);
 const aspect=screenW/screenH,halfWidth=2.14+.26*(1-smooth((aspect-.65)/.35));
 const fov=Math.max(.378,2*Math.atan(halfWidth/(aspect*11.6)));
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
// The shell and fittings are built, and their program
// compiled, once the first frame is out: the formation begins with the core
// alone. While it animates they are drawn from when their program is
// compiled (in parallel where the browser can), so neither holds a frame
// back; a frame asked for on its own (wait: a settled view, a seek, a
// snapshot) waits for them.
let fittings=null,parallel=null;
function fit(wait){
 if(!fittings){
  if(first&&!wait)return false;
  const buildStart=performance.now(),shell=sanctuary(),drum=towerFittings();
  fittings={made:program(VERTEX,FITTINGS),meshes:{shell:upload(sanctuaryShell()),frame:upload(frame()),platform:upload(platform()),bodySills:upload(shell.bronze),bodyReveals:upload(shell.stone),drumBronze:upload(drum.bronze),drumStone:upload(drum.stone)}};
  metrics.buildMs=performance.now()-buildStart;

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
   gl.useProgram(g.p);gl.uniformMatrix4fv(g.u.vp,false,m);if(g.u.noiseMap)gl.uniform1i(g.u.noiseMap,0);
   gl.uniform3fv(g.u.eye,camera.eye);gl.uniform1f(g.u.time,reduced?8:time);gl.uniform1f(g.u.age,age);
   gl.uniform1f(g.u.curtains,camera.curtain);gl.uniform1f(g.u.reveal,camera.reveal);gl.uniform1f(g.u.stillness,reduced?1:0);
  };
  const g=pg.glass,t=pg.fittings;use(g);
  // Lathe triangles wind inward: cull their front-facing (inside) surfaces.
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);
  if(fitted)part(meshes.shell,10);part(meshes.core,5);
  gl.disable(gl.CULL_FACE);
  part(meshes.porch,9);part(meshes.tunnel,3);
  // The fine bronze inner reveal, mineral landing and recessed window trim.
  if(fitted){
   gl.disableVertexAttribArray(g.n);use(t);
   part(meshes.frame,2,1,t);part(meshes.platform,4,2,t);part(meshes.bodySills,0,1,t);part(meshes.bodyReveals,0,2,t);part(meshes.drumBronze,1,1,t);part(meshes.drumStone,1,2,t);

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
function stop(){disposed=true;cancelAnimationFrame(handle);if(gl){if(fittings&&!pg?.fittings){gl.deleteProgram(fittings.made.p);Object.assign(meshes,fittings.meshes);}for(const m of Object.values(meshes||{}))if(m?.p){gl.deleteBuffer(m.p);gl.deleteBuffer(m.n);gl.deleteBuffer(m.ix);}gl.deleteBuffer(meshes?.quad);gl.deleteTexture(noiseTexture);for(const p of Object.values(pg||{}))gl.deleteProgram(p.p);if(query)ext?.deleteQueryEXT(query);gl.getExtension('WEBGL_lose_context')?.loseContext();}send('disposed');close();}
// The entry's view (scene-camera.js entryView), where the walk in ends.
function setEntry(view){if(view&&['x','y','z','yaw','tilt','lens'].every(k=>Number.isFinite(view[k])))entry={...entry,...view};}
onmessage=({data:d})=>{
 try{
  if(d.type==='init'){
   canvas=d.canvas;screenW=d.width;screenH=d.height;dpr=d.dpr||1;reduced=!!d.reduced;
   gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,depth:true,powerPreference:'low-power'});
   if(!gl||!gl.getExtension('OES_standard_derivatives'))throw Error('Worker WebGL with derivatives unavailable');
   ext=gl.getExtension('EXT_disjoint_timer_query');resize();makeNoiseMap();
   parallel=gl.getExtension('KHR_parallel_shader_compile');
   const made={glass:program(VERTEX,FRAGMENT),halo:program(HALO_VS,HALO_FS),sky:program(SKY_VS,SKY_FS),hole:program(HOLE_VS,HOLE_FS)};
   pg=Object.fromEntries(Object.entries(made).map(([name,made])=>[name,linked(made)]));
   meshes={core:upload(lathe(y=>Math.sqrt(Math.max(0,.145**2-y*y)),.145,-.145,40,64,CORE)),
    feed:upload(lathe(y=>.006+.014*Math.sin((y-1.22)/.38*Math.PI),1.60,1.22,28,24)),
    porch:upload(porch()),tunnel:upload(passage()),left:upload(curtain(-1)),right:upload(curtain(1)),hole:upload(hole())};
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
