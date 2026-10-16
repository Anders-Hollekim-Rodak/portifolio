// Material-pass guard: approved geometry, camera, timing and interaction paths are immutable.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const source=readFileSync(new URL('loading-living-worker.js',root),'utf8').replaceAll('\r\n','\n');
const git=(file)=>execFileSync('git',['show','d156488:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
const before=git('loading-living-worker.js');
function span(s,a,b){const i=s.indexOf(a),j=b?s.indexOf(b,i+a.length):s.length;assert.ok(i>=0&&j>i,'Find '+a);return s.slice(i,j);}
for(const [a,b]of [
 ['/*','const FS_HEAD='],
 ['const FS_OPEN=','const FRAGMENT='],
 ['float archHalf(','// A window\'s glass'],
 [' // The windows, sunk',' if(w.w>0.)win=niche'],
 [' // Golden capillary','// The fittings:'],
 ['float terrace(','void main(){'],
 ['const SKY_VS=',null]
]){
 // The new shared LIQUID shader sits between FS_OPEN and FRAGMENT.
 const clip=s=>span(s,a,b).split('// Shared world-space liquid mineral.')[0];
 assert.equal(clip(source),clip(before),'Approved block: '+a);
}
for(const file of ['loading-gate.js','loading-exterior-3d.js','loading-gate.css','index.html','room-scene.js','scene-camera.js','portal-orb-material.js']){
 assert.equal(readFileSync(new URL(file,root),'utf8').replaceAll('\r\n','\n'),git(file),file+' unchanged');
}
assert.ok(source.includes('gl.uniform1f(g.u.time,reduced?8:time)'),'Frozen material time under reduced motion');
console.log(JSON.stringify({result:'PASS',baseline:'d156488',geometry:'unchanged',vertexDeformation:'unchanged',camera:'unchanged',entryAndReadiness:'unchanged',roomAndOrb:'unchanged',sourceHash:createHash('sha256').update(source.trim()).digest('hex')},null,2));
