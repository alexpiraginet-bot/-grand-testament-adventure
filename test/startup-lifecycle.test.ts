import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StartupLifecycle} from '../src/startup-lifecycle.ts';

test('a failed startup remains terminal and cleans prepared resources once',async()=>{
  const startup=new StartupLifecycle();let disposed=0;
  await startup.track(Promise.resolve({asset:1}),()=>disposed++);
  assert.equal(startup.cancel(new Error('context lost')),true);
  assert.equal(startup.cancel(new Error('later error')),false);
  assert.equal(disposed,1);assert.throws(()=>startup.check(),/context lost/);
});

test('late assets are disposed after cancellation without entering the ready path',async()=>{
  const startup=new StartupLifecycle();let resolve!:(value:string)=>void,disposed='';
  const pending=startup.track(new Promise<string>(r=>resolve=r),resource=>disposed=resource);
  startup.cancel(new Error('world load failed'));
  await assert.rejects(pending,/world load failed/);
  resolve('late bitmap');await Promise.resolve();await Promise.resolve();
  assert.equal(disposed,'late bitmap');assert.throws(()=>startup.check(),/world load failed/);
});

test('a context loss between compile and render stops the next stage',async()=>{
  const startup=new StartupLifecycle(),stages:string[]=[];
  stages.push('compile');await Promise.resolve();startup.cancel(new Error('device lost'));
  assert.throws(()=>{startup.check();stages.push('render');},/device lost/);
  assert.deepEqual(stages,['compile']);
});
