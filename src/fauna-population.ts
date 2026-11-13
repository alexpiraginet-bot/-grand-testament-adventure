// Artistic wildlife distribution, not historical population estimates. No assets or runtime activation.
// World-sector identities survive eviction; ambient motion resets only after a sector leaves the bounded cache.
import {buildingPoint,distanceToSegment,insideObstacle,rng,type Building,type Segment} from './world-layout.ts';
import type {FaunaAgent,FaunaBodyBounds,FaunaKind,FaunaTerrain,FaunaBlocker} from './fauna-simulation.ts';

export interface FaunaSector {x:number;z:number}
export interface FaunaCourtyard {id:string;x:number;z:number;radius:number}
export interface FaunaPopulationOptions {
  terrain:FaunaTerrain&{readonly size:number};
  routes:readonly Segment[];
  buildings:readonly Building[];
  /** Pass actual known clear yards if available. Building forecourts remain artistic fallbacks. */
  courtyards?:readonly FaunaCourtyard[];
  /** Static terrestrial props/walls; do not include moving NPCs or fauna. */
  blocked:FaunaBlocker;
  waterBlocked?:FaunaBlocker;
  bodies?:Partial<Record<FaunaKind,FaunaBodyBounds>>;
  /** Future integration must restrict this list to visually approved, loaded animal assets. */
  species?:readonly FaunaKind[];
  seed?:number;sectorSize?:number;loadRadius?:number;playableMargin?:number;
  maxAgents?:number;maxLoadedSectors?:number;maxCachedSectors?:number;loadsPerUpdate?:number;
}
export interface FaunaPopulationView {
  /** Mutable agent state for stepFauna; callers must not splice this manager-owned array. */
  agents:FaunaAgent[];added:FaunaAgent[];removed:string[];
  loadedSectorIds:string[];pendingSectors:number;
}
export interface FaunaPopulation {
  /** Use this terrain in stepFauna too, so wandering retains the playable map margin. */
  habitatTerrain:FaunaTerrain;
  update(player:{x:number;z:number}):FaunaPopulationView;
  clear():string[];
  diagnostics():{cachedSectors:number;activeAgents:number;generatedSectors:number;selectionUpdates:number};
}
export const FAUNA_POPULATION_MOBILE={sectorSize:128,loadRadius:96,maxAgents:48,maxLoadedSectors:9,maxCachedSectors:24,loadsPerUpdate:2,playableMargin:60} as const;
const kinds:readonly FaunaKind[]=['chicken','donkey','goat','sheep','fish'];
const defaults:Record<FaunaKind,FaunaBodyBounds>={
  chicken:{radius:.22,halfHeight:.28},donkey:{radius:.7,halfHeight:.8},
  goat:{radius:.42,halfHeight:.55},sheep:{radius:.42,halfHeight:.55},fish:{radius:.12,halfHeight:.12}
};
const footprint=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
const TAU=Math.PI*2;
const key=(p:FaunaSector)=>`${p.x}:${p.z}`;
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const square=(x:number,z:number)=>x*x+z*z;
const finite=(n:number,min:number,max:number,name:string)=>{
  if(!Number.isFinite(n)||n<min||n>max)throw Error(`Invalid fauna population ${name}`);return n;
};
export function faunaSectorAt(x:number,z:number,sectorSize=128):FaunaSector {
  finite(sectorSize,64,256,'sectorSize');
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid fauna population position');
  return{x:Math.floor(x/sectorSize),z:Math.floor(z/sectorSize)};
}

