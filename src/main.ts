// Grand Testament Adventure, vertical slice: "Pescadores de gente" (Mark 1:16-20) on the shore of the Sea of Galilee at
// Capernaum. three.js with its WebGPU renderer (WebGPU when the browser has it, WebGL 2 otherwise).
import * as THREE from "three/webgpu";
import episode from "./data/mc-pescadores.json";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "./terrain.ts";
import { boat as makeBoat, castNet, farMesh, groundMesh, loadGroundTextures, loadSkyTextures, houses, props, sky, water } from "./world.ts";
import { missionRoutes, insideObstacle } from './world-layout.ts';
import { animate, makePerson, PALETTES, type Person } from "./people.ts";
import { goals as makeGoals, npcs as makeNpcs, shoreDir, type NpcSpec } from "./episode.ts";
import { distanceToGoal, initialState, restoreState, start as startEpisode, step, type EpisodeData, type Event, type Vec2 } from "./missions.ts";
import { episodeProgress, LocalSaveStore, mergeSaves, recordMission, restartEpisode } from "./save.ts";
import { Cloud, NICK_MESSAGE, newCode, syncOnce, type CloudConfig } from "./cloud.ts";
import { setupCloudPanel } from "./cloudui.ts";
import { setupFeedbackPanel } from "./feedbackui.ts";
import nuvem from "./data/nuvem.json";
import { Input } from "./input.ts";
import { Hud } from "./hud.ts";
import { Sfx } from "./audio.ts";
import { animatedActor } from './animated-actor.ts';
import { loadTripoAssets } from './tripo-assets.ts';
import { BenchRun, benchShots } from "./bench.ts";
import { createPostFx, parseAo, parseFx } from "./postfx.ts";
import { CAM_SPRING, parseCam, snap3, spring3, stepBoom, stepSpring3 } from "./camera.ts";
import { atmosphereFog, cascadedShadows, parseAtmo, parseExposure, parseShadow, parseTone, TONE_MAPPING } from "./look.ts";
import { ease, twoShot, type CineShot } from "./cinematic.ts";
import { BUILD_SHA, describeGpu } from "./build-info.ts";
import { installSessionLog } from "./session-log.ts";
import { memorySummary, renderTargetBytes } from "./bench.ts";
import { sceneTextures } from "./scene-memory.ts";

const ep = episode as unknown as EpisodeData & { personagens: { id: string; nome: string }[] };
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
// tests on a software renderer (1-2 fps) let game time follow real time: ?debug&dtmax=0.5
const DT_MAX = DEBUG && params.has("dtmax") ? Number(params.get("dtmax")) : 0.05;
const $ = (id: string) => document.getElementById(id)!;

async function load() {
  const base = import.meta.env.BASE_URL;
  const [meta, near, far, img] = await Promise.all([
    fetch(`${base}world/cafarnaum.json`).then((r) => r.json() as Promise<WorldMeta & { far: { size: number; n: number } }>),
    fetch(`${base}world/cafarnaum-heights.json`).then((r) => r.json() as Promise<HeightsFile>),
    fetch(`${base}world/far-heights.json`).then((r) => r.json() as Promise<HeightsFile>),
    new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `${base}world/radar.png`; }),
  ]);
  return { meta, terrain: new Terrain(meta, decodeHeights(near)), far: decodeHeights(far), img };
}

