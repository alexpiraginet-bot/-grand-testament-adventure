// Reproducible CC0 texture derivative, independent of the proprietary Tripo meshes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const maps={
  albedo:{url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_gravel/rocky_gravel_diff_2k.jpg',md5:'b78a49ef675dff9dcc62f4668854db23'},
  normal:{url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_gravel/rocky_gravel_nor_gl_2k.jpg',md5:'11de3f8b3a18e4211a46b55ef341bf82'},
  roughness:{url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_gravel/rocky_gravel_rough_2k.jpg',md5:'bd3d01e357a4d2c0ad0d7e3481505bdd'},
};
await mkdir('tools/.cache/ground',{recursive:true}); await mkdir('public/textures/ground',{recursive:true});
const record={asset:'Rocky Gravel',source:'https://polyhaven.com/a/rocky_gravel',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',authors:['Dimitrios Savva','Dario Barresi'],note:'Photographed material reference; not a scan of Capernaum.',maps:{}};
for(const [role,src] of Object.entries(maps)) {
  const cache=`tools/.cache/ground/${role}.jpg`;
  let input=await readFile(cache).catch(()=>null);
  if(!input) { const response=await fetch(src.url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`${response.status}: ${src.url}`);input=Buffer.from(await response.arrayBuffer());await writeFile(cache,input); }
  if(createHash('md5').update(input).digest('hex')!==src.md5)throw Error(`Source integrity: ${role}`);
  const bytes=await sharp(input).resize(2048,2048).webp({quality:role==='normal'?95:90}).toBuffer();
  const path=`public/textures/ground/rocky-gravel-${role}.webp`;
  await writeFile(path,bytes);
  record.maps[role]={...src,sourceSha256:createHash('sha256').update(input).digest('hex'),path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:2048,height:2048};
}
await writeFile('public/textures/ground/LICENSE.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
