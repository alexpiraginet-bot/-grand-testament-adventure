import type {FaunaAssetSpec} from './fauna-renderer.ts';
import type {FaunaBodyBounds,FaunaKind} from './fauna-simulation.ts';

export interface FaunaRuntimeAssetSpec extends FaunaAssetSpec {
  /** Measured animated envelope, in normalised metres before the individual scale is applied. */
  body:FaunaBodyBounds;
}
export interface FaunaAssetProfile {
  kind:FaunaKind;
  desktop?:FaunaRuntimeAssetSpec;
  mobile?:FaunaRuntimeAssetSpec;
}

// Reviewed for controlled integration; terrain/turn/stop/iPhone QA remains a separate gate.
// Add only inspected original GLBs with provenance, size/hash, source origin and a reviewed gait.
// Mobile needs its own explicit profile, even when it intentionally reuses the desktop GLB URL.
const chicken:Omit<FaunaRuntimeAssetSpec,'url'|'expectedBytes'|'sha256'>={
  kind:'chicken',status:'approved',nativeForwardYaw:0,scaleToMeters:1,origin:[0,0,0],
  // Union of neutral pose +121 phases: X±.12348, Z[-.22680,.22471], Y[~0,.45].
  // Conservative XZ corner radius .25824m + clearance, rounded upward. Individual scale is applied later.
  body:{radius:.28,halfHeight:.23},
  locomotion:{mode:'walk',clip:'bird-walk-inplace-r8-r2',speedMetersPerSecond:.24},
  idlePose:{clip:'bird-walk-inplace-r8-r2',time:0},
};
const donkey:Omit<FaunaRuntimeAssetSpec,'url'|'expectedBytes'|'sha256'>={
  kind:'donkey',status:'approved',nativeForwardYaw:0,scaleToMeters:1,origin:[0,0,0],
  // Neutral +138 phases/clip: conservative XZ corner radius .85617m, plus >5cm clearance.
  body:{radius:.91,halfHeight:.70},
  locomotion:{mode:'walk',clip:'donkey-walk-inplace-r8',speedMetersPerSecond:.38},
  idleClip:'donkey-idle-r8',
};
export const FAUNA_ASSET_PROFILES:readonly FaunaAssetProfile[]=[{
  kind:'chicken',
  desktop:{...chicken,url:'models/fauna-r8/chicken-r8-birdwalk-r2-1024-68acfac44214.glb',expectedBytes:1250520,
    sha256:'68acfac44214863cad4252a4bda4a94fed142eec9bef043ce8bf338f7ffd978d'},
  mobile:{...chicken,url:'models/fauna-r8/chicken-r8-birdwalk-r2-512-33c5201a2085.glb',expectedBytes:687972,
    sha256:'33c5201a20851cb50fe8a6577bb5c94691969aa1c8cf1055df2da04e04098eb0'},
},{
  kind:'donkey',
  desktop:{...donkey,url:'models/fauna-r8/donkey-r8-walk-1024-de6552cc3150.glb',expectedBytes:1807872,
    sha256:'de6552cc3150efd81b75059bc95347d7a58c4bd54f54d683ff8a6121e42e034b'},
  mobile:{...donkey,url:'models/fauna-r8/donkey-r8-walk-512-25bd1f401968.glb',expectedBytes:1095040,
    sha256:'25bd1f401968c7dcbfef983854004b7b009a434e574fc90d434e0c0229b3ac02'},
}];

export function selectFaunaAssets(profiles:readonly FaunaAssetProfile[],mobile:boolean,base='/'):readonly FaunaRuntimeAssetSpec[] {
  const selected:FaunaRuntimeAssetSpec[]=[],seen=new Set<FaunaKind>();
  for(const profile of profiles){
    const asset=mobile?profile.mobile:profile.desktop;
    if(!asset||asset.status!=='approved')continue;
    if(asset.kind!==profile.kind||seen.has(asset.kind))throw Error('Invalid or duplicate fauna asset profile');
    seen.add(asset.kind);
    const url=/^(?:https?:)?\/\//i.test(asset.url)?asset.url:`${base.endsWith('/')?base:`${base}/`}${asset.url.replace(/^\/+/, '')}`;
    selected.push({...asset,url});
  }
  return selected;
}
export function faunaAssetsManifest(mobile:boolean,base='/'):readonly FaunaRuntimeAssetSpec[]{
  return selectFaunaAssets(FAUNA_ASSET_PROFILES,mobile,base);
}