async function main() {
  // the session diary (session-log.ts): errors, device/context loss and unclean ends, kept in this tab only
  const slog = installSessionLog(window);
  if (slog.previous?.uncleanEnd) console.warn("Sessão anterior desta aba terminou sem fechamento limpo (recarga ou queda).");
  const canvas = $("c") as HTMLCanvasElement;
  canvas.addEventListener("webglcontextlost", () => slog.mark("context-lost", "webglcontextlost"));
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  // the claude.ai page passes no query string, only a #name: #alta / #baixa choose the quality there, #fps shows the FPS
  const hash = location.hash.slice(1);
  const quality = params.get("q") ?? (hash === "baixa" ? "low" : "high");
  const q = quality === "low" ? 0.55 : 1;
  // ?fx=alto|master: post-processing under measurement (postfx.ts); without it the game renders exactly as before
  const fxLevel = parseFx(params.get("fx"));
  // ?tm= ?exp= ?atmo=1 ?shadow=csm: look options under measurement (look.ts); without them, the shipped render
  const visual = { tone: parseTone(params.get("tm")), exposure: parseExposure(params.get("exp")),
    atmo: parseAtmo(params.get("atmo")), shadow: parseShadow(params.get("shadow")) };

  // WebGPU only on a real adapter: a software ("fallback") one, or none, goes to WebGL 2. If the WebGPU device is lost
  // later (it happened with the software adapter of the test browser), the page reloads on WebGL 2.
  let forceWebGL = params.get("gl") === "1";
  type AdapterInfo = { isFallbackAdapter?: boolean; vendor?: string; architecture?: string; device?: string; description?: string };
  let adapterInfo: AdapterInfo | null = null;            // names the GPU in bench reports (build-info.ts)
  if (!forceWebGL) {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ isFallbackAdapter?: boolean; info?: AdapterInfo } | null> } }).gpu;
    const ad = gpu ? await gpu.requestAdapter().catch(() => null) : null;
    adapterInfo = ad?.info ?? null;
    forceWebGL = !ad || !!ad.isFallbackAdapter || !!ad.info?.isFallbackAdapter;
  }
  // GPU timestamps only while benchmarking (bench.ts): they cost queries every frame
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: quality !== "low" && fxLevel === "off", forceWebGL, logarithmicDepthBuffer: true,
    trackTimestamp: params.has("bench") });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "low" ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = TONE_MAPPING[visual.tone];
  renderer.toneMappingExposure = visual.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  const be = renderer.backend as unknown as { isWebGPUBackend?: boolean; device?: { lost: Promise<unknown> } };
  const backend = be.isWebGPUBackend ? "WebGPU" : "WebGL2";
  const gl = (renderer.backend as unknown as { gl?: WebGL2RenderingContext | null }).gl ?? null;
  const glInfo = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpuName = describeGpu({ webgpu: be.isWebGPUBackend ? adapterInfo : null,
    webglRenderer: gl && glInfo ? String(gl.getParameter(glInfo.UNMASKED_RENDERER_WEBGL)) : null });
  slog.setBackend(backend);
  be.device?.lost.then((info) => {
    slog.mark("device-lost", (info as { message?: string } | undefined)?.message ?? "device lost");
    const u = new URL(location.href); u.searchParams.set("gl", "1"); location.replace(u);
  });

  const [{ meta, terrain, far, img }, assets, groundTextures, skyTextures] = await Promise.all([load(), loadTripoAssets(),loadGroundTextures(),loadSkyTextures()]);

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(0.45, 0.92, 0.7).normalize();
  scene.add(sky(sunDir,skyTextures.background));
  if (visual.atmo) scene.fogNode = atmosphereFog(sunDir);    // replaces the linear fog below (NodeManager reads fogNode first)
  else scene.fog = new THREE.Fog(0x9daab9, 400, 16000);
  // Smaller panorama for reflections; avoid generating an environment from the 4K background.
  scene.environment = skyTextures.environment;
  scene.environmentRotation.y=-.38;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7d6c4f, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.castShadow = true;
  // three cascades each clone this shadow, so ?shadow=csm keeps their total near the single box's (3 x 2048² vs 4096²)
  const shadowSize = visual.shadow === "csm" ? (quality === "low" || touch ? 1024 : 2048) : quality === "low" ? 1024 : touch ? 2048 : 4096;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  if (visual.shadow === "csm") cascadedShadows(sun);

  const P = meta.points;
  const pt = (p: [number, number]): Vec2 => ({ x: p[0], z: p[1] });
  const keep=missionRoutes(terrain);
  scene.add(groundMesh(terrain, quality === "low" ? 192 : 256,keep,groundTextures));
  const fm = farMesh(far, meta.far.size, meta.far.n); fm.position.y = -0.3; scene.add(fm);
  const lake = water(meta.far.size,terrain); scene.add(lake.mesh);
  const cap = meta.places.find((p) => p.id === "Capernaum") ?? { x: 0, z: 0 };
  const town = houses(terrain, cap.x, cap.z, keep, assets);
  scene.add(town.group);
  const vegetation=props(terrain,keep,q,assets,town.boxes); scene.add(vegetation);

  // the boat of Zebedeu, along the shore, and the net of Simão and André in the water
  const theBoat = makeBoat(assets);
  const boatPos = pt(P.barco), shoreB = pt(P.barco_margem);
  theBoat.group.position.set(boatPos.x, 0, boatPos.z);
  const alongShore=shoreDir(meta,boatPos);
  theBoat.group.rotation.y = -Math.atan2(alongShore.z,alongShore.x);
  scene.add(theBoat.group);

  // people
  const names = Object.fromEntries(ep.personagens.map((p) => [p.id, p.nome]));
  const specs = makeNpcs(meta, names);
  type Npc = { spec: NpcSpec; person: Person; pos: Vec2; facing: number; following: number; speed: number; inBoat: boolean; y: number };
  const npcList: Npc[] = specs.map((s) => {
    const person = makePerson(PALETTES[s.look]);
    person.pose = s.pose;
    scene.add(person.root);
    return { spec: s, person, pos: { ...s.pos }, facing: s.facing, following: -1, speed: 0, inBoat: s.inBoat, y: 0 };
  });
  const net = castNet(assets);
  {
    const s = npcList[0].pos, a = npcList[0].facing;
    net.position.set(s.x + Math.sin(a) * 3.2 + (npcList[1].pos.x - s.x) / 2, 0.07, s.z - Math.cos(a) * 3.2 + (npcList[1].pos.z - s.z) / 2);
    scene.add(net);
  }

  // Preserve the delivered skin, skeleton and shared normalization ancestor.
  let actor: ReturnType<typeof animatedActor> | undefined;
  if (assets.heroi) { try { actor = animatedActor(assets.heroi.scene, assets.heroi.animations); } catch(e) { console.warn(e); } }
  const fallback = actor ? undefined : makePerson(PALETTES.heroi);
  const hero = actor ?? fallback!;
  const heroSource = actor ? 'tripo-r1/hero-native-skeleton' : 'formas';
  scene.add(hero.root);
  const player = { pos: pt(P.start), heading: Math.atan2(P.beach[0] - P.start[0], -(P.beach[1] - P.start[1])), speed: 0 };

  const camera = new THREE.PerspectiveCamera(touch && innerHeight > innerWidth ? 62 : 52, innerWidth / innerHeight, 0.1, 60000);
  const cam = { yaw: player.heading, pitch: 0.2, dist: touch && innerHeight > innerWidth ? 5.2 : 4.4, idle: 0 };
  // ?cam=mola: the head the camera looks at trails him on a spring, and the camera eases back out after a wall (camera.ts)
  const camMode = parseCam(params.get("cam"));
  const pivot = spring3(player.pos.x, 0, player.pos.z), boom = { x: cam.dist, v: 0 };

  const input = new Input(canvas, $("joy"), $("knob"), $("act"));
  const feedback = setupFeedbackPanel((open) => input.setSuspended(open));
  const sfx = new Sfx();
  const hud = new Hud(ep, meta, img, input.touch, keep);
  const goals = makeGoals(meta);
  const state = initialState();
  let ended = false;

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = touch && innerHeight > innerWidth ? 62 : 52;
    camera.updateProjectionMatrix();
  });

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

  /** Those called so far walk with him (Mark 1:18, 1:20); `near` puts them beside him at once (a resumed game). */
  const follow = (ids: string[], near = false) => {
    const already = npcList.filter((n) => n.following >= 0).length;
    ids.forEach((id, i) => {
      const n = npcList.find((x) => x.spec.id === id)!;
      n.following = already + i;
      n.person.pose = "stand";
      n.inBoat = false;
      if (near) { n.pos.x = player.pos.x + (i % 2 ? 1.6 : -1.6); n.pos.z = player.pos.z + 1.5 + already; n.y = terrain.heightAt(n.pos.x, n.pos.z); }
    });
  };

  const handle = (evs: Event[]) => {
    for (const e of evs) {
      if (e.type === "mission-start") sfx.thump(e.mission ? 0.28 : 0.55);
      if (e.type === "line") sfx.line();
      if (e.type === "mission-done" && e.mission < ep.missoes.length - 1) sfx.done();
      if (e.type === "follow") follow(e.npcs);
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
    sfx.start();
    hud.show();
    if (resume) {
      Object.assign(state, restoreState(ep, goals, prog.missionsDone));
      const c = save.current;
      const k = state.mission;
      const checkpoint = k === 0 ? pt(P.start) : goals[k - 1].at;
      const ok = c && c.episode === ep.id && c.mission === k && terrain.inside(c.pos.x, c.pos.z, 60) && !blocked(c.pos.x, c.pos.z);
      player.pos.x = ok ? c.pos.x : checkpoint.x; player.pos.z = ok ? c.pos.z : checkpoint.z;
      player.heading = ok ? c.heading : Math.atan2(goals[k].at.x - player.pos.x, -(goals[k].at.z - player.pos.z));
      cam.yaw = player.heading;
      follow(state.followers, true);
      handle([{ type: "mission-start", mission: k }]);
    } else {
      save = restartEpisode(save, ep.id, Date.now());
      handle(startEpisode(state));
    }
    persist(false);
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
  showStartCard();
  // ---- same-scene benchmark (bench.ts, tools/bench.mjs): ?bench flies the fixed shots, no HUD, and times every frame
  const num = (k: string, d: number) => { const v = Number(params.get(k)); return Number.isInteger(v) && v > 0 ? v : d; };
  const bench = params.has("bench") ? new BenchRun(benchShots(P, (x, z) => terrain.heightAt(x, z)), num("warmup", 30), num("frames", 180)) : null;
  // GPU time per frame from the renderer's timestamp queries, one resolve in flight at a time (a sample may lag a frame)
  const gpuTimer = backend === "WebGPU" ? renderer.hasFeature("timestamp-query")
    : !!(renderer.backend as unknown as { disjoint?: unknown }).disjoint;
  if (bench && !gpuTimer) bench.gpuUnavailable = backend === "WebGPU" ? "sem timestamp-query neste adaptador" : "sem EXT_disjoint_timer_query_webgl2";
  let gpuPending = false, gpuLast: number | null = null, lastShotName = "";
  let benchLoadMs = NaN, benchHold = -1;             // after the timed route, hold(i) re-shows a shot for its picture
  if (bench) $("start").hidden = true;
  const fx = createPostFx(renderer, scene, camera, fxLevel, parseAo(params.get("ao")));
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
  const blocked = (x: number, z: number, includePeople = true) => {
    if (!terrain.inside(x, z, 60)) return true;
    if (terrain.heightAt(x, z) < -0.55) return true;                       // no swimming: wading only
    for (const b of town.boxes) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hx + 0.3 && Math.abs(lz) < b.hz + 0.3) return true;
    }
    if(includePeople) for (const n of npcList) if (n.following < 0 && !n.inBoat && Math.hypot(x - n.pos.x, z - n.pos.z) < 0.6) return true;
    return false;
  };

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  // the story's two-shots (cinematic.ts): chosen when a line starts, blended in and out; cameraSolid matches the
  // obstruction test the follow camera already uses for houses and walls
  const cine: { shot: CineShot | null; k: number; left: boolean; why: string; ids: string[]; aim: THREE.Vector3 } =
    { shot: null, k: 0, left: false, why: "", ids: [], aim: new THREE.Vector3() };
  // the people in the shot right now: the hero and those called in this line (they start walking to him at once)
  const cineSubjects = () => [player.pos, ...npcList.filter((n) => cine.ids.includes(n.spec.id)).map((n) => n.pos)];
  const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hudEl = $("hud");
  const cameraSolid = (x: number, y: number, z: number) =>
    town.boxes.some((b) => y > (b.bottom ?? -Infinity) && y < (b.top ?? Infinity) + 0.15 && insideObstacle(x, z, b, 0.25));
  let last = performance.now(), fpsFrames = 0, fpsT = 0;
  const fpsLog: number[] = [];
  const fpsEl = $("fps");
  if (DEBUG || params.has("fps") || hash === "fps") fpsEl.hidden = false;
  let t = 0;
  let frozen = false;                                    // ?debug only (__gta.freeze): the story's clock held; camera and controls run

  const frame = () => {
    const now = performance.now();
    const real = (now - last) / 1000; last = now;
    const paused = feedback.isOpen();
    const dt = paused ? 0 : Math.min(DT_MAX, real); t += dt;  // feedback pauses mission time as well as controls
    const shot = bench ? bench.shot ?? bench.shots[benchHold] ?? null : null;
    if (shot) {
      // stand him 4.5 m ahead of the shot's eye, facing its way, so shadows and vegetation detail follow as in play
      const dx = shot.target[0] - shot.eye[0], dz = shot.target[2] - shot.eye[2], l = Math.hypot(dx, dz) || 1;
      player.pos.x = shot.eye[0] + (dx / l) * 4.5; player.pos.z = shot.eye[2] + (dz / l) * 4.5;
      player.heading = Math.atan2(dx, -dz);
    }
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
    const gy = terrain.heightAt(player.pos.x, player.pos.z);
    hero.root.position.set(player.pos.x, Math.max(gy, -0.6), player.pos.z);
    hero.root.rotation.y = -player.heading;
    if (actor) actor.update(mv,dt); else animate(fallback!, mv, dt, t);

    // mission logic
    if (!paused && !frozen && state.phase !== "intro") handle(step(state, ep, goals, { pos: player.pos, groundHeight: gy, action: input.takeAction() }, dt));
    else input.takeAction();
    // autosave every 15 s of play when he has moved (silent; ticked missions save at once, with the pill)
    if (!paused && (state.phase === "play" || state.phase === "line")) {
      playedSince += real; sinceSave += dt;
      if (sinceSave > 15 && Math.hypot(player.pos.x - savedAt.x, player.pos.z - savedAt.z) > 3) persist(false);
    }

    // people: the boat bobs; followers walk behind him
    const bob = Math.sin(t * 1.1) * 0.05;
    theBoat.group.position.y = bob;
    theBoat.group.rotation.z = Math.sin(t * 0.9) * 0.015;
    const fwd = { x: Math.sin(player.heading), z: -Math.cos(player.heading) };
    for (const n of npcList) {
      let sp = 0;
      if (n.following >= 0) {
        const row = Math.floor(n.following / 2), side = n.following % 2 ? 1 : -1;
        const back = 1.3 + row * 1.6, wide = 1.7 + row * 0.5;      // flanking him, not between him and the camera
        const tx = player.pos.x - fwd.x * back + fwd.z * side * wide, tz = player.pos.z - fwd.z * back - fwd.x * side * wide;
        const dx = tx - n.pos.x, dz = tz - n.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.25) {
          sp = Math.min(d * 1.6, Math.max(2.4, player.speed * 1.15));
          const k = Math.min(1, (sp * dt) / d);
          n.pos.x += dx * k; n.pos.z += dz * k;
          const want = Math.atan2(dx, -dz); let e = want - n.facing; e = Math.atan2(Math.sin(e), Math.cos(e)); n.facing += e * Math.min(1, dt * 6);
        }
      }
      const ground = terrain.heightAt(n.pos.x, n.pos.z);
      const y = n.inBoat ? bob + theBoat.deck : Math.max(ground, -0.6);
      n.y += (y - n.y) * Math.min(1, dt * 8);
      if (Math.abs(n.y - y) > 2) n.y = y;
      n.person.root.position.set(n.pos.x, n.y, n.pos.z);
      n.person.root.rotation.y = -n.facing;
      animate(n.person, sp, dt, t + n.spec.id.length);
    }
    lake.update(t);

    // camera behind and above his shoulders, kept above the ground
    const cd = cam.dist, cp = cam.pitch;
    const head = new THREE.Vector3(player.pos.x, hero.root.position.y + 1.55, player.pos.z);
    const springy = camMode === "mola" && state.phase !== "intro" && !shot;
    if (springy) {
      // a teleport or a cut (more than 6 m away) snaps; otherwise the head trails him, critically damped
      if (Math.hypot(pivot.x.x - head.x, pivot.y.x - head.y, pivot.z.x - head.z) > 6) snap3(pivot, head.x, head.y, head.z);
      stepSpring3(pivot, head.x, head.y, head.z, REDUCED_MOTION ? CAM_SPRING.pivotReduced : CAM_SPRING.pivot, dt);
      head.set(pivot.x.x, pivot.y.x, pivot.z.x);
    } else snap3(pivot, head.x, head.y, head.z);
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
    if (springy) {
      // in at once when a wall cuts the view, back out on the spring (reduced motion: no ease, straight to the test)
      const allowed = head.distanceTo(tmp);
      const use = REDUCED_MOTION ? (boom.x = allowed) : stepBoom(boom, allowed, CAM_SPRING.outward, dt);
      if (allowed > 1e-6) tmp.sub(head).multiplyScalar(use / allowed).add(head);
    } else { boom.x = head.distanceTo(tmp); boom.v = 0; }
    // a line being read: the composed two-shot (cinematic.ts), unless the player walks out of it or asks for less motion
    if (state.phase === "line" && !cine.left && !REDUCED_MOTION) {
      if (!cine.shot) {
        const g = goals[state.mission];
        cine.ids = g.kind === "call" ? g.npcs : [];
        const people = cineSubjects().map((p) => ({ x: p.x, z: p.z, ground: terrain.heightAt(p.x, p.z) }));
        const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
        cine.shot = twoShot(people, hfov, { heightAt: (x, z) => terrain.heightAt(x, z), solid: cameraSolid }, tmp) ?? null;
        if (!cine.shot) { cine.left = true; cine.why = "no-clear-shot"; }   // nowhere clear to stand: stay with the game camera
        else { cine.why = "shot"; cine.aim.set(cine.shot.look.x, cine.shot.look.y, cine.shot.look.z); }
      }
      if (Math.hypot(input.move.x, input.move.y) > 0.3 && !cine.left) { cine.left = true; cine.why = "moved"; }
    }
    if (state.phase !== "line") { cine.left = false; if (cine.k < 0.001) cine.shot = null; }
    const want = state.phase === "line" && !cine.left && cine.shot ? 1 : 0;
    cine.k += (want - cine.k) * Math.min(1, dt * 2.6);
    const k = cine.shot ? ease(cine.k) : 0;
    if (k > 0 && cine.shot) {
      // the eye holds still; the aim follows the group's centre as the called walk to him, eased
      const ps = cineSubjects();
      const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length, cz = ps.reduce((a, p) => a + p.z, 0) / ps.length;
      const cy = ps.reduce((a, p) => a + Math.max(terrain.heightAt(p.x, p.z), 0), 0) / ps.length + 1.45;
      cine.aim.lerp(tmp2.set(cx, cy, cz), Math.min(1, dt * 3));
      const e = cine.shot.eye, l = cine.aim;
      camera.position.set(tmp.x + (e.x - tmp.x) * k, tmp.y + (e.y - tmp.y) * k, tmp.z + (e.z - tmp.z) * k);
      camera.lookAt(head.x + (l.x - head.x) * k, head.y + 0.15 + (l.y - head.y - 0.15) * k, head.z + (l.z - head.z) * k);
    } else {
      camera.position.copy(tmp);
      camera.lookAt(head.x, head.y + 0.15, head.z);
    }
    hudEl.classList.toggle("cine", k > 0.5);
    sun.position.set(player.pos.x + sunDir.x * 120, hero.root.position.y + sunDir.y * 120, player.pos.z + sunDir.z * 120);
    sun.target.position.set(player.pos.x, hero.root.position.y, player.pos.z);

    if (state.phase !== "intro") {
      const g = state.phase === "done" ? null : goals[state.mission].at;
      const followers = npcList.filter((n) => n.following >= 0).map((n) => ({ pos: n.pos, kind: "follower" as const }));
      hud.update(state, player.pos, player.heading, g, distanceToGoal(state, goals, player.pos), followers, input.touch, dt);
    }
    vegetation.userData.update(player.pos.x,player.pos.z);
    if (shot) { camera.position.set(...shot.eye); camera.lookAt(...shot.target); }
    if (shot && shot.name !== lastShotName) { lastShotName = shot.name; slog.mark("shot", shot.name); }
    const cpuMs = performance.now() - now;                  // the frame's main-thread work before rendering
    renderer.info.reset();
    if (fx) fx.render(); else renderer.render(scene, camera);
    if (shot && bench && !bench.done) {
      if (Number.isNaN(benchLoadMs)) benchLoadMs = now;      // first measured frame, ms since navigation start
      if (gpuTimer && !gpuPending) {
        gpuPending = true;
        renderer.resolveTimestampsAsync("render").then((ms) => { gpuLast = typeof ms === "number" ? ms : null; }, () => { gpuLast = null; })
          .finally(() => { gpuPending = false; });
      }
      bench.record(real * 1000, renderer.info.render.drawCalls, renderer.info.render.triangles, { gpuMs: gpuLast, cpuMs });
    }
  };
  renderer.setAnimationLoop(frame);
  if (bench) (window as unknown as Record<string, unknown>).__gtaBench = {
    get done() { return bench.done; },
    hold: (i: number) => { benchHold = i; },
    results: () => ({ ...bench.results(), fx: fxLevel, ao: fx?.ao ?? null, look: visual, backend, quality, loadMs: benchLoadMs, warmup: bench.warmup, framesPerShot: bench.frames,
      build: { sha: BUILD_SHA, three: THREE.REVISION }, gpu: gpuName, userAgent: navigator.userAgent, heroSource,
      models: { loaded: Object.keys(assets).length },
      // estimates, labelled as such: textures per format/origin, and the canvas (colour + depth, MSAA when on)
      memory: { renderer: { ...renderer.info.memory }, textures: memorySummary(sceneTextures(scene)),
        canvasBytes: renderTargetBytes(innerWidth, innerHeight, renderer.getPixelRatio(), 4 + 4, fxLevel === "off" && quality !== "low" ? 4 : 1) },
      session: { status: slog.status, loads: slog.snapshot().loads, uncleanEnds: slog.snapshot().uncleanEnds, previous: slog.previous },
      viewport: [innerWidth, innerHeight], pixelRatio: renderer.getPixelRatio(), textureBytes: renderer.info.memory.texturesSize }),
  };

  if (DEBUG) {
    (window as unknown as Record<string, unknown>).__gta = {
      backend, state, player, meta, goals, fpsLog, cam, heroSource,
      actor: () => actor?.diagnostics() ?? null,
      assets: Object.keys(assets),
      world: {...town.group.userData.counts,...vegetation.userData.counts},
      routes:keep,
      blocked,
      quality,
      start: () => beginPlay(resumable), save: () => save, persist: () => persist(false), cloudState: () => cloudState,
      act: () => input.queueAction(),
      freeze: (on: boolean) => { frozen = on; },
      session: () => ({ status: slog.status, previous: slog.previous, record: slog.snapshot() }),
      cine: () => ({ k: cine.k, left: cine.left, why: cine.why, shot: cine.shot, on: hudEl.classList.contains("cine"),
        // fraction of the shot's people whose chest projects inside the central 90% of the picture
        framed: cine.shot ? cineSubjects().filter((p) => { const v = tmp2.set(p.x, Math.max(terrain.heightAt(p.x, p.z), 0) + 1.2, p.z).project(camera);
          return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1; }).length / cineSubjects().length : 0,
        camera: camera.position.toArray() }),
      teleport: (x: number, z: number, heading?: number) => {
        player.pos.x = x; player.pos.z = z;
        if (heading !== undefined) { player.heading = heading; cam.yaw = heading; }
        for (const n of npcList) if (n.following >= 0) { n.pos.x = x; n.pos.z = z; }
      },
      followers: () => npcList.filter((n) => n.following >= 0).map((n) => n.spec.id),
      // the camera this frame and whether it is inside a building's footprint (no margin), for tools/check_camera.mjs
      camera: () => { const c = camera.position;
        return { pos: c.toArray(), mode: camMode, inside: town.boxes.some((b) => c.y > (b.bottom ?? -Infinity) && c.y < (b.top ?? Infinity) && insideObstacle(c.x, c.z, b, 0)) }; },
      info: () => ({ calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, textureBytes: renderer.info.memory.texturesSize }),
    };
  }
}

main().catch((e) => {
  console.error(e);
  const go = document.getElementById("go") as HTMLButtonElement | null;
  if (go) { go.textContent = "Não foi possível abrir o jogo neste navegador"; go.disabled = true; }
});
