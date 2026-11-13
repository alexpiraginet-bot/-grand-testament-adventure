import test from 'node:test';
import assert from 'node:assert/strict';
import {copyPixKey,SUPPORT} from '../src/support.ts';

test('support copies only the explicitly configured public email key after clipboard acknowledgement',async()=>{
  const writes:string[]=[];
  assert.equal(await copyPixKey(async value=>{writes.push(value);}),true);
  assert.deepEqual(writes,['Alexpiraginet@outlook.com']);
  assert.equal(SUPPORT.pixKeyType,'E-mail');
  assert.equal(new URL(SUPPORT.diaryUrl).pathname,'/alexpiraginet-bot/-grand-testament-adventure/blob/main/docs/DIARIO-DESENVOLVIMENTO.md');
});

test('unavailable or rejected clipboard returns manual-copy state rather than false success',async()=>{
  assert.equal(await copyPixKey(),false);
  assert.equal(await copyPixKey(async()=>{throw new Error('clipboard denied');}),false);
});
