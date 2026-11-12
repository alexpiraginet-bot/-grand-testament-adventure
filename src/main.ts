// Grand Testament Adventure, vertical slice: "Pescadores de gente" (Mark 1:16-20) on the shore of the Sea of Galilee at
// Capernaum. three.js with its WebGPU renderer (WebGPU when the browser has it, WebGL 2 otherwise).
import * as THREE from "three/webgpu";
import episode from "./data/mc-pescadores.json";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "./terrain.ts";
import { boat as makeBoat, castNet, farMesh, groundMesh, houses, props, sky, water, type Segment } from "./world.ts";
import { animate, makePerson, PALETTES, type Person } from "./people.ts";
import { goals as makeGoals, npcs as makeNpcs, type NpcSpec } from "./episode.ts";
import { distanceToGoal, initialState, restoreState, start as startEpisode, step, type EpisodeData, type Event, type Vec2 } from "./missions.ts";
import { episodeProgress, LocalSaveStore, mergeSaves, recordMission, restartEpisode } from "./save.ts";
import { Cloud, newCode, syncOnce, type CloudConfig } from "./cloud.ts";
import { setupCloudPanel } from "./cloudui.ts";
import nuvem from "./data/nuvem.json";
import { Input } from "./input.ts";
import { Hud } from "./hud.ts";
import { Sfx } from "./audio.ts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakedGeometry, rigPerson, type ModelSpec } from "./rig.ts";
import modelos from "./data/modelos.json";

const ep = episode as unknown as EpisodeData & { personagens: { id: string; nome: string }[] };
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
// tests on a software renderer (1-2 fps) let game time follow real time: ?debug&dtmax=0.5
const DT_MAX = DEBUG && params.has("dtmax") ? Number(params.get("dtmax")) : 0.05;
const $ = (id: string) => document.getElementById(id)!;