function prepare(options:FaunaPopulationOptions){
  const t=options.terrain,size=finite(options.sectorSize??128,64,256,'sectorSize');
  finite(t.size,128,100000,'terrain size');
  const margin=finite(options.playableMargin??60,0,t.size/2-.01,'playableMargin');
  const bodies={} as Record<FaunaKind,FaunaBodyBounds>;
  for(const kind of kinds){
    const body=options.bodies?.[kind]??defaults[kind];
    bodies[kind]={radius:finite(body.radius,.01,4,'body radius'),halfHeight:finite(body.halfHeight,.01,4,'body halfHeight')};
  }
  const seed=finite(options.seed??92471,0,0xffffffff,'seed')>>>0;
  const species=new Set(options.species??kinds);
  for(const kind of species)if(!kinds.includes(kind))throw Error('Invalid fauna population species');
  // Geometry is indexed once, not re-scanned globally whenever the player moves.
  const houseCells=new Map<string,Building[]>(),yardCells=new Map<string,FaunaCourtyard[]>(),routeCells=new Map<string,Segment[]>();
  function index<T>(map:Map<string,T[]>,item:T,minX:number,minZ:number,maxX:number,maxZ:number){
    for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++){
      const id=key({x,z}),items=map.get(id)??[];items.push(item);map.set(id,items);
    }
  }
  for(const b of options.buildings){
    const reach=Math.hypot(b.w,b.d)/2+40;
    index(houseCells,b,b.x-reach,b.z-reach,b.x+reach,b.z+reach);
  }
  for(const y of options.courtyards??[]){
    if(![y.x,y.z,y.radius].every(Number.isFinite)||y.radius<=0||y.radius>40)throw Error('Invalid fauna courtyard');
    index(yardCells,y,y.x-y.radius,y.z-y.radius,y.x+y.radius,y.z+y.radius);
  }
  for(const r of options.routes)index(routeCells,r,Math.min(r.ax,r.bx)-25,Math.min(r.az,r.bz)-25,Math.max(r.ax,r.bx)+25,Math.max(r.az,r.bz)+25);

  function generate(sector:FaunaSector):FaunaAgent[]{
    if(!Number.isInteger(sector.x)||!Number.isInteger(sector.z))throw Error('Invalid fauna sector coordinates');
    const x0=sector.x*size,z0=sector.z*size,world=t.size/2-margin;
    if(x0>=world||z0>=world||x0+size<=-world||z0+size<=-world)return[];
    const sectorId=key(sector),houses=houseCells.get(sectorId)??[],yards=yardCells.get(sectorId)??[],routes=routeCells.get(sectorId)??[];
    const agents:FaunaAgent[]=[];
    const inSector=(x:number,z:number,r:number)=>x>=x0+r+.05&&x<x0+size-r-.05&&z>=z0+r+.05&&z<z0+size-r-.05;
    const houseBlocked=(x:number,z:number,r:number)=>houses.some(b=>insideObstacle(x,z,{...b,hx:b.w/2,hz:b.d/2},r+.3));
    const samples=(x:number,z:number,r:number)=>footprint.map(([dx,dz])=>({x:x+dx*r,z:z+dz*r}));
    const valid=(kind:FaunaKind,x:number,z:number,r:number,halfHeight:number)=>{
      if(!inSector(x,z,r))return false;
      const points=samples(x,z,r);
      if(points.some(p=>!t.inside(p.x,p.z,margin)))return false;
      const heights=points.map(p=>t.heightAt(p.x,p.z));
      if(kind==='fish')return Math.max(...heights)<-.65&&Math.max(...heights)+2*halfHeight+.08<=0&&!points.some(p=>options.waterBlocked?.(p.x,p.z));
      if(Math.min(...heights)<.25||Math.max(...heights)-Math.min(...heights)>Math.max(.18,r*.9))return false;
      // Avoid steep terrain beyond the tiny footprint too; no grazing on abrupt escarpments.
      if(Math.hypot(t.heightAt(x+2,z)-t.heightAt(x-2,z),t.heightAt(x,z+2)-t.heightAt(x,z-2))/4>.45)return false;
      if(routes.some(s=>distanceToSegment(x,z,s)<s.r+r+.5)||houseBlocked(x,z,r))return false;
      return !points.some(p=>options.blocked(p.x,p.z));
    };
    const create=(kind:FaunaKind,slot:number,x:number,z:number,homeX:number,homeZ:number)=>{
      const id=`fauna:${seed}:${sectorId}:${kind}:${slot}`,random=rng(hash(id)),body=bodies[kind];
      const scale=.85+random()*.3,r=body.radius*scale,halfHeight=body.halfHeight*scale;
      if(!valid(kind,x,z,r,halfHeight)||agents.some(a=>(a.kind==='fish')===(kind==='fish')&&Math.hypot(a.x-x,a.z-z)<a.radius+r+.08))return false;
      const phase=random()*TAU,heading=random()*TAU,individualSeed=Math.floor(random()*0x7fffffff);
      const bed=Math.max(...samples(x,z,r).map(p=>t.heightAt(p.x,p.z)));
      const y=kind==='fish'?Math.max(bed+halfHeight+.04,Math.min(-halfHeight-.04,-.42+Math.sin((individualSeed%10000)/137)*.13)):t.heightAt(x,z);
      agents.push({id,kind,x,y,z,heading,homeX,homeZ,phase,scale,radius:r,halfHeight,seed:individualSeed,time:0,moving:false,speed:0});return true;
    };
    for(const kind of kinds){
      if(!species.has(kind))continue;
      const random=rng(hash(`${seed}:${sectorId}:${kind}:homes`));
      const domestic=kind==='chicken'||kind==='donkey',fish=kind==='fish';
      // Household activity is denser around known yards/frontages; inland groups remain sparse.
      const anchors=[...yards.map(y=>({x:y.x,z:y.z,r:Math.min(y.radius,5)})),...houses.map(b=>({...buildingPoint(b,0,b.d/2+4),r:3.5}))]
        .filter(p=>inSector(p.x,p.z,2)).sort((a,b)=>a.x-b.x||a.z-b.z);
      if(domestic&&!anchors.length)continue;
      if(!domestic&&!fish&&random()>.58)continue;
      const groups=fish?2:domestic?Math.min(kind==='chicken'?4:2,anchors.length):1;
      for(let group=0;group<groups;group++){
        const count=fish?6:kind==='chicken'?3:kind==='donkey'?1:3;
        let home:{x:number;z:number}|null=null;
        for(let attempt=0;attempt<48&&!home;attempt++){
          const anchor=domestic?anchors[Math.floor(random()*anchors.length)]:null;
          const x=anchor?anchor.x+(random()-.5)*anchor.r*2:x0+6+random()*(size-12);
          const z=anchor?anchor.z+(random()-.5)*anchor.r*2:z0+6+random()*(size-12);
          if(!domestic&&!fish&&houses.some(b=>Math.hypot(b.x-x,b.z-z)<Math.hypot(b.w,b.d)/2+12))continue;
          if(valid(kind,x,z,bodies[kind].radius*1.15,bodies[kind].halfHeight*1.15))home={x,z};
        }
        if(!home)continue;
        for(let member=0;member<count;member++)for(let attempt=0;attempt<24;attempt++){
          const theta=random()*TAU,spread=member===0?0:Math.sqrt(random())*(fish?3:domestic?2.5:4);
          const x=home.x+Math.sin(theta)*spread,z=home.z+Math.cos(theta)*spread;
          // Ground individuals wander around their own starting point; a school shares one home.
          if(create(kind,group*count+member,x,z,fish?home.x:x,fish?home.z:z))break;
        }
      }
    }
    return agents;
  }
  return{generate,size,seed,margin};
}

