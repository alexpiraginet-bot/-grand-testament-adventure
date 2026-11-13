// Only a pinned, locally shipped reviewed Simão profile can enter the runtime.
export interface NpcProfile{url:string;expectedBytes:number;sha256:string;textureMaxSize:number}
export const NPC_SOURCE_SHA256='1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793';
export interface NpcCatalog{schemaVersion:number;id:string;approval:string;sourceSha256:string;units:string;nativeForward:string;groundY:number;
 animation:{idle:string;walk:string;walkSpeedMps:number};profiles:{mobile:NpcProfile;desktop:NpcProfile}}
export interface NpcAsset extends NpcProfile{idle:string;walk:string;walkSpeedMps:number}
export function npcManifest(catalog:NpcCatalog,mobile:boolean,base='/'):NpcAsset{
 const p=mobile?catalog.profiles.mobile:catalog.profiles.desktop;
 if(catalog.schemaVersion!==1||catalog.id!=='simao-r12'||catalog.approval!=='reviewed-integration-candidate'||catalog.sourceSha256!==NPC_SOURCE_SHA256||catalog.units!=='meters'||catalog.nativeForward!=='-Z'||catalog.groundY!==0)throw Error('Unreviewed NPC catalogue');
 if(catalog.animation.idle!=='simao-idle-r11'||catalog.animation.walk!=='simao-walk-r11'||catalog.animation.walkSpeedMps!==.7)throw Error('Unreviewed NPC animation');
 if(!/^[a-f0-9]{64}$/.test(p.sha256)||!p.url.includes(p.sha256.slice(0,12))||!/^\/?models\/npc-r12\/[a-z0-9-]+\.glb$/.test(p.url))throw Error('NPC URL must be local and hash-pinned');
 if(!Number.isSafeInteger(p.expectedBytes)||p.expectedBytes<20||p.expectedBytes>(mobile?1000000:2000000)||p.textureMaxSize!==(mobile?512:1024))throw Error('NPC profile exceeds device budget');
 if(!/^(?:\/|\.\/)(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw Error('NPC base must remain same-origin');
 return{...p,url:base+p.url.replace(/^\//,''),...catalog.animation};
}
