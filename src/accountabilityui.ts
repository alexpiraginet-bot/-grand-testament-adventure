import data from './data/accountability.json';
import {parseAccountability,accountabilityTotals,formatAccountabilityCents} from './accountability.ts';
import {COMMUNITY_REPO} from './feedback.ts';

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string)=>{
  const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;
};
const localDate=(date:string)=>{const [y,m,d]=date.slice(0,10).split('-');return `${d}/${m}/${y}`;};
export function renderAccountability(container:HTMLElement,input:unknown=data):void {
  container.replaceChildren();container.classList.add('accountability');
  const heading=node('h3','Prestação de contas');heading.id='accountability-heading';container.append(heading);
  container.setAttribute('aria-labelledby',heading.id);
  let ledger:ReturnType<typeof parseAccountability>;
  try{ledger=parseAccountability(input);}catch{
    container.dataset.status='unavailable';container.append(node('p','Os registros não puderam ser apresentados. Consulte o histórico de revisões.','notice'));
    appendHistory(container);return;
  }
  container.dataset.status=ledger.status;
  const totals=accountabilityTotals(ledger),summary=node('dl',undefined,'accountability-totals');
  for(const [label,kind,value] of [['Recebimentos','income',totals.incomeCents],['Gastos do projeto','expense',totals.expenseCents],['Saldo apurado','balance',totals.balanceCents]] as const){
    const pair=node('div'),term=node('dt',label),amount=node('dd',formatAccountabilityCents(value));amount.dataset.total=kind;
    pair.append(term,amount);summary.append(pair);
  }
  container.append(summary);
  if(ledger.status==='awaiting-records')container.append(node('p','Aguardando o primeiro fechamento; recebimentos e gastos serão publicados após conferência.','notice accountability-status'));
  else {
    const review=ledger.lastReviewedAt?`Conferido em ${localDate(ledger.lastReviewedAt)}. `:'';
    container.append(node('p',`${review}Atualizado em ${localDate(ledger.updatedAt!)}.`,'notice accountability-status'));
    if(totals.balanceCents===null)container.append(node('p','O saldo aguarda conferência do valor de abertura.','notice'));
  }
  const wrap=node('div',undefined,'accountability-table-wrap'),table=node('table',undefined,'accountability-table');
  table.append(node('caption','Recebimentos e despesas publicados'));
  const head=node('thead'),header=node('tr');
  for(const text of ['Data','Registro','Valor','Comprovante']){const th=node('th',text);th.scope='col';header.append(th);}head.append(header);table.append(head);
  const body=node('tbody');
  if(!ledger.entries.length){const row=node('tr'),cell=node('td','Nenhum lançamento publicado até a conferência.');cell.colSpan=4;cell.className='accountability-empty';row.append(cell);body.append(row);}
  for(const entry of [...ledger.entries].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))){
    const row=node('tr'),description=node('td'),type=node('span',entry.type==='income'?'Entrada':'Despesa','accountability-type');
    description.append(type,node('span',entry.type==='income'?'Apoio voluntário':entry.label));
    if(entry.type==='expense')description.append(node('small',entry.category));
    const proof=node('td');
    if(entry.evidenceUrl){const link=node('a','Ver ↗');link.href=entry.evidenceUrl;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Ver comprovante do registro ${entry.id}`);proof.append(link);}
    else proof.textContent='Não publicado';
    row.append(node('td',localDate(entry.date)),description,node('td',formatAccountabilityCents(entry.amountCents)),proof);body.append(row);
  }
  table.append(body);wrap.append(table);container.append(wrap);
  container.append(node('p','Registros conferidos manualmente, sem integração bancária. Recebimentos são apresentados sem identificação de apoiadores; comprovantes publicados devem ter dados pessoais ocultados.','notice'));
  if(ledger.subscriptionCosts.length){
    const costs=node('section',undefined,'accountability-subscriptions');costs.append(node('h4','Assinaturas da estrutura de desenvolvimento'));
    const list=node('ul');
    for(const sub of ledger.subscriptionCosts){const item=node('li');item.append(node('strong',sub.name),node('span',`${formatAccountabilityCents(sub.amountCents)} / mês`),node('small',`Pagamento informado: dia ${sub.paymentDay}. Informado por Alex; sem comprovante publicado.`));list.append(item);}
    const total=node('p',`Total mensal informado: ${formatAccountabilityCents(totals.subscriptionsMonthlyCents)}`,'accountability-subscription-total');total.dataset.total='subscriptions';
    costs.append(list,total,node('p','Parcela atribuída ao jogo ainda não definida. Estes custos gerais não foram descontados do saldo do projeto.','notice'));container.append(costs);
  }
  appendHistory(container);
}
function appendHistory(container:HTMLElement){
  const link=node('a','Ver histórico dos registros no GitHub ↗','accountability-history');
  link.href=`${COMMUNITY_REPO}/commits/main/src/data/accountability.json`;link.target='_blank';link.rel='noopener noreferrer';container.append(link);
}
