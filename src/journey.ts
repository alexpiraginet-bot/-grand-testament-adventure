// Editorial narration and play guidance for episode 1, based on Mark 1:16–20.
// These are NOT scripture quotations or newly attributed dialogue from Jesus.
import type {State,Vec2} from './missions.ts';
import type {Segment} from './world-layout.ts';

type JourneyState=Pick<State,'phase'|'mission'|'promptVisible'>;

export const SCENE_DEVELOPMENT_NOTICE='Cena em desenvolvimento · personagens em preparação.';

/** Participants are not yet rendered; keep encounters playable and label the missing scene honestly. */
export function sceneDevelopmentNotice(state:JourneyState,distance:number|null):string {
  if(state.mission<1||state.mission>2||state.phase==='intro'||state.phase==='done')return '';
  const near=distance!==null&&Number.isFinite(distance)&&distance>=0&&distance<35;
  return state.phase==='line'||state.promptVisible||near?SCENE_DEVELOPMENT_NOTICE:'';
}

export function journeyNarrative(mission:number):string {
  return [
    'A trilha desce até o lago. Na praia, um encontro está por começar.',
    'Entre as redes, Simão e André trabalham. Aproxime-se para chamá-los.',
    'Mais adiante, Tiago e João estão no barco. O chamado continua.',
  ][mission]??'';
}

/** Guidance follows the real action state, never guesses interaction range from display distance. */
export function buildJourneyHint(state:JourneyState,distance:number|null,touch:boolean):string {
  if(state.phase!=='play')return '';
  const near=distance!==null&&Number.isFinite(distance)&&distance>=0&&distance<35;
  if(state.mission===0)return near?'Continue até a areia junto à água.':'Siga a trilha até a margem do lago.';
  if(state.mission===1){
    if(state.promptVisible)return touch?'Toque em Chamar para convidá-los.':'Aperte E para chamar Simão e André.';
    return near?'Aproxime-se do ponto marcado junto às redes.':'Siga até o encontro de Simão e André junto às redes.';
  }
  if(state.mission===2){
    if(state.promptVisible)return touch?'Toque em Chamar; pode ficar na margem.':'Aperte E para chamar; pode ficar na margem.';
    return near?'Aproxime-se do barco pela margem.':'Siga pela margem até o barco de Tiago e João.';
  }
  return '';
}

/** Ordered walking route, starting at the player's nearest projection before the active goal.
 * No direct connector from an off-path player: that could cross buildings or the inlet.
 * Unknown goals deliberately return no dotted route instead of inventing a straight shortcut.
 */
export function journeyRoute(routes:readonly Segment[],player:Vec2,goal:Vec2):Vec2[] {
  const end=routes.findIndex(s=>Math.hypot(s.bx-goal.x,s.bz-goal.z)<1e-5);
  if(end<0)return [];
  let nearest=0,bestDistance=Infinity,projection:Vec2|null=null;
  for(let i=0;i<=end;i++){
    const s=routes[i],dx=s.bx-s.ax,dz=s.bz-s.az,len2=dx*dx+dz*dz;
    const u=len2?Math.max(0,Math.min(1,((player.x-s.ax)*dx+(player.z-s.az)*dz)/len2)):0;
    const point={x:s.ax+u*dx,z:s.az+u*dz},distance=Math.hypot(point.x-player.x,point.z-player.z);
    if(distance<bestDistance){nearest=i;bestDistance=distance;projection=point;}
  }
  if(!projection)return [];
  const points:Vec2[]=[projection];
  for(let i=nearest;i<=end;i++){
    const p={x:routes[i].bx,z:routes[i].bz},last=points.at(-1)!;
    if(Math.hypot(last.x-p.x,last.z-p.z)>1e-5)points.push(p);
  }
  return points;
}
