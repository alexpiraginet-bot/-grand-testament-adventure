// Art-directed settlement on the measured terrain, not an archaeological site plan.
import type { Terrain } from './terrain.ts';

export type Segment = { ax: number; az: number; bx: number; bz: number; r: number };
export type Building = { x: number; z: number; y: number; w: number; d: number; h: number; foundation: number; rot: number; variant: number };
export type Obstacle = { x: number; z: number; hx: number; hz: number; rot: number; bottom?:number; top?:number };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distanceToSegment(x: number, z: number, s: Segment) {
  const dx = s.bx-s.ax, dz = s.bz-s.az, l2 = dx*dx+dz*dz;
  const u = l2 ? Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/l2)) : 0;
  return Math.hypot(x-s.ax-u*dx,z-s.az-u*dz);
}

export function insideObstacle(x: number, z: number, b: Obstacle, margin = 0) {
  const c=Math.cos(b.rot),s=Math.sin(b.rot),dx=x-b.x,dz=z-b.z;
  return Math.abs(dx*c-dz*s)<b.hx+margin && Math.abs(dx*s+dz*c)<b.hz+margin;
}

function pathIntersects(s:Segment,b:Obstacle) {
  const c=Math.cos(b.rot),sn=Math.sin(b.rot),local=(x:number,z:number)=>[(x-b.x)*c-(z-b.z)*sn,(x-b.x)*sn+(z-b.z)*c];
  const a=local(s.ax,s.az),end=local(s.bx,s.bz),half=[b.hx+s.r+.35,b.hz+s.r+.35];
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++){
    const d=end[axis]-a[axis];
    if(Math.abs(d)<1e-8){if(Math.abs(a[axis])>half[axis])return false;continue;}
    const t0=(-half[axis]-a[axis])/d,t1=(half[axis]-a[axis])/d;
    lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
  }
  return true;
}

function buildingsOverlap(a:Building,b:{x:number;z:number;w:number;d:number;rot:number}) {
  const axes=(rot:number)=>[[Math.cos(rot),-Math.sin(rot)],[Math.sin(rot),Math.cos(rot)]];
  const aa=axes(a.rot),bb=axes(b.rot);
  const projection=(axis:number[],basis:number[][],w:number,d:number)=>Math.abs(axis[0]*basis[0][0]+axis[1]*basis[0][1])*w/2+Math.abs(axis[0]*basis[1][0]+axis[1]*basis[1][1])*d/2;
  return [...aa,...bb].every(axis=>Math.abs((a.x-b.x)*axis[0]+(a.z-b.z)*axis[1])<projection(axis,aa,a.w,a.d)+projection(axis,bb,b.w,b.d)+1.2);
}

export function missionRoutes(t: Terrain): Segment[] {
  const p=t.meta.points, pairs=[['start','beach'],['beach','simao'],['simao','barco_margem']] as const;
  return pairs.flatMap(([a,b])=>landRoute(t,p[a],p[b]));
}

function landRoute(t:Terrain,a:[number,number],b:[number,number]):Segment[] {
  const dry=(x:number,z:number)=>[[-1,0],[1,0],[0,-1],[0,1],[0,0]].every(([dx,dz])=>t.heightAt(x+dx,z+dz)>-.35);
  const visible=(a:[number,number],b:[number,number])=>{
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
    for(let i=0;i<=n;i++)if(!dry(a[0]+(b[0]-a[0])*i/Math.max(n,1),a[1]+(b[1]-a[1])*i/Math.max(n,1)))return false;
    return true;
  };
  const segment=(a:[number,number],b:[number,number]):Segment=>({ax:a[0],az:a[1],bx:b[0],bz:b[1],r:1.35});
  if(visible(a,b))return[segment(a,b)];
  // A* over the actual height field. It changes only the footpath, never the shoreline or elevation.
  const step=4,x0=Math.floor((Math.min(a[0],b[0])-120)/step)*step,z0=Math.floor((Math.min(a[1],b[1])-120)/step)*step;
  const nx=Math.ceil((Math.max(a[0],b[0])+120-x0)/step),nz=Math.ceil((Math.max(a[1],b[1])+120-z0)/step),n=nx*nz;
  const xy=(i:number):[number,number]=>[x0+(i%nx)*step,z0+Math.floor(i/nx)*step];
  const nearest=(p:[number,number])=>{
    let best=-1,d=Infinity;
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
      const q:[number,number]=[x0+ix*step,z0+iz*step],dd=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(dd<d&&dd<20&&dry(...q)&&visible(p,q)){best=iz*nx+ix;d=dd;}
    }
    if(best<0)throw Error('No walkable route endpoint');return best;
  };
  const start=nearest(a),end=nearest(b),score=new Float64Array(n).fill(Infinity),from=new Int32Array(n).fill(-1),closed=new Uint8Array(n),open=[start];score[start]=0;
  while(open.length){
    let best=0,bestCost=Infinity;
    for(let i=0;i<open.length;i++){const q=xy(open[i]),cost=score[open[i]]+Math.hypot(q[0]-b[0],q[1]-b[1]);if(cost<bestCost){best=i;bestCost=cost;}}
    const cur=open.splice(best,1)[0];if(cur===end)break;if(closed[cur])continue;closed[cur]=1;
    const ix=cur%nx,iz=Math.floor(cur/nx),p=xy(cur);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz||ix+dx<0||ix+dx>=nx||iz+dz<0||iz+dz>=nz)continue;
      const next=(iz+dz)*nx+ix+dx,q=xy(next);if(closed[next]||!visible(p,q))continue;
      const cost=score[cur]+Math.hypot(dx,dz)*step*(t.heightAt(...q)<.35?1.2:1);
      if(cost<score[next]){score[next]=cost;from[next]=cur;open.push(next);}
    }
  }
  if(!Number.isFinite(score[end]))throw Error('No land route to mission');
  const points:[number,number][]=[b];for(let i=end;i!==-1;i=from[i])points.unshift(xy(i));points.unshift(a);
  const out:Segment[]=[];
  for(let i=0;i<points.length-1;){let j=points.length-1;while(j>i+1&&!visible(points[i],points[j]))j--;out.push(segment(points[i],points[j]));i=j;}
  return out;
}

