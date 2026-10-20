// Keep this pass limited to current intensity and the camera-facing terrace.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8').replaceAll('\r\n','\n');
const source=read('loading-living-worker.js'),before=execFileSync('git',['show','25543df:loading-living-worker.js'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
// Compare all code outside the explicitly changed material and terrace regions.
const mask=s=>s.replace(/^const PLATFORM = .*;$/m,'PLATFORM').replace(/\/\/ A level mineral tongue[\s\S]*?(?=const terraceHalf=)/,'TERRACE_AXIS\n').replace(/const LIQUID=`[\s\S]*?`;(?=\nconst FRAGMENT=)/,'LIQUID').replace(/ o\.x[+-]=[^\n]+/,' TERRACE_SHADER_AXIS');
assert.equal(mask(source),mask(before),'Everything except liquid shading and terrace axis unchanged');
for(const file of ['loading-gate.js','loading-exterior-3d.js','scene-camera.js','room-scene.js'])assert.equal(read(file),execFileSync('git',['show','25543df:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n'),file+' unchanged');
const make=s=>{const c=vm.createContext({onmessage:null,postMessage(){},performance,setTimeout,clearTimeout,Math});vm.runInContext(s,c);return c;},old=make(before),now=make(source);
const get=(c,s)=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c));
const a=get(old,'platform()'),b=get(now,'platform()');assert.deepEqual(a.ix,b.ix,'Unchanged platform topology');assert.equal(a.p.length,b.p.length);assert.ok(b.p.every(Number.isFinite)&&b.n.every(Number.isFinite));
for(let i=0;i<a.p.length;i++)if(i%3)assert.equal(a.p[i],b.p[i],'Preserve every y/z coordinate');
const path=get(now,'(()=>{const points=[];for(let i=0;i<=100;i++){const z=DOOR.plane+LANDING*S*i/100,v=(z-PLATFORM.z)/PLATFORM.length;points.push({z,half:terraceHalf(v),centre:terraceCentre(v)});}return points;})()');
assert.ok(path.every(p=>p.half-Math.abs(p.centre)>DOOR_WIDTH()),'Entry centreline supported by platform');
function DOOR_WIDTH(){return get(now,'DOOR.a');}
const views=[];
for(const[w,h]of [[1024,1024],[1600,1000],[390,844],[844,390]]){
 vm.runInContext(`width=screenW=${w};height=screenH=${h};time=8.05;`,now);
 const v=get(now,'(()=>{const c=pose(),m=matrix(c.eye,c.target,c.fov);return{door:project([0,FLOOR,DOOR.plane],m),tip:project([terraceCentre(1),FLOOR,PLATFORM.z+PLATFORM.length],m),yawDegrees:PLATFORM.yaw*180/Math.PI};})()');
 assert.ok(Math.abs(v.tip[0]-v.door[0])<.1,'Platform faces camera at '+w+'x'+h);views.push({size:[w,h],...v});
}
const result={status:'PASS',baseline:'25543df',sourceHash:createHash('sha256').update(source.trim()).digest('hex'),unchanged:'Body/tower/door/camera/entry/room; platform y,z,width,topology',platformTriangles:b.ix.length/3,entryCentrelineSupported:true,views};
mkdirSync(new URL('verification/exterior-flow-landing/',root),{recursive:true});writeFileSync(new URL('verification/exterior-flow-landing/check.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
