import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {Sfx} from '../src/audio.ts';
class Param {
 value=0;targets:number[]=[];
 cancelScheduledValues(){}
 setTargetAtTime(value:number){this.value=value;this.targets.push(value);}
 setValueAtTime(value:number){this.value=value;}
 linearRampToValueAtTime(value:number){this.value=value;}
 exponentialRampToValueAtTime(value:number){this.value=value;}
}
class FakeContext {
 static made:FakeContext[]=[];
 state='suspended';currentTime=0;destination={};resumeCalls=0;oscillators=0;rejectResume=false;throwResume=false;
 constructor(){FakeContext.made.push(this);}
 createGain(){return {gain:new Param(),connect(){}};}
 createOscillator(){this.oscillators++;return{frequency:new Param(),connect(){},start(){},stop(){}};}
 resume(){this.resumeCalls++;if(this.throwResume)throw Error('interrupted');if(this.rejectResume)return Promise.reject(Error('blocked'));this.state='running';return Promise.resolve();}
}
const install=(t:TestContext,AC:unknown=FakeContext)=>{
 const old=globalThis.window;FakeContext.made=[];
 Object.assign(globalThis,{window:{AudioContext:AC}});
 t.after(()=>Object.assign(globalThis,{window:old}));
};
test('Sfx does not allocate before start and reuses its graph after interruption',async t=>{
 install(t);const sfx=new Sfx();assert.equal(FakeContext.made.length,0);
 const graph=sfx.start()!;await Promise.resolve();const ctx=FakeContext.made[0];
 assert.equal(ctx.resumeCalls,1);assert.equal(ctx.oscillators,0);assert.equal(sfx.stats.syntheticWaves,false);
 ctx.state='suspended';sfx.resumeFromGesture();await Promise.resolve();
 assert.equal(ctx.resumeCalls,2);assert.equal(sfx.start()?.context,graph.context);assert.equal(FakeContext.made.length,1);
});
test('mute and modal pause gate interface tones and reuse master gain',t=>{
 install(t);const sfx=new Sfx();sfx.setMuted(true);const graph=sfx.start()!;const ctx=FakeContext.made[0];
 assert.equal(graph.output.gain.value,0);sfx.thump();sfx.tick();assert.equal(ctx.oscillators,0);
 sfx.setMuted(false);assert.equal(graph.output.gain.value,.7);sfx.tick();assert.equal(ctx.oscillators,2);
 sfx.setPaused(true);assert.equal(graph.output.gain.value,0);sfx.line();assert.equal(ctx.oscillators,2);
 sfx.setPaused(false);sfx.line();assert.equal(ctx.oscillators,4);
});
test('unchanged frame pause state does not enqueue fresh gain automation',t=>{
 install(t);const sfx=new Sfx(),graph=sfx.start()!;sfx.setPaused(true);
 const param=graph.output.gain as unknown as Param,count=param.targets.length;
 for(let i=0;i<120;i++)sfx.setPaused(true);
 assert.equal(param.targets.length,count);
});
test('unavailable audio and failed resume are optional, not fatal to Go',async t=>{
 install(t,undefined);Object.assign(globalThis,{window:{}});const unsupported=new Sfx();assert.equal(unsupported.available,false);assert.equal(unsupported.start(),null);
 Object.assign(globalThis,{window:{AudioContext:FakeContext}});const sfx=new Sfx();assert.equal(sfx.available,true);sfx.start();
 const ctx=FakeContext.made[0];ctx.state='suspended';ctx.rejectResume=true;sfx.resumeFromGesture();await Promise.resolve();
 assert.match(sfx.stats.resumeError??'',/blocked/);
 ctx.rejectResume=false;ctx.throwResume=true;assert.doesNotThrow(()=>sfx.resumeFromGesture());assert.match(sfx.stats.resumeError??'',/interrupted/);
});
