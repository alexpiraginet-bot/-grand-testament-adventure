// The HUD in the DOM: mission line, counter, key prompt, subtitle, radar, progress bar, place plate, cards.
import type { EpisodeData, State, Vec2 } from "./missions.ts";
import { counterTotal, readingTime } from "./missions.ts";
import type { WorldMeta } from "./terrain.ts";
import { SECTIONS, SHORT } from "./credits.ts";
import { buildJourneyHint, journeyNarrative, journeyRoute, sceneDevelopmentNotice } from './journey.ts';
import type { Segment } from './world-layout.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export type RadarMark = { pos: Vec2; kind: "follower" };

export class Hud {
  private radar: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: HTMLImageElement;
  private lastMission = -1;
  private lastDone = -1;
  private doneFlash = 0;
  private bars: HTMLElement[] = [];
  private ep: EpisodeData;
  private meta: WorldMeta;
  private journey: HTMLParagraphElement;
  private journeyBody: HTMLSpanElement;
  private journeyLabel: HTMLSpanElement;
  private sceneNotice: HTMLParagraphElement;
  private routes: readonly Segment[];
  private journeyMission = -1;
  private narrativeLeft = 0;
  readonly radiusM = 260;        // metres from the player to the radar's edge

  constructor(ep: EpisodeData, meta: WorldMeta, map: HTMLImageElement, touch: boolean, routes:readonly Segment[] = []) {
    this.ep = ep; this.meta = meta; this.map = map;
    this.routes=routes;
    this.radar = $("radar") as HTMLCanvasElement;
    this.ctx = this.radar.getContext("2d")!;
    this.journey=document.createElement('p');this.journey.id='journey';this.journey.className='journey';this.journey.hidden=true;
    this.journeyLabel=document.createElement('span');this.journeyLabel.className='journey-label';this.journeyLabel.textContent='Narrativa do jogo';
    this.journeyBody=document.createElement('span');this.journeyBody.className='journey-body';
    this.journey.append(this.journeyLabel,this.journeyBody);$('counter').after(this.journey);
    this.sceneNotice=document.createElement('p');this.sceneNotice.id='scene-development';this.sceneNotice.className='journey';
    this.sceneNotice.hidden=true;this.sceneNotice.setAttribute('role','status');this.journey.after(this.sceneNotice);
    $("title").textContent = ep.titulo;
    $("ref").textContent = ep.ref_pt;
    $("how").innerHTML = touch
      ? "Arraste do lado esquerdo para andar · do lado direito para olhar<br>Botão redondo para agir"
      : "WASD ou setas para andar · Shift corre · arraste o mouse para olhar (duplo clique trava o cursor)<br>E para agir";
    const bar = $("bar");
    bar.innerHTML = ep.missoes.map(() => "<i><b></b></i>").join("");
    this.bars = Array.from(bar.querySelectorAll("b"));
    const g = meta.center;
    const lat = Math.abs(g.lat).toFixed(2).replace(".", ","), lon = Math.abs(g.lon).toFixed(2).replace(".", ",");
    $("plate").innerHTML = `<div class="l"></div><div class="c">${lat}° N · ${lon}° L</div><div class="r"></div>`;
    $("plate").querySelector(".l")!.textContent = ep.lugar;
    $("plate").querySelector(".r")!.textContent = ep.ref_pt;
    $("endt").textContent = ep.titulo;
    $("endr").textContent = `Recriação · ${ep.ref_pt}`;
    $("endcred").innerHTML = SHORT.map((l) => `<li>${l}</li>`).join("");
    $("credbody").innerHTML = SECTIONS.map((s) => `<h4>${s.h}</h4>${s.quote ? `<blockquote>${s.quote}</blockquote>` : ""}${s.p.map((p) => `<p>${p}</p>`).join("")}`).join("");
    const open = (e: Event) => { e.preventDefault(); $("credits").hidden = false; };
    $("credbtn").addEventListener("click", open);
    $("credlink").addEventListener("click", open);
    $("credclose").addEventListener("click", () => { $("credits").hidden = true; });
    if (touch) { $("key").hidden = true; }
  }

  show() { this.journeyMission=-1;this.narrativeLeft=0;$("hud").hidden = false; $("start").hidden = true; }

