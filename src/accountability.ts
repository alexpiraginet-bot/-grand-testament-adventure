// Public, manually reviewed bookkeeping. No bank connection or automatic payment confirmation.
export type LedgerStatus='awaiting-records'|'reviewed';
export interface LedgerEntry {id:string;date:string;type:'income'|'expense';category:string;label:string;amountCents:number;evidenceUrl?:string}
export interface SubscriptionCost {id:string;name:string;amountCents:number;period:'monthly';paymentDay:number;source:'owner-reported';effectiveAt:string;allocationToGameCents:null}
export interface AccountabilityLedger {
  currency:'BRL';status:LedgerStatus;openingBalanceCents:number|null;openingBalanceVerified:boolean;
  updatedAt:string|null;lastReviewedAt?:string|null;entries:LedgerEntry[];subscriptionCosts:SubscriptionCost[];
}
const record=(input:unknown,keys:string[],label:string):Record<string,unknown>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error(`${label}: expected object`);
  const value=input as Record<string,unknown>;
  if(Object.keys(value).some(key=>!keys.includes(key)))throw Error(`${label}: unsupported field`);
  return value;
};
function text(value:unknown,max:number,label:string):string {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw Error(`${label}: invalid text`);
  return value.trim();
}
function id(value:unknown):string {const result=text(value,70,'id');if(!/^[a-zA-Z0-9_-]+$/.test(result))throw Error('id: invalid');return result;}
function cents(value:unknown,positive=false):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||(positive&&value<=0))throw Error('amount: integer cents required');return value;
}
function date(value:unknown,label:string):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error(`${label}: ISO calendar date required`);
  const parsed=new Date(`${value}T00:00:00.000Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw Error(`${label}: invalid date`);
  return value;
}
function auditDate(value:unknown,label:string):string|null {
  if(value===null||value===undefined)return null;
  if(typeof value!=='string')throw Error(`${label}: invalid date`);
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return date(value,label);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw Error(`${label}: ISO UTC timestamp required`);
  date(value.slice(0,10),label);
  const parsed=new Date(value);if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,19)!==value.slice(0,19))throw Error(`${label}: invalid timestamp`);
  return value;
}
function evidenceUrl(value:unknown):string {
  const url=new URL(text(value,2048,'evidenceUrl'));
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('evidenceUrl: public HTTPS link required');
  return url.href;
}
const safe=(value:bigint):number=>{if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER))throw Error('totals: safe integer range exceeded');return Number(value);};

export function parseAccountability(input:unknown):AccountabilityLedger {
  const raw=record(input,['currency','status','openingBalanceCents','openingBalanceVerified','updatedAt','lastReviewedAt','entries','subscriptionCosts'],'ledger');
  if(raw.currency!=='BRL')throw Error('currency: BRL required');
  if(raw.status!=='awaiting-records'&&raw.status!=='reviewed')throw Error('status: invalid');
  if(typeof raw.openingBalanceVerified!=='boolean')throw Error('openingBalanceVerified: required');
  const opening=raw.openingBalanceCents===null?null:cents(raw.openingBalanceCents);
  if(raw.openingBalanceVerified&&opening===null)throw Error('opening balance: verified value missing');
  const updatedAt=auditDate(raw.updatedAt,'updatedAt'),lastReviewedAt=auditDate(raw.lastReviewedAt,'lastReviewedAt');
  if(!Array.isArray(raw.entries))throw Error('entries: array required');
  const seen=new Set<string>();
  const entries=raw.entries.map(value=>{
    const entry=record(value,['id','date','type','category','label','amountCents','evidenceUrl'],'entry');
    const entryId=id(entry.id);if(seen.has(entryId))throw Error('entries: duplicate id');seen.add(entryId);
    if(entry.type!=='income'&&entry.type!=='expense')throw Error('entry type: invalid');
    const category=text(entry.category,60,'category'),label=text(entry.label,180,'label');
    // The published source must not identify donors, even before rendering.
    if(entry.type==='income'&&(category!=='apoio'||label!=='Apoio voluntário'))throw Error('income: anonymous public labels required');
    return {id:entryId,date:date(entry.date,'entry date'),type:entry.type,category,label,amountCents:cents(entry.amountCents,true),
      ...(entry.evidenceUrl===undefined?{}:{evidenceUrl:evidenceUrl(entry.evidenceUrl)})} as LedgerEntry;
  });
  if(raw.status==='awaiting-records'&&(entries.length||opening!==null||raw.openingBalanceVerified))throw Error('awaiting-records: no reviewed balances or entries yet');
  if(raw.status==='reviewed'&&!updatedAt)throw Error('reviewed ledger: update date required');
  if(!Array.isArray(raw.subscriptionCosts))throw Error('subscriptionCosts: array required');
  const subscriptionIds=new Set<string>();
  const subscriptionCosts=raw.subscriptionCosts.map(value=>{
    const sub=record(value,['id','name','amountCents','period','paymentDay','source','effectiveAt','allocationToGameCents'],'subscription');
    const subId=id(sub.id);if(subscriptionIds.has(subId))throw Error('subscriptions: duplicate id');subscriptionIds.add(subId);
    if(sub.period!=='monthly'||sub.source!=='owner-reported'||sub.allocationToGameCents!==null)throw Error('subscription: unsupported attribution');
    if(typeof sub.paymentDay!=='number'||!Number.isInteger(sub.paymentDay)||sub.paymentDay<1||sub.paymentDay>31)throw Error('subscription: invalid payment day');
    return {id:subId,name:text(sub.name,60,'subscription name'),amountCents:cents(sub.amountCents,true),period:'monthly',paymentDay:sub.paymentDay,
      source:'owner-reported',effectiveAt:date(sub.effectiveAt,'effectiveAt'),allocationToGameCents:null} as SubscriptionCost;
  });
  const ledger:AccountabilityLedger={currency:'BRL',status:raw.status,openingBalanceCents:opening,openingBalanceVerified:raw.openingBalanceVerified,updatedAt,lastReviewedAt,entries,subscriptionCosts};
  // Validate aggregate overflow before any data reaches the presentation layer.
  totalsOf(ledger);return ledger;
}

function totalsOf(ledger:AccountabilityLedger){
  const subscriptions=ledger.subscriptionCosts.length?safe(ledger.subscriptionCosts.reduce((sum,s)=>sum+BigInt(s.amountCents),0n)):null;
  if(ledger.status==='awaiting-records')return {incomeCents:null,expenseCents:null,balanceCents:null,subscriptionsMonthlyCents:subscriptions};
  const income=ledger.entries.filter(e=>e.type==='income').reduce((sum,e)=>sum+BigInt(e.amountCents),0n);
  const expense=ledger.entries.filter(e=>e.type==='expense').reduce((sum,e)=>sum+BigInt(e.amountCents),0n);
  const balance=ledger.openingBalanceVerified&&ledger.openingBalanceCents!==null?safe(BigInt(ledger.openingBalanceCents)+income-expense):null;
  return {incomeCents:safe(income),expenseCents:safe(expense),balanceCents:balance,subscriptionsMonthlyCents:subscriptions};
}
export function accountabilityTotals(input:unknown){return totalsOf(parseAccountability(input));}

/** Format exact cents without losing a cent when dividing very large safe integers by 100. */
export function formatAccountabilityCents(value:number|null):string {
  if(value===null)return '—';cents(value);
  const amount=BigInt(value),absolute=amount<0n?-amount:amount;
  return `${amount<0n?'-':''}R$\u00a0${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(absolute/100n)},${String(absolute%100n).padStart(2,'0')}`;
}
