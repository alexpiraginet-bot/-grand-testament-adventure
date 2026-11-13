// Grand Testament Adventure, vertical slice: "Pescadores de gente" (Mark 1:16-20) on the shore of the Sea of Galilee at
// Capernaum. three.js with its WebGPU renderer (WebGPU when the browser has it, WebGL 2 otherwise).
import * as THREE from "three/webgpu";
import episode from "./data/mc-pescadores.json";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "./terrain.ts";
import { boat as makeBoat, castNet, farMesh, groundMesh, loadGroundTextures, loadSkyTextures, houses, props, sky, water } from "./world.ts";
import { missionRoutes, insideObstacle, distanceToSegment, type Obstacle } from './world-layout.ts';
import { goals as makeGoals, npcs as makeNpcs, shoreDir } from "./episode.ts";
import { distanceToGoal, initialState, restoreState, start as startEpisode, step, type EpisodeData, type Event, type Vec2 } from "./missions.ts";
import { episodeProgress, LocalSaveStore, mergeSaves, recordMission, restartEpisode } from "./save.ts";
import { Cloud, NICK_MESSAGE, newCode, syncOnce, type CloudConfig } from "./cloud.ts";
import { setupCloudPanel } from "./cloudui.ts";
import { setupFeedbackPanel } from "./feedbackui.ts";
import { setupWorldMap } from './worldmap.ts';
import './worldmap.css';
import nuvem from "./data/nuvem.json";
import { Input } from "./input.ts";
import { Hud } from "./hud.ts";
import { Sfx } from "./audio.ts";
import {FaunaAudio,type FaunaSoundHabitat} from './fauna-audio.ts';
import {FAUNA_AUDIO_CREDITS,faunaAudioManifest} from './fauna-audio-manifest.ts';
import {FaunaScene} from './fauna-renderer.ts';
import {faunaAssetsManifest} from './fauna-assets-manifest.ts';
import {createFaunaPopulation,type FaunaPopulation} from './fauna-population.ts';
import {stepFauna,type FaunaAgent} from './fauna-simulation.ts';
import { requireHero, characterDiagnostics } from './character-quality.ts';
import { loadTripoAssets, disposeTripoAssets } from './tripo-assets.ts';
import { LoadingScreen, loadingProfile, withDeadline } from './loading.ts';
import { StartupLifecycle } from './startup-lifecycle.ts';
import { abortable } from './asset-loading.ts';

const ep = episode as unknown as EpisodeData & { personagens: { id: string; nome: string }[] };
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
// tests on a software renderer (1-2 fps) let game time follow real time: ?debug&dtmax=0.5
const DT_MAX = DEBUG && params.has("dtmax") ? Number(params.get("dtmax")) : 0.05;
const $ = (id: string) => document.getElementById(id)!;
const touchDevice=matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const startupProfile=loadingProfile(touchDevice,navigator.userAgent,navigator.maxTouchPoints,params);
const loading=new LoadingScreen(startupProfile);
const startup=new StartupLifecycle();
let stopRenderer:()=>void=()=>{};
const failStartup=(error:unknown)=>{
  if(!startup.cancel(error))return;
  stopRenderer();
  loading.fail(error instanceof Error?error.message:'Não foi possível abrir o jogo neste navegador.');
};
const disposeTexture=(texture:THREE.Texture)=>{(texture.image as {close?:()=>void}|undefined)?.close?.();texture.dispose();};
const fetchJSON=async <T>(url:string):Promise<T>=>{
  const request=fetch(url,{signal:startup.signal}).then(r=>{
    if(!r.ok)throw new Error(`Recurso do mundo indisponível (${r.status}).`);
    return r.json() as Promise<T>;
  });
  return withDeadline(abortable(request,startup.signal),20000,'Um recurso do mundo demorou a responder.');
};

async function load() {
  const base = import.meta.env.BASE_URL;
  const [meta, near, far, img] = await Promise.all([
    fetchJSON<WorldMeta & {far:{size:number;n:number}}>(`${base}world/cafarnaum.json`),
    fetchJSON<HeightsFile>(`${base}world/cafarnaum-heights.json`),
    fetchJSON<HeightsFile>(`${base}world/far-heights.json`),
    withDeadline(startup.track(new Promise<HTMLImageElement>((ok,no)=>{
      const i=new Image(),abort=()=>{i.src='';i.onload=i.onerror=null;no(startup.signal.reason);};
      startup.signal.addEventListener('abort',abort,{once:true});
      const clear=()=>startup.signal.removeEventListener('abort',abort);
      i.onload=()=>{clear();ok(i);};i.onerror=()=>{clear();no(new Error('O mapa não pôde ser carregado.'));};
      if(startup.signal.aborted)abort();else i.src=`${base}world/radar.png`;
    }),image=>{image.src='';}),20000,'O mapa demorou a responder.'),
  ]);
  return { meta, terrain: new Terrain(meta, decodeHeights(near)), far: decodeHeights(far), img };
}

