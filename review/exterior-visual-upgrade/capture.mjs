// Read-only visual inspection: diagnostic camera edits exist only in HTTP response bytes.
import {createServer} from 'node:http';
import {readFile, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..'), label=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'after', output = resolve(root, 'verification/exterior-visual-upgrade',label);
await mkdir(output, {recursive: true});
// Paths the server answers with 404, or holds until released.
const missing = new Set(), held = new Map();
let reviewCameraEnabled=true;
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, '.' + path.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + sep) || missing.has(path)) { res.writeHead(404).end(); return; }
  if (held.has(path)) await held.get(path);
  try {
    let data = await readFile(file);
    if(path==='/loading-living-worker.js'&&reviewCameraEnabled){
      let source=data.toString('utf8');
      source=source.replace('if(eye.z<${f(DOOR.plane)}&&solid)discard;', '// Diagnostic side/rear view: do not treat the camera as having entered the doorway.');
      source+='\nlet reviewView=null;\n';
      source=source.replace('const camera=pose(),m=matrix','const camera=(reviewView?{...pose(),...reviewView}:pose()),m=matrix');
      source=source.replace("if(d.type==='init')", "if(d.type==='review-view'){reviewView=d.view;render();report();return;}\n  if(d.type==='init')");
      data=Buffer.from(source);
    }
    res.setHeader('Cache-Control','no-store');

    res.setHeader('Content-Type', ({'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png':'image/png', '.webp':'image/webp'})[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
const url = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(resolve(tmpdir(), 'portfolio-gate-check-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--enable-unsafe-swiftshader', '--use-angle=d3d11', '--enable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
let ws;
try {
  const endpoint = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('Chrome startup timed out')), 20000);
    let log = '';
    chrome.once('error', error => { clearTimeout(timer); fail(error); });
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); done(match[1]); }
    });
  });
  ws = new WebSocket(endpoint);
  await new Promise((done, fail) => { ws.addEventListener('open', done, {once: true}); ws.addEventListener('error', fail, {once: true}); });
  let serial = 0, session;
  const pending = new Map(), errors = [], warnings = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id);
      message.error ? request.fail(new Error(JSON.stringify(message.error))) : request.done(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') warnings.push(message.params.args.map(a => a.value ?? a.description).join(' '));
  });
  const cdp = (method, params = {}, attached = true) => new Promise((done, fail) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); fail(new Error('CDP timeout: ' + method)); }, 90000);
    pending.set(id, {done: result => { clearTimeout(timer); done(result); }, fail: error => { clearTimeout(timer); fail(error); }});
    ws.send(JSON.stringify({id, method, params, ...(attached && session ? {sessionId: session} : {})}));
  });
  const {targetInfos} = await cdp('Target.getTargets', {}, false);
  session = (await cdp('Target.attachToTarget', {targetId: targetInfos.find(target => target.type === 'page').targetId, flatten: true}, false)).sessionId;
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront');
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const sleep = ms => new Promise(done => setTimeout(done, ms));
  async function until(expression, timeout = 90000) {
    const start = Date.now();
    while (!await evaluate(expression)) {
      if (Date.now() - start > timeout) throw new Error('Timed out: ' + expression);
      await sleep(100);
    }
  }
  async function shot(name) {
    const {data} = await cdp('Page.captureScreenshot', {format: 'png'});
    await writeFile(resolve(output, 'gate-' + name + '.png'), Buffer.from(data, 'base64'));
  }
  async function click(x, y) {
    await cdp('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, buttons: 0});
    await cdp('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
    await cdp('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
  }
  async function viewport(width, height, motion = 'no-preference') {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await cdp('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: motion}]});
  }
  // From the very start of each page: what the first paint holds, and when
  // ready / entering / entered happen.
  await cdp('Page.addScriptToEvaluateOnNewDocument', {source: `window.__gate = {events: {}, paint: null};
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint' && !__gate.paint)
      __gate.paint = {at: entry.startTime, gate: !!document.getElementById('loadingGate')}; }).observe({type: 'paint', buffered: true});
    for (const name of ['site-ready', 'site-entering', 'site-entered']) addEventListener(name, event => { __gate.events[name] = {at: performance.now(), detail: event.detail}; });`});
  const loaded = "document.readyState !== 'loading' && !!document.getElementById('loadingGate')";
  const entered = "document.documentElement.dataset.siteEntered === 'yes'";
  // After entry: the gate is gone, nothing is inert, and the page is on top.
  async function assertEntered(label) {
    assert.ok(await evaluate("!document.getElementById('loadingGate') && !document.querySelector('[inert]')"), label + ': the gate is gone and nothing is inert');
    assert.ok(await evaluate("!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.loading-gate')"), label + ': the page is on top');
    assert.ok(await evaluate("!!__gate.events['site-entered'] && __gate.events['site-entered'].at >= (__gate.events['site-ready']?.at ?? 0)"), label + ': entered after ready');
  }




  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const OriginalWorker=window.Worker;window.Worker=class extends OriginalWorker{constructor(url,options){super(url,options);if(String(url).includes('loading-living-worker.js'))window.__reviewWorker=this;}};"});
  await viewport(1600,1000);await cdp('Page.navigate',{url:url+'dev/living-exterior-preview.html'});
  await until("window.previewPortal && document.querySelector('.loading-living').dataset.view==='live'");
  await evaluate("document.querySelector('.review').hidden=true;loadingExterior3d.seek(8.05)");
  await until('loadingExterior3d.stats.drawing?.time===8.05');await sleep(400);await shot('front-current');
  const views=[
   ['left-three-quarter',[-3.7,1.65,5.75],[.2,.25,0]],
   ['right-three-quarter',[4.1,1.5,5.6],[.2,.25,0]],
   ['side-geometry',[6.0,1.2,.2],[.2,.25,0]],
   ['rear-geometry',[1.5,1.4,-6.3],[.2,.25,0]],
   ['entrance-detail',[-.35,-.16,3.0],[0,-.32,1.05]]
  ];
  for(const[name,eye,target]of views){
   await evaluate('__reviewWorker.postMessage('+JSON.stringify({type:'review-view',view:{eye,target}})+')');
   await sleep(350);await shot(name);
  }
  const baseline=await evaluate('loadingExterior3d.stats');
  await evaluate("__reviewWorker.postMessage({type:'review-view',view:null})");
  await viewport(390,844);await sleep(500);await shot('mobile-current');
  if(!process.argv.includes('--preview-only')){
  reviewCameraEnabled=false;
  await viewport(1600,1000);await cdp('Page.navigate',{url});
  await until("window.loadingGate?.state==='entering'");await evaluate('loadingExterior3d.pause()');await sleep(200);
  const E=await evaluate('loadingExterior3d.stats.drawing.entry'),A=E.approach,B=A+E.arrival,C=B+E.curtains,D=C+E.walk;
  for(const[name,t]of[['arrival-current',A+.8],['curtains-current',B+E.curtains*.65],['interior-threshold',C+E.walk*.55]]){
   await evaluate('loadingExterior3d.seekFlight('+t+')');await sleep(500);await shot(name);
  }
  await evaluate('loadingExterior3d.seekFlight('+(D+.1)+')');await until(entered);await sleep(700);await shot('interior-entry');
  await evaluate("sceneCamera.go('chair',{instant:true})");await sleep(600);await shot('interior-seated');
  await evaluate("document.getElementById('tableCloth').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");await sleep(3200);await shot('interior-orb');
  await evaluate("sceneCamera.go('shelf',{instant:true})");await sleep(600);await shot('interior-shelf');
  }
  let published;
  try{
   const {createHash}=await import('node:crypto');
   const live=await fetch('https://wizzardcake.github.io/portifolio/loading-living-worker.js');
   const bytes=Buffer.from(await live.arrayBuffer()),local=await readFile(resolve(root,'loading-living-worker.js'));
   const normalize=b=>b.toString('utf8').replaceAll('\r\n','\n').trim();
   published={status:live.status,sameSource:normalize(bytes)===normalize(local),liveHash:createHash('sha256').update(normalize(bytes)).digest('hex'),localHash:createHash('sha256').update(normalize(local)).digest('hex')};
  }catch(error){published={error:error.message};}
  await writeFile(resolve(output,'inspection.json'),JSON.stringify({commit:'63072d3 + B working tree',baseline,published,errors,warnings,viewports:['1600x1000 DPR1','390x844 DPR1'],note:'Diagnostic standalone viewpoints override camera pose and bypass the cinematic door-plane discard in the served response only. Side/rear geometry views therefore inspect normally hidden geometry; the root-page entry and interior captures use untouched response bytes. Diagnostic changes exist only in served bytes; root-page captures use the working-tree renderer without injection.'},null,2));
  console.log(JSON.stringify({published,errors,warnings,triangles:baseline.drawing?.triangles}));
  assert.equal(errors.length,0,JSON.stringify(errors));await cdp('Browser.close',{},false).catch(()=>{});
}finally{
 ws?.close();server.close();chrome.kill();await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250}).catch(()=>{});
}

