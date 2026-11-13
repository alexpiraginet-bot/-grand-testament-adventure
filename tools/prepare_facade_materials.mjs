import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
// Source directory holds the three original 1k JPGs and the official files.json.
// No asset download, credential, GPU or original-file mutation occurs here.
const source=process.argv[2];
if(!source)throw Error('Usage: node tools/prepare_facade_materials.mjs <rough_wood source directory>');
const out='public/textures/facade-r13';await fs.mkdir(out,{recursive:true});
const files=JSON.parse(await fs.readFile(path.join(source,'files.json'),'utf8'));
const manifest={schemaVersion:1,id:'rough-wood-r13',assetUrl:'https://polyhaven.com/a/rough_wood',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',author:'Rob Tuytel',tileMeters:.5,derivation:'Resize source JPG (1k) to 512/1024; WebP quality 88 albedo, 92 linear data. No retouching. GL normal.',sources:[],profiles:{}};
for(const [key,channel] of [['map','Diffuse'],['normalMap','nor_gl'],['roughnessMap','Rough']]){
 const item=files[channel]['1k'].jpg;const raw=await fs.readFile(path.join(source,path.basename(item.url)));
 manifest.sources.push({channel,url:item.url,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),md5:item.md5});
 for(const size of [512,1024]){
  const buf=await sharp(raw).resize(size,size).webp({quality:key==='map'?88:92,effort:6}).toBuffer();const sha256=createHash('sha256').update(buf).digest('hex');
  const file=`rough-wood-${key}-${size}-${sha256.slice(0,12)}.webp`;await fs.writeFile(path.join(out,file),buf);
  const profile=size===512?'mobile':'desktop';manifest.profiles[profile]??={};manifest.profiles[profile][key]={url:`textures/facade-r13/${file}`,bytes:buf.length,sha256,size,colorSpace:key==='map'?'srgb':'linear'};
 }
}
await fs.writeFile(path.join(out,'SOURCES.json'),JSON.stringify(manifest,null,2)+'\n');
const {sources,derivation,...runtime}=manifest;
await fs.writeFile('src/data/facade-materials-r13.json',JSON.stringify(runtime,null,2)+'\n');
console.log(JSON.stringify(manifest.profiles,null,2));