async function main() {
  const canvas = $("c") as HTMLCanvasElement;
  const touch = touchDevice;
  // the claude.ai page passes no query string, only a #name: #alta / #baixa choose the quality there, #fps shows the FPS
  const hash = location.hash.slice(1);
  const quality = params.get("q") ?? (hash === "baixa" || startupProfile.compat ? "low" : "high");
  const q = quality === "low" ? 0.55 : 1;

  // WebGPU only on a real adapter; iOS defaults to the bounded WebGL profile.
  // Device/context loss is terminal with an explicit retry, never an automatic reload loop.
  loading.stage('Preparando a imagem');
  let forceWebGL = params.get("gl") === "1" || startupProfile.compat;
  if (!forceWebGL) {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean } } | null> } }).gpu;
    const ad = gpu ? await withDeadline(abortable(gpu.requestAdapter(),startup.signal),8000,'O dispositivo gráfico demorou a responder.').catch(() => null) : null;
    forceWebGL = !ad || !!ad.isFallbackAdapter || !!ad.info?.isFallbackAdapter;
  }
  startup.check();
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: quality !== "low", forceWebGL, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,startupProfile.mobile?1.25:quality === "low" ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let rendererReady=false,rendererDisposed=false;
  stopRenderer=()=>{
    // three's dispose/setAnimationLoop may initialise an uninitialised renderer. Wait for its real init.
    if(!rendererReady||rendererDisposed)return;rendererDisposed=true;
    void renderer.setAnimationLoop(null).then(()=>renderer.dispose()).catch(error=>console.warn('Renderer cleanup failed',error));
  };
  const lost=()=>failStartup(new Error('O navegador interrompeu a imagem. Abra no modo compatível para tentar novamente.'));
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost();});
  const initialising=renderer.init().then(()=>{rendererReady=true;if(startup.signal.aborted)stopRenderer();});
  await withDeadline(abortable(initialising,startup.signal),20000,'Não foi possível iniciar a imagem neste navegador.');
  startup.check();
  loading.complete('renderer','Recebendo o mundo');
  const be = renderer.backend as unknown as { isWebGPUBackend?: boolean; device?: { lost: Promise<unknown> } };
  const backend = be.isWebGPUBackend ? "WebGPU" : "WebGL2";
  be.device?.lost.then(lost);

  const [{ meta, terrain, far, img }, assets, groundTextures, skyTextures] = await Promise.all([
    load().then(value=>{loading.complete('world','Mapa da Galileia preparado');return value;}),
    startup.track(loadTripoAssets({mobile:startupProfile.mobile,onProgress:p=>loading.updateAssets(p),signal:startup.signal}),disposeTripoAssets),
    withDeadline(startup.track(loadGroundTextures(),maps=>Object.values(maps).forEach(disposeTexture)),25000,'As texturas do terreno demoraram a responder.').then(value=>{loading.complete('ground','Terreno preparado');return value;}),
    withDeadline(startup.track(loadSkyTextures(),maps=>Object.values(maps).forEach(disposeTexture)),25000,'O céu demorou a responder.').then(value=>{loading.complete('sky','Iluminação preparada');return value;}),
  ]);
  startup.check();
  const actor=requireHero(assets.heroi);
  if(loading.diagnostics().failed>0)throw new Error('Alguns modelos não chegaram. Confira a conexão e tente novamente.');
  loading.stage('Montando sua jornada');

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(0.45, 0.92, 0.7).normalize();
  scene.add(sky(sunDir,skyTextures.background));
  scene.fog = new THREE.Fog(0x9daab9, 400, 16000);
  // Smaller panorama for reflections; avoid generating an environment from the 4K background.
  scene.environment = skyTextures.environment;
  scene.environmentRotation.y=-.38;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7d6c4f, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(startupProfile.mobile||quality === "low" ? 1024 : 4096,startupProfile.mobile||quality === "low" ? 1024 : 4096);
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const P = meta.points;
  const movementMargin = 60;
  const pt = (p: [number, number]): Vec2 => ({ x: p[0], z: p[1] });
  const keep=missionRoutes(terrain);
  const ground=groundMesh(terrain, quality === "low" ? 192 : 256,keep,groundTextures);
  scene.add(ground);
  const fm = farMesh(far, meta.far.size, meta.far.n); fm.position.y = -0.3; scene.add(fm);
  const lake = water(meta.far.size,terrain); scene.add(lake.mesh);
  const cap = meta.places.find((p) => p.id === "Capernaum") ?? { x: 0, z: 0 };
  const town = houses(terrain, cap.x, cap.z, keep, assets, {
    map:groundTextures.albedo,normalMap:groundTextures.normal,roughnessMap:groundTextures.roughness,
    groundSegments:quality === 'low' ? 192 : 256,
  });
  scene.add(town.group);
  const vegetation=props(terrain,keep,q,assets,town.boxes); scene.add(vegetation);

  // Attach ambience to actual tree positions and the mapped shore, not a global sound bed.
  // props()' first three pools are oliveira-a, oliveira-b and arvore-espinhosa. Read before LOD compaction.
  const treeSpots:{x:number;y:number;z:number}[]=[],treeMatrix=new THREE.Matrix4(),treePoint=new THREE.Vector3();
  for(const pool of vegetation.children.slice(0,3)) {
    const mesh=pool instanceof THREE.InstancedMesh?pool:pool.children.find(child=>child instanceof THREE.InstancedMesh);
    if(!(mesh instanceof THREE.InstancedMesh))continue;
    for(let i=0;i<mesh.count;i++) {mesh.getMatrixAt(i,treeMatrix);treePoint.setFromMatrixPosition(treeMatrix);treeSpots.push({x:treePoint.x,y:treePoint.y+2,z:treePoint.z});}
  }
  const habitats:FaunaSoundHabitat[]=[];
  const nearRoute=(p:{x:number;z:number})=>Math.min(...keep.map(s=>distanceToSegment(p.x,p.z,s)));
  for(const point of treeSpots.sort((a,b)=>nearRoute(a)-nearRoute(b))) {
    if(nearRoute(point)>65||habitats.filter(h=>h.kind==='birds').length>=24)continue;
    if(habitats.some(h=>h.kind==='birds'&&Math.hypot(h.x-point.x,h.z-point.z)<55))continue;
    habitats.push({id:`grove-${habitats.length}`,kind:'birds',...point,radius:48});
  }
  const shoreSpots=meta.shoreline.map(([x,z])=>({x,y:.1,z})).filter(p=>terrain.inside(p.x,p.z)&&nearRoute(p)<45).sort((a,b)=>nearRoute(a)-nearRoute(b));
  for(const point of shoreSpots) {
    if(habitats.filter(h=>h.kind==='lake').length>=24)break;
    if(habitats.some(h=>h.kind==='lake'&&Math.hypot(h.x-point.x,h.z-point.z)<45))continue;
    habitats.push({id:`shore-${habitats.length}`,kind:'lake',...point,radius:40});
  }

  // the boat of Zebedeu, along the shore, and the net of Simão and André in the water
  const theBoat = makeBoat(assets);
  const boatPos = pt(P.barco), shoreB = pt(P.barco_margem);
  theBoat.group.position.set(boatPos.x, 0, boatPos.z);
  const alongShore=shoreDir(meta,boatPos);
  theBoat.group.rotation.y = -Math.atan2(alongShore.z,alongShore.x);
  scene.add(theBoat.group);

  // Participants remain narrative data. No NPC has an approved animated asset yet.
  // The unfinished A-pose candidates are neither instantiated nor used as invisible colliders.
  const names = Object.fromEntries(ep.personagens.map((p) => [p.id, p.nome]));
  const specs = makeNpcs(meta, names);
  const net = castNet(assets);
  {
    const s = specs[0].pos, a = specs[0].facing;
    net.position.set(s.x + Math.sin(a) * 3.2 + (specs[1].pos.x - s.x) / 2, 0.07, s.z - Math.cos(a) * 3.2 + (specs[1].pos.z - s.z) / 2);
    scene.add(net);
  }

  // Preserve the delivered skin, skeleton and shared normalization ancestor.
  const hero = actor;
  const heroSource = 'tripo-r1/hero-native-skeleton';
  scene.add(hero.root);
  const player = { pos: pt(P.start), heading: Math.atan2(P.beach[0] - P.start[0], -(P.beach[1] - P.start[1])), speed: 0 };

  const camera = new THREE.PerspectiveCamera(touch && innerHeight > innerWidth ? 62 : 52, innerWidth / innerHeight, 0.1, 60000);
  const cam = { yaw: player.heading, pitch: 0.2, dist: touch && innerHeight > innerWidth ? 5.2 : 4.4, idle: 0 };

  const input = new Input(canvas, $("joy"), $("knob"), $("act"));
  // Each modal owns its pause reason; closing one must not clear another panel's pause.
  const panelPauses = new Set<'feedback'|'worldmap'>();
  const setPanelPaused = (panel:'feedback'|'worldmap',open:boolean) => {
    if(open)panelPauses.add(panel);else panelPauses.delete(panel);
    input.setSuspended(panelPauses.size>0);
    syncAudio();
  };
  setupFeedbackPanel((open) => setPanelPaused('feedback',open));
  const sfx = new Sfx();
  const hud = new Hud(ep, meta, img, input.touch, keep);
  const goals = makeGoals(meta);
  const state = initialState();
  let ended = false;
  // One graph, created by Go; audio never participates in startup readiness.
  let natureAudio:FaunaAudio|null=null,natureRunning=false;
  let faunaScene:FaunaScene|null=null,faunaPopulation:FaunaPopulation|null=null,faunaAgents:FaunaAgent[]=[];
  let faunaStarted=false,faunaStatus='not-started',faunaError:string|null=null;
  let faunaBlocked:(x:number,z:number)=>boolean=()=>false;
  const AUDIO_KEY='gta:audio-muted';
  let audioMuted=(()=>{try{return localStorage.getItem(AUDIO_KEY)==='1';}catch{return false;}})();
  sfx.setMuted(audioMuted);
  const audioAllowed=()=>!document.hidden&&!startup.signal.aborted&&state.phase!=='intro'&&!panelPauses.size&&
    $('credits').hidden&&$('nuvem').hidden&&$('end').hidden&&!($('feedback') as HTMLDialogElement).open;
  const syncAudio=()=>{
    const allowed=audioAllowed();sfx.setPaused(!allowed);
    const running=allowed&&!audioMuted;
    if(natureAudio&&running!==natureRunning){if(running)natureAudio.resume();else natureAudio.stop();natureRunning=running;}
  };
  const soundButton=document.createElement('button');soundButton.id='soundbtn';soundButton.type='button';soundButton.className='credbtn';
  const updateSoundButton=()=>{
    soundButton.disabled=!sfx.available;
    soundButton.textContent=!sfx.available?'Som indisponível':audioMuted?'Som desligado':'Som ligado';
    soundButton.setAttribute('aria-pressed',String(sfx.available&&!audioMuted));
    soundButton.setAttribute('aria-label',!sfx.available?'Este navegador não oferece áudio para o jogo':audioMuted?'Ativar som do jogo':'Silenciar som do jogo');
  };
  updateSoundButton();$('mapbtn').before(soundButton);
  soundButton.addEventListener('click',()=>{
    audioMuted=!audioMuted;sfx.setMuted(audioMuted);updateSoundButton();
    try{localStorage.setItem(AUDIO_KEY,audioMuted?'1':'0');}catch{/* Preference still works for this page. */}
    if(!audioMuted)sfx.resumeFromGesture();syncAudio();
  });
  const resumeAudioFromGesture=()=>{if(audioAllowed()&&!audioMuted)sfx.resumeFromGesture();};
  addEventListener('pointerdown',resumeAudioFromGesture,{capture:true,passive:true});
  addEventListener('keydown',resumeAudioFromGesture,{capture:true});
  document.addEventListener('visibilitychange',syncAudio);
  addEventListener('pagehide',()=>{natureAudio?.stop();natureRunning=false;sfx.setPaused(true);});
  const audioPanels=new MutationObserver(syncAudio);
  for(const id of ['credits','nuvem','end'])audioPanels.observe($(id),{attributes:true,attributeFilter:['hidden']});
  startup.signal.addEventListener('abort',()=>{
    natureAudio?.dispose();natureRunning=false;sfx.setPaused(true);audioPanels.disconnect();
    faunaScene?.dispose();faunaPopulation?.clear();faunaPopulation=null;faunaAgents=[];faunaBlocked=()=>false;faunaStatus='disposed';
  },{once:true});
  const audioCreditHeading=document.createElement('h4');audioCreditHeading.textContent='Gravações de natureza';
  const audioCredit=document.createElement('p');audioCredit.textContent='Gravações modernas usadas na recriação: ';
  FAUNA_AUDIO_CREDITS.forEach((source,i)=>{if(i)audioCredit.append(', ');const link=document.createElement('a');link.textContent=source.author;link.href=source.url;link.target='_blank';link.rel='noopener';audioCredit.append(link);});
  audioCredit.append(' (Freesound). ');
  const audioLicense=document.createElement('a');audioLicense.href='https://creativecommons.org/publicdomain/zero/1.0/';audioLicense.textContent='CC0 1.0';audioLicense.target='_blank';audioLicense.rel='noopener';audioCredit.append(audioLicense,'. ');
  const audioSources=document.createElement('a');audioSources.href=`${import.meta.env.BASE_URL}audio/fauna/SOURCES.json`;audioSources.textContent='Registro das adaptações';audioSources.target='_blank';audioSources.rel='noopener';audioCredit.append(audioSources);
  $('credbody').append(audioCreditHeading,audioCredit);
  const failFauna=(error:unknown)=>{
    faunaScene?.dispose();faunaPopulation?.clear();faunaPopulation=null;faunaAgents=[];faunaBlocked=()=>false;
    faunaError=String(error);faunaStatus=startup.signal.aborted?'disposed':'unavailable';
    if(!startup.signal.aborted)console.warn('Fauna opcional indisponível; a jornada continua.',error);
  };
  const startFauna=async()=>{
    if(faunaStarted||startup.signal.aborted)return;faunaStarted=true;
    try{
      const manifest=faunaAssetsManifest(startupProfile.mobile,import.meta.env.BASE_URL);
      if(!manifest.length){faunaStatus='no-approved-assets';return;}
      faunaStatus='loading';
      const maxAgents=startupProfile.mobile?24:48;
      const optional=new FaunaScene(manifest,{mobile:startupProfile.mobile,signal:startup.signal,maxAgents,
        animateRadius:45,visibleRadius:90,onError:(kind,error)=>console.warn(`Animal opcional indisponível: ${kind}`,error)});
      faunaScene=optional;scene.add(optional.root);
      await optional.load();
      if(startup.signal.aborted)return;
      const loaded=new Set(optional.diagnostics().loadedKinds),approved=manifest.filter(asset=>loaded.has(asset.kind));
      if(!approved.length){faunaStatus='unavailable';return;}
      // Static obstacle buckets keep each nearby animal query independent of the full town size.
      const cells=new Map<string,Obstacle[]>(),cellSize=32;
      for(const box of town.boxes){
        const radius=Math.hypot(box.hx,box.hz)+.15;
        for(let z=Math.floor((box.z-radius)/cellSize);z<=Math.floor((box.z+radius)/cellSize);z++)
          for(let x=Math.floor((box.x-radius)/cellSize);x<=Math.floor((box.x+radius)/cellSize);x++){
            const id=`${x}:${z}`,items=cells.get(id)??[];items.push(box);cells.set(id,items);
          }
      }
      faunaBlocked=(x,z)=>(cells.get(`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`)??[]).some(box=>insideObstacle(x,z,box,.15));
      // Use the fitted visual footprints, never an older plan or prop collider as a house.
      faunaPopulation=createFaunaPopulation({terrain,routes:keep,buildings:town.plans,
        blocked:faunaBlocked,playableMargin:movementMargin,species:approved.map(asset=>asset.kind),
        bodies:Object.fromEntries(approved.map(asset=>[asset.kind,asset.body])),maxAgents});
      faunaStatus='ready';
    }catch(error){failFauna(error);}
  };
  setupWorldMap({terrain,image:img,episode:ep,routes:keep,goals,buildings:town.boxes,movementMargin,
    player:()=>player,state:()=>state,
    canOpen:()=>!$("hud").hidden && (state.phase==='play'||state.phase==='line') && Boolean($("credits").hidden && $("nuvem").hidden && $("end").hidden),
    onOpenChange:open=>setPanelPaused('worldmap',open),button:$("mapbtn") as HTMLButtonElement});

  let resizeTimer:ReturnType<typeof setTimeout>;
  addEventListener("resize", () => { clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = touch && innerHeight > innerWidth ? 62 : 52;
    camera.updateProjectionMatrix();
  },150); });

  // ---- saved progress (save.ts): this browser's copy, autosaved
  const store = new LocalSaveStore();
  let save = store.load(Date.now());
  let savedAt = { x: player.pos.x, z: player.pos.z }, sinceSave = 0, playedSince = 0;
  const persist = (show: boolean) => {
    if (state.phase === "intro") return;
    const now = Date.now();
    save = { ...save, updatedAt: now, playSeconds: save.playSeconds + playedSince,
      current: state.phase === "done" ? null : { episode: ep.id, mission: state.mission, pos: { ...player.pos }, heading: player.heading } };
    playedSince = 0; sinceSave = 0; savedAt = { ...player.pos };
    if (store.write(save) && show) hud.flashSaved();
    if (show || now - cloudPushedAt > 60_000) pushCloud(false);     // a ticked mission at once; walking, once a minute
  };

  // ---- the cloud copy (cloud.ts): off until src/data/nuvem.json is switched on (tests: ?debug&nuvem=1)
  const cloud = new Cloud({ ...(nuvem as CloudConfig), enabled: (nuvem as CloudConfig).enabled || (DEBUG && params.get("nuvem") === "1") });
  const CODE_KEY = "gta:cloud-code";
  const readCode = () => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };
  const writeCode = (c: string) => { try { localStorage.setItem(CODE_KEY, c); } catch { /* the panel still shows it */ } };
  const NICK_KEY = "gta:nick";
  let nick: string | null = (() => { try { return localStorage.getItem(NICK_KEY); } catch { return null; } })();
  const keepNick = (n: string | null) => { nick = n; try { if (n) localStorage.setItem(NICK_KEY, n); } catch { /* shown this session */ } };
  let cloudPushedAt = 0, cloudState: "off" | "synced" | "offline" = cloud.enabled ? "offline" : "off";
  const pushCloud = (keepalive: boolean) => {
    if (!cloud.enabled) return;
    let code = readCode();
    if (!code) { code = newCode(); writeCode(code); }
    cloudPushedAt = Date.now();
    cloud.put(code, save, keepalive).then(() => { cloudState = "synced"; }, () => { cloudState = "offline"; });
  };
  if (cloud.enabled && readCode()) {
    // meet the cloud copy before the start card, so "Continuar" shows the furthest mission (at most 4 s)
    const r = await Promise.race([syncOnce(save, readCode()!, cloud), new Promise<null>((ok) => setTimeout(() => ok(null), 4000))]);
    if (r) { save = r.save; cloudState = r.status; if (r.status === "synced") { store.write(save); if (r.nick) keepNick(r.nick); } }
  }
  addEventListener("pagehide", () => { persist(false); pushCloud(true); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persist(false); });

  const handle = (evs: Event[]) => {
    for (const e of evs) {
      if (e.type === "mission-start") sfx.thump(e.mission ? 0.28 : 0.55);
      if (e.type === "line") sfx.line();
      if (e.type === "mission-done" && e.mission < ep.missoes.length - 1) sfx.done();
      // Follow events already update narrative state in missions.ts. They create no absent visual actors.
      if (e.type === "mission-done") {
        save = recordMission(save, ep.id, e.mission, ep.missoes.length, Date.now());
        persist(true);
      }
      if (e.type === "episode-done") {
        sfx.finale();
        ended = true;
        save = { ...save, current: null };
        persist(false);
        setTimeout(() => hud.end(state.filled), 1200);
      }
    }
  };

  // the start card: continue a run in progress, or start one (a finished episode starts a new run, keeping its record)
  const total = ep.missoes.length;
  let prog = episodeProgress(save, ep.id);
  let resumable = prog.missionsDone > 0 && prog.missionsDone < total;
  const beginPlay = (resume: boolean) => {
    const graph=sfx.start();
    if(graph&&!natureAudio)natureAudio=new FaunaAudio(graph.context,graph.output,faunaAudioManifest(import.meta.env.BASE_URL),{habitats,maxVoices:3,onError:(id,error)=>console.warn(`Som opcional indisponível: ${id}`,error)});
    hud.show();
    sfx.setPaused(false);
    if (resume) {
      Object.assign(state, restoreState(ep, goals, prog.missionsDone));
      const c = save.current;
      const k = state.mission;
      const checkpoint = k === 0 ? pt(P.start) : goals[k - 1].at;
      const ok = c && c.episode === ep.id && c.mission === k && terrain.inside(c.pos.x, c.pos.z, movementMargin) && !blocked(c.pos.x, c.pos.z);
      player.pos.x = ok ? c.pos.x : checkpoint.x; player.pos.z = ok ? c.pos.z : checkpoint.z;
      player.heading = ok ? c.heading : Math.atan2(goals[k].at.x - player.pos.x, -(goals[k].at.z - player.pos.z));
      cam.yaw = player.heading;
      handle([{ type: "mission-start", mission: k }]);
    } else {
      save = restartEpisode(save, ep.id, Date.now());
      handle(startEpisode(state));
    }
    syncAudio();persist(false);void startFauna();
  };
  const showStartCard = () => {
    prog = episodeProgress(save, ep.id);
    resumable = prog.missionsDone > 0 && prog.missionsDone < total;
    const where = cloudState === "synced" ? "neste aparelho e na nuvem" : "neste aparelho";
    const who = nick ? `Jogando como ${nick}. ` : "";
    const note = store.status === "ok" ? `${who}O progresso fica salvo automaticamente ${where}.`
      : store.status === "newer" ? "Este progresso foi salvo por uma versão mais nova do jogo: atualize a página para continuar."
      : "Este navegador não está deixando salvar (janela anônima?). Dá pra jogar, mas o progresso não fica.";
    if (resumable) hud.startCard({ primary: `Continuar · Missão ${prog.missionsDone + 1} de ${total}`, secondary: "Começar do zero", note });
    else if (prog.completions > 0) hud.startCard({ primary: "Jogar de novo", note: `Episódio concluído ${prog.completions === 1 ? "1 vez" : `${prog.completions} vezes`}. ${note}` });
    else hud.startCard({ primary: "Começar", note });
  };
  // Enable the start button only after the first scene has actually rendered.
  if (cloud.enabled) setupCloudPanel({
    ensureCode: async () => {
      let code = readCode();
      if (!code && Object.keys(save.episodes).length === 0 && !nick) return null;   // nothing to keep yet: no empty row in the cloud
      if (!code) { code = newCode(); writeCode(code); }
      await cloud.put(code, save); cloudState = "synced";
      return code;
    },
    useCode: async (code) => {
      try {
        const remote = await cloud.get(code);
        if (!remote) return "notfound";
        save = mergeSaves(save, remote.save);
        writeCode(code); store.write(save); await cloud.put(code, save); cloudState = "synced";
        keepNick(remote.nick);
        return "ok";
      } catch { return "offline"; }
    },
    onRestored: showStartCard,
    nick: () => nick,
    checkNick: async (n) => { try { return NICK_MESSAGE[await cloud.nickCheck(n)] ?? "Não deu para conferir agora."; } catch { return "Sem conexão agora."; } },
    setNick: async (n) => {
      try {
        let code = readCode();
        if (!code) { code = newCode(); writeCode(code); }
        await cloud.put(code, save);                       // the nickname lives with the save
        const r = await cloud.nickSet(code, n);
        if (r === "ok") { keepNick(n); cloudState = "synced"; }
        return { ok: r === "ok", message: NICK_MESSAGE[r] ?? "Não deu para salvar agora." };
      } catch { return { ok: false, message: "Sem conexão agora. Tente de novo em instantes." }; }
    },
  });
  const go = $("go") as HTMLButtonElement, novo = $("novo") as HTMLButtonElement;
  go.addEventListener("click", () => beginPlay(resumable));
  // starting over erases a run in progress: the button asks once more, in place
  let armed: ReturnType<typeof setTimeout> | undefined;
  novo.addEventListener("click", () => {
    if (!armed) {
      novo.textContent = "Apagar a missão em andamento? Toque de novo"; novo.classList.add("armed");
      armed = setTimeout(() => { armed = undefined; novo.textContent = "Começar do zero"; novo.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(armed); beginPlay(false);
  });
  ($("again") as HTMLButtonElement).addEventListener("click", () => location.reload());

  // ---- movement
  const blocked = (x: number, z: number) => {
    if (!terrain.inside(x, z, movementMargin)) return true;
    if (terrain.heightAt(x, z) < -0.55) return true;                       // no swimming: wading only
    for (const b of town.boxes) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hx + 0.3 && Math.abs(lz) < b.hz + 0.3) return true;
    }
    return false;
  };

  const tmp = new THREE.Vector3();
  let last = performance.now(), fpsFrames = 0, fpsT = 0;
  const fpsLog: number[] = [];
  const fpsEl = $("fps");
  if (DEBUG || params.has("fps") || hash === "fps") fpsEl.hidden = false;
  let t = 0;

  const waitingToStart=()=>state.phase==='intro';
  const frame = () => {
    syncAudio();
    if(startup.signal.aborted)return;
    if(document.hidden || waitingToStart()){last=performance.now();return;}
    const now = performance.now();
    const real = (now - last) / 1000; last = now;
    const paused = panelPauses.size>0;
    const dt = paused ? 0 : Math.min(DT_MAX, real); t += dt;  // modal panels pause mission time as well as controls
    fpsFrames++; fpsT += real;                           // the FPS counter uses real time
    if (fpsT >= 1) { fpsLog.push(fpsFrames / fpsT); if (fpsLog.length > 120) fpsLog.shift(); fpsEl.textContent = `${backend}\n${(fpsFrames / fpsT).toFixed(0)} fps`; fpsFrames = 0; fpsT = 0; }

    input.poll();
    const look = input.takeLook();
    const playing = !paused && (state.phase === "play" || state.phase === "line");
    if (playing || ended) {
      cam.yaw += look.dx * 0.0042;
      cam.pitch = Math.max(-0.25, Math.min(0.85, cam.pitch + look.dy * 0.003));
    }
    if (look.dx || look.dy) cam.idle = 0; else cam.idle += dt;

    // walk relative to the camera
    let mv = 0;
    const previousX = player.pos.x, previousZ = player.pos.z;
    if (playing && !ended) {
      const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const dx = fx * input.move.y + Math.cos(cam.yaw) * input.move.x, dz = fz * input.move.y + Math.sin(cam.yaw) * input.move.x;
      const l = Math.hypot(dx, dz);
      if (l > 0.08) {
        const target = Math.atan2(dx, -dz);
        let d = target - player.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        player.heading += d * Math.min(1, dt * 10);
        const sp = (input.run ? 5.2 : 2.5) * Math.min(1, l);
        const wade = terrain.heightAt(player.pos.x, player.pos.z) < 0 ? 0.55 : 1;
        const nx = player.pos.x + (dx / l) * sp * wade * dt, nz = player.pos.z + (dz / l) * sp * wade * dt;
        if (!blocked(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
        else if (!blocked(nx, player.pos.z)) player.pos.x = nx;
        else if (!blocked(player.pos.x, nz)) player.pos.z = nz;
        mv = sp * wade;
        // the camera drifts back behind him while he walks, as in the reels
        if (cam.idle > 1.2) { let e = player.heading - cam.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); cam.yaw += e * Math.min(1, dt * 1.6); }
      }
    }
    // Colliding with a wall must stop the walk cycle instead of walking in place.
    mv = dt>0 ? Math.hypot(player.pos.x-previousX,player.pos.z-previousZ)/dt : 0;
    player.speed = mv;
    if (playing && state.phase === 'line' && mv < .06) {
      const target = state.mission === 2 ? pt(P.barco) : goals[state.mission].at;
      const dx=target.x-player.pos.x,dz=target.z-player.pos.z;
      if(Math.hypot(dx,dz)>.1){const delta=Math.atan2(dx,-dz)-player.heading;player.heading+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*7);}
    }
    const gy = terrain.heightAt(player.pos.x, player.pos.z);
    hero.root.position.set(player.pos.x, Math.max(gy, -0.6), player.pos.z);
    hero.root.rotation.y = -player.heading;
    actor.update(mv,dt,state.phase==='line' && state.line?.ref==='Marcos 1:17');

    // mission logic
    if (!paused && state.phase !== "intro") handle(step(state, ep, goals, { pos: player.pos, groundHeight: gy, action: input.takeAction() }, dt));
    else input.takeAction();
    // autosave every 15 s of play when he has moved (silent; ticked missions save at once, with the pill)
    if (!paused && (state.phase === "play" || state.phase === "line")) {
      playedSince += real; sinceSave += dt;
      if (sinceSave > 15 && Math.hypot(player.pos.x - savedAt.x, player.pos.z - savedAt.z) > 3) persist(false);
    }

    // The boat remains scenery while its human encounter visuals are in development.
    const bob = Math.sin(t * 1.1) * 0.05;
    theBoat.group.position.y = bob;
    theBoat.group.rotation.z = Math.sin(t * 0.9) * 0.015;
    lake.update(t);

    // camera behind and above his shoulders, kept above the ground
    const cd = cam.dist, cp = cam.pitch;
    const head = new THREE.Vector3(player.pos.x, hero.root.position.y + 1.55, player.pos.z);
    tmp.set(head.x - Math.sin(cam.yaw) * Math.cos(cp) * cd, head.y + Math.sin(cp) * cd, head.z + Math.cos(cam.yaw) * Math.cos(cp) * cd);
    const floor = Math.max(terrain.heightAt(tmp.x, tmp.z), 0) + 0.4;
    if (tmp.y < floor) tmp.y = floor;
    if (state.phase === "intro") {
      // the start card: a slow turn around him
      const a = t * 0.12 + player.heading + Math.PI * 0.85;
      tmp.set(player.pos.x - Math.sin(a) * 7, head.y + 1.6, player.pos.z + Math.cos(a) * 7);
    }
    // Narrow lanes need camera obstruction, otherwise orbiting places the viewer inside a wall.
    const cameraDistance=head.distanceTo(tmp);
    for(let d=.25;d<cameraDistance;d+=.18){
      const f=d/cameraDistance,x=head.x+(tmp.x-head.x)*f,y=head.y+(tmp.y-head.y)*f,z=head.z+(tmp.z-head.z)*f;
      if(town.boxes.some(b=>y>(b.bottom??-Infinity)&&y<(b.top??Infinity)+.15&&insideObstacle(x,z,b,.18))){
        tmp.lerpVectors(head,tmp,Math.max(.12,d-.23)/cameraDistance);break;
      }
    }
    camera.position.copy(tmp);
    camera.lookAt(head.x, head.y + 0.15, head.z);
    // Animal downloads do not gate Go. Empty/pending catalogues never generate a population.
    // Muting audio does not freeze animals; menus/visibility use the same independent pause gate.
    if(faunaPopulation&&faunaScene&&audioAllowed()){
      try{
        const view=faunaPopulation.update(player.pos);
        if(view.agents!==faunaAgents){faunaAgents=view.agents;faunaScene.sync(faunaAgents);}
        stepFauna(faunaAgents,faunaPopulation.habitatTerrain,faunaBlocked,player.pos,dt,{activeRadius:45});
        faunaScene.update(dt,player.pos);
      }catch(error){failFauna(error);}
    }
    if(natureRunning)natureAudio?.update(dt,{x:player.pos.x,y:hero.root.position.y+1.55,z:player.pos.z,yaw:cam.yaw},faunaScene?.visibleApprovedAgents()??[]);
    sun.position.set(player.pos.x + sunDir.x * 120, hero.root.position.y + sunDir.y * 120, player.pos.z + sunDir.z * 120);
    sun.target.position.set(player.pos.x, hero.root.position.y, player.pos.z);

    if (state.phase !== "intro") {
      const g = state.phase === "done" ? null : goals[state.mission].at;
      // The counter records the passage; radar marks require actual approved scene actors.
      hud.update(state, player.pos, player.heading, g, distanceToGoal(state, goals, player.pos), [], input.touch, dt);
    }
    vegetation.userData.update(player.pos.x,player.pos.z);
    renderer.info.reset();
    renderer.render(scene, camera);
  };
  hero.root.position.set(player.pos.x,terrain.heightAt(player.pos.x,player.pos.z),player.pos.z);
  camera.position.set(player.pos.x,hero.root.position.y+3,player.pos.z+5);
  camera.lookAt(player.pos.x,hero.root.position.y+1.5,player.pos.z);
  vegetation.userData.update(player.pos.x,player.pos.z);
  loading.complete('scene','Preparando luz e materiais');
  startup.check();
  await withDeadline(abortable(renderer.compileAsync(scene,camera),startup.signal),45000,'A preparação da imagem demorou. Experimente o modo compatível.');
  startup.check();
  await withDeadline(abortable(renderer.renderAsync(scene,camera),startup.signal),20000,'O primeiro quadro não ficou pronto. Experimente o modo compatível.');
  startup.check();
  loading.complete('frame','Imagem pronta');
  if(!loading.ready())throw new Error('A inicialização foi interrompida.');
  showStartCard();
  await renderer.setAnimationLoop(frame);
  startup.check();

  if (DEBUG) {
    (window as unknown as Record<string, unknown>).__gta = {
      backend, state, player, meta, goals, fpsLog, cam, heroSource,
      actor: () => actor.diagnostics(),
      characters:()=>({...characterDiagnostics(scene),npcVisuals:'pending',npcColliders:[],radarFollowers:[]}),
      audio:()=>({...sfx.stats,nature:natureAudio?.stats??null,habitats,visibleAnimalEmitters:faunaScene?.visibleApprovedAgents().filter(a=>a.kind!=='fish').length??0}),
      fauna:()=>({status:faunaStatus,error:faunaError,profile:startupProfile.mobile?'mobile':'desktop',
        renderer:faunaScene?.diagnostics()??null,population:faunaPopulation?.diagnostics()??null,
        visible:faunaScene?.visibleApprovedAgents().map(a=>({id:a.id,kind:a.kind,x:a.x,y:a.y,z:a.z,speed:a.speed,
          heading:a.heading,scale:a.scale,radius:a.radius,halfHeight:a.halfHeight,groundHeight:terrain.heightAt(a.x,a.z),blockedStatic:faunaBlocked(a.x,a.z)}))??[]}),
      assets: Object.keys(assets),
      world: {...town.group.userData.counts,...vegetation.userData.counts},
      worldQuality:()=>({houses:town.diagnostics,ground:(ground.material as THREE.Material).userData.groundSurface}),
      routes:keep,
      blocked,
      quality,
      loading:()=>({...loading.diagnostics(),assetProfiles:Object.entries(assets).map(([id,asset])=>({id,...asset?.userData?.loadingProfile})),maxTextureDimension:Math.max(0,...Object.values(assets).flatMap(asset=>(asset?.userData?.loadingProfile?.images??[]).flatMap((i:{width:number;height:number})=>[i.width,i.height])))}),
      start: () => beginPlay(resumable), save: () => save, persist: () => persist(false), cloudState: () => cloudState,
      act: () => input.queueAction(),
      teleport: (x: number, z: number, heading?: number) => {
        player.pos.x = x; player.pos.z = z;
        if (heading !== undefined) { player.heading = heading; cam.yaw = heading; }
      },
      followers: () => [],
      npcPositions: () => [],
      narrativeFollowers: () => [...state.followers],
      narrativeLocations: () => specs.map(spec=>({id:spec.id,pos:{...spec.pos},inBoat:spec.inBoat})),
      info: () => ({ calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, textureBytes: renderer.info.memory.texturesSize }),
    };
  }
}

main().catch((e) => {
  console.error(e);
  failStartup(e);
});
