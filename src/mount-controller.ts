// Pure mounted locomotion contract. No Three, scene mutation, animation, IO or recovery warp.
export interface MountPosition {x:number;y:number;z:number}
export interface MountTarget extends MountPosition {
  id:string;kind:string;heading:number;radius:number;halfHeight:number;
  /** Reviewed conservative height of the complete donkey+rider, not only the animal. */
  mountedHeight:number;
  approved:boolean;visualReady:boolean;
}
export interface MountedState extends MountPosition {
  animalId:string;heading:number;radius:number;halfHeight:number;height:number;speed:number;
}
export interface MountBodyQuery {
  from:MountPosition;to:MountPosition;radius:number;height:number;animalId:string;
  phase:'mount'|'ride'|'dismount';
}
export interface MountWorld {
  heightAt(x:number,z:number):number;
  inside(x:number,z:number):boolean;
  /** Required swept volume + occupancy gate, including ceilings and other actors.
   * Ignore only animalId itself. A point-only obstruction check does not implement this contract. */
  bodyClear(query:MountBodyQuery):boolean;
}
export const MOUNT_RULES={speedMultiplier:1.6,maxDt:.05,reach:1.8,riderRadius:.30,riderHeight:1.76,
  dryHeight:.25,maxSlope:.42,groundTolerance:.015,maxFootHeightError:.06,sample:.12,
  maxTurnRate:3,exitGap:.18,maxQueryDistance:4} as const;
export type MountFailure='already-mounted'|'not-mounted'|'invalid-target'|'visual-not-ready'|'reserved'
  |'too-far'|'unsafe-approach'|'unsafe-body'|'no-safe-exit';
export type MountResult={ok:true;state:MountedState}|{ok:false;reason:MountFailure};
export interface MountDismountPreview {position:MountPosition;from:MountPosition;animal:MountedState}
export type DismountResult=({ok:true}&MountDismountPreview)|{ok:false;reason:MountFailure};

/** Share this registry if more than one interaction controller can reserve fauna. */
export class MountReservations {
  private owners=new Map<string,symbol>();
  isReserved(id:string):boolean{return this.owners.has(id);}
  claim(id:string,owner:symbol):boolean{if(this.owners.has(id))return false;this.owners.set(id,owner);return true;}
  release(id:string,owner:symbol):boolean{if(this.owners.get(id)!==owner)return false;this.owners.delete(id);return true;}
}
const finite=(p:MountPosition)=>[p.x,p.y,p.z].every(Number.isFinite);
const length=(a:MountPosition,b:MountPosition)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const copyPosition=(p:MountPosition):MountPosition=>({x:p.x,y:p.y,z:p.z});
const directions=[[0,0],[1,0],[-1,0],[0,1],[0,-1],
  [Math.SQRT1_2,Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2],
  [Math.SQRT1_2,-Math.SQRT1_2],[-Math.SQRT1_2,-Math.SQRT1_2]] as const;

/** Sampled terrain support is a conservative proxy, not triangle/hoof IK collision. */
function support(world:MountWorld,x:number,z:number,radius:number):MountPosition|null {
  if(![x,z,radius].every(Number.isFinite)||radius<=0)return null;
  const center=world.heightAt(x,z);if(!Number.isFinite(center))return null;
  for(const [dx,dz] of directions){
    const sx=x+dx*radius,sz=z+dz*radius,y=world.heightAt(sx,sz);
    if(!world.inside(sx,sz)||!Number.isFinite(y)||y<MOUNT_RULES.dryHeight)return null;
    if(Math.abs(y-center)>Math.hypot(dx,dz)*radius*MOUNT_RULES.maxSlope+MOUNT_RULES.groundTolerance)return null;
  }
  return{x,y:center,z};
}
function traverse(world:MountWorld,from:MountPosition,to:MountPosition,radius:number,height:number,animalId:string,phase:MountBodyQuery['phase']):boolean {
  if(!finite(from)||!finite(to)||![radius,height].every(Number.isFinite)||radius<=0||height<=0)return false;
  const distance=length(from,to);if(distance>MOUNT_RULES.maxQueryDistance)return false;
  const steps=Math.max(1,Math.ceil(distance/MOUNT_RULES.sample));let previous=from.y;
  for(let i=0;i<=steps;i++){
    const p=support(world,from.x+(to.x-from.x)*i/steps,from.z+(to.z-from.z)*i/steps,radius);if(!p)return false;
    if((i===0&&Math.abs(p.y-from.y)>MOUNT_RULES.maxFootHeightError)||(i===steps&&Math.abs(p.y-to.y)>MOUNT_RULES.maxFootHeightError))return false;
    if(i&&Math.abs(p.y-previous)>distance/steps*MOUNT_RULES.maxSlope+MOUNT_RULES.groundTolerance)return false;
    previous=p.y;
  }
  return world.bodyClear({from:copyPosition(from),to:copyPosition(to),radius,height,animalId,phase})===true;
}

export class MountController {
  readonly speed:number;
  private mounted:MountedState|null=null;
  private reservations:MountReservations;
  private owner=Symbol('mount-controller');
  constructor(options:{walkSpeed:number;reservations?:MountReservations}){
    if(!Number.isFinite(options.walkSpeed)||options.walkSpeed<=0||options.walkSpeed>10)throw Error('Invalid base walking speed');
    // There is intentionally no running/boost multiplier or input in this controller.
    this.speed=options.walkSpeed*MOUNT_RULES.speedMultiplier;
    this.reservations=options.reservations??new MountReservations();
  }
  get state():MountedState|null{return this.mounted?{...this.mounted}:null;}
  isReserved(id:string):boolean{return this.reservations.isReserved(id);}

