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
  id:string;kind:FaunaKind;x:number;y:number;z:number;heading:number;
  homeX:number;homeZ:number;phase:number;scale:number;radius:number;seed:number;time:number;
  moving:boolean;speed:number;
}
export interface FaunaOptions {seed?:number;counts?:Partial<Record<FaunaKind,number>>}
export const DEFAULT_FAUNA_COUNTS:Readonly<Record<FaunaKind,number>>={chicken:30,donkey:6,goat:0,sheep:12,fish:60};
const TAU=Math.PI*2;
const radius:Record<FaunaKind,number>={chicken:.22,donkey:.7,goat:.42,sheep:.42,fish:.12};
const wander:Record<FaunaKind,number>={chicken:2.8,donkey:3.5,goat:5,sheep:4.5,fish:5};
const pace:Record<FaunaKind,number>={chicken:.48,donkey:.55,goat:.64,sheep:.52,fish:.74};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));

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
function waterValid(t:FaunaTerrain,x:number,z:number):boolean {
  return [[0,0],[.2,0],[-.2,0],[0,.2],[0,-.2]].every(([dx,dz])=>
    t.inside(x+dx,z+dz,.5)&&t.heightAt(x+dx,z+dz)<-.65);
}
function fishHeight(t:FaunaTerrain,x:number,z:number,phase:number):number {
  return clamp(-.42+Math.sin(phase)*.13,t.heightAt(x,z)+.18,-.16);
}

export function generateFauna(t:FaunaTerrain,routes:readonly Segment[],blocked:FaunaBlocker,options:FaunaOptions={}):FaunaAgent[] {
  if(!routes.length)return [];
  const random=rng(options.seed??92471),agents:FaunaAgent[]=[];
  const counts=Object.fromEntries(Object.entries(DEFAULT_FAUNA_COUNTS).map(([kind,count])=>
    [kind,Math.floor(clamp(options.counts?.[kind as FaunaKind]??count,0,300))])) as Record<FaunaKind,number>;
  const beach=t.meta?.points?.beach;
  const end=beach?routes.findIndex(s=>Math.hypot(s.bx-beach[0],s.bz-beach[1])<1e-4):-1;
  const village=end>=0?routes.slice(0,end+1):routes;
  const coast=end>=0&&end<routes.length-1?routes.slice(end+1):routes;
  const create=(kind:FaunaKind,index:number,x:number,z:number,homeX=x,homeZ=z)=>{
    const phase=random()*TAU,heading=random()*TAU,scale=.85+random()*.3,seed=Math.floor(random()*0x7fffffff);
    // The first simulation tick continues this same vertical oscillator, rather than jumping phases.
    agents.push({id:`${kind}-${index}`,kind,x,z,y:kind==='fish'?fishHeight(t,x,z,(seed%10000)/137):t.heightAt(x,z),
      heading,homeX,homeZ,phase,scale,radius:radius[kind]*scale,seed,time:0,moving:false,speed:0});
  };
  for(const kind of ['chicken','donkey','goat','sheep'] as const){
    let made=0;
    for(let attempts=0;made<counts[kind]&&attempts<counts[kind]*250;attempts++){
      const s=village[Math.floor(random()*village.length)],u=random(),dx=s.bx-s.ax,dz=s.bz-s.az,length=Math.hypot(dx,dz);
      if(length<1e-6)continue;
      const off=(kind==='chicken'?3.2+random()*8:6+random()*18)*(random()<.5?-1:1);
      const x=s.ax+dx*u+dz/length*off,z=s.az+dz*u-dx/length*off;
      if(!landValid(t,blocked,x,z,radius[kind]*1.15)||routes.some(s=>distanceToSegment(x,z,s)<s.r+1))continue;
      if(agents.some(a=>Math.hypot(a.x-x,a.z-z)<radius[kind]*1.15+a.radius+.35))continue;
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
    if(waterValid(t,x,z)&&schools.every(p=>Math.hypot(p.x-x,p.z-z)>12))schools.push({x,z});
  }
  let made=0;
  for(let attempts=0;made<counts.fish&&schools.length&&attempts<counts.fish*100;attempts++){
    const home=schools[made%schools.length],theta=random()*TAU,r=Math.sqrt(random())*3.5;
    const x=home.x+Math.cos(theta)*r,z=home.z+Math.sin(theta)*r;
    if(waterValid(t,x,z)&&agents.every(a=>a.kind!=='fish'||Math.hypot(a.x-x,a.z-z)>radius.fish*1.15+a.radius+.03))
      create('fish',made++,x,z,home.x,home.z);
  }
  return agents;
}

/** Bounded ambient motion. A paused/non-finite timestep must leave every field untouched. */
export function stepFauna(agents:FaunaAgent[],t:FaunaTerrain,blocked:FaunaBlocker,player:{x:number;z:number},dt:number):void {
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);
  const occupancy=new FaunaSpatialIndex(agents);
  for(const a of agents){
    a.time+=dt;
    const fish=a.kind==='fish',clock=a.time+(a.seed%10000)/137,range=wander[a.kind];
    // School members use the same slow home-centred turn, with a small individual spread.
    const turn=fish?a.time*.21+a.homeX*.018+a.homeZ*.023:clock*.28;
    const spread=fish?(a.seed%37)*.06:0;
    const targetX=a.homeX+Math.sin(turn+spread)*range,targetZ=a.homeZ+Math.cos(turn*.83+spread)*range*.7;
    let dx=targetX-a.x,dz=targetZ-a.z,len=Math.hypot(dx,dz),speed=pace[a.kind];
    let active=fish||Math.sin(clock*.41)>.12;
    const awayX=a.x-player.x,awayZ=a.z-player.z,near=Math.hypot(awayX,awayZ);
    if(!fish&&near<1.5){
      dx=near>.001?awayX/near:Math.sin(a.seed);dz=near>.001?awayZ/near:Math.cos(a.seed);
      len=1;active=true;speed*=1.65;
    }
    a.moving=false;a.speed=0;
    if(active&&len>.12){
      const desired=Math.atan2(dx,-dz);
      a.heading=angle(a.heading+clamp(angle(desired-a.heading),-dt*3.5,dt*3.5));
      const step=Math.min(speed*dt,len),vx=dx/len*step,vz=dz/len*step;
      const valid=(x:number,z:number)=>Math.hypot(x-a.homeX,z-a.homeZ)<range*2+4
        &&occupancy.free(a,x,z)&&(fish?waterValid(t,x,z):landValid(t,blocked,x,z,a.radius));
      // Check midpoints too; do not tunnel across a narrow barrier or dry shoreline.
      for(const [sx,sz] of [[vx,vz],[vx,0],[0,vz],[-vz*.8,vx*.8],[vz*.8,-vx*.8]]){
        if(Math.hypot(sx,sz)<1e-8)continue;
        if(valid(a.x+sx*.5,a.z+sz*.5)&&valid(a.x+sx,a.z+sz)){
          occupancy.move(a,a.x+sx,a.z+sz);a.speed=Math.hypot(sx,sz)/dt;a.moving=true;break;
        }
      }
    }
    a.phase=(a.phase+dt*(fish?4:a.moving?7:1.4))%TAU;
    a.y=fish?fishHeight(t,a.x,a.z,clock):t.heightAt(a.x,a.z);
  }
}
