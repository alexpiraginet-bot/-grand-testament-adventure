// Reviewed CC0 panorama -> bounded, locally vendored sky/background derivatives.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const source={url:'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kloofendal_48d_partly_cloudy_puresky.jpg',md5:'3f2b19fa9c14943b34e5d4f480ba13ba'};
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
await mkdir('tools/.cache/sky',{recursive:true});await mkdir('public/textures/sky',{recursive:true});
const cache='tools/.cache/sky/kloofendal.jpg';
let input=await readFile(cache).catch(()=>null);
if(!input){const response=await fetch(source.url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Sky source: ${response.status}`);input=Buffer.from(await response.arrayBuffer());await writeFile(cache,input);}
if(hash(input,'md5')!==source.md5)throw Error('Sky source integrity');
const record={asset:'Kloofendal 48d Partly Cloudy (Pure Sky)',source:'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',authors:['Greg Zaal','Jarod Guest'],note:'Photographic sky reference, not a photograph of first-century Capernaum. Tonemapped LDR derivatives, not HDR lighting.',original:{...source,sha256:hash(input)},maps:{}};
for(const [role,width] of [['background',4096],['environment',1024]]){
 const bytes=await sharp(input).resize(width,width/2).webp({quality:90}).toBuffer(),path=`public/textures/sky/clouds-${role}.webp`;
 await writeFile(path,bytes);record.maps[role]={path,bytes:bytes.length,sha256:hash(bytes),width,height:width/2};
}
await writeFile('public/textures/sky/LICENSE.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
