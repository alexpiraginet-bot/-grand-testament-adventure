// Reproducible runtime derivatives; originals and proprietary GLBs stay outside Git.
// Run with the reviewed R1 package at assets-src/tripo-r1/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const input = resolve('assets-src/tripo-r1');
const roster = JSON.parse(readFileSync(`${input}/handoff/MANIFEST.json`));
const hero = JSON.parse(readFileSync(`${input}/candidate/heroi-walk.manifest.json`));
const out = resolve('public/models/tripo-r1');
mkdirSync(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const catalog = { revision: 'tripo-runtime-r1', license: 'Alex / Tripo paid-plan output; separate from MIT code', assets: {} };
for (const a of roster.assets) {
  const id = a.file.replace('.glb', '');
  const isHero = id === 'heroi';
  const src = isHero ? `${input}/candidate/heroi-walk.glb` : `${input}/source/${basename(a.sourceArchivePath)}`;
  const source = readFileSync(src);
  const expected = isHero ? hero.sha256 : a.sha256;
  if (hash(source) !== expected.toLowerCase()) throw new Error(`Source hash mismatch: ${id}`);
  const doc = await io.read(src);
  const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
  if (!isHero) {
    // Rotate the long axis of boats/walls to X, preserving the full original hierarchy.
    const group = doc.createNode(`${id}-meters`);
    for (const child of [...scene.listChildren()]) group.addChild(child);
    scene.addChild(group);
    let b = getBounds(scene), size = b.max.map((v, i) => v - b.min[i]);
    if (a.target.sizeMeters && size[2] > size[0]) {
      group.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
      b = getBounds(scene); size = b.max.map((v, i) => v - b.min[i]);
    }
    let scale;
    if (a.target.sizeMeters) {
      const [x,z,y] = a.target.sizeMeters;
      scale = [x / size[0], y / size[1], z / size[2]];
    } else {
      const k = a.target.diameterMeters ? a.target.diameterMeters / Math.max(size[0], size[2]) : a.target.heightMeters / size[1];
      scale = [k,k,k];
    }
    const wrapper = doc.createNode(`${id}-origin`).setScale(scale)
      .setTranslation([-(b.min[0] + b.max[0]) / 2 * scale[0], -b.min[1] * scale[1], -(b.min[2] + b.max[2]) / 2 * scale[2]]);
    wrapper.addChild(group); scene.addChild(wrapper);
  }
  const textureSize = 2048; // Alex: retain the original 2K detail, reduce bandwidth through encoding, not resolution.
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const encoded = await sharp(Buffer.from(image)).resize(textureSize, textureSize, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 }).toBuffer();
    texture.setImage(new Uint8Array(encoded)).setMimeType('image/webp');
  }
  for (const ext of root.listExtensionsUsed()) if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const bytes = await io.writeBinary(doc);
  const filename = `${id}-${hash(bytes).slice(0,12)}.glb`;
  writeFileSync(`${out}/${filename}`, bytes);
  const bounds = getBounds(scene);
  const triangles = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((s,p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  catalog.assets[id] = { file: `models/tripo-r1/${filename}`, sha256: hash(bytes), sourceSha256: expected,
    bytes: bytes.length, triangles, textureSize, bounds, skins: root.listSkins().length,
    clips: root.listAnimations().map(x => x.getName()),
    status: !isHero && a.target.rig ? 'awaiting-rig-not-used-in-game' : 'runtime',
    source: 'Tripo Studio, Alex Pro, 2026-11-12' };
  console.log(`${id}: ${source.length} -> ${bytes.length} bytes, ${triangles} triangles`);
}
writeFileSync('src/data/tripo-assets.json', JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(`${out}/manifest.json`, JSON.stringify(catalog, null, 2) + '\n');