/** Offline/test inspection of a single canonical sector. Runtime should reuse createFaunaPopulation. */
export function generateFaunaSector(options:FaunaPopulationOptions,sector:FaunaSector):FaunaAgent[]{
  return prepare(options).generate(sector);
}

/** Bounded CPU population cache. It loads no GLBs, textures, sounds or global animal arrays. */
export function createFaunaPopulation(options:FaunaPopulationOptions):FaunaPopulation {
  const prepared=prepare(options),{size,generate}=prepared;
  const loadRadius=finite(options.loadRadius??96,16,512,'loadRadius');
  const maxAgents=Math.floor(finite(options.maxAgents??48,1,256,'maxAgents'));
  const maxLoaded=Math.floor(finite(options.maxLoadedSectors??9,1,25,'maxLoadedSectors'));
  const maxCached=Math.floor(finite(options.maxCachedSectors??24,maxLoaded,128,'maxCachedSectors'));
  const loadsPerUpdate=Math.floor(finite(options.loadsPerUpdate??2,1,4,'loadsPerUpdate'));
  const selectionStep=16,cache=new Map<string,FaunaAgent[]>();
  let agents:FaunaAgent[]=[],selectedCell='',desired:FaunaSector[]=[],generatedSectors=0,selectionUpdates=0;
  const loadedIds=()=>desired.map(key).filter(id=>cache.has(id));
  const result=(added:FaunaAgent[]=[],removed:string[]=[]):FaunaPopulationView=>({agents,added,removed,loadedSectorIds:loadedIds(),pendingSectors:desired.filter(s=>!cache.has(key(s))).length});
  function update(player:{x:number;z:number}):FaunaPopulationView {
    if(!Number.isFinite(player.x)||!Number.isFinite(player.z))return result();
    const cell=`${Math.floor(player.x/selectionStep)}:${Math.floor(player.z/selectionStep)}`;
    const changed=cell!==selectedCell;
    const center={x:(Math.floor(player.x/selectionStep)+.5)*selectionStep,z:(Math.floor(player.z/selectionStep)+.5)*selectionStep};
    if(changed){
      selectedCell=cell;selectionUpdates++;
      desired=[];
      for(let z=Math.floor((center.z-loadRadius)/size);z<=Math.floor((center.z+loadRadius)/size);z++)
        for(let x=Math.floor((center.x-loadRadius)/size);x<=Math.floor((center.x+loadRadius)/size);x++){
          const x0=x*size,z0=z*size,r=options.terrain.size/2-prepared.margin;
          if(x0>=r||z0>=r||x0+size<=-r||z0+size<=-r)continue;
          const dx=Math.max(x0-center.x,0,center.x-x0-size),dz=Math.max(z0-center.z,0,center.z-z0-size);
          if(square(dx,dz)<=loadRadius*loadRadius)desired.push({x,z});
        }
      desired.sort((a,b)=>square((a.x+.5)*size-center.x,(a.z+.5)*size-center.z)-square((b.x+.5)*size-center.x,(b.z+.5)*size-center.z)||a.x-b.x||a.z-b.z);
      desired=desired.slice(0,maxLoaded);
    }
    let loaded=0;
    for(const sector of desired){
      const id=key(sector),existing=cache.get(id);
      if(existing){cache.delete(id);cache.set(id,existing);continue;}
      if(loaded>=loadsPerUpdate)continue;
      cache.set(id,generate(sector));loaded++;generatedSectors++;
    }
    if(!changed&&!loaded)return result();
    const wanted=new Set(desired.map(key));
    for(const id of cache.keys()){if(cache.size<=maxCached)break;if(!wanted.has(id))cache.delete(id);}
    // At most maxLoaded sectors are scanned, only on cell changes/new sector arrivals.
    const candidates=desired.flatMap(s=>cache.get(key(s))??[])
      .filter(a=>square(a.x-center.x,a.z-center.z)<=loadRadius*loadRadius)
      .sort((a,b)=>square(a.x-center.x,a.z-center.z)-square(b.x-center.x,b.z-center.z)||(a.id<b.id?-1:a.id>b.id?1:0));
    const next:FaunaAgent[]=[];
    for(const a of candidates){
      if(next.length>=maxAgents)break;
      // Moving cached animals may cross sector edges. Re-admit only if their body space is free.
      if(next.some(b=>(a.kind==='fish')===(b.kind==='fish')&&Math.hypot(a.x-b.x,a.z-b.z)<a.radius+b.radius+.03))continue;
      next.push(a);
    }
    const previous=new Set(agents.map(a=>a.id)),nextIds=new Set(next.map(a=>a.id));
    const added=next.filter(a=>!previous.has(a.id)),removed=agents.filter(a=>!nextIds.has(a.id)).map(a=>a.id);
    agents=next;return result(added,removed);
  }
  const habitatTerrain:FaunaTerrain={heightAt:(x,z)=>options.terrain.heightAt(x,z),
    inside:(x,z,margin=0)=>options.terrain.inside(x,z,Math.max(margin,prepared.margin)),meta:options.terrain.meta};
  return{habitatTerrain,update,clear(){const removed=agents.map(a=>a.id);cache.clear();agents=[];desired=[];selectedCell='';return removed;},
    diagnostics:()=>({cachedSectors:cache.size,activeAgents:agents.length,generatedSectors,selectionUpdates})};
}
