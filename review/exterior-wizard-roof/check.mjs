import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),source=readFileSync(new URL('loading-living-worker.js',root),'utf8').replaceAll('\r\n','\n');
const before=execFileSync('git',['show','37fd68d:loading-living-worker.js'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
const masked=source.replace(/\/\/ Sculpt only the roof[\s\S]*?(?=const SHELL_BOUNDS=)/,'').replace('return sculptWizardRoof(mesh);','return mesh;');
assert.equal(masked,before,'Only the once-built roof geometry may change');
for(const file of ['loading-gate.js','loading-exterior-3d.js','room-scene.js','scene-camera.js'])assert.equal(readFileSync(new URL(file,root),'utf8').replaceAll('\r\n','\n'),execFileSync('git',['show','37fd68d:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n'),file+' unchanged');
const context=s=>{const c=vm.createContext({onmessage:null,postMessage(){},performance,setTimeout,clearTimeout,Math});vm.runInContext(s,c);return c;};
const old=context(before),now=context(source),original=vm.runInContext('sanctuaryShell()',old),mesh={p:[...original.p],n:[...original.n],ix:[...original.ix]};
now.__mesh=mesh;const start=performance.now();vm.runInContext('sculptWizardRoof(__mesh)',now);const sculptMs=performance.now()-start;
let changed=0,lowestChangedY=Infinity;const roofRoot=vm.runInContext('TOWER_ROOF-.11',now);
for(let i=0;i<mesh.p.length;i+=3){
 const same=mesh.p.slice(i,i+3).every((v,k)=>v===original.p[i+k]);
 if(!same){changed++;lowestChangedY=Math.min(lowestChangedY,original.p[i+1]);assert.ok(original.p[i+1]>roofRoot);assert.ok(Math.hypot(original.p[i],original.p[i+2])>.70,'Main dome untouched');}
 if(original.p[i+1]<=roofRoot){assert.ok(same);for(let k=0;k<3;k++)assert.equal(mesh.n[i+k],original.n[i+k],'Lower normals preserved');}
 const length=Math.hypot(...mesh.n.slice(i,i+3));assert.ok(Number.isFinite(length)&&length>.999&&length<1.001,'Unit normals');
}
assert.ok(changed>0);assert.ok(mesh.p.every(Number.isFinite));assert.deepEqual(mesh.ix,[...original.ix]);assert.ok(mesh.p.length/3<65536);
now.__points=[...mesh.p,...vm.runInContext('platform().p',now)];const views=[];
for(const[w,h]of [[1024,1024],[1600,1000],[390,844],[844,390]]){
 vm.runInContext(`width=screenW=${w};height=screenH=${h};time=8.05;`,now);
 const bounds=JSON.parse(vm.runInContext('JSON.stringify((()=>{const c=pose(),m=matrix(c.eye,c.target,c.fov),b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<__points.length;i+=3){const p=project(__points.slice(i,i+3),m);b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;})())',now));
 assert.ok(bounds[0]>w*.01&&bounds[1]>h*.01&&bounds[2]<w*.99&&bounds[3]<h*.99,'Framing '+w+'x'+h);views.push({size:[w,h],bounds});
}
const result={status:'PASS',baseline:'37fd68d',sourceHash:createHash('sha256').update(source.trim()).digest('hex'),shellVertices:mesh.p.length/3,shellTriangles:mesh.ix.length/3,changedVertices:changed,lowestChangedY,roofRoot,sculptMs,unchanged:'All runtime code except one-time roof mapping; topology, dome, lower tower, doorway, platform, materials, camera and entry preserved',views};
mkdirSync(new URL('verification/exterior-wizard-roof/',root),{recursive:true});writeFileSync(new URL('verification/exterior-wizard-roof/check.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
