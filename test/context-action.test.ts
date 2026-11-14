import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContextAction,beginConversation,advanceConversation,conversationLabel,SIMAO_CONVERSATION} from '../src/context-action.ts';
import {candidates,receiver,switchFocus,type Target} from '../src/interactions.ts';
const simao:Target={id:'talk:simao',kind:'talk',label:'Conversar com Simão',anchor:{x:0,z:-2},height:1,available:true};
const hero={pos:{x:0,z:0},heading:0,height:1};
const around={clearLine:()=>true,deepWater:()=>false};
test('E follows the shown label; mission and chosen conversation cannot both receive it',()=>{
 const actions=new ContextAction(),list=candidates([simao],hero,around),mission={label:'Chamar Simão e André'};
 const first=receiver({ongoing:null,candidates:list,chosen:null,mission});actions.present(first);
 assert.deepEqual(actions.take(true,first),{to:'mission',...mission});
 assert.deepEqual(actions.take(true,first),{to:'none'},'one painted action cannot be consumed twice');
 const chosen=switchFocus(list,null),talk=receiver({ongoing:null,candidates:list,chosen,mission});
 actions.present(talk);assert.deepEqual(actions.take(true,talk),{to:'target',id:simao.id,label:simao.label});
});
test('stale label, departed actor, hidden menu and target switch cannot trigger another action',()=>{
 const actions=new ContextAction(),shown={to:'target' as const,id:simao.id,label:simao.label};
 for(const current of [{to:'none' as const},{...shown,id:'talk:andre'},{...shown,label:'Encerrar conversa'},{to:'mission' as const,label:'Chamar'}]){
  actions.present(shown);assert.deepEqual(actions.take(true,current),{to:'none'});
 }
 actions.present(shown);actions.clear();assert.deepEqual(actions.take(true,shown),{to:'none'});
});
test('conversation cannot be offered through wall, deep water, at a different elevation or with no actor',()=>{
 for(const list of [candidates([simao],hero,{...around,clearLine:()=>false}),candidates([simao],hero,{...around,deepWater:()=>true}),
  candidates([{...simao,available:false}],hero,around),candidates([{...simao,height:4}],hero,around),candidates([{...simao,anchor:{x:0,z:-8}}],hero,around)])assert.equal(list.length,0);
});
test('optional authored dialogue ends without changing scripture or mission state',()=>{
 const before=JSON.stringify(SIMAO_CONVERSATION);let talk=beginConversation(true);
 assert.equal(conversationLabel(talk),'Continuar conversa');talk=advanceConversation(talk)!;
 assert.equal(conversationLabel(talk),'Encerrar conversa');assert.equal(advanceConversation(talk),null);
 assert.equal(JSON.stringify(SIMAO_CONVERSATION),before);
});
