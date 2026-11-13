import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAccountability,accountabilityTotals,formatAccountabilityCents} from '../src/accountability.ts';

const initial=()=>JSON.parse(readFileSync(new URL('../src/data/accountability.json',import.meta.url),'utf8'));
const income=(id='apoio-001',amountCents=12345)=>({id,date:'2026-11-13',type:'income',category:'apoio',label:'Apoio voluntário',amountCents});
const expense=(amountCents=3000)=>({id:'expense-001',date:'2026-11-12',type:'expense',category:'Hospedagem',label:'Serviço do jogo',amountCents});
const reviewed=(overrides:Record<string,unknown>={})=>({...initial(),status:'reviewed',openingBalanceCents:1000,openingBalanceVerified:true,
  updatedAt:'2026-11-13T16:30:00Z',lastReviewedAt:'2026-11-13',entries:[income(),income('apoio-002',55),expense()],...overrides});

test('public initial ledger does not pretend unknown donations are zero and reports only owner-provided monthly subscriptions',()=>{
  const raw=initial(),copy=structuredClone(raw),ledger=parseAccountability(raw);
  assert.deepEqual(accountabilityTotals(ledger),{incomeCents:null,expenseCents:null,balanceCents:null,subscriptionsMonthlyCents:179800});
  assert.equal(ledger.status,'awaiting-records');assert.equal(ledger.entries.length,0);
  assert.deepEqual(ledger.subscriptionCosts.map(s=>[s.name,s.amountCents,s.paymentDay,s.source,s.allocationToGameCents]),[
    ['Claude',79900,6,'owner-reported',null],['Codex',99900,6,'owner-reported',null],
  ]);
  assert.deepEqual(raw,copy,'validation must not alter the published data');
});

test('reviewed income and expenses reconcile exact cents without charging general subscriptions to the project',()=>{
  assert.deepEqual(accountabilityTotals(reviewed()),{incomeCents:12400,expenseCents:3000,balanceCents:10400,subscriptionsMonthlyCents:179800});
  assert.equal(accountabilityTotals(reviewed({openingBalanceCents:-10000})).balanceCents,-600);
  assert.equal(accountabilityTotals(reviewed({openingBalanceCents:0,entries:[]})).balanceCents,0,'zero is shown only when a reviewed zero is actually supplied');
  assert.equal(parseAccountability(reviewed({lastReviewedAt:undefined})).lastReviewedAt,null,'review date is optional independently of required update date');
});

test('missing or unverified opening balance keeps the balance unknown while retaining reviewed activity totals',()=>{
  for(const openingBalanceCents of [null,1000]){
    const totals=accountabilityTotals(reviewed({openingBalanceCents,openingBalanceVerified:false}));
    assert.equal(totals.incomeCents,12400);assert.equal(totals.expenseCents,3000);assert.equal(totals.balanceCents,null);
  }
  assert.throws(()=>parseAccountability(reviewed({openingBalanceCents:null,openingBalanceVerified:true})),/verified value missing/);
});

test('ledger refuses ambiguous currency, duplicated records, impossible dates and accidental donor data before publication',()=>{
  assert.throws(()=>parseAccountability(reviewed({currency:'USD'})),/currency/);
  assert.throws(()=>parseAccountability(reviewed({entries:[income(),income()]})),/duplicate id/);
  for(const date of ['13/11/2026','2026-02-30','2025-02-29','2026-13-01']){
    assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),date}]})),/date/);
  }
  assert.doesNotThrow(()=>parseAccountability(reviewed({entries:[{...income(),date:'2024-02-29'}]})));
  assert.throws(()=>parseAccountability(reviewed({updatedAt:'2026-11-13T24:00:00Z'})),/timestamp/);
  assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),donorName:'Pessoa'}]})),/unsupported field/);
  assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),label:'Pix de uma pessoa'}]})),/anonymous/);
  assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),category:'Pessoa'}]})),/anonymous/);
  assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),type:'transfer'}]})),/type/);
  assert.throws(()=>parseAccountability(reviewed({updatedAt:null})),/update date/);
  assert.throws(()=>parseAccountability({...initial(),entries:[income()]}),/awaiting-records/);
});

test('only positive safe integer transaction amounts and overflow-safe sums can reach the totals',()=>{
  for(const amount of [0,-1,.25,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'12345']){
    assert.throws(()=>parseAccountability(reviewed({entries:[{...income(),amountCents:amount}]})),/integer cents/);
  }
  assert.throws(()=>accountabilityTotals(reviewed({openingBalanceCents:0,entries:[income('one',Number.MAX_SAFE_INTEGER),income('two',1)]})),/safe integer range/);
  assert.throws(()=>accountabilityTotals(reviewed({openingBalanceCents:Number.MAX_SAFE_INTEGER,entries:[income('one',1)]})),/safe integer range/);
  assert.throws(()=>accountabilityTotals(reviewed({openingBalanceCents:Number.MIN_SAFE_INTEGER,entries:[expense(1)]})),/safe integer range/);
  assert.equal(accountabilityTotals(reviewed({openingBalanceCents:0,entries:[income('one',Number.MAX_SAFE_INTEGER)]})).balanceCents,Number.MAX_SAFE_INTEGER);
});

test('evidence links accept public HTTPS destinations and reject scripts, insecure URLs and embedded credentials',()=>{
  for(const evidenceUrl of ['javascript:alert(1)','data:text/html,hello','http://example.com/receipt','https://name:password@example.com/receipt','/receipt.pdf','']){
    assert.throws(()=>parseAccountability(reviewed({entries:[{...expense(),evidenceUrl}]})));
  }
  const link='https://example.com/receipts/expense-001.pdf';
  assert.equal(parseAccountability(reviewed({entries:[{...expense(),evidenceUrl:link}]})).entries[0].evidenceUrl,link);
  assert.equal(parseAccountability(reviewed()).entries[0].evidenceUrl,undefined,'a record without a published receipt must remain explicitly without one');
});

test('subscription data cannot silently assign shared tools to donations or overflow the monthly total',()=>{
  const subscription=initial().subscriptionCosts[0];
  for(const paymentDay of [0,32,6.5])assert.throws(()=>parseAccountability({...initial(),subscriptionCosts:[{...subscription,paymentDay}]}),/payment day/);
  assert.throws(()=>parseAccountability({...initial(),subscriptionCosts:[{...subscription,allocationToGameCents:79900}]}),/attribution/);
  assert.throws(()=>parseAccountability({...initial(),subscriptionCosts:[subscription,subscription]}),/duplicate id/);
  assert.throws(()=>parseAccountability({...initial(),subscriptionCosts:[{...subscription,amountCents:Number.MAX_SAFE_INTEGER},{...subscription,id:'second',amountCents:1}]}),/safe integer range/);
  assert.equal(accountabilityTotals({...initial(),subscriptionCosts:[]}).subscriptionsMonthlyCents,null);
});

test('public money formatting preserves exact cents, negative balance and unknown state',()=>{
  assert.equal(formatAccountabilityCents(null),'—');
  assert.equal(formatAccountabilityCents(0),'R$\u00a00,00');
  assert.equal(formatAccountabilityCents(179800),'R$\u00a01.798,00');
  assert.equal(formatAccountabilityCents(-1),'-R$\u00a00,01');
  assert.equal(formatAccountabilityCents(Number.MAX_SAFE_INTEGER),'R$\u00a090.071.992.547.409,91');
  assert.throws(()=>formatAccountabilityCents(.01),/integer cents/);
});
