/** Reproducible CC0 material derivatives. No GPU, accounts, paid endpoints or generated artwork. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const argument=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const sourceDir=argument('--source-dir');
if(!sourceDir)throw Error('Required: --source-dir <raw-source-folder>; optional --download --output-dir <folder>');
const outputDir=path.resolve(argument('--output-dir',path.join(here,'../../public/textures/ground/r13')));
const sources=JSON.parse(await fs.readFile(path.join(here,'sources-r13.json'),'utf8'));
if(sharp.versions.sharp!=='0.35.5')throw Error('Reproduction requires the pinned sharp 0.35.5 dependency');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(sourceDir,{recursive:true});await fs.mkdir(outputDir,{recursive:true});
async function preserve(file,bytes){
  try{const old=await fs.readFile(file);if(!old.equals(bytes))throw Error('Refusing divergent existing file: '+file);}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,bytes,{flag:'wx'});}
}
async function sourceBuffer(source){
  if(path.basename(source.file)!==source.file)throw Error('Unsafe source path');
  const file=path.join(sourceDir,source.file);let bytes;
  try{bytes=await fs.readFile(file);}catch(error){
    if(error.code!=='ENOENT'||!args.includes('--download'))throw error;
    if(new URL(source.url).hostname!=='dl.polyhaven.org')throw Error('Unexpected source host');
    const response=await fetch(source.url,{signal:AbortSignal.timeout(60000),headers:{'User-Agent':'GrandTestamentAdventure-CC0Materials/1.0'}});
    if(!response.ok)throw Error('Source HTTP '+response.status);
    bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==source.bytes||sha(bytes)!==source.sha256)throw Error('Downloaded source differs from pinned source');
    await preserve(file,bytes);
  }
  if(bytes.length!==source.bytes||sha(bytes)!==source.sha256)throw Error('Source hash/size mismatch: '+file);
  return bytes;
}
const manifest={schemaVersion:1,revision:'ground-r13',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',
  verifiedDate:sources.verifiedDate,note:sources.licenseNote,
  generator:{script:'tools/materials/prepare_ground_r13.mjs',sharp:sharp.versions.sharp,vips:sharp.versions.vips,
    albedo:'WebP quality 92, sRGB, no hue or exposure edit',
    normalRoughness:'lossless WebP RGB OpenGL normal, A roughness (minimum 1/255); normals renormalized after Lanczos3 resizing'},
  materials:sources.materials,profiles:{}};
for(const size of [512,1024]){
  const files=[];
  for(const [index,source] of sources.materials.entries()){
    const role=index===0?'dirt':'sand';
    const albedo=await sourceBuffer(source.maps.albedo);
    const normal=await sourceBuffer(source.maps.normal);
    const roughness=await sourceBuffer(source.maps.roughness);
    const color=await sharp(albedo).resize(size,size,{kernel:'lanczos3'}).removeAlpha().webp({quality:92,effort:6}).toBuffer();
    const n=await sharp(normal).resize(size,size,{kernel:'lanczos3'}).removeAlpha().raw({depth:'uchar'}).toBuffer({resolveWithObject:true});
    const r=await sharp(roughness).resize(size,size,{kernel:'lanczos3'}).removeAlpha().toColourspace('b-w').raw({depth:'uchar'}).toBuffer({resolveWithObject:true});
    if(n.info.channels!==3||r.info.channels!==1)throw Error('Unexpected normal/roughness channel layout');
    const packed=Buffer.alloc(size*size*4);let zeroRoughnessClamped=0;
    for(let p=0;p<size*size;p++){
      let x=n.data[p*3]/127.5-1,y=n.data[p*3+1]/127.5-1,z=n.data[p*3+2]/127.5-1;
      const length=Math.hypot(x,y,z);if(length<1e-6){x=0;y=0;z=1;}else{x/=length;y/=length;z/=length;}
      packed[p*4]=Math.round((x+1)*127.5);packed[p*4+1]=Math.round((y+1)*127.5);packed[p*4+2]=Math.round((z+1)*127.5);
      if(r.data[p]===0)zeroRoughnessClamped++;
      packed[p*4+3]=Math.max(1,r.data[p]);
    }
    const data=await sharp(packed,{raw:{width:size,height:size,channels:4}}).webp({lossless:true,effort:6,alphaQuality:100}).toBuffer();
    for(const [suffix,bytes] of [['albedo',color],['normal-roughness',data]]){
      const name=`${role}-${size}-${suffix}.webp`;await preserve(path.join(outputDir,name),bytes);
      const decoded=await sharp(bytes).metadata();
      if(decoded.width!==size||decoded.height!==size)throw Error('Derivative dimension mismatch');
      files.push({key:role+(suffix==='albedo'?'Albedo':'NormalRoughness'),path:'textures/ground/r13/'+name,
        bytes:bytes.length,sha256:sha(bytes),width:size,height:size,
        colorSpace:suffix==='albedo'?'srgb':'linear',sourceId:source.id,
        ...(suffix==='albedo'?{}:{zeroRoughnessClamped})});
    }
    // Confirm lossless packing survives the encoder, including the non-opacity alpha channel.
    const check=await sharp(data).raw().toBuffer();
    if(!check.equals(packed))throw Error('Packed normal/roughness failed exact decode verification');
  }
  manifest.profiles[size===512?'mobile':'desktop']={textureMax:size,files,
    totalBytes:files.reduce((sum,f)=>sum+f.bytes,0),
    estimatedGpuRgba8MipBytes:4*size*size*4*4/3};
}
const total=Object.values(manifest.profiles).reduce((sum,p)=>sum+p.totalBytes,0);
if(total>6_000_000)throw Error('Combined runtime file budget exceeds 6 MB');
await preserve(path.join(outputDir,'manifest.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const catalogPath=argument('--catalog-path');
if(catalogPath){await fs.mkdir(path.dirname(path.resolve(catalogPath)),{recursive:true});await preserve(catalogPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));}
console.log(JSON.stringify({outputDir,totalBytes:total,profiles:manifest.profiles},null,2));
