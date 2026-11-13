import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {faunaAssetsManifest,selectFaunaAssets,type FaunaRuntimeAssetSpec} from '../src/fauna-assets-manifest.ts';
const fixture:FaunaRuntimeAssetSpec={kind:'chicken',status:'approved',url:'models/original-chicken.glb',expectedBytes:100,
  nativeForwardYaw:Math.PI,scaleToMeters:1,origin:[0,0,0],body:{radius:.3,halfHeight:.4},locomotion:{mode:'walk',clip:'walk',speedMetersPerSecond:.5}};

test('an empty or entirely pending catalogue selects no animal assets',()=>{
  assert.deepEqual(selectFaunaAssets([],false),[]);assert.deepEqual(selectFaunaAssets([],true),[]);
  const pending={...fixture,status:'pending' as const};
  assert.deepEqual(selectFaunaAssets([{kind:'chicken',desktop:pending,mobile:pending}],false),[]);
  assert.deepEqual(selectFaunaAssets([{kind:'chicken',desktop:pending,mobile:pending}],true),[]);
});
test('approval is explicit for each device profile, with no desktop fallback on mobile',()=>{
  const desktopOnly=[{kind:'chicken' as const,desktop:fixture}];
  assert.equal(selectFaunaAssets(desktopOnly,false).length,1);assert.deepEqual(selectFaunaAssets(desktopOnly,true),[]);
  const pending=[{kind:'chicken' as const,desktop:fixture,mobile:{...fixture,status:'pending' as const}}];
  assert.deepEqual(selectFaunaAssets(pending,true),[]);
  const mobile=[{kind:'chicken' as const,desktop:{...fixture,status:'pending' as const},mobile:fixture}];
  assert.deepEqual(selectFaunaAssets(mobile,false),[]);assert.equal(selectFaunaAssets(mobile,true).length,1);
});
test('profile selection keeps measured bounds and integrity while resolving base-relative or hosted URLs',()=>{
  const selection=selectFaunaAssets([{kind:'chicken',desktop:{...fixture,sha256:'a'.repeat(64)}}],false,'/game/')[0];
  assert.equal(selection.url,'/game/models/original-chicken.glb');assert.equal(selection.sha256,'a'.repeat(64));assert.deepEqual(selection.body,fixture.body);
  const hosted=selectFaunaAssets([{kind:'chicken',mobile:{...fixture,url:'https://assets.example/original.glb'}}],true,'/game/')[0];
  assert.equal(hosted.url,'https://assets.example/original.glb');assert.equal(fixture.url,'models/original-chicken.glb');
});
test('mismatched or duplicate approved species cannot silently choose the wrong asset',()=>{
  assert.throws(()=>selectFaunaAssets([{kind:'donkey',desktop:fixture}],false),/Invalid or duplicate/);
  assert.throws(()=>selectFaunaAssets([{kind:'chicken',desktop:fixture},{kind:'chicken',desktop:fixture}],false),/Invalid or duplicate/);
});

test('reviewed species retain source integrity, separate device budgets and measured body clearance',()=>{
  const catalogue=JSON.parse(readFileSync(new URL('../public/fauna/SOURCES.json',import.meta.url),'utf8'));
  const desktop=faunaAssetsManifest(false),mobile=faunaAssetsManifest(true);
  assert.deepEqual(catalogue.species.map((s:{kind:string})=>s.kind).sort(),desktop.map(a=>a.kind).sort());
  assert.deepEqual(mobile.map(a=>a.kind).sort(),desktop.map(a=>a.kind).sort());
  for(const record of catalogue.species){
    const pc=desktop.find(a=>a.kind===record.kind)!,phone=mobile.find(a=>a.kind===record.kind)!;
    assert.notEqual(pc.url,phone.url);assert.ok(phone.expectedBytes<pc.expectedBytes);
    for(const [profile,asset] of [['desktop',pc],['mobile',phone]] as const){
      const file=record.files.find((f:{profile:string})=>f.profile===profile);
      assert.equal(asset.url,`/${file.url}`);assert.equal(asset.expectedBytes,file.bytes);assert.equal(asset.sha256,file.sha256);
      assert.ok(asset.url.endsWith(`-${asset.sha256!.slice(0,12)}.glb`));
      assert.ok(asset.body.radius>record.adaptation.measuredEnvelope.cornerRadiusMeters);
      const {minMeters,maxMeters}=record.adaptation.measuredEnvelope;
      assert.ok(asset.body.halfHeight*2>=maxMeters[1]-minMeters[1]);
      assert.equal(asset.locomotion.speedMetersPerSecond,record.adaptation.locomotion.nominalMetersPerSecond);
      assert.equal(asset.locomotion.clip,record.adaptation.locomotion.clip);
      if(record.adaptation.idle)assert.equal(asset.idleClip,record.adaptation.idle.clip);
      assert.equal(asset.scaleToMeters,1);assert.equal(asset.nativeForwardYaw,0);assert.deepEqual(asset.origin,[0,0,0]);
    }
  }
});