/** The bytes of a GLB. Hosts that do not serve .glb (the claude.ai page) get <name>.glb.json = { b64 } instead. */
async function fetchModel(url: string): Promise<ArrayBuffer> {
  const isGlb = (b: ArrayBuffer) => b.byteLength > 12 && new TextDecoder().decode(new Uint8Array(b, 0, 4)) === "glTF";
  const r = await fetch(url).catch(() => null);
  if (r?.ok) { const b = await r.arrayBuffer(); if (isGlb(b)) return b; }
  const j = await fetch(`${url}.json`);
  if (!j.ok) throw new Error(`${url}: not found (${j.status})`);
  const bin = atob(((await j.json()) as { b64: string }).b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  if (!isGlb(out.buffer)) throw new Error(`${url}.json: not a GLB`);
  return out.buffer;
}

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
  const canvas = $("c") as HTMLCanvasElement;
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  // the claude.ai page passes no query string, only a #name: #alta / #baixa choose the quality there, #fps shows the FPS
  const hash = location.hash.slice(1);
  const quality = params.get("q") ?? (hash === "alta" ? "high" : hash === "baixa" ? "low" : touch ? "low" : "high");
  const q = quality === "low" ? 0.55 : 1;

  // WebGPU only on a real adapter: a software ("fallback") one, or none, goes to WebGL 2. If the WebGPU device is lost
  // later (it happened with the software adapter of the test browser), the page reloads on WebGL 2.
  let forceWebGL = params.get("gl") === "1";
  if (!forceWebGL) {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean } } | null> } }).gpu;
    const ad = gpu ? await gpu.requestAdapter().catch(() => null) : null;
    forceWebGL = !ad || !!ad.isFallbackAdapter || !!ad.info?.isFallbackAdapter;
  }
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: quality !== "low", forceWebGL, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "low" ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  const be = renderer.backend as unknown as { isWebGPUBackend?: boolean; device?: { lost: Promise<unknown> } };
  const backend = be.isWebGPUBackend ? "WebGPU" : "WebGL2";
  be.device?.lost.then(() => { const u = new URL(location.href); u.searchParams.set("gl", "1"); location.replace(u); });

  const { meta, terrain, far, img } = await load();

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(0.45, 0.55, 0.7).normalize();
  scene.add(sky(sunDir));
  scene.fog = new THREE.Fog(0xd3d6cc, 400, 16000);
  {
    // environment for the reflections: the sky's gradient as an equirectangular picture
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#4f86c2"); gr.addColorStop(0.47, "#d9dcd2"); gr.addColorStop(0.53, "#8a8064"); gr.addColorStop(1, "#5d5444");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    const env = new THREE.CanvasTexture(c); env.mapping = THREE.EquirectangularReflectionMapping; env.colorSpace = THREE.SRGBColorSpace;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
  }
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7d6c4f, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === "low" ? 1024 : 2048, quality === "low" ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const P = meta.points;
  const pt = (p: [number, number]): Vec2 => ({ x: p[0], z: p[1] });
  const keep: Segment[] = [
    { ax: P.start[0], az: P.start[1], bx: P.beach[0], bz: P.beach[1], r: 5 },
    { ax: P.beach[0], az: P.beach[1], bx: P.simao[0], bz: P.simao[1], r: 6 },
    { ax: P.simao[0], az: P.simao[1], bx: P.barco_margem[0], bz: P.barco_margem[1], r: 6 },
  ];
  scene.add(groundMesh(terrain, quality === "low" ? 192 : 256));
  const fm = farMesh(far, meta.far.size, meta.far.n); fm.position.y = -0.3; scene.add(fm);
  const lake = water(meta.far.size); scene.add(lake.mesh);
  scene.add(props(terrain, keep, q));
  const cap = meta.places.find((p) => p.id === "Capernaum") ?? { x: 0, z: 0 };
  const town = houses(terrain, cap.x, cap.z, keep);
  scene.add(town.group);

  // the boat of Zebedeu, along the shore, and the net of Simão and André in the water
  const theBoat = makeBoat();
  const boatPos = pt(P.barco), shoreB = pt(P.barco_margem);
  theBoat.group.position.set(boatPos.x, 0, boatPos.z);
  theBoat.group.rotation.y = -Math.atan2(boatPos.x - shoreB.x, -(boatPos.z - shoreB.z)) + Math.PI / 2;
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
  const net = castNet();
  {
    const s = npcList[0].pos, a = npcList[0].facing;
    net.position.set(s.x + Math.sin(a) * 3.2 + (npcList[1].pos.x - s.x) / 2, 0.07, s.z - Math.cos(a) * 3.2 + (npcList[1].pos.z - s.z) / 2);
    scene.add(net);
  }

  // the player: the Tripo mesh when it loads (with the provisional rig of rig.ts), the simple shapes otherwise
  let hero: Person = makePerson(PALETTES.heroi);
  let heroSource = "formas";
  try {
    const spec = (modelos as Record<string, ModelSpec & { arquivo: string }>).heroi;
    const gltf = await new GLTFLoader().parseAsync(await fetchModel(`${import.meta.env.BASE_URL}${spec.arquivo}`), "");
    if (gltf.animations.length) throw new Error("heroi.glb tem animações próprias: falta ligar o AnimationMixer (rig.ts é só para malha sem rig)");
    const { geometry, material } = bakedGeometry(gltf.scene, spec);
    hero = rigPerson(geometry, material, spec.altura);
    heroSource = spec.arquivo;
  } catch (e) {
    console.warn("heroi.glb não carregou; o jogador fica com as formas simples", e);
  }
  scene.add(hero.root);
  const player = { pos: pt(P.start), heading: Math.atan2(P.beach[0] - P.start[0], -(P.beach[1] - P.start[1])), speed: 0 };

  const camera = new THREE.PerspectiveCamera(touch && innerHeight > innerWidth ? 62 : 52, innerWidth / innerHeight, 0.1, 60000);
  const cam = { yaw: player.heading, pitch: 0.2, dist: touch && innerHeight > innerWidth ? 5.2 : 4.4, idle: 0 };

  const input = new Input(canvas, $("joy"), $("knob"), $("act"));
  const sfx = new Sfx();
  const hud = new Hud(ep, meta, img, input.touch);
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
    if (r) { save = r.save; cloudState = r.status; if (r.status === "synced") store.write(save); }
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
    const note = store.status === "ok" ? `O progresso fica salvo automaticamente ${where}.`
      : store.status === "newer" ? "Este progresso foi salvo por uma versão mais nova do jogo: atualize a página para continuar."
      : "Este navegador não está deixando salvar (janela anônima?). Dá pra jogar, mas o progresso não fica.";
    if (resumable) hud.startCard({ primary: `Continuar · Missão ${prog.missionsDone + 1} de ${total}`, secondary: "Começar do zero", note });
    else if (prog.completions > 0) hud.startCard({ primary: "Jogar de novo", note: `Episódio concluído ${prog.completions === 1 ? "1 vez" : `${prog.completions} vezes`}. ${note}` });
    else hud.startCard({ primary: "Começar", note });
  };
  showStartCard();
  if (cloud.enabled) setupCloudPanel({
    ensureCode: async () => {
      let code = readCode();
      if (!code && Object.keys(save.episodes).length === 0) return null;   // nothing to keep yet: no empty row in the cloud
      if (!code) { code = newCode(); writeCode(code); }
      await cloud.put(code, save); cloudState = "synced";
      return code;
    },
    useCode: async (code) => {
      try {
        const remote = await cloud.get(code);
        if (!remote) return "notfound";
        save = mergeSaves(save, remote);
        writeCode(code); store.write(save); await cloud.put(code, save); cloudState = "synced";
        return "ok";
      } catch { return "offline"; }
    },
    onRestored: showStartCard,
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
    if (!terrain.inside(x, z, 60)) return true;
    if (terrain.heightAt(x, z) < -0.55) return true;                       // no swimming: wading only
    for (const b of town.boxes) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hx + 0.3 && Math.abs(lz) < b.hz + 0.3) return true;
    }
    for (const n of npcList) if (n.following < 0 && !n.inBoat && Math.hypot(x - n.pos.x, z - n.pos.z) < 0.6) return true;
    return false;
  };

  const tmp = new THREE.Vector3();
  let last = performance.now(), fpsFrames = 0, fpsT = 0;
  const fpsLog: number[] = [];
  const fpsEl = $("fps");
  if (DEBUG || params.has("fps") || hash === "fps") fpsEl.hidden = false;
  let t = 0;

  const frame = () => {
    const now = performance.now();
    const real = (now - last) / 1000; last = now;
    const dt = Math.min(DT_MAX, real); t += dt;         // game time: at most 50 ms per frame (slow motion below 20 fps)
    fpsFrames++; fpsT += real;                           // the FPS counter uses real time
    if (fpsT >= 1) { fpsLog.push(fpsFrames / fpsT); if (fpsLog.length > 120) fpsLog.shift(); fpsEl.textContent = `${backend}\n${(fpsFrames / fpsT).toFixed(0)} fps`; fpsFrames = 0; fpsT = 0; }

    input.poll();
    const look = input.takeLook();
    const playing = state.phase === "play" || state.phase === "line";
    if (playing || ended) {
      cam.yaw += look.dx * 0.0042;
      cam.pitch = Math.max(-0.25, Math.min(0.85, cam.pitch + look.dy * 0.003));
    }
    if (look.dx || look.dy) cam.idle = 0; else cam.idle += dt;

    // walk relative to the camera
    let mv = 0;
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
    player.speed = mv;
    const gy = terrain.heightAt(player.pos.x, player.pos.z);
    hero.root.position.set(player.pos.x, Math.max(gy, -0.6), player.pos.z);
    hero.root.rotation.y = -player.heading;
    animate(hero, mv, dt, t);

    // mission logic
    if (state.phase !== "intro") handle(step(state, ep, goals, { pos: player.pos, groundHeight: gy, action: input.takeAction() }, dt));
    else input.takeAction();
    // autosave every 15 s of play when he has moved (silent; ticked missions save at once, with the pill)
    if (state.phase === "play" || state.phase === "line") {
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
    tmp.set(head.x - Math.sin(cam.yaw) * Math.cos(cp) * cd, head.y + Math.sin(cp) * cd, head.z + Math.cos(cam.yaw) * Math.cos(cp) * cd);
    const floor = Math.max(terrain.heightAt(tmp.x, tmp.z), 0) + 0.4;
    if (tmp.y < floor) tmp.y = floor;
    if (state.phase === "intro") {
      // the start card: a slow turn around him
      const a = t * 0.12 + player.heading + Math.PI * 0.85;
      tmp.set(player.pos.x - Math.sin(a) * 7, head.y + 1.6, player.pos.z + Math.cos(a) * 7);
    }
    camera.position.copy(tmp);
    camera.lookAt(head.x, head.y + 0.15, head.z);
    sun.position.set(player.pos.x + sunDir.x * 120, hero.root.position.y + sunDir.y * 120, player.pos.z + sunDir.z * 120);
    sun.target.position.set(player.pos.x, hero.root.position.y, player.pos.z);

    if (state.phase !== "intro") {
      const g = state.phase === "done" ? null : goals[state.mission].at;
      const followers = npcList.filter((n) => n.following >= 0).map((n) => ({ pos: n.pos, kind: "follower" as const }));
      hud.update(state, player.pos, player.heading, g, distanceToGoal(state, goals, player.pos), followers, input.touch, dt);
    }
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);

  if (DEBUG) {
    (window as unknown as Record<string, unknown>).__gta = {
      backend, state, player, meta, goals, fpsLog, cam, heroSource,
      start: () => beginPlay(resumable), save: () => save, persist: () => persist(false), cloudState: () => cloudState,
      act: () => input.queueAction(),
      teleport: (x: number, z: number, heading?: number) => {
        player.pos.x = x; player.pos.z = z;
        if (heading !== undefined) { player.heading = heading; cam.yaw = heading; }
        for (const n of npcList) if (n.following >= 0) { n.pos.x = x; n.pos.z = z; }
      },
      followers: () => npcList.filter((n) => n.following >= 0).map((n) => n.spec.id),
      info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    };
  }
}

main().catch((e) => {
  console.error(e);
  const go = document.getElementById("go") as HTMLButtonElement | null;
  if (go) { go.textContent = "Não foi possível abrir o jogo neste navegador"; go.disabled = true; }
});
