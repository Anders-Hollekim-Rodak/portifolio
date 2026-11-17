// Room materials: still frames from fixed camera angles, for before/after.
//   node tests/room-materials-shots.mjs --out=name [--views=floor,timber,walls] [--format=webp]
// PORTFOLIO_TEST_ROOT serves another checkout (the untouched baseline); the
// frames always land in this checkout's verification/materials/<name>/.
// Reduced motion and a fixed clock, so two runs differ only by the source.
// Each frame's mean brightness (the room canvas alone, whole and lower half)
// goes to report.json: the room must come out neither lighter nor darker.
// Same CDP approach as the other suites: local Chrome on the GPU, no install.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const sourceRoot=resolve(process.env.PORTFOLIO_TEST_ROOT||root);
const arg=(key,fallback)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const name=arg('out','shots');assert.match(name,/^[a-z0-9-]+$/i);
const groups=arg('views','floor,timber,walls').split(',');
// png, or webp (smaller, for a page of comparisons).
const format=arg('format','png');assert.match(format,/^(png|webp)$/);
const out=resolve(root,'verification/materials',name);await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const file=resolve(sourceRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
  if(!file.startsWith(sourceRoot+sep)){res.writeHead(403).end();return;}
  try{const data=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data);}
  catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url=`http://127.0.0.1:${server.address().port}/`;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

