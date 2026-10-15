// Phase-1 regression guard: door, shared walk and material/light functions stay intact.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const source=readFileSync(new URL('../../loading-living-worker.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const before=execFileSync('git',['show','6e61372:loading-living-worker.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');
function sandbox(code){const c=vm.createContext({onmessage:null,postMessage(){},performance,setTimeout,clearTimeout,Math});vm.runInContext(code,c);return c;}
const old=sandbox(before),now=sandbox(source),run=(c,js)=>JSON.parse(vm.runInContext('JSON.stringify('+js+')',c));
for(const expr of ['DOOR','FRAME','FORMATION','ENTRY','arch()','hole()','passage()','curtain(-1)','curtain(1)'])assert.deepEqual(run(now,expr),run(old,expr),expr+' unchanged');
const span=(s,start,end)=>{const i=s.indexOf(start),j=s.indexOf(end,i+start.length);assert.ok(i>=0&&j>i,start);return s.slice(i,j);};
for(const [a,b]of [
 ['vec3 current(', '// A pointed opening'],
 ['vec3 night(', 'const FS_OPEN='],
 ['vec3 pane(', 'void main(){\n${FS_OPEN}'],
 [' // The living surface:', ' // The windows, sunk'],
 ['vec3 bronze(', 'float terrace('],
 ['const SKY_VS=', '// The doorway\'s opening'],
 ['function makeNoiseMap()', 'function shader('],
 ['  // Gather each fitted panel', ' }else{\n  float u=sat'],
 ['function walked(', 'function pose(){'],
 [' const t=time-flight.start', 'function part(']
])assert.equal(span(source,a,b),span(before,a,b),'Unchanged material/light/animation block: '+a);
for(const t of [2.6,3.5,4.6,5.5,6,8.5,11]){
 for(const c of [old,now])vm.runInContext('flight={start:10,eye:[0,0,6],target:[0,0,0],fov:.7};time=10+'+t+';lighter=true;',c);
 assert.deepEqual(run(now,'pose()'),run(old,'pose()'),'Shared entrance after approach at '+t);
}
vm.runInContext('flight=null;time=8.05;',now);
const summary=[];let shell,landing;
for(const name of ['sanctuaryShell','porch','platform']){
 const start=performance.now(),mesh=vm.runInContext(name+'()',now),vertices=mesh.p.length/3;
 assert.ok(vertices<65536,name+' 16-bit vertex budget');assert.equal(mesh.n.length,mesh.p.length);
 assert.ok(mesh.p.every(Number.isFinite)&&mesh.n.every(Number.isFinite),name+' finite');
 assert.ok(mesh.ix.every(i=>Number.isInteger(i)&&i>=0&&i<vertices),name+' indices');
 summary.push({name,vertices,triangles:mesh.ix.length/3});
 if(name==='sanctuaryShell'){shell=mesh;const {lo,hi}=run(now,'SHELL_BOUNDS');assert.ok(mesh.p.every((v,i)=>v>lo[i%3]+.005&&v<hi[i%3]-.005),'Shell stays inside its meshing volume; no clipped-open folds');}if(name==='platform')landing=mesh;
}
const clearance=vm.runInContext(`Math.min(...Array.from({length:101},(_,i)=>{const z=DOOR.plane+LANDING*S*i/100,v=(z-PLATFORM.z)/PLATFORM.length;return terraceHalf(v)-Math.abs(terraceCentre(v));}))`,now);
assert.ok(clearance>.2,'Unchanged x=0 walk has at least .2 world units of landing on either side');
now.__points=[...shell.p,...landing.p];
const bounds=[];
for(const [w,h]of [[1024,1024],[1600,1000],[390,844],[844,390]]){
 vm.runInContext(`width=screenW=${w};height=screenH=${h};`,now);
 const b=run(now,`(()=>{const c=pose(),m=matrix(c.eye,c.target,c.fov),out=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<__points.length;i+=3){const q=project(__points.slice(i,i+3),m);out[0]=Math.min(out[0],q[0]);out[1]=Math.min(out[1],q[1]);out[2]=Math.max(out[2],q[0]);out[3]=Math.max(out[3],q[1]);}return out;})()`);
 assert.ok(b[0]>w*.01&&b[1]>h*.01&&b[2]<w*.99&&b[3]<h*.99,'Framing stays inside '+w+'x'+h+': '+b);
 bounds.push({viewport:[w,h],bounds:b.map(v=>Math.round(v))});
}
console.log(JSON.stringify({result:'PASS',doorAndCurtains:'unchanged',sharedWalk:'unchanged',materialLightAndAnimationBlocks:'unchanged',walkClearance:clearance,geometry:summary,framing:bounds},null,2));