  /** The start card's buttons and the line about saving. */
  startCard(o: { primary: string; secondary?: string; note: string }) {
    const go = $("go") as HTMLButtonElement, novo = $("novo") as HTMLButtonElement, note = $("savenote");
    go.disabled = false; go.textContent = o.primary;
    novo.hidden = !o.secondary; if (o.secondary) novo.textContent = o.secondary;
    note.hidden = !o.note; note.textContent = o.note;
  }

  /** The "Progresso salvo" pill, for a moment. */
  flashSaved() {
    const el = $("saved");
    el.hidden = true; void el.offsetWidth; el.hidden = false;     // restart the fade
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => { el.hidden = true; }, 2300);
  }
  private savedTimer: ReturnType<typeof setTimeout> | undefined;

  update(s: State, pos: Vec2, heading: number, goal: Vec2 | null, dist: number | null, followers: RadarMark[], touch: boolean, dt: number) {
    const ep = this.ep, n = ep.missoes.length;
    const k = Math.min(s.mission, n - 1);
    const m = ep.missoes[k];
    // a mission just ticked: hold its line with the check for a moment before the next one comes in
    const lastDone = s.completedAt.length - 1;
    if (lastDone !== this.lastDone) { this.lastDone = lastDone; this.doneFlash = lastDone >= 0 ? 1.4 : 0; }
    this.doneFlash = Math.max(0, this.doneFlash - dt);
    const showing = this.doneFlash > 0 ? lastDone : k;
    const done = this.doneFlash > 0 || s.phase === "done";
    if (showing !== this.lastMission || done !== $("obj").classList.contains("done")) {
      this.lastMission = showing;
      $("mk").textContent = `MISSÃO ${showing + 1} DE ${n}`;
      $("objt").textContent = ep.missoes[showing].objetivo;
      $("obj").classList.toggle("done", done);
    }
    $("dist").textContent = !done && dist !== null ? `${Math.round(dist)} m` : "";

    const total = counterTotal(ep);
    const c = $("counter");
    if (c.childElementCount !== total + 1) c.innerHTML = `<span>${ep.contador.rotulo.toUpperCase()}</span>` + "<i></i>".repeat(total);
    c.querySelectorAll("i").forEach((el, i) => el.classList.toggle("on", i < s.filled));

    // Give each encounter a short editorial introduction, then switch to contextual help.
    // Do not compete with scripture, completion cards or the previous mission's tick animation.
    if(s.phase==='play'&&this.doneFlash===0&&s.mission!==this.journeyMission){
      this.journeyMission=s.mission;this.narrativeLeft=7;
    }
    this.narrativeLeft=Math.max(0,this.narrativeLeft-dt);
    const guidance=buildJourneyHint(s,dist,touch);
    const narrated=this.narrativeLeft>0&&!s.promptVisible;
    const journeyText=s.phase==='play'&&this.doneFlash===0
      ?(narrated?journeyNarrative(s.mission):guidance):'';
    this.journey.hidden=!journeyText;
    const journeyLabel=narrated?'Narrativa do jogo':'Orientação';
    if(this.journeyLabel.textContent!==journeyLabel)this.journeyLabel.textContent=journeyLabel;
    if(this.journeyBody.textContent!==journeyText)this.journeyBody.textContent=journeyText;
    const notice=sceneDevelopmentNotice(s,dist);
    this.sceneNotice.hidden=!notice;
    if(this.sceneNotice.textContent!==notice)this.sceneNotice.textContent=notice;

    const pr = $("prompt"), act = $("act");
    const label = m.acao ?? "";
    pr.hidden = !(s.promptVisible && s.phase === "play") || touch;     // on a phone the round button is the prompt
    $("promptt").textContent = label;
    act.hidden = !touch || !(s.promptVisible && s.phase === "play");
    if (!act.hidden) act.textContent = label;

    const sub = $("sub");
    sub.hidden = !s.line;
    if (s.line) {
      $("subt").textContent = `“${s.line.texto}”`;
      $("subr").textContent = `BÍBLIA LIVRE · ${s.line.ref.toUpperCase()}`;
    }

    // progress: done segments full; the current one fills with the reading of its line, or with the walk to the goal
    this.bars.forEach((b, i) => {
      let f = i < s.completedAt.length ? 1 : 0;
      if (i === s.completedAt.length && s.phase === "line" && s.line) f = 1 - s.lineLeft / readingTime(s.line.texto);
      b.style.width = `calc(${Math.max(0, Math.min(1, f)) * 100}% - 2px)`;
    });

    this.drawRadar(pos, heading, goal, followers, s.time);
  }

  private drawRadar(pos: Vec2, heading: number, goal: Vec2 | null, followers: RadarMark[], t: number) {
    const ctx = this.ctx, S = this.radar.width, c = S / 2, meta = this.meta;
    const ppm = c / this.radiusM;                                  // canvas px per metre
    ctx.save();
    ctx.fillStyle = "#e2cda4"; ctx.fillRect(0, 0, S, S);
    // the map image covers the world square, north up; the radar stays north up, as in the reels
    const iw = this.map.width, k = iw / meta.size;                 // image px per metre
    const sw = (2 * this.radiusM) * k;
    const sx = (pos.x + meta.size / 2) * k - sw / 2, sy = (pos.z + meta.size / 2) * k - sw / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.map, sx, sy, sw, sw, 0, 0, S, S);
    const toR = (p: Vec2) => ({ x: c + (p.x - pos.x) * ppm, y: c + (p.z - pos.z) * ppm });

    // places (names as the BLIVRE writes them)
    ctx.font = "italic 600 19px 'Space Grotesk', sans-serif";
    for (const pl of meta.places) {
      const q = toR({ x: pl.x, z: pl.z });
      if (q.x < -40 || q.y < -40 || q.x > S + 40 || q.y > S + 40) continue;
      ctx.fillStyle = "#3a2818"; ctx.strokeStyle = "#ecdcba"; ctx.lineWidth = 2;
      ctx.fillRect(q.x - 5, q.y - 5, 10, 10); ctx.strokeRect(q.x - 5, q.y - 5, 10, 10);
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(232,214,176,.9)"; ctx.strokeText(pl.nome, q.x + 10, q.y + 6);
      ctx.fillStyle = "#3a2818"; ctx.fillText(pl.nome, q.x + 10, q.y + 6);
    }

    // Dots follow the walkable route around bends/inlets; the ring retains the true goal direction.
    if (goal) {
      const route=journeyRoute(this.routes,pos,goal).map(toR),actual=toR(goal);
      ctx.save();ctx.beginPath();ctx.rect(8,8,S-16,S-16);ctx.clip();
      let nextDot=0;
      for(let i=1;i<route.length;i++){
        const a=route[i-1],b=route[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        if(length<1e-6)continue;
        for(;nextDot<length;nextDot+=13){
          const x=a.x+dx*nextDot/length,y=a.y+dy*nextDot/length;
          if(Math.hypot(x-c,y-c)<22||Math.hypot(x-actual.x,y-actual.y)<14)continue;
          ctx.beginPath();ctx.arc(x,y,3.4,0,Math.PI*2);ctx.fillStyle='#ffcf73';ctx.fill();
          ctx.lineWidth=1.5;ctx.strokeStyle='#18120c';ctx.stroke();
        }
        nextDot-=length;
      }
      ctx.restore();
      const g = toR(goal);
      let dx = g.x - c, dy = g.y - c; const L = Math.hypot(dx, dy); dx /= L || 1; dy /= L || 1;
      const end = Math.min(L, c - 16);
      const gx = c + dx * end, gy = c + dy * end, pulse = (Math.sin(t * 4) + 1) / 2;
      ctx.beginPath(); ctx.arc(gx, gy, 13 + 4 * pulse, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,207,115,${1 - 0.6 * pulse})`; ctx.stroke();
      ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2); ctx.fillStyle = "#ffcf73"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#18120c"; ctx.stroke();
      ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fillStyle = "#18120c"; ctx.fill();
    }
    for (const f of followers) {
      const q = toR(f.pos);
      ctx.beginPath(); ctx.arc(q.x, q.y, 6.5, 0, Math.PI * 2); ctx.fillStyle = "#84c4ff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#18120c"; ctx.stroke();
    }
    // the player's arrow
    ctx.translate(c, c); ctx.rotate(heading);
    ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(18, 21); ctx.lineTo(0, 10); ctx.lineTo(-18, 21); ctx.closePath();
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#18120c"; ctx.stroke();
    ctx.restore();
  }

  end(filled: number) {
    $("endc").textContent = `${filled} ${this.ep.contador.rotulo}`;
    $("end").hidden = false;
  }
}