const prefix=resolve(tmpdir(),'portfolio-materials-'),profile=await mkdtemp(prefix);
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking',
  '--use-angle=d3d11','--enable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank',
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((done,fail)=>{let log='';const timer=setTimeout(()=>fail(new Error('Chrome startup timeout')),20000);
    chrome.once('error',fail);chrome.stderr.on('data',c=>{log+=c;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);done(m[1]);}});});
  ws=new WebSocket(endpoint);await new Promise((done,fail)=>{ws.addEventListener('open',done,{once:true});ws.addEventListener('error',fail,{once:true});});
  let serial=0,session;const pending=new Map(),errors=[],warnings=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.fail(new Error(JSON.stringify(m.error))):p.done(m.result);}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))(m.params.type==='error'?errors:warnings).push(m.params.args.map(a=>a.value||a.description).join(' '));
  });
  const cdp=(method,params={},attached=true)=>new Promise((done,fail)=>{const id=++serial,t=setTimeout(()=>{pending.delete(id);fail(new Error('Timeout '+method+' '+(params.expression||'').slice(0,100)));},90000);
    pending.set(id,{done:r=>{clearTimeout(t);done(r);},fail:e=>{clearTimeout(t);fail(e);}});ws.send(JSON.stringify({id,method,params,...(attached&&session?{sessionId:session}:{})}));});
  const {targetInfos}=await cdp('Target.getTargets',{},false);
  session=(await cdp('Target.attachToTarget',{targetId:targetInfos.find(t=>t.type==='page').targetId,flatten:true},false)).sessionId;
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"try{sessionStorage.setItem('fp-invited','yes')}catch{}"});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  async function until(expression,timeout=90000){const at=Date.now();while(!await evaluate(expression)){if(Date.now()-at>timeout)throw new Error('Timed out '+expression);await sleep(100);}}
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp('Page.navigate',{url});
  await until("(document.querySelector('.loading-gate__continue:not([hidden])')?.click(), document.documentElement?.dataset.siteEntered === 'yes') && document.querySelector('#roomShell')?.classList.contains('is-ready')");
  await evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]).then(()=>true)');await sleep(800);
  await evaluate(`window.__shelfPose=structuredClone(sceneCamera.shelf);window.__nativeRAF=requestAnimationFrame;window.requestAnimationFrame=cb=>__nativeRAF(()=>cb(20000));true`);
  // Scene coordinates: metres, the table at the origin, +Z toward the door.
  const free=(position,lookAt)=>({position,lookAt});
  const views={
    // The three places a visitor stands or sits.
    all:[['entry'],['seated','chair'],['shelf']],
    floor:[
      // From the entry, down at the boards between the door and the table.
      ['floor-entry',free([0,1.7,3.4],[0,0,1.5])],
      // Low across the boards toward the window: joints, wear and sheen.
      ['floor-low',free([1.7,.5,3.3],[-.7,0,-.6])],
      // Close on a few boards beside the rug.
      ['floor-close',free([-1.5,.85,2.9],[-2.0,0,2.2])],
      // Where the boards meet a column's base and the wall (right of the door).
      ['floor-column',free([1.5,1.15,2.0],[2.95,.1,3.25])],
      // From above, steeply: where the wear lies.
      ['floor-plan',free([0,4.3,2.6],[0,0,.7])],
      // The walk to the nook, looking back along it toward the door.
      ['floor-path',free([-2.6,1.6,-.6],[-.4,0,2.6])],
    ],
    timber:[
      // A column from base to capital, with the gallery's beam and front.
      ['column',free([.6,1.5,1.2],[2.95,1.6,3.25])],
      // Its base, close.
      ['column-base',free([1.9,.7,2.3],[2.95,.2,3.25])],
      // The gallery's front and balustrade from below.
      ['gallery',free([0,1.6,.2],[3.2,3.0,-1.9])],
      // The cornice and the plinth along a blind bay.
      ['trim',free([.4,1.5,1.4],[3.6,1.4,2.2])],
      // The door's stone frame, close: its profile and its edges.
      ['door-frame',free([1.2,1.6,2.9],[.6,1.7,4.25])],
      // The gallery's front from below: the moulded fascia, the rails.
      ['gallery-front',free([.3,1.9,.6],[2.6,2.65,-1.0])],
      // The cornice under the vault, from the open middle at gallery height.
      ['cornice',free([1.0,3.6,.8],[3.3,3.85,2.3])],
      // From inside the stair tower, back at a column of its mouth: the
      // column's base and shafts seen from behind.
      ['tower-mouth',free([4.9,1.1,-2.0],[3.93,.3,-.75])],
    ],
    walls:[
      // A blind bay in the sconce's light, obliquely: the wall's relief.
      ['wall-raking',free([1.2,1.5,2.6],[3.75,1.6,1.3])],
      // The wall and the floor, the corner between two bays.
      ['wall-foot',free([1.6,1.0,1.4],[3.6,.3,2.4])],
      // The wall arch over a bay (the blind arch's edge).
      ['wall-arch',free([.5,1.6,.9],[3.7,2.3,2.3])],
      // A blind arch close, obliquely: its reveal and the edge round into it.
      ['blind-arch',free([2.0,1.7,2.0],[3.46,2.2,2.3])],
      // A shelving niche: its reveal and its back.
      ['niche',free([-1.8,1.5,-.6],[-3.46,1.6,-1.7])],
      // The upper walls over the gallery, up to the vault.
      ['upper-wall',free([.4,3.4,.6],[2.6,4.3,-2.2])],
    ],
  };
  const list=[...views.all,...groups.flatMap(group=>views[group]||[])];
  const stats={},shots=[];
  for(const [label,place=label] of list) {
    await evaluate(`sceneCamera.shelf=structuredClone(__shelfPose);true`);
    const posed=typeof place==='object';
    if(posed) await evaluate(`sceneCamera.shelf.wide=${JSON.stringify(place)};sceneCamera.shelf.portrait=sceneCamera.shelf.wide;true`);
    await evaluate(`sceneCamera.go('${posed?'shelf':place}',{instant:true});sceneCamera.update();studyRoom.invalidate();true`);
    await sleep(650);
    // The room canvas as drawn (it keeps its buffer): calls, triangles and
    // mean brightness (sRGB 0..1), whole and lower half.
    stats[label]=await evaluate(`(()=>{const R=studyRoom,r=R.renderer;r.info.autoReset=false;r.info.reset();R.camera.layers.set(0);r.render(R.scene,R.camera);
      const s={calls:r.info.render.calls,triangles:r.info.render.triangles};r.info.autoReset=true;
      const c=document.createElement('canvas');c.width=360;c.height=225;const g=c.getContext('2d',{willReadFrequently:true});
      g.drawImage(r.domElement,0,0,360,225);const d=g.getImageData(0,0,360,225).data;let all=0,low=0;
      for(let y=0;y<225;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4,l=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;all+=l;if(y>=112)low+=l;}
      s.brightness=+(all/(360*225)).toFixed(4);s.lowerHalf=+(low/(360*113)).toFixed(4);R.invalidate();return s;})()`);
    await sleep(350);
    const {data}=await cdp('Page.captureScreenshot',format==='png'?{format}:{format,quality:90});
    await writeFile(resolve(out,label+'.'+format),Buffer.from(data,'base64'));shots.push(label);
    console.log('Captured',label,JSON.stringify(stats[label]));
  }
  const programs=await evaluate("studyRoom.renderer.info.programs.length"),memory=await evaluate("({...studyRoom.renderer.info.memory})"),surfaces=await evaluate("studyRoom.floor?{...studyRoom.floor.stats}:null");
  await writeFile(resolve(out,'report.json'),JSON.stringify({sourceRoot,viewport:"1440x900 DPR 1",stats,programs,memory,surfaces,errors,warnings,shots},null,2));
  console.log(JSON.stringify({out,programs,memory,surfaces,errors,warnings}));
  assert.deepEqual(errors,[],'Console/shader errors');
  await cdp('Browser.close',{},false).catch(()=>{});
} finally {ws?.close();chrome.kill();server.close();if(resolve(profile).startsWith(prefix))await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250}).catch(()=>{});}
