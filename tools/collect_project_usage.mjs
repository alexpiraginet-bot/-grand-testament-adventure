// Explicit local-only collector. No network, auto-discovery, credential access or publication.
// node tools/collect_project_usage.mjs --source <authorized JSONL> --since <ISO>
//   --out public/metrics/development.json --cursor assets-src/telemetry/cursor.json [--once]
// Optional --watch-seconds N polls every 60 seconds and ends within 7200 seconds.
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,rename,stat,realpath} from 'node:fs/promises';
import {resolve,dirname,basename,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {isUsageMetadataHeader,parseUsageMetadata,consumeUsageMetadata,createUsageState,publicUsageSnapshot} from './project-usage-core.mjs';

const AUTHORIZED_SESSION='01a09ccb-fd11-7903-be4c-25b2f10603ff';
const options={};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i];
  if(key==='--once'){options.once=true;continue;}
  if(!['--source','--since','--out','--cursor','--watch-seconds'].includes(key)||!process.argv[i+1])throw new Error('Use explicit --source, --since, --out, --cursor and optional --watch-seconds N or --once');
  options[key.slice(2)]=process.argv[++i];
}
if(!options.source||!options.since||!options.out||!options.cursor)throw new Error('Missing explicit source, since, out or cursor');
const since=new Date(options.since).toISOString();
if(since<'2026-11-12T19:28:52.842Z')throw new Error('Coverage cannot precede the authorized game marker');
const source=await realpath(resolve(options.source));
if(!basename(source).endsWith(`-${AUTHORIZED_SESSION}.jsonl`))throw new Error('Only the explicitly authorized Codex session is permitted');
const output=resolve(options.out),cursorPath=resolve(options.cursor);
const publicRoot=resolve('public');
const inside=(root,path)=>{const rel=relative(root,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../');};
if(inside(publicRoot,cursorPath)||source===output||source===cursorPath||cursorPath===output)throw new Error('Private source/cursor and public snapshot must be separate');
// A private cursor must remain Git-ignored before any metadata is written.
try{execFileSync('git',['check-ignore','--quiet','--',cursorPath],{stdio:'ignore'});}catch{throw new Error('Cursor destination must be Git-ignored (use assets-src/telemetry/cursor.json)');}
const watch=options['watch-seconds']===undefined?0:Number(options['watch-seconds']);
if(!Number.isInteger(watch)||watch<0||watch>7200||(options.once&&watch))throw new Error('watch-seconds must be an integer from 0 to 7200; do not combine with --once');
let cursor;
try{cursor=JSON.parse(await readFile(cursorPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(cursor&&(cursor.version!==1||cursor.sourcePath!==source||cursor.since!==since||cursor.sessionId!==AUTHORIZED_SESSION))throw new Error('Cursor belongs to another source/window; use a new private cursor path');
cursor??={version:1,sessionId:AUTHORIZED_SESSION,sourcePath:source,since,offset:0,sourceBirthtimeMs:null,state:createUsageState({sessionId:AUTHORIZED_SESSION,since}),publishedRevision:-1};

async function atomicJson(path,value) {
  await mkdir(dirname(path),{recursive:true});
  const temporary=`${path}.tmp-${process.pid}`;
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n','utf8');await rename(temporary,path);
}

// Stream bytes and retain only candidate metadata lines. Large screenshot/transcript
// records are discarded after their 512-byte header instead of decoded or indexed.
async function scan(start,size) {
  if(start===size)return start;
  let offset=start,committed=start,parts=[],length=0,selected=null;
  const classify=()=>{
    const header=Buffer.concat(parts,Math.min(length,512)).toString('utf8');
    selected=isUsageMetadataHeader(header);
    if(!selected)parts=[];
  };
  for await(const chunk of createReadStream(source,{start,end:size-1,highWaterMark:1024*1024})) {
    let at=0;
    while(at<chunk.length) {
      const newline=chunk.indexOf(10,at),end=newline<0?chunk.length:newline,part=chunk.subarray(at,end);
      if(selected!==false){parts.push(part);length+=part.length;if(selected===null&&length>=512)classify();
        if(selected&&length>2*1024*1024){selected=false;parts=[];}}
      if(newline<0)break;
      if(selected===null)classify();
      if(selected)consumeUsageMetadata(cursor.state,parseUsageMetadata(Buffer.concat(parts,length).toString('utf8')));
      committed=offset+newline+1;parts=[];length=0;selected=null;at=newline+1;
    }
    offset+=chunk.length;
  }
  // A concurrently appended incomplete final line is deliberately read again next poll.
  return committed;
}

async function collectOnce() {
  const info=await stat(source);
  if(!info.isFile()||info.size<cursor.offset||(cursor.sourceBirthtimeMs!==null&&info.birthtimeMs!==cursor.sourceBirthtimeMs))throw new Error('Source was replaced/truncated; review it and choose a new private cursor');
  cursor.sourceBirthtimeMs=info.birthtimeMs;
  const previousOffset=cursor.offset;
  cursor.offset=await scan(cursor.offset,info.size);
  if(cursor.offset>0&&!cursor.state.previous)throw new Error('No valid usage metadata found; refusing to publish a misleading empty snapshot');
  let outputExists=true;try{await stat(output);}catch(error){if(error.code==='ENOENT')outputExists=false;else throw error;}
  const changed=cursor.state.revision!==cursor.publishedRevision;
  let snapshot;
  if(changed||!outputExists) {
    snapshot=publicUsageSnapshot(cursor.state,changed?new Date().toISOString():(cursor.lastPublishedAt??cursor.state.lastActivityAt));
    await atomicJson(output,snapshot);cursor.publishedRevision=cursor.state.revision;cursor.lastPublishedAt=snapshot.generatedAt;
  }
  // Save a byte cursor even when only non-usage records arrived; public freshness stays unchanged.
  await atomicJson(cursorPath,cursor);
  console.log(JSON.stringify({published:changed||!outputExists,bytesScanned:cursor.offset-previousOffset,
    generatedAt:snapshot?.generatedAt??null,lastActivityAt:cursor.state.lastActivityAt,groups:Object.keys(cursor.state.groups).length,
    tokens:Object.values(cursor.state.groups).reduce((sum,group)=>sum+group.inputTokens+group.outputTokens,0),diagnostics:cursor.state.diagnostics}));
}
await collectOnce();
const deadline=Date.now()+watch*1000;
for(let nextPoll=deadline-watch*1000+60000;watch&&nextPoll<=deadline;nextPoll+=60000){
  await delay(Math.max(0,nextPoll-Date.now()));await collectOnce();
}
