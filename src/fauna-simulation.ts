// Artistic ambient wildlife, not a claim about animal counts at historical Capernaum.
// Reserved simulation only: no runtime models until Alex approves original animal meshes.
// No rendering or physics-engine dependency: the game keeps fauna non-blocking to the player.
import {rng,distanceToSegment,type Segment} from './world-layout.ts';

export type FaunaKind='chicken'|'donkey'|'goat'|'sheep'|'fish';
export interface FaunaTerrain {
  heightAt(x:number,z:number):number;
  inside(x:number,z:number,margin?:number):boolean;
  meta?:{points?:{beach?:readonly [number,number]}};
}
export type FaunaBlocker=(x:number,z:number)=>boolean;
export interface FaunaAgent {
  /** Heading 0 faces -Z; fish y is body centre, terrestrial y is the foot support height. */
  id:string;kind:FaunaKind;x:number;y:number;z:number;heading:number;
  homeX:number;homeZ:number;phase:number;scale:number;radius:number;halfHeight:number;seed:number;time:number;
  moving:boolean;speed:number;
}
export interface FaunaBodyBounds {radius:number;halfHeight:number}
export interface FaunaOptions {
  seed?:number;counts?:Partial<Record<FaunaKind,number>>;
  /** Metres in the approved, normalised asset, before the individual's scale is applied. */
  bodies?:Partial<Record<FaunaKind,FaunaBodyBounds>>;
}
export interface FaunaStepOptions {
  /** XZ metres around the player; defaults to Infinity. Far agents retain their exact state. */
  activeRadius?:number;
}
export const DEFAULT_FAUNA_COUNTS:Readonly<Record<FaunaKind,number>>={chicken:30,donkey:6,goat:0,sheep:12,fish:60};
const TAU=Math.PI*2;
const radius:Record<FaunaKind,number>={chicken:.22,donkey:.7,goat:.42,sheep:.42,fish:.12};
const wander:Record<FaunaKind,number>={chicken:2.8,donkey:3.5,goat:5,sheep:4.5,fish:5};
const pace:Record<FaunaKind,number>={chicken:.24,donkey:.38,goat:.64,sheep:.52,fish:.74};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const footprint=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;

/** Broadphase uses scaled body discs, not eventual mesh geometry; revalidate radii with approved meshes. */
class FaunaSpatialIndex {
  private cells=new Map<string,Set<FaunaAgent>>();
  private maxRadius:number;
  private cellSize=2;
  constructor(agents:FaunaAgent[]){
    this.maxRadius=Math.max(0,...agents.map(a=>a.radius));
    for(const a of agents)this.add(a);
  }
  private key(x:number,z:number){return `${Math.floor(x/this.cellSize)},${Math.floor(z/this.cellSize)}`;}
  private add(a:FaunaAgent){const key=this.key(a.x,a.z);let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=new Set());cell.add(a);}
  move(a:FaunaAgent,x:number,z:number){
    const old=this.key(a.x,a.z),next=this.key(x,z);
    if(old!==next){const cell=this.cells.get(old)!;cell.delete(a);if(!cell.size)this.cells.delete(old);}
    a.x=x;a.z=z;if(old!==next)this.add(a);
  }
  free(a:FaunaAgent,x:number,z:number):boolean {
    const reach=a.radius+this.maxRadius+.03,cell=this.cellSize;
    for(let ix=Math.floor((x-reach)/cell);ix<=Math.floor((x+reach)/cell);ix++)
      for(let iz=Math.floor((z-reach)/cell);iz<=Math.floor((z+reach)/cell);iz++){
        for(const b of this.cells.get(`${ix},${iz}`)??[]){
          if(a===b||(a.kind==='fish')!==(b.kind==='fish'))continue;
          if(Math.hypot(x-b.x,z-b.z)<a.radius+b.radius+.03)return false;
        }
      }
    return true;
  }
}

function landValid(t:FaunaTerrain,blocked:FaunaBlocker,x:number,z:number,r:number):boolean {
  return [[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dz])=>
    t.inside(x+dx,z+dz,.5)&&t.heightAt(x+dx,z+dz)>=.25&&!blocked(x+dx,z+dz));
}
function bedUnderBody(t:FaunaTerrain,x:number,z:number,r:number):number {
  let bed=-Infinity;
  for(const [dx,dz] of footprint)bed=Math.max(bed,t.heightAt(x+dx*r,z+dz*r));
  return bed;
}
function waterValid(t:FaunaTerrain,x:number,z:number,r:number,halfHeight:number):boolean {
  if(!footprint.every(([dx,dz])=>t.inside(x+dx*r,z+dz*r,.5)))return false;
  const bed=bedUnderBody(t,x,z,r);
  // Include fins/body, not just the centre. This is a sampled conservative box proxy, not mesh collision.
  return bed<-.65 && bed+halfHeight+.04<=-halfHeight-.04;
}
function fishHeight(t:FaunaTerrain,x:number,z:number,phase:number,r:number,halfHeight:number):number {
  return clamp(-.42+Math.sin(phase)*.13,bedUnderBody(t,x,z,r)+halfHeight+.04,-halfHeight-.04);
}

