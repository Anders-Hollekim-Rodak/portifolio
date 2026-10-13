// Read-only visual inspection: diagnostic camera edits exist only in HTTP response bytes.
import {createServer} from 'node:http';
import {readFile, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root = resolve(import.meta.dirname, '../..'), label=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'after', output = resolve(root, 'verification/exterior-visual-upgrade',label);
await mkdir(output, {recursive: true});
// Paths the server answers with 404, or holds until released.
const missing = new Set(), held = new Map();
let reviewCameraEnabled=false;
const ref=process.argv.find(a=>a.startsWith('--ref='))?.slice(6);
const workerSource=ref?execFileSync('git',['show',ref+':loading-living-worker.js'],{cwd:root}):null;
const sourceHash=createHash('sha256').update((workerSource||await readFile(resolve(root,'loading-living-worker.js'))).toString('utf8').replaceAll('\r\n','\n').trim()).digest('hex');
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, '.' + path.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + sep) || missing.has(path)) { res.writeHead(404).end(); return; }
  if (held.has(path)) await held.get(path);
  try {
    let data = path==='/loading-living-worker.js'&&workerSource?workerSource:await readFile(file);
    if(path==='/loading-living-worker.js'&&process.argv.includes('--fixed-normals'))data=Buffer.from(data.toString('utf8').replace('N=normalize(cross(deform(position+t*.003)-P,deform(position+b*.003)-P));','N=n;'));
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
  async function viewport(width, height, motion = 'no-preference') {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await cdp('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: motion}]});
  }
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const W=window.Worker;window.Worker=class extends W{constructor(url,opts){super(url,opts);if(!String(url).includes('loading-living-worker.js'))return;window.__workerStart=performance.now();this.addEventListener('message',e=>{if(e.data.type==='drawn')window.__firstDraw=performance.now()-__workerStart;});}};"});
  const environment={at:new Date().toISOString(),browser:await cdp('Browser.getVersion',{},false),gpu:(await cdp('SystemInfo.getInfo',{},false)).gpu};
  const samples=[];
  for(const[w,h]of [[1600,1000],[390,844]]){
   await viewport(w,h);await cdp('Page.navigate',{url:url+'dev/living-exterior-preview.html'});
   await until("window.loadingExterior3d?.stats.renderer==='webgl-worker'");
   await evaluate('loadingExterior3d.seek(8.05)');await sleep(300);
   await evaluate('loadingExterior3d.play()');await sleep(12500);
   const idle=await evaluate('loadingExterior3d.stats');
   samples.push({size:[w,h],firstDrawMs:await evaluate('__firstDraw'),idle});
  }
  const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))];
  const summary=samples.map(s=>({size:s.size,firstDrawMs:s.firstDrawMs,buildMs:s.idle.drawing.buildMs,triangles:s.idle.drawing.triangles,drawCalls:s.idle.drawing.drawCalls,gpuN:s.idle.drawing.gpuMs.length,gpuMedianMs:quantile(s.idle.drawing.gpuMs,.5),gpuP95Ms:quantile(s.idle.drawing.gpuMs,.95),cpuMedianMs:quantile(s.idle.drawing.cpuMs,.5),cpuP95Ms:quantile(s.idle.drawing.cpuMs,.95),frameMedianMs:quantile(s.idle.drawing.frameGaps,.5),frameP95Ms:quantile(s.idle.drawing.frameGaps,.95)}));
  await writeFile(resolve(output,'performance.json'),JSON.stringify({ref:ref||'working-tree',sourceHash,environment,summary,samples,errors,warnings,conditions:'Headless Chrome ANGLE D3D11; fresh temporary Chrome profile per command, DPR1; 12.5 sec idle after seek(8.05); target idle 30fps. GPU query approximately every 30 drawn frames. Viewport runs sequentially.'},null,2));
  console.log(JSON.stringify({summary,errors,warnings}));assert.equal(errors.length,0);
  await cdp('Browser.close',{},false).catch(()=>{});
}finally{ws?.close();server.close();chrome.kill();await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250}).catch(()=>{});}
