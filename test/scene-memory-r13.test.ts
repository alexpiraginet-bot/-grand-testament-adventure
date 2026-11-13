import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {texture} from 'three/tsl';
import {sceneTextures} from '../src/scene-memory.ts';

test('texture estimate includes TSL PBR and vertex depth maps once even when graph nodes are shared',()=>{
  const colour=new THREE.DataTexture(new Uint8Array(16*16*4),16,16);
  const depth=new THREE.DataTexture(new Uint8Array(8*8*4),8,8);
  const material=new THREE.MeshStandardNodeMaterial();material.colorNode=texture(colour).rgb;
  material.roughnessNode=texture(colour).a;material.positionNode=texture(depth).rgb;
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
  const rows=sceneTextures(scene);
  assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>'width' in r?r.width:0).sort((a,b)=>a-b),[8,16]);
  colour.dispose();depth.dispose();material.dispose();
});