/** Courtyard blocks near Capernaum and a settlement edge along the walk to the shore. */
export function settlementLayout(t: Terrain, routes: Segment[], cx=0, cz=0): Building[] {
  const r=rng(611), out:Building[]=[];
  const add=(x:number,z:number,w:number,d:number,rot:number)=>{
    if(t.heightAt(x,z)<.05 || t.slopeAt(x,z)>.26) return;
    if(routes.some(s=>pathIntersects(s,{x,z,hx:w/2+.35,hz:d/2+.35,rot}))) return;
    if(out.some(b=>buildingsOverlap(b,{x,z,w,d,rot}))) return;
    // A level foundation meets the highest footprint corner; no floating downhill walls.
    const c=Math.cos(rot),s=Math.sin(rot),heights=[];
    for(const sx of [-1,1]) for(const sz of [-1,1])
      heights.push(t.heightAt(x+c*sx*w/2+s*sz*d/2,z-s*sx*w/2+c*sz*d/2));
    if(Math.min(...heights)<.015)return;
    const y=Math.max(.28,Math.max(...heights)+.02);
    out.push({x,z,y,w,d,h:2.65+r()*.65,foundation:y-Math.min(...heights)+.25,rot,variant:out.length%3});
  };
  const spine=routes[0],dx=spine.bx-spine.ax,dz=spine.bz-spine.az,l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
  // Facing rows with gaps for courtyards; the walking lane itself stays clear.
  for(let row=-3;row<13;row++) for(const side of [-1,1]) {
    const along=row*17+7,w=6+r()*2.5,d=5.2+r()*2,offset=(d/2+2.25+r()*.4)*side;
    add(spine.ax+ux*along+uz*offset,spine.az+uz*along-ux*offset,w,d,Math.atan2(ux,uz)-side*Math.PI/2);
    if(row%3!==0) {
      const outer=(27+r()*4)*side;
      add(spine.ax+ux*(along+4)+uz*outer,spine.az+uz*(along+4)-ux*outer,7+r()*2,6+r()*2,0);
    }
  }
  // Small fishing workshops on the inland side of the shore route. Their placement is artistic.
  for(const s of routes.slice(1)) {
    const dx=s.bx-s.ax,dz=s.bz-s.az,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
    for(let dist=8;dist<length;dist+=19){
      const u=dist/length,x=s.ax+dx*u,z=s.az+dz*u;
      const side=t.heightAt(x+nx*10,z+nz*10)>t.heightAt(x-nx*10,z-nz*10)?1:-1;
      add(x+nx*side*9,z+nz*side*9,6+r()*2,5+r(),Math.atan2(-nx*side,-nz*side));
    }
  }
  // Compact blocks around the geocoded settlement, rather than random isolated huts.
  for(let iz=-4;iz<=4;iz++) for(let ix=-4;ix<=4;ix++) {
    if(Math.abs(ix)<2 && iz>1) continue;
    add(cx+ix*17+(r()-.5)*3,cz+iz*17+(r()-.5)*3,6+r()*3,5+r()*2.5,0);
  }
  return out;
}