  tryMount(target:MountTarget,rider:MountPosition,world:MountWorld):MountResult {
    if(this.mounted)return{ok:false,reason:'already-mounted'};
    if(!target||!finite(target)||!finite(rider)||target.kind!=='donkey'||target.approved!==true
      ||typeof target.id!=='string'||!target.id.length||target.id.length>160
      ||![target.heading,target.radius,target.halfHeight,target.mountedHeight].every(Number.isFinite)
      ||target.radius<=0||target.radius>3||target.halfHeight<=0||target.halfHeight>3
      ||target.mountedHeight<Math.max(target.halfHeight*2,MOUNT_RULES.riderHeight)||target.mountedHeight>6)
      return{ok:false,reason:'invalid-target'};
    if(target.visualReady!==true)return{ok:false,reason:'visual-not-ready'};
    if(this.isReserved(target.id))return{ok:false,reason:'reserved'};
    if(length(target,rider)>MOUNT_RULES.reach||Math.abs(target.y-rider.y)>.35)return{ok:false,reason:'too-far'};
    const next:MountedState={animalId:target.id,x:target.x,y:target.y,z:target.z,heading:angle(target.heading),
      radius:Math.max(target.radius,MOUNT_RULES.riderRadius),halfHeight:target.halfHeight,height:target.mountedHeight,speed:0};
    if(!traverse(world,rider,next,MOUNT_RULES.riderRadius,MOUNT_RULES.riderHeight,target.id,'mount'))return{ok:false,reason:'unsafe-approach'};
    if(!traverse(world,next,next,next.radius,next.height,target.id,'ride'))return{ok:false,reason:'unsafe-body'};
    if(!this.exit(next,world))return{ok:false,reason:'no-safe-exit'};
    if(!this.reservations.claim(target.id,this.owner))return{ok:false,reason:'reserved'};
    this.mounted=next;return{ok:true,state:{...next}};
  }

  /** Input is a world-space XZ direction after camera conversion, never a desired position. */
  update(dt:number,input:{x:number;z:number},world:MountWorld,options:{paused?:boolean}={}):MountedState|null {
    const current=this.mounted;if(!current)return null;
    current.speed=0;
    if(options.paused||!Number.isFinite(dt)||dt<=0||![input.x,input.z].every(Number.isFinite))return this.state;
    dt=Math.min(dt,MOUNT_RULES.maxDt);const magnitude=Math.hypot(input.x,input.z);if(magnitude<=.08)return this.state;
    const desired=Math.atan2(input.x,-input.z),delta=angle(desired-current.heading);
    const heading=angle(current.heading+Math.max(-dt*MOUNT_RULES.maxTurnRate,Math.min(dt*MOUNT_RULES.maxTurnRate,delta)));
    // A large turn is made on the spot; the animal never slides sideways or instantly reverses.
    if(Math.abs(angle(desired-heading))>1.05){
      if(traverse(world,current,current,current.radius,current.height,current.animalId,'ride'))current.heading=heading;
      return this.state;
    }
    const distance=this.speed*Math.min(1,magnitude)*dt;
    const next=support(world,current.x+Math.sin(heading)*distance,current.z-Math.cos(heading)*distance,current.radius);
    if(!next||!traverse(world,current,next,current.radius,current.height,current.animalId,'ride'))return this.state;
    // Keep at least one reachable side exit along the route. A newly blocked exit never causes a warp.
    if(!this.exit({...current,...next,heading},world))return this.state;
    current.speed=length(current,next)/dt;current.x=next.x;current.y=next.y;current.z=next.z;current.heading=heading;
    return this.state;
  }

  previewDismount(world:MountWorld):MountDismountPreview|null{return this.mounted?this.exit(this.mounted,world):null;}
  tryDismount(world:MountWorld):DismountResult {
    if(!this.mounted)return{ok:false,reason:'not-mounted'};
    const exit=this.previewDismount(world);if(!exit)return{ok:false,reason:'no-safe-exit'};
    this.reservations.release(this.mounted.animalId,this.owner);this.mounted=null;
    return{ok:true,...exit};
  }
  private exit(state:MountedState,world:MountWorld):MountDismountPreview|null {
    const side=state.radius+MOUNT_RULES.riderRadius+MOUNT_RULES.exitGap,c=Math.cos(state.heading),s=Math.sin(state.heading);
    // Local right/left first, then modest diagonal alternatives. No search, spawn or distant repair.
    for(const [right,forward] of [[side,0],[-side,0],[side,-.35],[-side,-.35],[side,.35],[-side,.35]]){
      const candidate=support(world,state.x+c*right+s*forward,state.z+s*right-c*forward,MOUNT_RULES.riderRadius);
      if(candidate&&length(state,candidate)>=state.radius+MOUNT_RULES.riderRadius
        &&traverse(world,state,candidate,MOUNT_RULES.riderRadius,MOUNT_RULES.riderHeight,state.animalId,'dismount'))
        return{from:copyPosition(state),position:candidate,animal:{...state}};
    }
    return null;
  }
}
