// Overview of the existing terrain; it does not add regions or change movement/save state.
import type { EpisodeData, Goal, State, Vec2 } from './missions.ts';
import type { Terrain } from './terrain.ts';
import type { Obstacle, Segment } from './world-layout.ts';
import { buildingPoint } from './world-layout.ts';
import { journeyRoute } from './journey.ts';

export type MapView = { width:number; height:number; size:number; zoom:number; center:Vec2 };
const PADDING=24, MAX_ZOOM=8;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));

/** Same north-up projection as radar.png: x east, z south, distances in metres. */
export function projectMap(view:MapView) {
  const pixelsPerMetre=Math.max(1,Math.min(view.width,view.height)-PADDING*2)/view.size*view.zoom;
  return {
    pixelsPerMetre,
    screen:(p:Vec2)=>({x:view.width/2+(p.x-view.center.x)*pixelsPerMetre,y:view.height/2+(p.z-view.center.z)*pixelsPerMetre}),
    world:(p:{x:number;y:number})=>({x:view.center.x+(p.x-view.width/2)/pixelsPerMetre,z:view.center.z+(p.y-view.height/2)/pixelsPerMetre}),
  };
}

/** At fit, show the complete terrain. At zoom, keep the viewport over that terrain. */
export function constrainMap(view:MapView):MapView {
  const zoom=clamp(view.zoom,1,MAX_ZOOM),next={...view,zoom},ppm=projectMap(next).pixelsPerMetre;
  const rx=Math.max(0,view.size/2-(view.width-PADDING*2)/(2*ppm));
  const rz=Math.max(0,view.size/2-(view.height-PADDING*2)/(2*ppm));
  return {...next,center:{x:clamp(view.center.x,-rx,rx),z:clamp(view.center.z,-rz,rz)}};
}

/** Zoom around a screen point, so a wheel gesture does not drift away from its target. */
export function zoomMap(view:MapView,zoom:number,anchor={x:view.width/2,y:view.height/2}):MapView {
  const before=projectMap(view).world(anchor),next={...view,zoom:clamp(zoom,1,MAX_ZOOM)};
  const after=projectMap(next).world(anchor);
  return constrainMap({...next,center:{x:view.center.x+before.x-after.x,z:view.center.z+before.z-after.z}});
}

export function mapScaleBar(pixelsPerMetre:number,maxPixels=110) {
  if(!Number.isFinite(pixelsPerMetre)||pixelsPerMetre<=0||!Number.isFinite(maxPixels)||maxPixels<=0)throw Error('Invalid map scale');
  const maxMetres=maxPixels/pixelsPerMetre,base=10**Math.floor(Math.log10(maxMetres));
  const metres=base*(maxMetres>=base*5?5:maxMetres>=base*2?2:1);
  return {metres,pixels:metres*pixelsPerMetre};
}

type MapOptions={
  terrain:Terrain; image:HTMLImageElement; episode:EpisodeData; routes:readonly Segment[];
  goals:readonly Goal[]; buildings:readonly Obstacle[]; movementMargin:number;
  player:()=>{pos:Vec2;heading:number}; state:()=>State; canOpen:()=>boolean;
  onOpenChange:(open:boolean)=>void; button:HTMLButtonElement;
};
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,cls?:string,text?:string)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;
};

