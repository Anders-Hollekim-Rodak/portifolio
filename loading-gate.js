/* Loading gate: everything the scene needs is loaded first, with a bar that
   shows how far it has come (site-ready.js siteProgress); then the scene,
   the building forming and the flight in, with nothing left to load.
   The interior is inert until entry finishes. The exterior never determines
   readiness, and failures/timeouts never expose an unpainted room.
   Existing site-entering / site-unveiling / site-entered events are preserved. */
const gate=document.getElementById('loadingGate'),media=matchMedia('(prefers-reduced-motion: reduce)');
const stats={state:'loading',portal:null,way:null,veiled:true,portalAt:null,readyAt:null,preparedAt:null,loadedAt:null,formationAt:null,unveiledAt:null,enteredAt:null,ready:null,progress:0,frames:[],phases:[]};
let siblings=[],portal=null,canEnter=false,watch,recording=false;
const blockedEvents=['pointerdown','pointerup','pointermove','click','wheel','keydown'];
function blockRoomInput(event){
 if(event.target?.closest?.('.loading-gate__enter'))return;
 event.stopImmediatePropagation();
 if(!(event.type==='keydown'&&event.key==='Tab')&&event.cancelable)event.preventDefault();
}
if(gate)blockedEvents.forEach(type=>addEventListener(type,blockRoomInput,{capture:true,passive:false}));

