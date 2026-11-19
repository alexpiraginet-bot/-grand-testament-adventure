// The real terrain and the town's colliders, rebuilt the way village-houses.ts does (which cannot be imported in
// Node: it pulls a JSON module through Vite). The fittings' meshes are stand-in boxes of the catalogued sizes:
// placement reads only their bounds.
import { readFileSync } from "node:fs";
import * as THREE from "three/webgpu";
import { Terrain, decodeHeights } from "../../src/terrain.ts";
import { missionRoutes, settlementLayout, type Building, type Obstacle } from "../../src/world-layout.ts";
import { houseObstacle, type HouseShape } from "../../src/village-house-placement.ts";
import { facadeHousePlacements } from "../../src/village-facade-layout.ts";
import { settlementDetails } from "../../src/settlement-details.ts";
import { villageDetailsR13 } from "../../src/village-detail-r13.ts";

export const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
export const t = new Terrain(JSON.parse(read("public/world/cafarnaum.json").toString()), decodeHeights(JSON.parse(read("public/world/cafarnaum-heights.json").toString())));
const catalog = JSON.parse(read("src/data/tripo-assets.json").toString());
export const routes = missionRoutes(t), lots = settlementLayout(t, routes, 0, 0), P = t.meta.points;
export const start = { x: P.start[0], z: P.start[1] }, beach = { x: P.beach[0], z: P.beach[1] };
export const MARGIN = 60;                                    // main.ts movementMargin

/** The town's colliders as village-houses.ts builds them for a ground of `segments` (256 desktop, 192 low). */
export function scene(segments: number): { plans: Building[]; boxes: Obstacle[] } {
  const shapes: HouseShape[] = ["casa-basalto-a", "casa-basalto-b", "casa-basalto-c"].map((id) => ({ bounds: catalog.assets[id].bounds }));
  const standIn = (id: string) => {
    const b = catalog.assets[id].bounds, s = b.max.map((v: number, i: number) => v - b.min[i]);
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  };
  const placements = facadeHousePlacements(t, lots, shapes, routes, segments);
  const plans = placements.map((p) => p.plan), boxes = placements.map(houseObstacle);
  const authored = new Set(placements.filter((p) => p.sample && (p.plan.variant !== 1 || p.correctedFront)).map((p) => p.plan));
  const details = settlementDetails(t, plans.filter((p) => !authored.has(p)), routes, boxes, standIn("muro-pedra"));
  const wood = { map: new THREE.Texture(), normalMap: new THREE.Texture(), roughnessMap: new THREE.Texture() };
  const facade = villageDetailsR13(t, placements, routes, [...boxes, ...details.boxes], wood, { net: standIn("rede-amontoada"), rocks: standIn("pedras-basalto") }, segments);
  boxes.push(...facade.boxes, ...details.boxes);
  return { plans, boxes };
}
