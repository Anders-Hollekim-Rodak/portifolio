// Correction pass: only optical shading and the initial presentation may change.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const source=readFileSync(new URL('loading-living-worker.js',root),'utf8').replaceAll('\r\n','\n');
const git=file=>execFileSync('git',['show','4304dd7:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
const before=git('loading-living-worker.js');
function span(s,a,b){const i=s.indexOf(a),j=b?s.indexOf(b,i+a.length):s.length;assert.ok(i>=0&&j>i,'Find '+a);return s.slice(i,j);}
for(const[a,b]of [
 ['/*','const LIQUID='],
 ['const FRAGMENT=','function pose(){'],
 [' if(!flight)return{eye:far',null]
])assert.equal(span(source,a,b),span(before,a,b),'Preserve '+a);
for(const file of ['loading-gate.js','loading-exterior-3d.js','loading-gate.css','index.html','room-scene.js','scene-camera.js','portal-orb-material.js'])assert.equal(readFileSync(new URL(file,root),'utf8').replaceAll('\r\n','\n'),git(file),file+' unchanged');
function sandbox(code){const c=vm.createContext({onmessage:null,postMessage(){},performance,setTimeout,clearTimeout,Math});vm.runInContext(code,c);return c;}
const old=sandbox(before),now=sandbox(source),run=(c,js)=>JSON.parse(vm.runInContext('JSON.stringify('+js+')',c));
// The shared arrival, curtains and walk are identical after the changed approach.
for(const t of [2.6,3.5,4.6,5.5,6,8.5,11]){
 for(const c of [old,now])vm.runInContext('flight={start:10,eye:[0,0,6],target:[0,0,0],fov:.7};time=10+'+t+';lighter=true;',c);
 assert.deepEqual(run(now,'pose()'),run(old,'pose()'),'Entry pose '+t);
}
for(const c of [old,now])vm.runInContext('flight=null;time=8.05;',c);
const shell=vm.runInContext('sanctuaryShell()',now),platform=vm.runInContext('platform()',now);now.__points=[...shell.p,...platform.p];
const views=[];
for(const[w,h]of [[1024,1024],[1600,1000],[390,844],[844,390]]){
 for(const c of [old,now])vm.runInContext(`width=screenW=${w};height=screenH=${h};`,c);
 const snapshot=c=>run(c,`(()=>{const p=pose(),m=matrix(p.eye,p.target,p.fov);return {eye:p.eye,target:p.target,door:project([0,(DOOR.sill+DOOR.peak)/2,DOOR.plane],m),azimuth:Math.atan2(p.eye[0],p.eye[2])*180/Math.PI,doorObliqueness:Math.atan2(p.eye[0],p.eye[2]-DOOR.plane)*180/Math.PI};})()`);
 const a=snapshot(old),b=snapshot(now);
 assert.ok(Math.abs(b.door[0]/w-.5)<1e-5,'Door horizontally centred at '+w+'x'+h);
 assert.ok(Math.abs(a.azimuth-b.azimuth-10)<1e-8,'Exactly 10 degree presentation yaw');
 const bounds=run(now,`(()=>{const c=pose(),m=matrix(c.eye,c.target,c.fov),b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<__points.length;i+=3){const p=project(__points.slice(i,i+3),m);b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;})()`);
 assert.ok(bounds[0]>w*.01&&bounds[1]>h*.01&&bounds[2]<w*.99&&bounds[3]<h*.99,'Framing '+w+'x'+h+': '+bounds);
 views.push({viewport:[w,h],before:a,after:b,bounds});
}
const result={status:'PASS',baseline:'4304dd7',geometry:'unchanged',doorAndRoom:'unchanged',sharedEntry:'unchanged',presentationYawDegrees:10,sourceHash:createHash('sha256').update(source.trim()).digest('hex'),views};
mkdirSync(new URL('verification/exterior-correction/',root),{recursive:true});writeFileSync(new URL('verification/exterior-correction/geometry-camera.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