export function setupWorldMap(o:MapOptions) {
  const meta=o.terrain.meta,format=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const dialog=element('dialog','worldmap-dialog');dialog.id='worldmap';
  dialog.setAttribute('aria-labelledby','worldmap-heading');dialog.setAttribute('aria-describedby','worldmap-intro');
  const header=element('header','worldmap-header'),headingBlock=element('div');
  const heading=element('h2',undefined,'Mapa da região');heading.id='worldmap-heading';heading.tabIndex=-1;
  headingBlock.append(element('p','worldmap-eyebrow',o.episode.lugar),heading);
  const button=(text:string,label?:string)=>{const b=element('button',undefined,text);b.type='button';if(label)b.setAttribute('aria-label',label);return b;};
  const closeButton=button('Voltar ao jogo');closeButton.id='worldmap-close';
  header.append(headingBlock,closeButton);
  const intro=element('p','worldmap-intro',`Terreno atual: ${format.format(meta.size)} × ${format.format(meta.size)} m. Esta visão geral mostra a região já existente; novas regiões continuam em desenvolvimento.`);
  intro.id='worldmap-intro';
  const toolbar=element('div','worldmap-toolbar');toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Controles do mapa');
  const less=button('−','Diminuir zoom'),more=button('+','Aumentar zoom'),reset=button('Ver região'),locate=button('Minha posição');
  less.id='worldmap-zoom-out';more.id='worldmap-zoom-in';reset.id='worldmap-reset';locate.id='worldmap-locate';
  const zoomLabel=element('output','worldmap-zoom');zoomLabel.id='worldmap-zoom';zoomLabel.setAttribute('aria-live','polite');
  toolbar.append(less,more,zoomLabel,reset,locate);
  const layout=element('div','worldmap-layout'),stage=element('div','worldmap-stage'),canvas=element('canvas');
  canvas.id='worldmap-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`Mapa de ${meta.center.nome}, com relevo, água, sua posição e as missões disponíveis.`);
  canvas.setAttribute('aria-describedby','worldmap-instructions');
  canvas.textContent='As missões e os lugares também estão listados ao lado do mapa.';
  stage.append(canvas);
  const aside=element('aside','worldmap-sidebar');aside.setAttribute('aria-label','Lugares e missões no mapa');
  const missionTitle=element('h3',undefined,o.episode.titulo),reference=element('p','worldmap-reference',o.episode.ref_pt),missionList=element('ol','worldmap-missions');
  const entries=o.goals.map((goal,i)=>{
    const item=element('li'),b=button(o.episode.missoes[i]?.objetivo??'Ponto da missão'),status=element('span','worldmap-mission-status');
    b.dataset.mapMission=String(i);b.addEventListener('click',()=>focusAt(goal.at));
    item.append(b,status);missionList.append(item);return {item,b,status,goal};
  });
  const places=element('ul','worldmap-places');
  for(const place of meta.places){
    if(!o.terrain.inside(place.x,place.z))continue;
    const li=element('li'),b=button(place.nome);b.addEventListener('click',()=>focusAt(place));li.append(b);places.append(li);
  }
  const legend=element('ul','worldmap-legend');legend.setAttribute('aria-label','Legenda');
  for(const [kind,text] of [['player','Sua posição'],['route','Caminhos das missões'],['water','Água · sem travessia a nado'],['limit','Limite atual de movimentação']]){
    const item=element('li'),swatch=element('span',`worldmap-swatch ${kind}`);swatch.setAttribute('aria-hidden','true');item.append(swatch,document.createTextNode(text));legend.append(item);
  }
  const boundary=element('p','worldmap-note','Dentro do limite, água profunda e construções também impedem a passagem. O horizonte distante é cenário, não uma nova região explorável.');
  aside.append(missionTitle,reference,missionList,element('h3',undefined,'Lugares'),places,legend,boundary);layout.append(stage,aside);
  const footer=element('footer','worldmap-footer'),instructions=element('p',undefined,'Arraste para explorar o mapa. Com o mapa em foco: setas movem, + e − ajustam o zoom, Home mostra a região. M ou Esc fecha.');
  instructions.id='worldmap-instructions';
  const sources=element('details','worldmap-sources');sources.append(element('summary',undefined,'Fontes e limites desta representação'));
  sources.append(element('p',undefined,`Relevo: ${String(meta.sources.relief)}.`),element('p',undefined,`Lugares: ${String(meta.sources.places)}. Texto: ${String(meta.sources.text)}.`),element('p',undefined,'O relevo é moderno. As edificações e os trajetos das missões são uma recriação do jogo, não um levantamento arqueológico do século I.'));
  footer.append(instructions,sources);dialog.append(header,intro,toolbar,layout,footer);document.body.append(dialog);
  const ctx=canvas.getContext('2d');
  let view:MapView={width:1,height:1,size:meta.size,zoom:1,center:{x:0,z:0}},opener:HTMLElement|null=null,suspended=false,raf=0;
  let drag:{id:number;x:number;y:number;center:Vec2}|null=null;
  const waterMask=element('canvas');waterMask.width=waterMask.height=meta.n;
  const waterCtx=waterMask.getContext('2d');
  if(waterCtx){
    const pixels=waterCtx.createImageData(meta.n,meta.n);
    for(let i=0;i<o.terrain.h.length;i++)if(o.terrain.h[i]<0){const k=i*4;pixels.data[k]=37;pixels.data[k+1]=116;pixels.data[k+2]=183;pixels.data[k+3]=o.terrain.h[i]<-.55?102:56;}
    waterCtx.putImageData(pixels,0,0);
  }
  function scheduleDraw(){if(!dialog.open||raf)return;raf=requestAnimationFrame(()=>{raf=0;draw();});}
  function refreshView(next:MapView){view=constrainMap(next);scheduleDraw();}
  function focusAt(pos:Vec2){
    refreshView({...view,zoom:Math.max(view.zoom,4),center:{x:pos.x,z:pos.z}});
    stage.scrollIntoView({block:'nearest',inline:'nearest'});
    canvas.focus({preventScroll:true});
  }
  function draw(){
    if(!ctx||!dialog.open)return;
    const width=stage.clientWidth,height=stage.clientHeight;if(width<1||height<1)return;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    view=constrainMap({...view,width,height});const projection=projectMap(view),screen=projection.screen,ppm=projection.pixelsPerMetre;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#edf1f5';ctx.fillRect(0,0,width,height);
    const nw=screen({x:-meta.size/2,z:-meta.size/2}),side=meta.size*ppm;
    ctx.imageSmoothingEnabled=true;ctx.drawImage(o.image,nw.x,nw.y,side,side);
    if(waterCtx)ctx.drawImage(waterMask,nw.x,nw.y,side,side);
    ctx.save();ctx.beginPath();ctx.rect(nw.x,nw.y,side,side);ctx.clip();
    // The mask marks the same edge margin used by the movement collision check.
    const margin=o.movementMargin*ppm;ctx.fillStyle='rgba(231,236,242,.64)';
    ctx.fillRect(nw.x,nw.y,side,margin);ctx.fillRect(nw.x,nw.y+side-margin,side,margin);
    ctx.fillRect(nw.x,nw.y+margin,margin,side-margin*2);ctx.fillRect(nw.x+side-margin,nw.y+margin,margin,side-margin*2);
    ctx.strokeStyle='#334976';ctx.lineWidth=1.5;ctx.setLineDash([7,5]);ctx.strokeRect(nw.x+margin,nw.y+margin,side-margin*2,side-margin*2);ctx.setLineDash([]);
    ctx.strokeStyle='rgba(28,88,127,.65)';ctx.lineWidth=1.2;ctx.beginPath();
    meta.shoreline.forEach(([x,z],i)=>{const p=screen({x,z});if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();
    if(view.zoom>=2){
      ctx.fillStyle='rgba(61,62,62,.52)';ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=.7;
      for(const b of o.buildings){
        ctx.beginPath();[[-b.hx,-b.hz],[b.hx,-b.hz],[b.hx,b.hz],[-b.hx,b.hz]].forEach(([x,z],i)=>{const p=screen(buildingPoint(b,x,z));if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fill();ctx.stroke();
      }
    }
    const stroke=(points:Vec2[],color:string,lineWidth:number)=>{
      if(points.length<2)return;ctx.beginPath();points.forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    };
    for(const s of o.routes){const route=[{x:s.ax,z:s.az},{x:s.bx,z:s.bz}];stroke(route,'rgba(255,255,255,.9)',5);stroke(route,'#6386bb',2);}
    const player=o.player(),state=o.state(),goal=state.phase==='done'?undefined:o.goals[state.mission];
    if(goal){const active=journeyRoute(o.routes,player.pos,goal.at);stroke(active,'#fff',7);stroke(active,'#244fc8',3.5);}
    const label=(text:string,x:number,y:number)=>{
      ctx.font='600 13px "Space Grotesk",sans-serif';const w=ctx.measureText(text).width;
      const tx=clamp(x,8,Math.max(8,width-w-8)),ty=clamp(y,19,height-12);
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(tx-4,ty-14,w+8,19);ctx.fillStyle='#183154';ctx.fillText(text,tx,ty);
    };
    for(const place of meta.places){
      const p=screen(place);if(p.x<0||p.x>width||p.y<0||p.y>height)continue;
      ctx.fillStyle='#253e66';ctx.fillRect(p.x-3,p.y-3,6,6);label(place.nome,p.x+10,p.y-12);
    }
    entries.forEach(({goal},i)=>{
      const p=screen(goal.at);ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);
      ctx.fillStyle=i<state.completedAt.length?'#277659':i===state.mission&&state.phase!=='done'?'#244fc8':'#f7faff';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=i<=state.mission?'#fff':'#183154';ctx.font='700 12px "Space Grotesk",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x,p.y);ctx.textAlign='left';ctx.textBaseline='alphabetic';
    });
    const p=screen(player.pos);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(player.heading);ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(9,10);ctx.lineTo(0,5);ctx.lineTo(-9,10);ctx.closePath();ctx.fillStyle='#fff';ctx.strokeStyle='#122b50';ctx.lineWidth=2.5;ctx.fill();ctx.stroke();ctx.restore();
    if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)label('Você',p.x+15,p.y+23);
    ctx.restore();
    const scale=mapScaleBar(ppm,Math.min(110,width*.24));ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(12,height-53,scale.pixels+20,41);
    ctx.strokeStyle='#183154';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(22,height-27);ctx.lineTo(22,height-20);ctx.lineTo(22+scale.pixels,height-20);ctx.lineTo(22+scale.pixels,height-27);ctx.stroke();ctx.fillStyle='#183154';ctx.font='600 12px "Space Grotesk",sans-serif';ctx.fillText(`${format.format(scale.metres)} m`,22,height-33);
    ctx.fillStyle='rgba(255,255,255,.94)';ctx.beginPath();ctx.arc(width-30,30,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#183154';ctx.textAlign='center';ctx.font='700 13px "Space Grotesk",sans-serif';ctx.fillText('N',width-30,27);ctx.beginPath();ctx.moveTo(width-30,31);ctx.lineTo(width-34,39);ctx.lineTo(width-26,39);ctx.fill();ctx.textAlign='left';
    const zoomText=`${format.format(view.zoom*100)}%`;if(zoomLabel.value!==zoomText)zoomLabel.value=zoomText;
    less.disabled=view.zoom<=1;more.disabled=view.zoom>=MAX_ZOOM;
    canvas.dataset.zoom=String(view.zoom);canvas.dataset.centerX=String(view.center.x);canvas.dataset.centerZ=String(view.center.z);
    entries.forEach(({item,b,status,goal},i)=>{
      const completed=i<state.completedAt.length,current=i===state.mission&&state.phase!=='done';
      item.classList.toggle('current',current);if(current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
      status.textContent=`${completed?'Concluída':current?'Missão atual':'Próxima etapa'} · ${format.format(Math.hypot(goal.at.x-player.pos.x,goal.at.z-player.pos.z))} m em linha reta`;
    });
  }
  const anotherOverlay=()=>Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]:not([hidden]), [role="menu"]:not([hidden])')).some(el=>el!==dialog&&el.getClientRects().length>0);
  function open(){
    if(dialog.open||!ctx||!o.canOpen()||anotherOverlay())return;
    opener=document.activeElement instanceof HTMLElement?document.activeElement:o.button;
    document.exitPointerLock?.();dialog.showModal();suspended=true;o.onOpenChange(true);
    heading.focus();scheduleDraw();
  }
  function resume(){
    if(!suspended)return;suspended=false;drag=null;o.onOpenChange(false);
    if(opener?.isConnected)opener.focus({preventScroll:true});
  }
  const close=()=>{dialog.close();resume();};
  closeButton.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',resume);
  o.button.addEventListener('click',open);o.button.setAttribute('aria-haspopup','dialog');o.button.setAttribute('aria-controls',dialog.id);
  const zoom=(factor:number,anchor?:{x:number;y:number})=>refreshView(zoomMap(view,view.zoom*factor,anchor));
  less.addEventListener('click',()=>zoom(1/1.5));more.addEventListener('click',()=>zoom(1.5));
  reset.addEventListener('click',()=>refreshView({...view,zoom:1,center:{x:0,z:0}}));locate.addEventListener('click',()=>focusAt(o.player().pos));
  canvas.addEventListener('wheel',event=>{event.preventDefault();const r=canvas.getBoundingClientRect();zoom(event.deltaY<0?1.2:1/1.2,{x:event.clientX-r.left,y:event.clientY-r.top});},{passive:false});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,center:{...view.center}};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const ppm=projectMap(view).pixelsPerMetre;refreshView({...view,center:{x:drag.center.x-(event.clientX-drag.x)/ppm,z:drag.center.z-(event.clientY-drag.y)/ppm}});});
  const endDrag=()=>{drag=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
  canvas.addEventListener('keydown',event=>{
    const metres=64/projectMap(view).pixelsPerMetre,directions:Record<string,Vec2>={ArrowLeft:{x:-metres,z:0},ArrowRight:{x:metres,z:0},ArrowUp:{x:0,z:-metres},ArrowDown:{x:0,z:metres}};
    const d=directions[event.key];
    if(d){event.preventDefault();refreshView({...view,center:{x:view.center.x+d.x,z:view.center.z+d.z}});}
    else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.5);}
    else if(event.key==='-'){event.preventDefault();zoom(1/1.5);}
    else if(event.key==='Home'){event.preventDefault();refreshView({...view,zoom:1,center:{x:0,z:0}});}
  });
  addEventListener('keydown',event=>{
    if(event.code!=='KeyM'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(dialog.open){event.preventDefault();close();}else if(o.canOpen()&&!anotherOverlay()){event.preventDefault();open();}
  });
  new ResizeObserver(scheduleDraw).observe(stage);
  return {isOpen:()=>dialog.open};
}
