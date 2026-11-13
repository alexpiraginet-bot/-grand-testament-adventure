// R10: authored village lots, catalogued GLB proportions, terrain-following foundations.
import * as THREE from 'three/webgpu';
import type { Terrain } from './terrain.ts';
import { sceneryMesh, type AssetLibrary, type AssetId } from './tripo-assets.ts';
import { settlementLayout, type Segment } from './world-layout.ts';
import { settlementDetails } from './settlement-details.ts';
import { convexFootprint, foundationMeshData, houseObstacle, placeVillageHouses,
  type HouseShape, type PointXZ } from './village-house-placement.ts';

export type FoundationSurface = {
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  groundSegments?: number;
};

function shapeOf(model: THREE.Mesh | undefined): HouseShape | undefined {
  if (!model) return undefined;
  model.geometry.computeBoundingBox();
  const bounds = model.geometry.boundingBox!, p = model.geometry.getAttribute('position');
  const base: PointXZ[] = [], lowerWall = bounds.min.y + (bounds.max.y - bounds.min.y) * .12;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= lowerWall) base.push({ x: p.getX(i), z: p.getZ(i) });
  const footprint = convexFootprint(base);
  return { bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    footprint: footprint.length >= 3 ? footprint : undefined };
}

/** The sixth argument shares already-loaded terrain maps; no texture clones/downloads. */
export function houses(t: Terrain, cx: number, cz: number, keepClear: Segment[], assets: AssetLibrary = {},
  foundationSurface: FoundationSurface = {}) {
  const group = new THREE.Group(); group.name = 'village-houses-r10';
  const ids: AssetId[] = ['casa-basalto-a', 'casa-basalto-b', 'casa-basalto-c'];
  const models = ids.map(id => sceneryMesh(assets[id])), shapes = models.map(shapeOf);
  const groundSegments = foundationSurface.groundSegments ?? t.n - 1;
  const lots = settlementLayout(t, keepClear, cx, cz);
  const placements = placeVillageHouses(t, lots, shapes, groundSegments);
  const plans = placements.map(p => p.plan), boxes = placements.map(houseObstacle), transform = new THREE.Object3D();
  let buildingTriangles = 0, houseBatches = 0;
  models.forEach((model, variant) => {
    if (!model) return; // A missing mesh does not become a fake untextured house.
    const list = placements.filter(p => p.plan.variant === variant);
    if (!list.length) { model.geometry.dispose(); return; }
    const offset = list[0].sourceOffset;
    model.geometry.translate(offset.x, offset.y, offset.z);
    const batch = new THREE.InstancedMesh(model.geometry, model.material, list.length);
    batch.name = ids[variant];
    list.forEach(({ plan, scale }, i) => {
      transform.position.set(plan.x, plan.y, plan.z); transform.rotation.set(0, plan.rot, 0);
      transform.scale.setScalar(scale); transform.updateMatrix(); batch.setMatrixAt(i, transform.matrix);
      const tone = .97 + (i % 4) * .01; batch.setColorAt(i, new THREE.Color().setScalar(tone));
    });
    batch.castShadow = batch.receiveShadow = true;
    batch.computeBoundingBox(); batch.computeBoundingSphere(); group.add(batch); houseBatches++;
    buildingTriangles += (model.geometry.index?.count ?? model.geometry.attributes.position.count) / 3 * list.length;
  });

  const foundation = foundationMeshData(t, placements, groundSegments);
  if (foundation.indices.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(foundation.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(foundation.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(foundation.colors, 3));
    geometry.setIndex(foundation.indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      // This is a rubble/aggregate plinth. It does not claim new masonry detail.
      color: 0x777773, roughness: 1, metalness: 0, vertexColors: true,
      map: foundationSurface.map ?? null, normalMap: foundationSurface.normalMap ?? null,
      roughnessMap: foundationSurface.roughnessMap ?? null, normalScale: new THREE.Vector2(.4, .4),
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'terrain-following-rubble-plinths';
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  const details = settlementDetails(t, plans, keepClear, boxes, sceneryMesh(assets['muro-pedra']));
  group.add(details.group); boxes.push(...details.boxes);
  const scales = placements.map(p => p.scale);
  const diagnostics = {
    revision: 'houses-r10', houses: plans.length, originalLots: lots.length,
    missingVariants: ids.filter((_, i) => !models[i]),
    uniformScale: { min: scales.length ? Math.min(...scales) : 0, max: scales.length ? Math.max(...scales) : 0 },
    buildingTriangles, foundationTriangles: foundation.indices.length / 3,
    houseBatches, foundationBatches: foundation.indices.length ? 1 : 0, groundSegments,
    foundationExposed: { min: foundation.exposedMin, max: foundation.exposedMax },
    sharedSurfaceMaps: !!foundationSurface.map,
  };
  group.userData.counts = { houses: plans.length, ...details.counts };
  group.userData.quality = diagnostics;
  return { group, boxes, plans, diagnostics };
}
