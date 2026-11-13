// A prospective cash scenario, separate from actual receipts/expenses and API usage estimates.
// Money is integer BRL cents. The initial phase is a subset, never an extra amount to add.
export interface ProjectPlanLine {id: string; label: string; amountCents: number; basis: string}
export interface ProjectPlan {
  planVersion: 1; status: 'estimate'; currency: 'BRL'; updatedAt: string; scope: string;
  targetCents: number; range: {minCents: number; maxCents: number};
  timeframeMonths: {min: number; max: number; reference: number}; subscriptionMonthlyCents: number;
  lineItems: ProjectPlanLine[];
  initialPhase: {label: string; amountCents: number; includedInTarget: true; timeframeWeeks: {min: number; max: number}; scope: string};
  volunteerScenario: {
    people: number; assumedHoursPerPersonWeekly: number;
    timeframeMonths: {min: number; max: number; reference: number}; baselineReferenceMonths: number;
    notes: string[];
  };
  notes: string[];
}

const fail = (field: string): never => {throw new Error(`Invalid project plan: ${field}`);};
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !keys.includes(key))) return fail('unexpected field');
  return raw;
}
function text(value: unknown, field: string, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) return fail(field);
  return value.trim();
}
function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return fail(field);
  return value;
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return fail('overflow');
  return Number(value);
}
function date(value: unknown): string {
  const s = text(value, 'updatedAt', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail('updatedAt');
  const parsed = new Date(`${s}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) return fail('updatedAt');
  return s;
}

export function parseProjectPlan(input: unknown): ProjectPlan {
  const raw = record(input, ['planVersion', 'status', 'currency', 'updatedAt', 'scope', 'targetCents', 'range',
    'timeframeMonths', 'subscriptionMonthlyCents', 'lineItems', 'initialPhase', 'volunteerScenario', 'notes']);
  if (raw.planVersion !== 1 || raw.status !== 'estimate' || raw.currency !== 'BRL') return fail('version/status/currency');
  const targetCents = positive(raw.targetCents, 'targetCents');
  const rangeRaw = record(raw.range, ['minCents', 'maxCents']);
  const range = {minCents: positive(rangeRaw.minCents, 'minCents'), maxCents: positive(rangeRaw.maxCents, 'maxCents')};
  if (range.minCents > targetCents || targetCents > range.maxCents) return fail('target range');
  const time = record(raw.timeframeMonths, ['min', 'max', 'reference']);
  const timeframeMonths = {min: positive(time.min, 'minimum months'), max: positive(time.max, 'maximum months'), reference: positive(time.reference, 'reference months')};
  if (timeframeMonths.min > timeframeMonths.reference || timeframeMonths.reference > timeframeMonths.max) return fail('timeframe range');
  const subscriptionMonthlyCents = positive(raw.subscriptionMonthlyCents, 'subscriptionMonthlyCents');
  if (!Array.isArray(raw.lineItems) || !raw.lineItems.length || raw.lineItems.length > 40) return fail('lineItems');
  const ids = new Set<string>();
  const lineItems = raw.lineItems.map(value => {
    const item = record(value, ['id', 'label', 'amountCents', 'basis']), id = text(item.id, 'id', 80);
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) return fail('unique line id');
    ids.add(id);
    return {id, label: text(item.label, 'label', 180), amountCents: positive(item.amountCents, 'line amount'), basis: text(item.basis, 'basis')};
  });
  const sum = safe(lineItems.reduce((n, item) => n + BigInt(item.amountCents), 0n));
  if (sum !== targetCents) return fail('line item sum must equal target');
  const subscriptionReference = safe(BigInt(subscriptionMonthlyCents) * BigInt(timeframeMonths.reference));
  if (lineItems.find(item => item.id === 'subscriptions')?.amountCents !== subscriptionReference) return fail('subscription projection');
  const initial = record(raw.initialPhase, ['label', 'amountCents', 'includedInTarget', 'timeframeWeeks', 'scope']);
  if (initial.includedInTarget !== true) return fail('initial phase must be included');
  const amountCents = positive(initial.amountCents, 'initial phase amount');
  if (amountCents > targetCents) return fail('initial phase exceeds target');
  const weeks = record(initial.timeframeWeeks, ['min', 'max']);
  const timeframeWeeks = {min: positive(weeks.min, 'minimum weeks'), max: positive(weeks.max, 'maximum weeks')};
  if (timeframeWeeks.min > timeframeWeeks.max) return fail('initial timeframe');
  const volunteer = record(raw.volunteerScenario, ['people', 'assumedHoursPerPersonWeekly', 'timeframeMonths', 'baselineReferenceMonths', 'notes']);
  const people = positive(volunteer.people, 'volunteer people');
  const assumedHoursPerPersonWeekly = positive(volunteer.assumedHoursPerPersonWeekly, 'volunteer weekly hours');
  if (assumedHoursPerPersonWeekly > 168) return fail('volunteer weekly hours exceed a week');
  safe(BigInt(people) * BigInt(assumedHoursPerPersonWeekly));
  const volunteerTime = record(volunteer.timeframeMonths, ['min', 'max', 'reference']);
  const volunteerMonths = {min: positive(volunteerTime.min, 'volunteer minimum months'), max: positive(volunteerTime.max, 'volunteer maximum months'), reference: positive(volunteerTime.reference, 'volunteer reference months')};
  const baselineReferenceMonths = positive(volunteer.baselineReferenceMonths, 'volunteer baseline months');
  if (baselineReferenceMonths !== timeframeMonths.reference) return fail('volunteer baseline must match main reference');
  if (volunteerMonths.min > volunteerMonths.reference || volunteerMonths.reference > volunteerMonths.max || volunteerMonths.max > baselineReferenceMonths) return fail('volunteer timeframe range');
  if (!Array.isArray(volunteer.notes) || !volunteer.notes.length || volunteer.notes.length > 30) return fail('volunteer notes');
  if (!Array.isArray(raw.notes) || !raw.notes.length || raw.notes.length > 30) return fail('notes');
  return {planVersion: 1, status: 'estimate', currency: 'BRL', updatedAt: date(raw.updatedAt), scope: text(raw.scope, 'scope'),
    targetCents, range, timeframeMonths, subscriptionMonthlyCents, lineItems,
    initialPhase: {label: text(initial.label, 'initial label', 180), amountCents, includedInTarget: true, timeframeWeeks, scope: text(initial.scope, 'initial scope')},
    volunteerScenario: {people, assumedHoursPerPersonWeekly, timeframeMonths: volunteerMonths, baselineReferenceMonths,
      notes: volunteer.notes.map(note => text(note, 'volunteer note'))},
    notes: raw.notes.map(note => text(note, 'note'))};
}

/** No raised/remaining amount or completion percentage: those require a verified actual ledger. */
export function projectPlanTotals(input: unknown) {
  const plan = parseProjectPlan(input);
  return {targetCents: plan.targetCents, lineItemsCents: safe(plan.lineItems.reduce((n, item) => n + BigInt(item.amountCents), 0n)),
    subscriptionReferenceCents: safe(BigInt(plan.subscriptionMonthlyCents) * BigInt(plan.timeframeMonths.reference)),
    initialPhaseCents: plan.initialPhase.amountCents,
    // Available hours are a hypothesis, not measured work or linear delivery speed.
    volunteerTheoreticalHoursPerWeek: safe(BigInt(plan.volunteerScenario.people) * BigInt(plan.volunteerScenario.assumedHoursPerPersonWeekly)),
    volunteerReferenceTimeReductionPercent: (plan.volunteerScenario.baselineReferenceMonths - plan.volunteerScenario.timeframeMonths.reference) / plan.volunteerScenario.baselineReferenceMonths * 100};
}

export function formatPlanCents(value: number | null): string {
  if (value === null) return 'A definir';
  if (!Number.isSafeInteger(value) || value < 0) return fail('format amount');
  const cents = BigInt(value);
  return `R$\u00a0${new Intl.NumberFormat('pt-BR').format(cents / 100n)},${String(cents % 100n).padStart(2, '0')}`;
}
