/* Exterior lifecycle bridge. The worker owns formation, geometry and camera.
   No room resources are imported or disposed here. Gate readiness is separate.
   Held ({hold: true}, the loading gate): the building is made ready in its
   thread while the page loads (prepared: its first frame drawn, its shell
   built, every program compiled), unseen behind the seed, and forms only on
   start(). The messages, page to worker: init {hold}, start, fly, entry,
   resize, pause, play, still, seek, seekFlight, rate, snapshot, dispose;
   worker to page: drawn, prepared, phase, formed, stats, view, aperture,
   flown, snapshot, failed, disposed. */
export function createLoadingPortal(container,{reducedMotion,onPhase,hold=false}={}){
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let reduced=reducedMotion??media.matches,worker=null,canvas=null,fallback=null,disposed=false,live=false;
 let formResolve,readyResolve,preparedResolve,flightResolve,observer,startupTimer,killTimer,override=reducedMotion,started=!hold;
 let snapshotResolve=null,drawing=null,phase='core',failed=null,cleanup={worker:false,observer:false,listeners:false};
 const ready=new Promise(r=>readyResolve=r),formation=new Promise(r=>formResolve=r),prepared=new Promise(r=>preparedResolve=r);
 // Shown once it forms: held, the seed stands in until start().
 const show=()=>{if(disposed||!live||!started)return;element.dataset.view='live';element.classList.add('is-live');canvas?.classList.add('is-live');element.querySelector('.loading-living__seed')?.remove();};
 const element=document.createElement('div');
 element.className='loading-exterior loading-living is-shown';element.dataset.view='starting';
 element.dataset.reducedMotion=String(reduced);element.setAttribute('aria-hidden','true');
 element.innerHTML='<div class="loading-living__seed"></div>';
 container.querySelector('.loading-living__seed')?.remove();
 container.append(element);
 const host=container.closest('.loading-gate')||container;
 const emit=(name,detail)=>{onPhase?.(detail);dispatchEvent(new CustomEvent(name,{detail}));};
 const post=data=>worker?.postMessage(data);
 const setPhase=value=>{phase=value.phase;element.dataset.phase=phase;emit('loading-exterior-phase',value);};
 async function fail(reason){
  if(disposed||failed)return;
  failed=String(reason);clearTimeout(startupTimer);worker?.terminate();worker=null;canvas?.remove();canvas=null;live=false;
  element.dataset.view='fallback';
  try{const module=await import('./loading-exterior.js');if(disposed)return;fallback=module.createLoadingPortal(container,{reducedMotion:true});await fallback.ready;}
  catch{ /* The solar core remains if both worker and image delivery fail. */ }
  if(fallback)element.style.display='none';
  readyResolve(false);preparedResolve(false);formResolve({fallback:true});flightResolve?.(false);
  window.siteReadiness?.exteriorStarted?.();
  emit('loading-exterior-fallback',{reason:failed});
 }
 function resize(){
  if(!canvas||disposed)return;const r=canvas.getBoundingClientRect();
  post({type:'resize',width:Math.max(1,r.width),height:Math.max(1,r.height),dpr:devicePixelRatio||1});
 }
 const onMedia=()=>{reduced=override??media.matches;element.dataset.reducedMotion=String(reduced);post({type:'still',value:reduced});if(reduced)formResolve({reduced:true});};
 const onVisibility=()=>post({type:document.hidden?'pause':'play'});
 media.addEventListener('change',onMedia);document.addEventListener('visibilitychange',onVisibility);
 const debug={
  get stats(){return{renderer:live?'webgl-worker':'fallback',drawing,phase,failed,disposed,cleanup:{...cleanup}};},
  setRate:value=>post({type:'rate',value}),seek:value=>post({type:'seek',value}),seekFlight:value=>post({type:'seekFlight',value}),
  snapshot:()=>new Promise(resolve=>{snapshotResolve=resolve;post({type:'snapshot'});}),
  pause:()=>post({type:'pause'}),play:()=>post({type:'play'})
 };
 window.loadingExterior3d=debug;
 const api={
  element,ready,prepared,formation,doorwayGrowth:0,
  // The formation begins (held only; otherwise it began with the first frame).
  start(){if(started)return;started=true;post({type:'start'});show();},
  get flies(){return live;},
  get opening(){const r=container.getBoundingClientRect();return fallback?.opening||{x:r.left+r.width/2,y:r.top+r.height*.6,width:r.width*.13,height:r.height*.22};},
  wake(){return ready;},
  // The flight up to the door and in, ending on the room's entry view
  // ({entry}: scene-camera.js entryView). On the way, onView receives the
  // eye in the room's terms (scene-camera.js wayIn) and onAperture the
  // doorway on screen.
  fly({entry}={}){
   if(!live)return Promise.resolve(false);
   return new Promise(resolve=>{flightResolve=resolve;post({type:'fly',entry});});
  },
  setEntry(entry){post({type:'entry',entry});},
  onView:null,
  onAperture:null,
  setApproach(value){fallback?.setApproach(value);},
  pause(){post({type:'pause'});fallback?.pause();},
  play(){post({type:'play'});fallback?.play();},
  setReducedMotion(value){override=typeof value==='boolean'?value:undefined;onMedia();},
  get stats(){return debug.stats;},
  dispose(){
   if(disposed)return;disposed=true;clearTimeout(startupTimer);
   observer?.disconnect();cleanup.observer=true;
   media.removeEventListener('change',onMedia);document.removeEventListener('visibilitychange',onVisibility);cleanup.listeners=true;
   if(worker){
    post({type:'dispose'});
    // Termination is a bounded backstop if a stalled GPU cannot acknowledge.
    killTimer=setTimeout(()=>{worker?.terminate();worker=null;cleanup.worker=true;},250);
   }else cleanup.worker=true;
   fallback?.dispose();fallback=null;canvas?.remove();canvas=null;element.remove();
   readyResolve(false);preparedResolve(false);formResolve({disposed:true});flightResolve?.(false);api.onAperture=null;api.onView=null;
  }
 };
 try{
  if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||!HTMLCanvasElement.prototype.transferControlToOffscreen)throw Error('OffscreenCanvas is unavailable');
  canvas=document.createElement('canvas');canvas.className='loading-exterior__live loading-living__canvas';canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const r=canvas.getBoundingClientRect(),offscreen=canvas.transferControlToOffscreen();
  worker=new Worker(new URL('./loading-living-worker.js',import.meta.url));
  worker.onmessage=({data})=>{
   if(data.type==='disposed'){clearTimeout(killTimer);worker?.terminate();worker=null;cleanup.worker=true;return;}
   if(disposed)return;
   if(data.type==='drawn'){
    clearTimeout(startupTimer);live=true;show();readyResolve(true);if(!hold)preparedResolve(true);
    // The room builds from here (site-ready.js exterior).
    window.siteReadiness?.exteriorStarted?.();
   }else if(data.type==='prepared'){preparedResolve(true);}
   else if(data.type==='formed'){formResolve(data);}
   else if(data.type==='phase')setPhase(data);
   else if(data.type==='stats')drawing=data;
   else if(data.type==='view')api.onView?.(data.view);
   else if(data.type==='aperture')api.onAperture?.(data);
   else if(data.type==='snapshot'){snapshotResolve?.(data.blob);snapshotResolve=null;}
   else if(data.type==='flown'){flightResolve?.(true);flightResolve=null;}
   else if(data.type==='failed')fail(data.message);
  };
  worker.onerror=event=>{event.preventDefault();fail(event.message||'Worker failed');};
  worker.postMessage({type:'init',canvas:offscreen,width:r.width,height:r.height,dpr:devicePixelRatio||1,reduced,hold},[offscreen]);
  observer=new ResizeObserver(resize);observer.observe(canvas);
  // Given up on only once its messages so far have been read: a page busy
  // building the room may not yet have read a first frame that came in time
  // (the round trip below queues behind them).
  startupTimer=setTimeout(()=>{
   const channel=new MessageChannel();
   channel.port1.onmessage=()=>{channel.port1.close();if(!live)fail('Worker did not produce its first frame within 12 seconds');};
   channel.port2.postMessage(0);
  },12000);
 }catch(error){fail(error.message);}
 return api;
}

