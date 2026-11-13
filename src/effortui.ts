import {EFFORT_POLL_MS, EFFORT_STALE_MS, fetchEffortSnapshot, isEffortStale, summarizeEffort,
  type EffortRead, type EffortSession} from './effort.ts';

const numbers = new Intl.NumberFormat('pt-BR');
const hours = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const dollars = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'USD', currencyDisplay: 'code'});
const dates = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'medium'});
const countText = (n: number | null) => n === null ? 'Sem medição' : numbers.format(n);
const hoursText = (seconds: number | null, unit: string) => seconds === null ? 'Sem medição' : `${hours.format(seconds / 3600)} ${unit}`;
const sessionTokens = (s: EffortSession) => s.inputTokens === null && s.outputTokens === null
  ? null : (s.inputTokens ?? 0) + (s.outputTokens ?? 0);

/** Mount once inside the support tab. Its returned cleanup removes observers and aborts reads.
 * No ticking usage clock: every quantity remains the last observed snapshot until a new one arrives. */
export function mountEffort(container: HTMLElement): () => void {
  const doc = container.ownerDocument;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el;
  };
  container.classList.add('effort'); container.replaceChildren();
  const heading = node('h3', 'Trabalho registrado no jogo');
  const status = node('p', 'Sem dados recentes', 'notice effort-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const updated = node('p', 'Atualização: aguardando registro.', 'notice effort-updated');
  const content = node('div', undefined, 'effort-content');
  const source = node('p', 'Fonte: metadados locais de uso, publicados pelos mantenedores.', 'notice effort-source');
  const disclaimer = node('p', 'Registro parcial: outras sessões e ferramentas podem não estar incluídas. Tokens reutilizados em cache já fazem parte da entrada. Horas-agente somam o trabalho observado de cada sessão; não são o tempo decorrido do projeto.', 'notice');
  const estimateNotice = node('p', 'Comparação de API é apenas uma estimativa em US$, não uma cobrança adicional dos planos nem uma despesa lançada na prestação de contas. Sem tarifa confirmada, não estimamos valor.', 'notice');
  const pricing = node('a', 'Consultar tarifas públicas da API ↗', 'effort-pricing');
  pricing.href = 'https://developers.openai.com/api/docs/pricing'; pricing.target = '_blank'; pricing.rel = 'noopener noreferrer';
  const history = node('a', 'Ver histórico dos registros no GitHub ↗', 'effort-history');
  history.href = 'https://github.com/alexpiraginet-bot/-grand-testament-adventure/commits/metrics/development/development.json';
  history.target = '_blank'; history.rel = 'noopener noreferrer';
  container.append(heading, status, updated, content, source, disclaimer, estimateNotice, pricing, history);

  let disposed = false, revision = 0, loading = false, failed = false;
  let latest: EffortRead | null = null, controller: AbortController | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | undefined, freshnessTimer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => {
    const panel = doc.getElementById('community-support'), dialog = container.closest('dialog');
    return !disposed && container.isConnected && doc.visibilityState !== 'hidden' && !!panel && !panel.hidden &&
      panel.contains(container) && !container.closest('[hidden], [aria-hidden="true"]') && (!dialog || dialog.open);
  };
  const renderStatus = () => {
    const stale = isEffortStale(latest?.snapshot ?? null);
    container.dataset.status = latest ? stale ? 'stale' : 'fresh' : loading ? 'loading' : 'unavailable';
    container.setAttribute('aria-busy', String(loading));
    status.textContent = `${stale ? 'Sem dados recentes' : 'Registro parcial'}${loading ? ' · Atualização em andamento…' : failed ? ' · Não foi possível atualizar agora.' : ''}`;
    if (latest) {
      updated.textContent = `Atualização do registro: ${dates.format(new Date(latest.snapshot.generatedAt))}. Os números permanecem limitados ao que foi observado.`;
      source.textContent = `Fonte: metadados locais de uso · ${latest.origin === 'remote' ? 'registro público no GitHub' : 'cópia publicada com o jogo'}${stale ? ' · registro desatualizado' : ''}.`;
    }
    clearTimeout(freshnessTimer);
    if (visible() && latest && !stale) {
      const wait = Date.parse(latest.snapshot.generatedAt) + EFFORT_STALE_MS + 1 - Date.now();
      freshnessTimer = setTimeout(renderStatus, Math.max(1, wait));
    }
  };
  const renderContent = () => {
    content.replaceChildren();
    if (!latest || !latest.snapshot.sessions.length) {
      content.append(node('p', 'Ainda não há sessões verificadas neste registro. Ausência de dados não significa zero horas, tokens ou custo.', 'notice effort-empty'));
      if (latest) appendNotes(latest.snapshot.notes);
      return;
    }
    const snapshot = latest.snapshot, sums = summarizeEffort(snapshot), totals = node('dl', undefined, 'effort-totals');
    const metric = (key: string, label: string, value: string) => {
      const group = node('div'), amount = node('dd', value); amount.dataset.effortTotal = key;
      group.append(node('dt', label), amount); totals.append(group);
    };
    metric('agent-hours', 'Trabalho observado somado', hoursText(sums.agentSeconds, 'h-agente'));
    metric('union-hours', 'Tempo com atividade, sem sobreposição', hoursText(sums.unionSeconds, 'h'));
    metric('tokens', `Tokens registrados${sums.tokensPartial ? ' · parcial' : ''}`, countText(sums.totalTokens));
    metric('api-estimate', `Comparação de API · estimativa em US$${sums.estimatePartial && sums.estimatedApiCostUsd !== null ? ' · parcial' : ''}`,
      sums.estimatedApiCostUsd === null ? 'Sem tarifa confirmada' : dollars.format(sums.estimatedApiCostUsd));
    content.append(totals);
    if (sums.unionSeconds === null) content.append(node('p', 'Faltam intervalos completos para descontar a sobreposição entre sessões. O valor disponível usa h-agente.', 'notice'));
    const tokenDetail = node('p', `Entrada registrada: ${countText(sums.inputTokens)} · Saída registrada: ${countText(sums.outputTokens)} · Cache, já incluído na entrada: ${countText(sums.cachedInputTokens)}.`, 'notice effort-token-detail');
    content.append(tokenDetail);
    if (snapshot.coverageStart) content.append(node('p', `Cobertura publicada a partir de ${dates.format(new Date(snapshot.coverageStart))}.`, 'notice'));
    const list = node('ul', undefined, 'effort-sessions');
    const sessions = [...snapshot.sessions].sort((a, b) => Date.parse(b.lastActivityAtISO) - Date.parse(a.lastActivityAtISO));
    for (const session of sessions.slice(0, 60)) {
      const row = node('li'); row.dataset.effortSession = session.id;
      row.append(node('strong', session.label), node('span', `${session.agent === 'codex' ? 'Codex' : 'Claude'} · ${session.model}`));
      const partial = session.inputTokens === null || session.outputTokens === null;
      row.append(node('span', `${hoursText(session.activeSeconds, 'h-agente')} · ${countText(sessionTokens(session))} tokens${partial ? ' · parcial' : ''}`));
      row.append(node('small', `Última atividade registrada: ${dates.format(new Date(session.lastActivityAtISO))}${session.endedAtISO ? ' · sessão encerrada' : ''}.`));
      if (session.estimatedApiCostUsd !== null) row.append(node('small', `Equivalente teórico de API: ${dollars.format(session.estimatedApiCostUsd)}. Base: ${session.estimateBasis}`));
      list.append(row);
    }
    content.append(list);
    if (sessions.length > 60) content.append(node('p', `Mostrando as ${numbers.format(60)} sessões mais recentes de ${numbers.format(sessions.length)}. Os totais incluem todas as sessões do registro.`, 'notice'));
    appendNotes(snapshot.notes);
  };
  function appendNotes(notes: string[]) {
    if (!notes.length) return;
    const list = node('ul', undefined, 'notice effort-notes');
    for (const note of notes) list.append(node('li', note));
    content.append(list);
  }
  const stop = () => {
    revision++; clearTimeout(pollTimer); clearTimeout(freshnessTimer); pollTimer = undefined;
    controller?.abort(); controller = null; loading = false;
  };
  const poll = async () => {
    pollTimer = undefined;
    if (!visible() || controller) return;
    const request = new AbortController(), mine = ++revision, started = Date.now();
    controller = request; loading = true; renderStatus();
    try {
      const read = await fetchEffortSnapshot({signal: request.signal});
      if (disposed || mine !== revision || !visible()) return;
      // A stale CDN/build copy cannot roll the currently displayed snapshot backwards.
      if (!latest || Date.parse(read.snapshot.generatedAt) >= Date.parse(latest.snapshot.generatedAt)) {
        latest = read; renderContent();
      }
      failed = false;
    } catch {
      if (disposed || mine !== revision || request.signal.aborted) return;
      failed = true;
    } finally {
      if (!disposed && mine === revision) {
        controller = null; loading = false; renderStatus();
        if (visible()) pollTimer = setTimeout(() => {void poll();}, Math.max(1, started + EFFORT_POLL_MS - Date.now()));
      }
    }
  };
  const onVisibility = () => {
    if (!visible()) {stop(); return;}
    renderStatus();
    if (!controller && pollTimer === undefined) void poll();
  };
  const observer = new MutationObserver(onVisibility);
  // Attribute-only observation avoids reacting to our own text updates or the render loop.
  observer.observe(doc.documentElement, {attributes: true, subtree: true, attributeFilter: ['hidden', 'open', 'aria-hidden']});
  doc.addEventListener('visibilitychange', onVisibility);
  renderContent(); onVisibility();
  return () => {
    if (disposed) return;
    disposed = true; stop(); observer.disconnect(); doc.removeEventListener('visibilitychange', onVisibility);
    container.removeAttribute('aria-busy');
  };
}