export function generateFauna(t:FaunaTerrain,routes:readonly Segment[],blocked:FaunaBlocker,options:FaunaOptions={}):FaunaAgent[] {
  if(!routes.length)return [];
  const random=rng(options.seed??92471),agents:FaunaAgent[]=[];
  const bodies=Object.fromEntries(Object.keys(radius).map(kind=>{
    const k=kind as FaunaKind,body=options.bodies?.[k]??{radius:radius[k],halfHeight:radius[k]};
    if(!Number.isFinite(body.radius)||!Number.isFinite(body.halfHeight)||body.radius<=0||body.halfHeight<=0)
      throw Error(`Invalid fauna body bounds: ${k}`);
    return[k,body];
  })) as Record<FaunaKind,FaunaBodyBounds>;
  const counts=Object.fromEntries(Object.entries(DEFAULT_FAUNA_COUNTS).map(([kind,count])=>
    [kind,Math.floor(clamp(options.counts?.[kind as FaunaKind]??count,0,300))])) as Record<FaunaKind,number>;
  const beach=t.meta?.points?.beach;
  const end=beach?routes.findIndex(s=>Math.hypot(s.bx-beach[0],s.bz-beach[1])<1e-4):-1;
  const village=end>=0?routes.slice(0,end+1):routes;
  const coast=end>=0&&end<routes.length-1?routes.slice(end+1):routes;
  const create=(kind:FaunaKind,index:number,x:number,z:number,homeX=x,homeZ=z)=>{
    const phase=random()*TAU,heading=random()*TAU,scale=.85+random()*.3,seed=Math.floor(random()*0x7fffffff);
    const body=bodies[kind],scaledRadius=body.radius*scale,halfHeight=body.halfHeight*scale;
    // The first simulation tick continues this same vertical oscillator, rather than jumping phases.
    agents.push({id:`${kind}-${index}`,kind,x,z,y:kind==='fish'?fishHeight(t,x,z,(seed%10000)/137,scaledRadius,halfHeight):t.heightAt(x,z),
      heading,homeX,homeZ,phase,scale,radius:scaledRadius,halfHeight,seed,time:0,moving:false,speed:0});
  };
  for(const kind of ['chicken','donkey','goat','sheep'] as const){
    let made=0;
    for(let attempts=0;made<counts[kind]&&attempts<counts[kind]*250;attempts++){
      const s=village[Math.floor(random()*village.length)],u=random(),dx=s.bx-s.ax,dz=s.bz-s.az,length=Math.hypot(dx,dz);
      if(length<1e-6)continue;
      const off=(kind==='chicken'?3.2+random()*8:6+random()*18)*(random()<.5?-1:1);
      const x=s.ax+dx*u+dz/length*off,z=s.az+dz*u-dx/length*off;
      if(!landValid(t,blocked,x,z,bodies[kind].radius*1.15)||routes.some(s=>distanceToSegment(x,z,s)<s.r+1))continue;
      if(agents.some(a=>Math.hypot(a.x-x,a.z-z)<bodies[kind].radius*1.15+a.radius+.35))continue;
      create(kind,made++,x,z);
    }
  }
  // Each group shares a home centre in the lake, with individually phased nearby positions.
  const schools:{x:number;z:number}[]=[];
  const schoolCount=Math.min(6,Math.ceil(counts.fish/10));
  for(let attempts=0;schools.length<schoolCount&&attempts<1500;attempts++){
    const s=coast[Math.floor(random()*coast.length)],u=random(),dx=s.bx-s.ax,dz=s.bz-s.az,length=Math.hypot(dx,dz);
    if(length<1e-6)continue;
    const off=(8+random()*42)*(random()<.5?-1:1),x=s.ax+dx*u+dz/length*off,z=s.az+dz*u-dx/length*off;
    if(waterValid(t,x,z,bodies.fish.radius*1.15,bodies.fish.halfHeight*1.15)&&schools.every(p=>Math.hypot(p.x-x,p.z-z)>12))schools.push({x,z});
  }
  let made=0;
  for(let attempts=0;made<counts.fish&&schools.length&&attempts<counts.fish*100;attempts++){
    const home=schools[made%schools.length],theta=random()*TAU,r=Math.sqrt(random())*3.5;
    const x=home.x+Math.cos(theta)*r,z=home.z+Math.sin(theta)*r;
    if(waterValid(t,x,z,bodies.fish.radius*1.15,bodies.fish.halfHeight*1.15)&&agents.every(a=>a.kind!=='fish'||Math.hypot(a.x-x,a.z-z)>bodies.fish.radius*1.15+a.radius+.03))
      create('fish',made++,x,z,home.x,home.z);
  }
  return agents;
}

