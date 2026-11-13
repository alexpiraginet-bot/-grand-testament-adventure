// One reviewed follower. Every segment is checked; no teleport/catch-up shortcut.
import type {Vec2} from './missions.ts';
export interface NpcGround {heightAt(x:number,z:number):number;inside(x:number,z:number):boolean;blocked(x:number,z:number):boolean;segmentBlocked?(a:Vec2,b:Vec2,radius:number):boolean}
export const NPC_MOTION={radius:.38,speed:.70,spacing:1.55,sample:.18,trailStep:.55,trailCap:2048,grid:.65,maxSearch:2600,maxLink:28,maxSlope:.42} as const;
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(p:Vec2)=>Number.isFinite(p.x)&&Number.isFinite(p.z);
/** Exact segment against an expanded oriented footprint (conservative for a disc). */
export function npcCrossesBox(a:Vec2,b:Vec2,box:{x:number;z:number;hx:number;hz:number;rot:number},radius:number=NPC_MOTION.radius):boolean{
 const c=Math.cos(box.rot),s=Math.sin(box.rot),local=(p:Vec2)=>({x:(p.x-box.x)*c-(p.z-box.z)*s,z:(p.x-box.x)*s+(p.z-box.z)*c}),p=local(a),q=local(b);
 let near=0,far=1;for(const [start,delta,limit] of [[p.x,q.x-p.x,box.hx+radius],[p.z,q.z-p.z,box.hz+radius]]){
  if(Math.abs(delta)<1e-12){if(Math.abs(start)>limit)return false;continue;}
  const t1=(-limit-start)/delta,t2=(limit-start)/delta;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)return false;
 }return true;
}
/** Full body clearance and dry land. Grounded mesh has no terrain IK, so avoid steep footing. */
export function npcStandable(world:NpcGround,p:Vec2):boolean{
 if(!finite(p)||world.segmentBlocked?.(p,p,NPC_MOTION.radius))return false;const heights:number[]=[];
 for(const [dx,dz] of [[0,0],[.38,0],[-.38,0],[0,.38],[0,-.38],[.27,.27],[-.27,.27],[.27,-.27],[-.27,-.27]]){
  const x=p.x+dx,z=p.z+dz,y=world.heightAt(x,z);
  if(!world.inside(x,z)||world.blocked(x,z)||!Number.isFinite(y)||y<.015)return false;heights.push(y);
 }
 return Math.max(...heights)-Math.min(...heights)<.18;
}
export function npcCanTraverse(world:NpcGround,a:Vec2,b:Vec2):boolean{
 if(!finite(a)||!finite(b)||world.segmentBlocked?.(a,b,NPC_MOTION.radius))return false;const length=distance(a,b),steps=Math.max(1,Math.ceil(length/NPC_MOTION.sample));
 let height=world.heightAt(a.x,a.z);
 for(let i=0;i<=steps;i++){
  const p={x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps};if(!npcStandable(world,p))return false;
  const next=world.heightAt(p.x,p.z);if(i&&Math.abs(next-height)>(length/steps)*NPC_MOTION.maxSlope+.015)return false;height=next;
 }return true;
}
/** Used only before first visibility (initial encounter or resumed narrative state). */
export function npcSpawn(world:NpcGround,near:Vec2,maxRadius=6):Vec2|null{
 if(npcStandable(world,near))return{...near};
 for(let radius=.5;radius<=maxRadius;radius+=.5)for(let i=0;i<24;i++){
  const p={x:near.x+Math.sin(i*Math.PI/12)*radius,z:near.z+Math.cos(i*Math.PI/12)*radius};if(npcStandable(world,p))return p;
 }return null;
}
/** Small bounded local repair around a wall or wading section, never a map-wide search per frame. */
export function npcLocalPath(world:NpcGround,start:Vec2,end:Vec2,budget:number=1600):Vec2[]|null{
 if(distance(start,end)>NPC_MOTION.maxLink||!npcStandable(world,start)||!npcStandable(world,end))return null;
 if(npcCanTraverse(world,start,end))return[{...end}];
 const grid=NPC_MOTION.grid,key=(x:number,z:number)=>`${x},${z}`,point=(x:number,z:number)=>({x:start.x+x*grid,z:start.z+z*grid});
 type Node={x:number;z:number;g:number;f:number;parent:Node|null};
 const first:Node={x:0,z:0,g:0,f:distance(start,end),parent:null},open=[first],best=new Map([[key(0,0),0]]),clearance=new Map<string,boolean>();
 const valid=(x:number,z:number)=>{const k=key(x,z);if(!clearance.has(k))clearance.set(k,npcStandable(world,point(x,z)));return clearance.get(k)!;};
 for(let visits=0;open.length&&visits<Math.min(NPC_MOTION.maxSearch,budget);visits++){
  let pick=0;for(let i=1;i<open.length;i++)if(open[i].f<open[pick].f)pick=i;
  const node=open.splice(pick,1)[0],p=point(node.x,node.z);
  if(node.g>(best.get(key(node.x,node.z))??Infinity))continue;
  if(distance(p,end)<grid*1.5&&npcCanTraverse(world,p,end)){
   const result:Vec2[]=[{...end}];let cursor:Node|null=node;while(cursor?.parent){result.push(point(cursor.x,cursor.z));cursor=cursor.parent;}return result.reverse();
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=node.x+dx,z=node.z+dz,next=point(x,z),cost=node.g+Math.hypot(dx,dz)*grid,k=key(x,z);
   if(Math.abs(x)>50||Math.abs(z)>50||cost>65||cost>=(best.get(k)??Infinity)||!valid(x,z)||!npcCanTraverse(world,p,next))continue;
   best.set(k,cost);open.push({x,z,g:cost,f:cost+distance(next,end),parent:node});
  }
 }return null;
}
export class NpcNavigation{
 readonly pos:Vec2;heading:number;speed=0;following=false;reason='waiting';
 private trail:Vec2[]=[];private retry=0;private shortcutIn=0;private lastTarget:Vec2|null=null;
 private projectionIn=0;private projected:Vec2|null=null;
 private world:NpcGround;private searchBudget:number;
 constructor(world:NpcGround,start:Vec2,heading:number,searchBudget=1600){if(!npcStandable(world,start))throw Error('NPC start is not safe land');this.world=world;this.searchBudget=searchBudget;this.pos={...start};this.heading=heading;}
 update(dt:number,target:Vec2,follow:boolean,paused=false):void{
  if(paused||!Number.isFinite(dt)||dt<=0){this.speed=0;return;}dt=Math.min(dt,.05);this.retry=Math.max(0,this.retry-dt);this.shortcutIn=Math.max(0,this.shortcutIn-dt);this.projectionIn=Math.max(0,this.projectionIn-dt);this.speed=0;
  if(!follow){this.following=false;this.trail=[];this.reason='waiting';return;}this.following=true;
  // The hero can wade. Queue nearby dry footing instead, never the point inside the lake.
  let routeTarget:Vec2|null=target;
  if(!npcStandable(this.world,target)){
   if(this.projectionIn===0){this.projectionIn=.7;this.projected=npcSpawn(this.world,target,3);}
   routeTarget=this.projected&&distance(this.projected,target)<=3.5?this.projected:null;
  }
  const tail=this.trail.at(-1)??this.pos;
  if(routeTarget&&distance(tail,routeTarget)>=NPC_MOTION.trailStep&&distance(tail,routeTarget)<=NPC_MOTION.maxLink&&this.trail.length<NPC_MOTION.trailCap){
   if(npcCanTraverse(this.world,tail,routeTarget))this.trail.push({...routeTarget});
   else if(this.retry===0&&(!this.lastTarget||distance(this.lastTarget,routeTarget)>.5||!this.trail.length)){
    this.retry=1.5;this.lastTarget={...routeTarget};const path=npcLocalPath(this.world,tail,routeTarget,this.searchBudget);
    if(path)this.trail.push(...path.slice(0,NPC_MOTION.trailCap-this.trail.length));else this.reason='no-safe-link';
   }
  }
  if(distance(this.pos,target)<NPC_MOTION.spacing){this.reason='near-player';return;}
  // Limited safe shortcut removes obsolete bends only when the swept body can cross them.
  if(this.shortcutIn===0){this.shortcutIn=.35;for(let i=Math.min(this.trail.length-1,4);i>0;i--)if(distance(this.pos,this.trail[i])<6&&npcCanTraverse(this.world,this.pos,this.trail[i])){this.trail.splice(0,i);break;}}
  while(this.trail.length&&distance(this.pos,this.trail[0])<.06)this.trail.shift();
  const goal=this.trail[0];if(!goal){this.reason='waiting-for-safe-trail';return;}
  const length=distance(this.pos,goal),step=Math.min(length,NPC_MOTION.speed*dt),next={x:this.pos.x+(goal.x-this.pos.x)/length*step,z:this.pos.z+(goal.z-this.pos.z)/length*step};
  if(!npcCanTraverse(this.world,this.pos,next)){this.reason='blocked';this.trail=[];this.retry=0;return;}
  const desired=Math.atan2(next.x-this.pos.x,-(next.z-this.pos.z)),delta=Math.atan2(Math.sin(desired-this.heading),Math.cos(desired-this.heading));
  this.heading+=delta*Math.min(1,dt*6);if(Math.abs(delta)>1.05){this.reason='turning';return;}
  this.pos.x=next.x;this.pos.z=next.z;this.speed=step/dt;this.reason='following';
 }
 diagnostics(){return{pos:{...this.pos},heading:this.heading,speed:this.speed,following:this.following,reason:this.reason,queued:this.trail.length};}
}
