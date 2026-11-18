// 🎲 Monte Carlo · fase 0: confere se o histórico do squad piloto serve para a previsão (ver docs/ideias/monte-carlo-previsao.md).
// Como usar: abra o painel-dev.html logado como ADM, espere os dados carregarem, cole este arquivo inteiro no Console e copie o JSON impresso.
// Só leitura: não grava nada. Faz 1 leitura pequena (config/flow do squad); o resto usa os cards que o Painel já carregou.
// Privacidade: a saída traz só totais e nomes de coluna. Nunca traz título, id de card ou dado de pessoa.
(async () => {
  const SQUAD = 'dados', JANELA = 56, HISTORICO = 120, TZ = 'America/Sao_Paulo';
  const PISOS = { dias: 28, entregas: 20, ocorrenciasPorDiaDaSemana: 4 };
  const EXCEPCIONAIS = [['2026-11-23', '2026-11-29'], ['2026-12-24', '2027-01-03']];   // Black Friday e fim de ano: fora do ritmo normal
  const d = (typeof squadData !== 'undefined') ? squadData[SQUAD] : null;
  if (!d || !Array.isArray(d.cards) || !d.cards.length) { console.warn('Os cards do squad "' + SQUAD + '" ainda não carregaram. Espere o Painel terminar e rode de novo.'); return null; }

  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dia = ms => fmt.format(new Date(ms));
  const utc = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const soma = (s, n) => new Date(utc(s) + n * 864e5).toISOString().slice(0, 10);
  const diaDaSemana = s => (new Date(utc(s)).getUTCDay() + 6) % 7;   // 0 = segunda
  const NOMES = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const excepcional = s => EXCEPCIONAIS.some(([a, b]) => s >= a && s <= b);

  let cfg = null, cfgFalhou = false;
  try { cfg = (await window._get(window._ref(window._db, 'kanban/squads/' + SQUAD + '/dados/config/flow'))).val(); } catch (e) { cfgFalhou = true; }
  const colunas = d.columns || [];
  const configuradas = (cfg && Array.isArray(cfg.doneCols) ? cfg.doneCols : []).filter(id => colunas.some(c => c.id === id));
  const fins = configuradas.length ? configuradas : [flowColsFor(d).doneId];
  const nomeDe = id => (colunas.find(c => c.id === id) || {}).name || id;
  const cancelamento = id => /cancel|descart|reprov/i.test(nomeDe(id));
  const entrega = fins.filter(id => !cancelamento(id));

  const hoje = dia(Date.now());
  const corteMs = d.flowBaseline && d.flowBaseline.at ? Date.parse(d.flowBaseline.at) : NaN;
  const primeiroDia = Number.isNaN(corteMs) ? soma(hoje, -HISTORICO) : [soma(dia(corteMs), 1), soma(hoje, -HISTORICO)].sort()[1];

  const descartes = { cancelados: 0, semData: 0, dataInvalida: 0, carimboDoReset: 0, semEventoDeEntrega: 0, importados: 0, criadosNoFim: 0, movidosEntreFins: 0, agregadores: 0, antesDoCorte: 0, diaDeHoje: 0, foraDoHistorico: 0, duplicados: 0 };
  const porDia = {}, porColuna = {}, vistos = new Set();
  let emFim = 0, arquivados = 0, arquivadosEntregues = 0, reaberturas = 0, validas = 0;

  d.cards.forEach(c => {
    if (!c) return;
    if (c.archived) arquivados++;
    if (vistos.has(c.id)) { descartes.duplicados++; return; }
    vistos.add(c.id);
    if (!fins.includes(c.col)) return;
    emFim++;
    if (cancelamento(c.col)) { descartes.cancelados++; return; }
    const f = c.flow || {};
    if (!f.doneAt) { descartes.semData++; return; }
    const ms = Date.parse(f.doneAt);
    if (Number.isNaN(ms)) { descartes.dataInvalida++; return; }
    if (f.resetAt && f.doneAt === f.resetAt) { descartes.carimboDoReset++; return; }
    const log = Array.isArray(f.log) ? f.log : [];
    const ev = log.filter(e => e && fins.includes(e.to) && Math.abs(Date.parse(e.at) - ms) <= 1000).pop();
    if (!ev) { descartes[f.imported ? 'importados' : 'semEventoDeEntrega']++; return; }
    if (ev.from === '—') { descartes.criadosNoFim++; return; }
    if (fins.includes(ev.from)) { descartes.movidosEntreFins++; return; }
    if ((c.childCardIds || []).length) { descartes.agregadores++; return; }
    if (!Number.isNaN(corteMs) && ms <= corteMs) { descartes.antesDoCorte++; return; }
    const s = dia(ms);
    if (s >= hoje) { descartes.diaDeHoje++; return; }
    if (s < primeiroDia) { descartes.foraDoHistorico++; return; }
    porDia[s] = (porDia[s] || 0) + 1;
    porColuna[nomeDe(c.col)] = (porColuna[nomeDe(c.col)] || 0) + 1;
    validas++;
    if (c.archived) arquivadosEntregues++;
    reaberturas += log.filter(e => e && fins.includes(e.from) && !fins.includes(e.to)).length;
  });

  const diario = [];
  for (let s = primeiroDia; s < hoje; s = soma(s, 1)) diario.push({ dia: s, entregas: porDia[s] || 0, excepcional: excepcional(s) });
  const recentes = diario.slice(-JANELA).filter(x => !x.excepcional);
  const ocorrencias = NOMES.map((n, i) => recentes.filter(x => diaDaSemana(x.dia) === i).length);
  const entregasJanela = recentes.reduce((t, x) => t + x.entregas, 0);

  const semanas = [];
  for (let s = soma(primeiroDia, (7 - diaDaSemana(primeiroDia)) % 7); soma(s, 6) < hoje; s = soma(s, 7)) {
    const dias = diario.filter(x => x.dia >= s && x.dia <= soma(s, 6));
    semanas.push({ inicio: s, entregas: dias.reduce((t, x) => t + x.entregas, 0), comparavel: !dias.some(x => x.excepcional) });
  }
  const comparaveis = semanas.filter(x => x.comparavel), total = l => l.reduce((t, x) => t + x.entregas, 0);
  const novas = comparaveis.slice(-2), antigas = comparaveis.slice(-4, -2);
  const razao = antigas.length === 2 && total(antigas) > 0 ? +(total(novas) / total(antigas)).toFixed(2) : null;

  const atende = { dias: recentes.length >= PISOS.dias, entregas: entregasJanela >= PISOS.entregas, ocorrenciasPorDiaDaSemana: ocorrencias.every(n => n >= PISOS.ocorrenciasPorDiaDaSemana), ritmoEstavel: razao !== null && razao >= 0.67 && razao <= 1.5 };
  const descartadas = Object.entries(descartes).filter(([k]) => !['cancelados', 'duplicados', 'diaDeHoje', 'foraDoHistorico', 'antesDoCorte'].includes(k)).reduce((t, [, n]) => t + n, 0);
  const alertas = [];
  if (cfgFalhou) alertas.push('Não consegui ler a configuração de fluxo; usei a coluna de fim deduzida pelo Painel.');
  if (!configuradas.length) alertas.push('O squad não tem colunas de fim configuradas; confirme se a coluna deduzida é a de entrega.');
  if (fins.length > 1) alertas.push('Há mais de uma coluna de fim; confirme quais significam entrega.');
  if (!Number.isNaN(corteMs) && dia(corteMs) >= soma(hoje, -JANELA)) alertas.push('A contagem de fluxo foi zerada dentro da janela de ' + JANELA + ' dias.');
  if (emFim && descartadas / emFim > 0.2) alertas.push('Mais de 20% dos cards concluídos não têm um evento de entrega confiável.');
  if (!atende.dias || !atende.entregas || !atende.ocorrenciasPorDiaDaSemana) alertas.push('O histórico ainda não atinge os pisos da previsão.');
  if (razao === null) alertas.push('Ainda não há 4 semanas comparáveis para medir a estabilidade do ritmo.');
  else if (!atende.ritmoEstavel) alertas.push('O ritmo das 2 últimas semanas mudou em relação às 2 anteriores.');

  const resumo = {
    squad: SQUAD, geradoEm: hoje, primeiroDiaConsiderado: primeiroDia, contagemZeradaEm: Number.isNaN(corteMs) ? null : dia(corteMs),
    colunasDeFim: fins.map(id => ({ nome: nomeDe(id), contaComoEntrega: entrega.includes(id) })), origemDasColunas: configuradas.length ? 'configuração do squad' : 'deduzida pelo Painel',
    cards: { total: vistos.size, emColunaDeFim: emFim, arquivados, arquivadosEntregues }, entregasValidas: validas, reaberturasNasValidas: reaberturas, porColuna: porColuna, descartes,
    janela: { dias: JANELA, diasComparaveis: recentes.length, entregas: entregasJanela, diasSemEntrega: recentes.filter(x => !x.entregas).length, ocorrenciasPorDiaDaSemana: Object.fromEntries(NOMES.map((n, i) => [n, ocorrencias[i]])) },
    pisos: PISOS, atende, razaoDoRitmo: razao, semanas, diario, alertas,
  };
  window.__mcCobertura = resumo;
  console.table(semanas);
  console.log(alertas.length ? '⚠ ' + alertas.join('\n⚠ ') : '✅ Nenhum alerta.');
  const json = JSON.stringify(resumo);
  try { if (typeof copy === 'function') { copy(json); console.log('📋 Resultado copiado. Cole na conversa com o Claude.'); } } catch (e) {}
  console.log(json);
  return resumo;
})();
