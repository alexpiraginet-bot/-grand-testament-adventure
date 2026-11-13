import roster from './data/tripo-assets.json';

export type LoadProgress = {completed:number;total:number;loaded:number;failed:number;receivedBytes:number;totalBytes:number;current:string|null;phase:string};
const assetTotal=Object.values(roster.assets).filter(a=>a.status==='runtime').length;
export function loadingProfile(touch:boolean,ua:string,maxTouchPoints:number,query:URLSearchParams){
  const ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&maxTouchPoints>1);
  const compat=query.get('compat')==='1'||ios;
  return {mobile:touch||ios||compat,ios,compat,textureLimit:touch||ios||compat?1024:2048,sceneryTextureLimit:touch||ios||compat?512:2048,concurrency:touch||ios||compat?1:2};
}
export function withDeadline<T>(promise:Promise<T>,ms:number,message:string):Promise<T>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(message)),ms);
    promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
export class LoadingScreen {
  private done=new Set<string>();
  private assets:LoadProgress={completed:0,total:assetTotal,loaded:0,failed:0,receivedBytes:0,totalBytes:0,current:null,phase:'fetch'};
  private state='loading';
  readonly profile:ReturnType<typeof loadingProfile>;
  constructor(profile:ReturnType<typeof loadingProfile>){
    this.profile=profile;
    document.getElementById('loading-retry')!.addEventListener('click',()=>location.reload());
    document.getElementById('loading-safe')!.addEventListener('click',()=>{
      const url=new URL(location.href);url.searchParams.set('compat','1');url.searchParams.set('gl','1');location.assign(url);
    });
    this.render('Preparando sua jornada');
  }
  stage(text:string){if(this.state==='loading')this.render(text);}
  complete(id:string,text:string){this.done.add(id);if(this.state==='loading')this.render(text);}
  updateAssets(progress:LoadProgress){
    this.assets={...progress};
    if(this.state==='loading')this.render(progress.phase==='decode'?'Preparando personagens e cenários':`Recebendo o mundo · ${progress.completed} de ${progress.total} modelos`);
  }
  ready(){if(this.state!=='loading')return false;this.state='ready';this.render('Sua jornada está pronta');return true;}
  fail(message:string){
    if(this.state==='error')return;
    this.state='error';
    document.getElementById('start')!.hidden=false;
    document.getElementById('hud')!.hidden=true;
    const go=document.getElementById('go') as HTMLButtonElement;go.disabled=true;go.textContent='Não foi possível iniciar';
    document.getElementById('loading-actions')!.hidden=false;
    this.render(message);
  }
  diagnostics(){return {profile:this.profile,...this.assets,state:this.state,stepsCompleted:this.done.size+this.assets.completed,stepsTotal:assetTotal+6};}
  private render(text:string){
    const total=assetTotal+6,completed=this.done.size+this.assets.completed;
    const percent=this.state==='ready'?100:Math.min(99,Math.floor(completed/total*100));
    const screen=document.getElementById('loading-screen')!,bar=document.getElementById('loading-progress')!;
    screen.dataset.state=this.state;document.getElementById('start')!.dataset.state=this.state;
    bar.dataset.completed=String(this.assets.completed);bar.dataset.total=String(assetTotal);
    bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuetext',`${completed} de ${total} etapas concluídas`);
    screen.style.setProperty('--load-progress',String(percent));
    document.getElementById('loading-percent')!.textContent=`${percent}%`;
    document.getElementById('loading-stage')!.textContent=text;
    document.getElementById('loading-count')!.textContent=this.state==='error'?'Tente novamente ou abra no modo compatível.':`${this.assets.completed} / ${assetTotal} modelos preparados`;
    document.getElementById('loading-screen')!.setAttribute('aria-busy',String(this.state==='loading'));
  }
}