window.loadingGate={get state(){return stats.state;},get veiled(){return stats.veiled;},get stats(){return{...stats,frames:[...stats.frames],phases:[...stats.phases]};}};
const parsed=()=>document.readyState==='loading'?new Promise(r=>document.addEventListener('readystatechange',r,{once:true})):Promise.resolve();
const painted=()=>!!document.querySelector('#roomShell.is-ready,#roomShell.room-fallback');
async function awaitPaintedRoom(){
 if(!painted())await new Promise(resolve=>{
  const observer=new MutationObserver(()=>{if(painted()){observer.disconnect();resolve();}});
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
 });
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
// The last frames before the scene: two drawn, and the room's GPU work so
// far finished (a fence), so the scene starts on an idle GPU.
async function settle(){
 await frame();await frame();
 const gl=window.studyRoom?.renderer?.getContext?.();
 if(gl?.fenceSync){
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
  for(let i=0;i<120&&gl.clientWaitSync(sync,0,0)===gl.TIMEOUT_EXPIRED;i++)await frame();
  gl.deleteSync(sync);
 }
 await frame();
}
// The room's camera back at its place, the entry, from following the way in.
const home=()=>window.sceneCamera?.setWayIn?.(null);
function unveil(){
 if(!stats.veiled)return;stats.veiled=false;stats.unveiledAt=Math.round(performance.now());dispatchEvent(new Event('site-unveiling'));
}
function open(detail){
 if(!canEnter)return;
 blockedEvents.forEach(type=>removeEventListener(type,blockRoomInput,true));
 unveil();home();stats.exterior=portal?.stats;portal?.dispose();gate?.remove();
 siblings.forEach(([el,inert])=>{el.inert=inert;});
 // The main is statically inert to protect the first parsed frame.
 const experience=document.getElementById('experience');if(experience)experience.inert=false;
 stats.state='entered';stats.enteredAt=Math.round(performance.now());document.documentElement.dataset.siteEntered='yes';
 dispatchEvent(new CustomEvent('site-entered',{detail:{...detail,enteredAt:stats.enteredAt}}));
}
function notePhase(event){
 stats.phases.push({phase:event.detail.phase,at:Math.round(performance.now())});
 if(stats.phases.length>30)stats.phases.shift();
 if(event.detail.phase==='curtains')unveil();
}
if(gate){
 const mount=gate.querySelector('.loading-gate__portal'),status=gate.querySelector('.loading-gate__status'),retry=gate.querySelector('.loading-gate__enter');
 const bar=gate.querySelector('.loading-gate__progress'),fill=gate.querySelector('.loading-gate__fill'),label=gate.querySelector('.loading-gate__label'),percent=gate.querySelector('.loading-gate__percent');
 const retryLoading=()=>location.reload();
 retry?.addEventListener('click',retryLoading);
 const offer=(message='Rommet bruker litt ekstra tid. Du kan vente eller prøve igjen.')=>{
  if(retry){retry.textContent='Prøv igjen';retry.hidden=false;}
  if(status){status.textContent=message;status.classList.add('is-visible');}
 };
 addEventListener('loading-exterior-phase',notePhase);
 // The bar, moved only forward. Through a step that holds the page, its
 // expected length carries the fill on to that step's end on the compositor.
 let target=0,movedAt=performance.now(),loaded=false;
 const paint=({value,label:step,expect})=>{
  const next=Math.max(value,expect?.value??0);
  if(fill&&next>target+1e-4){
   const ahead=expect&&expect.value>value&&expect.value>=next-1e-4;
   fill.style.transition=`transform ${ahead?expect.ms:350}ms ${ahead?'cubic-bezier(.25,.6,.35,1)':'ease-out'}`;
   target=next;fill.style.transform=`scaleX(${target})`;
  }
  if(value>stats.progress){stats.progress=value;movedAt=performance.now();}
  if(loaded)return;
  const shown=Math.floor(value*100);
  if(label)label.textContent=step;
  if(percent)percent.textContent=shown+' %';
  bar?.setAttribute('aria-valuenow',String(shown));
 };
 const unsubscribe=window.siteProgress?.subscribe(paint);
 let detail;
 try{
  // A retry is offered only if the load stops coming along.
  watch=setInterval(()=>{if(!loaded&&performance.now()-movedAt>20000)offer();},1000);
  // The building starts at once, while the page is still being read (its
  // module is preloaded, index.html): waiting for a frame first let the
  // room's long build take every turn of the main thread, and the building
  // began only once the room was done.
  try{
   const module=await import(new URL(mount.dataset.portal,document.baseURI));
   portal=module.createLoadingPortal(mount,{hold:true});
  }catch(error){
   const seed=document.createElement('div');seed.className='loading-living__seed';mount.append(seed);
   stats.portalFailure=error.message;window.siteReadiness?.exteriorStarted?.();
  }
  stats.portal=portal?'loading-portal':'orb';stats.portalAt=Math.round(performance.now());
  const formed=Promise.resolve(portal?.formation).then(()=>{stats.formationAt=Math.round(performance.now());});
  await parsed();
  siblings=[...document.body.children].filter(el=>el!==gate&&el.tagName!=='SCRIPT').map(el=>[el,el.inert]);
  siblings.forEach(([el])=>{el.inert=true;});
  const room=(async()=>{
   if(!window.siteReady)throw Error('The readiness coordinator is unavailable');
   const result=await window.siteReady;
   // siteReady can be degraded by an unrelated error. Still require a drawn room.
   await awaitPaintedRoom();
   stats.ready=result.state;stats.readyAt=Math.round(performance.now());
   return result;
  })();
  // Nearly there: the room and the portal's layers (siteReady), the building
  // made ready in its thread, then the last frames.
  let settled=0;const nearly=()=>window.siteProgress?.set('finish',++settled/3);
  const building=Promise.resolve(portal?.prepared).then(result=>{stats.preparedAt=Math.round(performance.now());nearly();return result;});
  [detail]=await Promise.all([room.then(result=>{nearly();return result;}),building]);
  await settle();nearly();
  loaded=true;clearInterval(watch);unsubscribe?.();
  if(fill){fill.style.transition='transform .3s ease-out';fill.style.transform='scaleX(1)';}
  if(label)label.textContent='Klar';
  if(percent)percent.textContent='100 %';
  bar?.setAttribute('aria-valuenow','100');
  stats.loadedAt=Math.round(performance.now());
  await new Promise(r=>setTimeout(r,350));gate.classList.add('is-loaded');
  // The scene: the building forms, then the way in.
  portal?.start?.();
  await formed;
  canEnter=true;
  retry.hidden=true;status?.classList.remove('is-visible');
  gate.setAttribute('aria-busy','false');gate.classList.add('is-going','is-ready');
  if(status)status.textContent='Rommet er klart. Vi går inn.';
  stats.state='entering';
  dispatchEvent(new CustomEvent('site-entering',{detail}));
  recording=true;
  let previous;
  function sample(now){if(!recording)return;if(previous!==undefined&&stats.frames.length<1500)stats.frames.push(+(now-previous).toFixed(1));previous=now;requestAnimationFrame(sample);}
  requestAnimationFrame(sample);
  const fade=async(duration)=>{unveil();home();await gate.animate([{opacity:1},{opacity:0}],{duration,easing:'ease-in-out',fill:'forwards'}).finished;};
  if(media.matches){
   stats.way='fade';await fade(450);
  }else if(portal?.flies){
   stats.way='flight';
   // The room's camera follows the flight's eye from the landing before the
   // door on (scene-camera.js wayIn): the room is seen through the doorway
   // from where the visitor is, and the walk in ends on the entry's view,
   // kept up to date if the window changes on the way.
   const camera=window.sceneCamera,entryView=()=>camera?.entryView&&{...camera.entryView,fov:camera.fov};
   const reframe=()=>portal.setEntry?.(entryView());
   portal.onView=view=>camera?.setWayIn?.(view);
   // Once the curtains part, the live view draws the void round the building
   // itself, with the doorway clear through it (loading-living-worker.js):
   // the gate's own void and stars give way (loading-exterior.css), and the
   // room behind shows through the doorway. Through it, the gate is
   // transparent (fade).
   portal.onAperture=({fade:amount})=>{
    unveil();gate.classList.add('is-revealing');
    const opacity=amount>0?String(1-amount):'';
    if(gate.style.opacity!==opacity)gate.style.opacity=opacity;
   };
   const change=()=>{if(media.matches){portal.setReducedMotion(true);portal.dispose();}};
   media.addEventListener('change',change);addEventListener('resize',reframe);
   let flown;
   try{flown=await portal.fly({entry:entryView()});}finally{media.removeEventListener('change',change);removeEventListener('resize',reframe);}
   if(!flown||media.matches)await fade(450);
  }else{
   stats.way='fade-fallback';await fade(700);
  }
 }catch(error){
  stats.failure=error?.message||String(error);
  if(canEnter){unveil();home();await gate.animate([{opacity:1},{opacity:0}],{duration:450,fill:'forwards'}).finished;}
  else offer('Rommet kunne ikke klargjøres. Prøv å laste siden på nytt.');
 }finally{
  recording=false;clearInterval(watch);unsubscribe?.();removeEventListener('loading-exterior-phase',notePhase);
  if(canEnter){retry?.removeEventListener('click',retryLoading);open(detail);}
 }
}

