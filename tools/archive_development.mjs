// Preserve real evidence for the development diary; no rendering, upload or social publication.
import {readFile,readdir,mkdir,copyFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const archiveRoot='D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='--commit' && /^[a-f0-9]{40}$/i.test(args[1])))throw Error('Use: node tools/archive_development.mjs [--commit FULL_SHA]');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
const r3Commit=args[1]||'working-tree';
if(r3Commit!=='working-tree'&&git('rev-parse',`${r3Commit}^{commit}`)!==r3Commit)throw Error('R3 commit not found');
const releases=[
 {id:'releaseR0',commit:'293fc8415e9aad171775ae8728a25fbcf4c9004c',label:'Protótipo e primeira publicação',sources:['shots/publicacao/feedback','shots/publicacao/episodio','shots/publicacao/build.log']},
 {id:'releaseR1',commit:'6e35ff1534d4d17aa082d1d03113d997b51da801',label:'Herói animado e vila',sources:['shots/production-r1-integration','shots/production-r1-world','shots/production-r1-episode']},
 {id:'releaseR2',commit:'424a096ee7e865553eb7d4ad55d7cb1cd881359b',label:'Céu fotográfico e água rasa',sources:['shots/production-r2-integration','shots/sky-water-r2-build.log']},
 {id:'releaseR3',commit:r3Commit,label:'Ruas, NPCs e orientação da jornada',sources:['shots/r3-final-integration','shots/r3-final-world','shots/r3-final-episode','shots/r3-final-build.log','shots/production-r3-integration','shots/production-r3-world','shots/production-r3-episode']},
];
const allowed=new Set(['.png','.jpg','.jpeg','.webp','.mp4','.webm','.json','.log']);
async function list(relative){
 const absolute=path.join(repo,relative),s=await stat(absolute).catch(()=>null);
 if(!s)return null;
 if(s.isFile())return allowed.has(path.extname(relative).toLowerCase())?[relative]:[];
 const out=[];
 for(const entry of (await readdir(absolute,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isSymbolicLink())continue;
  const child=path.posix.join(relative.replaceAll('\\','/'),entry.name);
  if(entry.isDirectory())out.push(...await list(child));
  else if(entry.isFile()&&allowed.has(path.extname(child).toLowerCase()))out.push(child);
 }
 return out;
}
async function immutableWrite(filename,bytes){
 await mkdir(path.dirname(filename),{recursive:true});
 const current=await readFile(filename).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
 if(current){if(sha(current)!==sha(bytes))throw Error(`Preserving divergent archive file: ${filename}`);return;}
 await writeFile(filename,bytes,{flag:'wx'});
}
const index={schema:1,repository:'https://github.com/alexpiraginet-bot/-grand-testament-adventure',archiveRoot,releases:[],limits:['Archive records existing files and hashes; it does not certify the claims in a test report.','Mobile viewport on the PC is not a physical phone benchmark.','No video was generated, and no file was uploaded or published on social networks.']};
for(const release of releases){
 const records=[],pending=[];
 for(const source of release.sources){
  const files=await list(source);
  if(!files){pending.push(source);continue;}
  for(const relative of files){const buffer=await readFile(path.join(repo,relative));records.push({relative,source:path.join(repo,relative),bytes:buffer.length,sourceSha256:sha(buffer)});}
 }
 records.sort((a,b)=>a.relative.localeCompare(b.relative));
 const contentHash=sha(JSON.stringify(records.map(({relative,bytes,sourceSha256})=>({relative,bytes,sourceSha256}))));
 const folder=path.join(archiveRoot,release.id,`${release.commit==='working-tree'?'working-tree':release.commit.slice(0,12)}-${contentHash.slice(0,12)}`);
 for(const record of records){
  const destination=path.join(folder,record.relative);
  await mkdir(path.dirname(destination),{recursive:true});
  const existing=await readFile(destination).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
  if(existing&&sha(existing)!==record.sourceSha256)throw Error(`Preserving divergent media: ${destination}`);
  if(!existing)await copyFile(record.source,destination,1); // COPYFILE_EXCL
  const copied=await readFile(destination);
  if(sha(copied)!==record.sourceSha256)throw Error(`Copy integrity: ${destination}`);
  record.destination=destination;record.copySha256=sha(copied);
 }
 const manifest={schema:1,...release,commitDate:release.commit==='working-tree'?null:git('show','-s','--format=%aI',release.commit),status:release.commit==='working-tree'?'working-tree-not-a-release':'commit-associated-evidence',contentHash,pending,files:records};
 // Pending sources can appear in a later run: distinct manifest names preserve both observations.
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),manifestPath=path.join(folder,`MANIFEST-${sha(manifestBytes).slice(0,12)}.json`);
 await immutableWrite(manifestPath,manifestBytes);
 index.releases.push({id:release.id,label:release.label,commit:release.commit,commitDate:manifest.commitDate,folder,manifest:manifestPath,files:records.length,bytes:records.reduce((sum,r)=>sum+r.bytes,0),pending,videoFiles:records.filter(r=>/\.(mp4|webm)$/i.test(r.relative)).length});
}
const indexBytes=Buffer.from(JSON.stringify(index,null,2)+'\n'),indexId=sha(indexBytes).slice(0,12);
const indexJson=path.join(archiveRoot,`INDEX-${indexId}.json`),indexMarkdown=path.join(archiveRoot,`INDEX-${indexId}.md`);
await immutableWrite(indexJson,indexBytes);
const md=['# Diário visual — Grand Testament Adventure','','Arquivo privado local. Fontes preservadas; cópias verificadas por SHA-256.','','| Etapa | Commit / data Git | Arquivos | Vídeos existentes | Manifesto |','|---|---|---:|---:|---|',...index.releases.map(r=>`| ${r.id} — ${r.label} | ${r.commit} / ${r.commitDate||'sem commit'} | ${r.files} | ${r.videoFiles} | [Manifesto](${r.manifest.replaceAll('\\','/')}) |`),'','## Fontes ainda ausentes','',...index.releases.flatMap(r=>r.pending.map(p=>`- ${r.id}: ${p}`)),'','## Limites','','- Índice não prova publicação, aprovação editorial ou desempenho em celular físico.','- Capturas com teleporte de depuração não são gravação de percurso contínuo.','- Não foram gerados vídeos nem feitas publicações sociais.','- R3 com working-tree deve ser arquivada novamente com --commit SHA após a revisão final.',''];
await immutableWrite(indexMarkdown,Buffer.from(md.join('\n')));
console.log(JSON.stringify({indexJson,indexMarkdown,releases:index.releases.map(({id,files,videoFiles,pending,folder})=>({id,files,videoFiles,pending,folder}))},null,2));