/** Bounded ambient motion. A paused/non-finite timestep must leave every field untouched. */
export function stepFauna(agents:FaunaAgent[],t:FaunaTerrain,blocked:FaunaBlocker,player:{x:number;z:number},dt:number,options:FaunaStepOptions={}):void {
  if(!Number.isFinite(dt)||dt<=0)return;
  const activeRadius=options.activeRadius??Infinity;
  if(Number.isNaN(activeRadius)||activeRadius<0||!Number.isFinite(player.x)||!Number.isFinite(player.z))return;
  dt=Math.min(dt,.1);
  const distanceSquared=(a:FaunaAgent)=>(a.x-player.x)**2+(a.z-player.z)**2;
  const activeAgents=Number.isFinite(activeRadius)?agents.filter(a=>distanceSquared(a)<=activeRadius**2):agents;
  if(!activeAgents.length)return;
  // The frozen ring remains in the occupancy index; an active animal cannot overlap an inactive neighbour.
  const padding=agents.reduce((max,a)=>Math.max(max,a.radius),0)*2+.2;
  const nearby=Number.isFinite(activeRadius)?agents.filter(a=>distanceSquared(a)<=(activeRadius+padding)**2):agents;
  const occupancy=new FaunaSpatialIndex(nearby);
  for(const a of activeAgents){
    a.time+=dt;
    const fish=a.kind==='fish',clock=a.time+(a.seed%10000)/137,range=wander[a.kind];
    // School members use the same slow home-centred turn, with a small individual spread.
    const turn=fish?a.time*.21+a.homeX*.018+a.homeZ*.023:clock*.28;
    const spread=fish?(a.seed%37)*.06:0;
    const targetX=a.homeX+Math.sin(turn+spread)*range,targetZ=a.homeZ+Math.cos(turn*.83+spread)*range*.7;
    let dx=targetX-a.x,dz=targetZ-a.z,len=Math.hypot(dx,dz),speed=pace[a.kind];
    let wantsToMove=fish||Math.sin(clock*.41)>.12;
    const awayX=a.x-player.x,awayZ=a.z-player.z,near=Math.hypot(awayX,awayZ);
    if(!fish&&near<1.5){
      dx=near>.001?awayX/near:Math.sin(a.seed);dz=near>.001?awayZ/near:Math.cos(a.seed);
      len=1;wantsToMove=true;speed*=1.65;
    }
    a.moving=false;a.speed=0;
    if(wantsToMove&&len>.12){
      const desired=Math.atan2(dx,-dz);
      const oldHeading=a.heading,turnLimit=dt*3.5,turn=clamp(angle(desired-oldHeading),-turnLimit,turnLimit);
      a.heading=angle(oldHeading+turn);
      const valid=(x:number,z:number)=>Math.hypot(x-a.homeX,z-a.homeZ)<range*2+4
        &&occupancy.free(a,x,z)&&(fish?waterValid(t,x,z,a.radius,a.halfHeight):landValid(t,blocked,x,z,a.radius));
      // Check midpoints too; do not tunnel across a narrow barrier or dry shoreline.
      // Turn first, then move along the accepted heading. Axis-sliding used to make animals walk sideways.
      for(const correction of [0,turnLimit*.6,-turnLimit*.6]){
        const heading=angle(oldHeading+clamp(turn+correction,-turnLimit,turnLimit));
        const alignment=Math.max(0,Math.cos(angle(desired-heading)));
        if(alignment<.25)continue;
        const step=Math.min(speed*dt*alignment,len),sx=Math.sin(heading)*step,sz=-Math.cos(heading)*step;
        if(Math.hypot(sx,sz)<1e-8)continue;
        if(valid(a.x+sx*.5,a.z+sz*.5)&&valid(a.x+sx,a.z+sz)){
          occupancy.move(a,a.x+sx,a.z+sz);a.heading=heading;a.speed=Math.hypot(sx,sz)/dt;a.moving=true;break;
        }
      }
    }
    a.phase=(a.phase+dt*(fish?4:a.moving?7:1.4))%TAU;
    a.y=fish?fishHeight(t,a.x,a.z,clock,a.radius,a.halfHeight):t.heightAt(a.x,a.z);
  }
}
