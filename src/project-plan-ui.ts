import data from './data/project-plan.json';
import ledger from './data/accountability.json';
import {parseProjectPlan,projectPlanTotals,formatPlanCents} from './project-plan.ts';
import {accountabilityTotals} from './accountability.ts';

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,cls?:string)=>{
  const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;
};
export function renderProjectPlan(container:HTMLElement):void {
  container.classList.add('project-plan');container.replaceChildren();
  container.append(node('h3','O mundo que queremos construir'));
  let plan:ReturnType<typeof parseProjectPlan>;
  try{plan=parseProjectPlan(data);}catch{container.append(node('p','O plano está em revisão. Os registros de valores realizados continuam abaixo.','notice'));return;}
  const totals=projectPlanTotals(plan),number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
  container.append(node('p',plan.scope,'plan-scope'));
  const metrics=node('dl',undefined,'effort-totals');
  const metric=(key:string,label:string,value:string)=>{
    const row=node('div'),amount=node('dd',value);amount.dataset.plan=key;row.append(node('dt',label),amount);metrics.append(row);
  };
  metric('target','Meta estimada do projeto completo',formatPlanCents(totals.targetCents));
  metric('time','Prazo estimado · núcleo pequeno',`${number.format(plan.timeframeMonths.min/12)}–${number.format(plan.timeframeMonths.max/12)} anos`);
  container.append(metrics,node('p',`Faixa de planejamento: ${formatPlanCents(plan.range.minCents)} a ${formatPlanCents(plan.range.maxCents)}. Referência: ${plan.timeframeMonths.reference} meses. Estimativa revisável, sem garantia de prazo.`, 'notice'));
  const phase=node('section',undefined,'plan-phase'),amount=node('strong',formatPlanCents(plan.initialPhase.amountCents));amount.dataset.plan='initial';
  phase.append(node('h4',plan.initialPhase.label),amount,node('p',plan.initialPhase.scope),node('p',`Alvo de ${plan.initialPhase.timeframeWeeks.min}–${plan.initialPhase.timeframeWeeks.max} semanas. Valor já incluído na meta completa, sujeito à capacidade de produção.`, 'notice'));container.append(phase);
  const income=accountabilityTotals(ledger).incomeCents;
  if(income===null)container.append(node('p','Arrecadação ainda aguardando conferência. Nenhum percentual financiado é apresentado sem registros verificados.','notice plan-raised'));
  else {
    const progress=node('progress');progress.max=plan.targetCents;progress.value=Math.min(income,plan.targetCents);progress.setAttribute('aria-label','Recebimentos conferidos em relação à meta estimada');
    container.append(node('p',`Recebimentos conferidos: ${formatPlanCents(income)}.`, 'notice plan-raised'),progress);
  }
  const scenario=plan.volunteerScenario,volunteers=node('section',undefined,'plan-volunteers');
  const time=node('strong',`${scenario.timeframeMonths.min}–${scenario.timeframeMonths.max} meses`);time.dataset.plan='volunteer-time';
  volunteers.append(node('h4',`E com ${number.format(scenario.people)} voluntários ativos?`),time,
    node('p',`Cenário de referência: ${scenario.timeframeMonths.reference} meses, com ${scenario.assumedHoursPerPersonWeekly} horas semanais por pessoa — ${number.format(totals.volunteerTheoreticalHoursPerWeek)} horas brutas por semana.`),
    node('p',`Referência de ${scenario.baselineReferenceMonths} para ${scenario.timeframeMonths.reference} meses: ${number.format(totals.volunteerReferenceTimeReductionPercent)}% menos tempo. É uma hipótese de organização, não uma previsão medida.`, 'notice'));
  const conditions=node('ul',undefined,'notice');for(const note of scenario.notes)conditions.append(node('li',note));volunteers.append(conditions);
  const join=node('button','Quero construir junto');join.type='button';join.id='plan-join';join.addEventListener('click',()=>{
    const tab=document.getElementById('community-volunteer-tab');tab?.click();tab?.focus();
  });volunteers.append(join);container.append(volunteers);
  const details=node('details'),summary=node('summary','Ver composição da meta e premissas');details.append(summary);
  const list=node('dl',undefined,'plan-budget');
  for(const item of plan.lineItems){const row=node('div');row.append(node('dt',item.label),node('dd',formatPlanCents(item.amountCents)),node('p',item.basis,'notice'));list.append(row);}details.append(list);
  const notes=node('ul',undefined,'notice');for(const note of plan.notes)notes.append(node('li',note));details.append(notes,node('p',`Estimativa revisada em ${plan.updatedAt.split('-').reverse().join('/')}. Valores de planejamento não alteram as despesas realizadas.`, 'notice'));
  const history=node('a','Plano detalhado e histórico ↗');history.href='https://github.com/alexpiraginet-bot/-grand-testament-adventure/blob/main/docs/ESTIMATIVA-PROJETO.md';history.target='_blank';history.rel='noopener noreferrer';details.append(history);container.append(details);
}
