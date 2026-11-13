import test from 'node:test';
import assert from 'node:assert/strict';
import {VOLUNTEER_ROLES,VOLUNTEER_AVAILABILITY,volunteerIssueUrl,type VolunteerDraft} from '../src/volunteers.ts';
const valid:VolunteerDraft={role:'gameplay',availability:'5',portfolio:'',motivation:'Posso revisar a câmera e testar as primeiras missões no navegador.',acknowledged:true};

test('volunteer draft requires an offered role, bounded availability, useful motivation and explicit public consent',()=>{
  for(const patch of [{role:'__proto__'},{availability:'40'},{motivation:'Olá'},{motivation:'x'.repeat(1001)},{acknowledged:false}])assert.equal(volunteerIssueUrl({...valid,...patch}).ok,false);
  assert.equal(volunteerIssueUrl(valid).ok,true);
  assert.equal(VOLUNTEER_ROLES.length,new Set(VOLUNTEER_ROLES.map(role=>role.id)).size);
  assert.deepEqual(VOLUNTEER_AVAILABILITY.map(item=>item.id),['2','5','10','20']);
});

test('optional portfolio permits HTTPS only, without credentials, controls or an executable scheme',()=>{
  for(const portfolio of ['javascript:alert(1)','data:text/html,<script>','http://example.com','https://name:password@example.com','https://%75ser@example.com','https://example.com/\nsecret','file:///C:/private','not a URL','https://example.com/'+ 'a'.repeat(500)])assert.equal(volunteerIssueUrl({...valid,portfolio}).ok,false,portfolio);
  for(const portfolio of ['', 'https://github.com/example', 'https://example.com/portfólio?projeto=árvore&ano=2026'])assert.equal(volunteerIssueUrl({...valid,portfolio}).ok,true);
});

test('application is an encoded draft on the fixed repository, not automatic registration or privileged issue options',()=>{
  const motivation='Quero ajudar com câmera & efeitos. <script>alert(1)</script>\nTambém testo português e acessibilidade.';
  const result=volunteerIssueUrl({...valid,motivation,portfolio:'https://example.com/work?a=1&b=2'});assert.equal(result.ok,true);if(!result.ok)return;
  const url=new URL(result.url);assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/alexpiraginet-bot/-grand-testament-adventure/issues/new');
  assert.deepEqual([...url.searchParams.keys()].sort(),['body','title']);
  assert.equal(url.searchParams.get('title'),'[Voluntariado] Gameplay e jornada');
  const body=url.searchParams.get('body')!;assert.ok(body.includes(motivation));assert.ok(body.includes('https://example.com/work?a=1&b=2'));
  assert.match(body,/depende de análise/);assert.match(body,/Não representa entrada confirmada/);assert.doesNotMatch(body,/undefined/);
  assert.equal(volunteerIssueUrl({...valid,motivation,portfolio:'https://example.com/work?a=1&b=2'}).ok,true);
});

test('every proposed area and weekly option yields a reviewable draft without manufacturing an accepted place',()=>{
  for(const role of VOLUNTEER_ROLES)for(const availability of VOLUNTEER_AVAILABILITY){
    const result=volunteerIssueUrl({...valid,role:role.id,availability:availability.id});assert.equal(result.ok,true);if(!result.ok)continue;
    const body=new URL(result.url).searchParams.get('body')!;assert.ok(body.includes(role.label));assert.ok(body.includes(availability.label));
  }
});
