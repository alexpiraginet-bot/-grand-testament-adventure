// Human presence is a visual quality gate. Narrative participant IDs never create scene objects.
import type * as THREE from 'three/webgpu';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {animatedActor} from './animated-actor.ts';

/** Missing/rejected hero uses the existing startup retry, never a procedural fallback. */
export function requireHero(asset:Pick<GLTF,'scene'|'animations'>|undefined):ReturnType<typeof animatedActor>{
  if(!asset)throw new Error('O personagem principal não chegou. Confira a conexão e tente novamente.');
  try{
    const walk=asset.animations.find(clip=>clip.name.toLowerCase()==='walk');
    if(!walk||!Number.isFinite(walk.duration)||walk.duration<=0||!walk.tracks.length)
      throw new Error('Missing or invalid reviewed walk clip');
    const actor=animatedActor(asset.scene,asset.animations);
    actor.root.name='character:hero';
    actor.root.userData.character={id:'heroi',role:'hero',source:'tripo-r1/hero-native-skeleton'};
    return actor;
  }catch(cause){
    throw new Error('Não foi possível preparar o personagem principal. Tente novamente ou abra no modo compatível.',{cause});
  }
}

/** Inspect attached, visible character roots, not mission/save IDs or catalogue candidates. */
export function characterDiagnostics(scene:THREE.Scene){
  const rendered:{id:string;role:string;source:string;meshes:number;skinnedMeshes:number;primitiveMeshes:number;geometryTypes:string[];position:{x:number;y:number;z:number}}[]=[];
  scene.traverse(root=>{
    const tag=root.userData.character as {id:string;role:string;source:string}|undefined;
    if(!tag)return;
    let visible=true;for(let ancestor:THREE.Object3D|null=root;ancestor;ancestor=ancestor.parent)visible&&=ancestor.visible;
    if(!visible)return;
    let meshes=0,skinnedMeshes=0,primitiveMeshes=0;const geometryTypes=new Set<string>();
    root.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      meshes++;if((mesh as THREE.SkinnedMesh).isSkinnedMesh)skinnedMeshes++;
      geometryTypes.add(mesh.geometry.type);
      if(mesh.geometry.type!=='BufferGeometry')primitiveMeshes++;
    });
    if(meshes)rendered.push({...tag,meshes,skinnedMeshes,primitiveMeshes,geometryTypes:[...geometryTypes],
      position:{x:root.position.x,y:root.position.y,z:root.position.z}});
  });
  return {rendered,humans:rendered.length,npcs:rendered.filter(actor=>actor.role==='npc').length,
    primitiveHumanMeshes:rendered.reduce((n,actor)=>n+actor.primitiveMeshes,0)};
}
