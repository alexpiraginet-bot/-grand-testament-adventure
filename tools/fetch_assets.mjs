// Download only reviewed runtime files, pinned by SHA-256. No provider credentials or API calls.
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const catalog=JSON.parse(readFileSync(new URL('../src/data/tripo-assets.json',import.meta.url)));
const host=JSON.parse(readFileSync(new URL('../src/data/asset-host.json',import.meta.url))).url;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let count=0,downloaded=0;
for(const [id,spec] of Object.entries(catalog.assets)) {
  if(spec.status!=='runtime')continue;
  if(!/^models\/tripo-r1\/[a-z0-9-]+\.glb$/.test(spec.file))throw new Error('Unsafe asset path');
  const target=fileURLToPath(new URL(`../public/${spec.file}`,import.meta.url));
  if(existsSync(target)) {
    const bytes=readFileSync(target);
    if(bytes.length===spec.bytes&&hash(bytes)===spec.sha256){count++;continue;}
    throw new Error(`Existing asset does not match reviewed hash: ${id}; preserved for investigation`);
  }
  const response=await fetch(new URL(spec.file,host),{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Asset ${id}: HTTP ${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==spec.bytes||hash(bytes)!==spec.sha256)throw new Error(`Asset integrity mismatch: ${id}`);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(`${target}.part`,bytes);renameSync(`${target}.part`,target);
  count++;downloaded+=bytes.length;
}
console.log(`Runtime assets verified: ${count}; downloaded ${downloaded} bytes. License separate from code.`);
