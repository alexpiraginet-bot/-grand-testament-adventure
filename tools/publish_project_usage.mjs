// Publish only validated aggregate metadata. No source logs, credentials or game deploy.
// One-shot command: it neither schedules a task nor leaves a background process.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEffortSnapshot} from '../src/effort.ts';
import {mergePublicUsage} from './merge_project_usage.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.length>1||args.length===1&&args[0]!=='--push')throw Error('Use: node tools/publish_project_usage.mjs [--push]');
const push=args[0]==='--push';
const local=parseEffortSnapshot(JSON.parse(readFileSync(path.join(root,'public/metrics/development.json'),'utf8')));
if(!local.sessions.length)throw Error('No observed sessions to publish');
const branch='metrics/development',ref=`refs/heads/${branch}`;
const remote='https://github.com/alexpiraginet-bot/-grand-testament-adventure.git';
const folder=path.join(root,'assets-src/usage-publisher.git');
mkdirSync(path.dirname(folder),{recursive:true});
const lock=path.join(root,'assets-src/usage-publication.lock');
const fd=openSync(lock,'wx');closeSync(fd);
const git=(cwd,argv,input)=>execFileSync('git',argv,{cwd,encoding:'utf8',input,stdio:['pipe','pipe','pipe']}).trim();
try {
  if(!existsSync(folder))git(root,['init','--bare',folder]);
  const advertised=git(root,['ls-remote','--heads',remote,branch]);
  let parent=null,previous=null;
  if(advertised){
    parent=advertised.split(/\s+/)[0];
    if(!/^[a-f0-9]{40}$/.test(parent))throw Error('Invalid remote revision');
    git(folder,['fetch','--no-tags',remote,ref]);
    const fetched=git(folder,['rev-parse','FETCH_HEAD']);
    if(fetched!==parent)throw Error('Concurrent metrics update; rerun to preserve it');
    previous=parseEffortSnapshot(JSON.parse(git(folder,['show',`${parent}:development.json`])));
  }
  const merged=mergePublicUsage(previous,local),generatedAt=merged.generatedAt;
  // Deterministic sanitized serialization. Never overwrite a concurrently collected local snapshot.
  const bytes=JSON.stringify(merged,null,2)+'\n';
  if(!push){console.log(JSON.stringify({status:'validated-not-published',sessions:merged.sessions.length,generatedAt,bytes:Buffer.byteLength(bytes)}));}
  else if(previous&&JSON.stringify(previous)===JSON.stringify(merged)){
    console.log(JSON.stringify({status:'unchanged',commit:parent}));
  } else {
    const files={
      'development.json':bytes,
      'vercel.json':JSON.stringify({git:{deploymentEnabled:false}},null,2)+'\n',
      'README.md':'# Registro agregado de desenvolvimento\n\nSomente metadados públicos validados de horas estimadas e tokens. Sem prompts, logs privados, dados de apoiadores ou credenciais. Valores de API são comparação teórica, não cobrança de assinatura. Esta branch não executa deploy do jogo.\n',
    };
    // Keep other contributors' files/subtrees. Replace only the three owned files.
    const entries=new Map();
    if(parent)for(const row of git(folder,['ls-tree','-z',parent]).split('\0').filter(Boolean)){
      const tab=row.indexOf('\t');entries.set(row.slice(tab+1),row);
    }
    for(const [name,data] of Object.entries(files)){
      const blob=git(folder,['hash-object','-w','--stdin'],data);entries.set(name,`100644 blob ${blob}\t${name}`);
    }
    const tree=git(folder,['mktree','-z'],[...entries.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,row])=>row+'\0').join(''));
    const name=git(root,['config','user.name']),email=git(root,['config','user.email']);
    const commit=git(folder,['-c',`user.name=${name}`,'-c',`user.email=${email}`,'commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`metrics: observed development usage ${generatedAt}`]);
    // Ordinary fast-forward push rejects a concurrent writer. Never force-push metrics.
    git(folder,['push',remote,`${commit}:${ref}`]);
    const observed=git(root,['ls-remote','--heads',remote,branch]).split(/\s+/)[0];
    if(observed!==commit)throw Error('Remote changed after publication; inspect before retrying');
    console.log(JSON.stringify({status:'published',commit,generatedAt,sessions:merged.sessions.length,
      url:'https://raw.githubusercontent.com/alexpiraginet-bot/-grand-testament-adventure/metrics/development/development.json'}));
  }
} finally {unlinkSync(lock);}
