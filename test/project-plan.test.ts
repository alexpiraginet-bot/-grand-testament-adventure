import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProjectPlan, projectPlanTotals, formatPlanCents} from '../src/project-plan.ts';
const original = () => JSON.parse(readFileSync(new URL('../src/data/project-plan.json', import.meta.url), 'utf8'));

test('the full-Gospel cash scenario sums to its target and keeps the first stage inside it', () => {
  const plan = parseProjectPlan(original()), totals = projectPlanTotals(plan);
  assert.deepEqual(totals, {targetCents: 30_000_000, lineItemsCents: 30_000_000, subscriptionReferenceCents: 8_630_400, initialPhaseCents: 1_500_000,
    volunteerTheoreticalHoursPerWeek: 1000, volunteerReferenceTimeReductionPercent: 62.5});
  assert.deepEqual(plan.range, {minCents: 20_000_000, maxCents: 50_000_000});
  assert.deepEqual(plan.timeframeMonths, {min: 36, max: 60, reference: 48});
  assert.deepEqual(plan.initialPhase.timeframeWeeks, {min: 8, max: 12});
  assert.equal(plan.initialPhase.includedInTarget, true);
  assert.equal(plan.subscriptionMonthlyCents * plan.timeframeMonths.reference, totals.subscriptionReferenceCents);
  assert.equal(plan.lineItems.some(item => item.id === 'initial-phase'), false, 'the first phase is not an extra line');
});

test('the published scenario discloses assumptions, excluded labor and the absence of actual spending', () => {
  const plan = parseProjectPlan(original()), notes = plan.notes.join(' ');
  assert.equal(plan.status, 'estimate');
  assert.match(notes, /60 missões e 10 a 15 áreas/); assert.match(notes, /não uma quantidade fechada ou prometida/);
  assert.match(notes, /não remunerado/); assert.match(notes, /não é o custo econômico completo/);
  assert.match(notes, /Não há cotações, contratos ou desembolsos comprovados/);
  assert.match(notes, /não comprova alocação integral/i);
  assert.match(notes, /não informa quanto já foi arrecadado ou gasto/);
  assert.ok(plan.lineItems.every(item => item.basis.trim().length > 20));
  const totals = projectPlanTotals(plan);
  for (const key of ['raisedCents', 'remainingCents', 'expenseCents', 'balanceCents', 'progress']) assert.equal(Object.hasOwn(totals, key), false);
});

test('the volunteer scenario computes availability and reference comparison without discounting cash', () => {
  const plan = parseProjectPlan(original()), totals = projectPlanTotals(plan), notes = plan.volunteerScenario.notes.join(' ');
  assert.deepEqual(plan.volunteerScenario.timeframeMonths, {min: 12, max: 24, reference: 18});
  assert.equal(plan.volunteerScenario.people, 200);
  assert.equal(plan.volunteerScenario.assumedHoursPerPersonWeekly, 5);
  assert.equal(plan.volunteerScenario.baselineReferenceMonths, plan.timeframeMonths.reference);
  assert.equal(totals.volunteerTheoreticalHoursPerWeek, 1000);
  assert.equal(totals.volunteerReferenceTimeReductionPercent, 62.5);
  assert.match(notes, /colaboradores ativos/); assert.match(notes, /não apenas 200 cadastros/);
  assert.match(notes, /Lideranças técnicas/); assert.match(notes, /revisão, testes e coordenação/);
  assert.match(notes, /não reduz automaticamente a meta de caixa/);
  assert.match(notes, /Não é compromisso ou garantia/);
  const smaller = original(); smaller.volunteerScenario.people = 100; smaller.volunteerScenario.timeframeMonths.reference = 24;
  const changed = projectPlanTotals(smaller);
  assert.equal(changed.volunteerTheoreticalHoursPerWeek, 500);
  assert.equal(changed.volunteerReferenceTimeReductionPercent, 50);
  assert.equal(changed.targetCents, totals.targetCents);
  assert.equal(changed.subscriptionReferenceCents, totals.subscriptionReferenceCents);
});

test('the volunteer scenario rejects impossible availability and inconsistent comparisons', () => {
  for (const change of [
    {people: 0}, {people: 1.5}, {people: Number.MAX_SAFE_INTEGER},
    {assumedHoursPerPersonWeekly: 169}, {assumedHoursPerPersonWeekly: NaN},
    {baselineReferenceMonths: 36}, {timeframeMonths: {min: 12, max: 16, reference: 18}},
    {timeframeMonths: {min: 12, max: 60, reference: 18}},
    {notes: []}, {notes: ['']}, {cashDiscountCents: 100000},
  ]) {
    const value = original(); value.volunteerScenario = {...value.volunteerScenario, ...change};
    assert.throws(() => parseProjectPlan(value));
  }
});

test('invalid amounts, contradictory line sums, duplicate IDs and unsupported actuals are rejected', () => {
  const mutate = (fn: (value: ReturnType<typeof original>) => void) => {const value = original(); fn(value); return value;};
  for (const value of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, '30000000', null]) {
    assert.throws(() => parseProjectPlan(mutate(p => {p.targetCents = value;})));
  }
  for (const change of [
    (p: ReturnType<typeof original>) => {p.lineItems[1].amountCents++;},
    (p: ReturnType<typeof original>) => {p.lineItems[1].id = p.lineItems[0].id;},
    (p: ReturnType<typeof original>) => {p.lineItems[1].basis = '';},
    (p: ReturnType<typeof original>) => {p.lineItems = [];},
    (p: ReturnType<typeof original>) => {p.initialPhase.includedInTarget = false;},
    (p: ReturnType<typeof original>) => {p.initialPhase.amountCents = p.targetCents + 1;},
    (p: ReturnType<typeof original>) => {p.subscriptionMonthlyCents++;},
    (p: ReturnType<typeof original>) => {p.raisedCents = 0;},
    (p: ReturnType<typeof original>) => {p.lineItems[0].paid = true;},
    (p: ReturnType<typeof original>) => {p.status = 'actual';},
    (p: ReturnType<typeof original>) => {p.planVersion = 2;},
    (p: ReturnType<typeof original>) => {p.currency = 'USD';},
    (p: ReturnType<typeof original>) => {p.notes = [];},
  ]) assert.throws(() => parseProjectPlan(mutate(change)));
});

test('target/timeframe ranges and calendar dates must be internally consistent', () => {
  for (const change of [
    {range: {minCents: 31_000_000, maxCents: 50_000_000}},
    {range: {minCents: 20_000_000, maxCents: 29_000_000}},
    {timeframeMonths: {min: 49, max: 60, reference: 48}},
    {timeframeMonths: {min: 36, max: 47, reference: 48}},
    {updatedAt: '2026-02-30'}, {updatedAt: '13/11/2026'},
  ]) assert.throws(() => parseProjectPlan({...original(), ...change}));
  const backwards = original(); backwards.initialPhase.timeframeWeeks = {min: 12, max: 8};
  assert.throws(() => parseProjectPlan(backwards));
});

test('BRL formatting preserves exact cents, including unknown and very large values', () => {
  assert.equal(formatPlanCents(30_000_000), 'R$\u00a0300.000,00');
  assert.equal(formatPlanCents(8_630_400), 'R$\u00a086.304,00');
  assert.equal(formatPlanCents(0), 'R$\u00a00,00');
  assert.equal(formatPlanCents(null), 'A definir');
  assert.equal(formatPlanCents(Number.MAX_SAFE_INTEGER), 'R$\u00a090.071.992.547.409,91');
  assert.throws(() => formatPlanCents(-1)); assert.throws(() => formatPlanCents(.5));
});
