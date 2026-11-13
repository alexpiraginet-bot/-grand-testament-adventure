/** Texture-only Simão R12 derivatives. Sources/rig/mesh/clips are never rewritten in place. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const PINNED_SOURCE = '1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793';
const { values } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' }, 'source-sha256': { type: 'string' },
  'validator-module': { type: 'string' }, help: { type: 'boolean' },
}, strict: true, allowPositionals: false });
if (values.help) {
  console.log('node tools/npc/prepare_simao_r12.mjs --input SOURCE.glb --output NEW_PACKAGE_DIR --source-sha256 HASH --validator-module /path/to/gltf-validator');
  process.exit(0);
}
for (const key of ['input', 'output', 'source-sha256', 'validator-module']) assert.ok(values[key], `Required --${key}`);
const input = path.resolve(values.input), output = path.resolve(values.output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(values['source-sha256'].toLowerCase(), PINNED_SOURCE, 'Only the reviewed Simão R11 candidate is accepted');
assert.ok(fs.statSync(input).isFile());
const source = fs.readFileSync(input);
assert.equal(hash(source), PINNED_SOURCE, 'Pinned source hash');
assert.ok(input !== output && !input.startsWith(`${output}${path.sep}`), 'Output must not contain the source');
if (fs.existsSync(output)) {
  assert.ok(!fs.lstatSync(output).isSymbolicLink(), 'Output must not be a symbolic link');
  assert.equal(fs.readdirSync(output).length, 0, 'Output directory must be empty; no overwrite');
}
const require = createRequire(import.meta.url);
const validator = require(path.resolve(values['validator-module']));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
sharp.concurrency(1);

function unpack(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF'); assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Complete GLB');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0); assert.ok(offset + 8 + length <= bytes.length);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) { assert.ok(!json); json = JSON.parse(chunk.toString('utf8')); }
    else if (type === 0x004e4942) { assert.ok(!bin); bin = chunk; }
    else throw Error('Unsupported GLB chunk');
    offset += 8 + length;
  }
  assert.ok(json && bin); assert.equal(json.buffers.length, 1); assert.equal(json.buffers[0].uri, undefined);
  assert.ok(json.buffers[0].byteLength <= bin.length && bin.length - json.buffers[0].byteLength <= 3);
  for (const view of json.bufferViews) {
    assert.equal(view.buffer, 0); assert.ok((view.byteOffset ?? 0) + view.byteLength <= bin.length);
  }
  return { json, bin };
}
function viewBytes(glb, index) {
  const view = glb.json.bufferViews[index];
  return glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}
function pack(json, bin) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonPad = Buffer.alloc((4 - text.length % 4) % 4, 0x20), binPad = Buffer.alloc((4 - bin.length % 4) % 4);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + text.length + jsonPad.length + bin.length + binPad.length, 8);
  jsonHeader.writeUInt32LE(text.length + jsonPad.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(bin.length + binPad.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, text, jsonPad, binHeader, bin, binPad]);
}
const base = unpack(source);
const imageViews = new Set(base.json.images.map(image => image.bufferView));
assert.equal(imageViews.size, base.json.images.length, 'One buffer view per embedded source image');
for (const accessor of base.json.accessors) {
  assert.ok(!imageViews.has(accessor.bufferView));
  assert.ok(!accessor.sparse, 'Unexpected sparse accessors require an explicit policy');
}
const normalImages = new Set(), dataImages = new Set();
for (const material of base.json.materials) {
  if (material.normalTexture) normalImages.add(base.json.textures[material.normalTexture.index].source);
  if (material.pbrMetallicRoughness?.metallicRoughnessTexture) dataImages.add(base.json.textures[material.pbrMetallicRoughness.metallicRoughnessTexture.index].source);
}
const sourceDoc = await io.readBinary(source);
const primitives = sourceDoc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
const clips = sourceDoc.getRoot().listAnimations().map(animation => ({
  name: animation.getName(), channels: animation.listChannels().length,
  duration: Math.max(...animation.listSamplers().map(sampler => Math.max(...sampler.getInput().getArray()))),
}));
assert.deepEqual(clips.map(clip => clip.name).sort(), ['simao-idle-r11', 'simao-walk-r11']);
const geometry = {
  meshes: base.json.meshes.length, primitives: primitives.length,
  vertices: primitives.reduce((sum, primitive) => sum + primitive.getAttribute('POSITION').getCount(), 0),
  triangles: primitives.reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0),
  skins: base.json.skins.length, joints: base.json.skins.map(skin => skin.joints.length), accessors: base.json.accessors.length,
};
const immutableFields = ['asset', 'scene', 'scenes', 'nodes', 'meshes', 'skins', 'animations', 'accessors', 'materials', 'samplers'];
const structuralHash = hash(Buffer.from(JSON.stringify(Object.fromEntries(immutableFields.map(key => [key, base.json[key]])))));
const sourceValidation = await validator.validateBytes(new Uint8Array(source), { uri: 'simao-r11-rig-candidate.glb', maxIssues: 200 });
assert.equal(sourceValidation.issues.numErrors, 0, 'Source Khronos validator errors');
fs.mkdirSync(path.join(output, 'validation'), { recursive: true });
fs.writeFileSync(path.join(output, 'validation/source.json'), JSON.stringify(sourceValidation, null, 2));
const artifacts = [];
for (const limit of [1024, 512]) {
  const json = structuredClone(base.json), replacements = new Map(), images = [];
  for (const [index, image] of base.json.images.entries()) {
    assert.ok(Number.isInteger(image.bufferView) && !image.uri, 'Images must be embedded');
    const original = viewBytes(base, image.bufferView), metadata = await sharp(original).metadata();
    const resized = await sharp(original).resize(limit, limit, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const role = normalImages.has(index) ? 'normal' : dataImages.has(index) ? 'metallicRoughness' : 'baseColor';
    const lossless = role !== 'baseColor';
    const encoded = await sharp(resized.data, { raw: resized.info }).webp({ lossless, quality: 92, effort: 5 }).toBuffer();
    const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, resized.info.width); assert.equal(decoded.info.height, resized.info.height);
    assert.ok(decoded.info.width <= limit && decoded.info.height <= limit);
    assert.equal(decoded.data.length, decoded.info.width * decoded.info.height * 4);
    if (lossless) assert.ok(decoded.data.equals(resized.data), 'Data/normal encoding must preserve the resized pixels exactly');
    replacements.set(image.bufferView, encoded); json.images[index].mimeType = 'image/webp';
    images.push({ index, role, sourceSha256: hash(original), sourceBytes: original.length, sourceDimensions: [metadata.width, metadata.height],
      width: decoded.info.width, height: decoded.info.height, encodedBytes: encoded.length, encodedSha256: hash(encoded),
      resizedPixelSha256: hash(resized.data), decodedPixelSha256: hash(decoded.data), losslessAfterResize: lossless });
  }
  const parts = []; let offset = 0;
  for (const [index, view] of json.bufferViews.entries()) {
    const padding = Buffer.alloc((4 - offset % 4) % 4); parts.push(padding); offset += padding.length;
    const bytes = replacements.get(index) ?? viewBytes(base, index);
    view.byteOffset = offset; view.byteLength = bytes.length; parts.push(bytes); offset += bytes.length;
  }
  json.buffers[0].byteLength = offset;
  for (const texture of json.textures) {
    assert.ok(Number.isInteger(texture.source));
    texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } }; delete texture.source;
  }
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'EXT_texture_webp'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), 'EXT_texture_webp'])];
  const bytes = pack(json, Buffer.concat(parts)), derived = unpack(bytes);
  for (const key of immutableFields) assert.deepEqual(derived.json[key], base.json[key], `Unchanged ${key}`);
  let invariantViews = 0;
  for (const index of base.json.bufferViews.keys()) if (!imageViews.has(index)) {
    assert.ok(viewBytes(base, index).equals(viewBytes(derived, index)), `Unchanged geometry/skin/animation bufferView ${index}`); invariantViews++;
  }
  for (const [index, texture] of derived.json.textures.entries()) {
    const restored = structuredClone(texture); restored.source = restored.extensions.EXT_texture_webp.source;
    delete restored.extensions.EXT_texture_webp; if (!Object.keys(restored.extensions).length) delete restored.extensions;
    assert.deepEqual(restored, base.json.textures[index], `Texture binding ${index}`);
  }
  const consumerDoc = await io.readBinary(bytes);
  assert.equal(consumerDoc.getRoot().listSkins().length, geometry.skins); assert.equal(consumerDoc.getRoot().listAnimations().length, clips.length);
  const sha256 = hash(bytes), file = `simao-r12-${limit}-${sha256.slice(0, 12)}.glb`;
  const validation = await validator.validateBytes(new Uint8Array(bytes), { uri: file, maxIssues: 200 });
  assert.equal(validation.issues.numErrors, 0, `Derived ${limit} Khronos errors`);
  fs.writeFileSync(path.join(output, file), bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, `validation/${limit}.json`), JSON.stringify(validation, null, 2));
  artifacts.push({ profile: limit === 512 ? 'mobile' : 'desktop', file, expectedBytes: bytes.length, sha256,
    textureMaxSize: limit, imageBytes: images.reduce((sum, image) => sum + image.encodedBytes, 0),
    estimatedRgba8BytesWithMipmaps: images.reduce((sum, image) => sum + Math.ceil(image.width * image.height * 4 * 4 / 3), 0),
    structuralHash, unchangedNonImageBufferViews: invariantViews, images,
    validation: { errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, infos: validation.issues.numInfos } });
}
assert.equal(hash(fs.readFileSync(input)), PINNED_SOURCE, 'Source preserved after derivation');
const report = { schemaVersion: 1, revision: 'simao-texture-profiles-r12', generatedAt: new Date().toISOString(),
  source: { filename: path.basename(input), sha256: PINNED_SOURCE, bytes: source.length },
  license: 'Proprietary Alex Tripo asset; not MIT/CC0. Local profiles do not authorize publication.',
  approval: 'reviewed-integration-candidate', units: 'meters', nativeForward: '-Z', groundY: 0, heightMeters: 1.76,
  geometry, clips, nominalWalkSpeedMps: .70, invariants: immutableFields, structuralHash,
  tooling: { node: process.version, sharp: sharp.versions, gltfTransform: '4.5.1', validator: validator.version() },
  encoding: { extension: 'EXT_texture_webp', baseColorQuality: 92, normalAndMetallicRoughnessLosslessAfterResize: true, effort: 5 },
  sourcePreserved: true, artifacts,
  limits: ['No mesh simplification, animation edits, rig changes or UV edits', 'CPU/image decoder and glTF validation only; GPU and phone QA are separate',
    'WebP compresses download bytes, not the decoded GPU texture allocation', 'No terrain IK, facial animation or cloth simulation inferred'],
};
fs.writeFileSync(path.join(output, 'PROVENANCE.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ geometry, clips, sourcePreserved: true, artifacts: artifacts.map(({ images, ...artifact }) => artifact) }, null, 2));
