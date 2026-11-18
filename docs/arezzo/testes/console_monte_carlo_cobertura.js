// 🎲 Monte Carlo · fase 0: confere se o histórico do squad piloto serve para a previsão (ver docs/ideias/monte-carlo-previsao.md).
// Como usar: abra o painel.html (o de produção: o painel-dev só carrega os squads de teste) logado como ADM, espere os dados carregarem, cole este arquivo inteiro no Console e copie o JSON impresso.
// Só leitura: não grava nada. Faz 1 leitura pequena (config/flow do squad); o resto usa os cards que o Painel já carregou.
// Privacidade: a saída traz só totais e nomes de coluna. Nunca traz título, id de card ou dado de pessoa.
(async () => {
  const SQUAD = 'dados', JANELA = 56, HISTORICO = 120, TZ = 'America/Sao_Paulo';
  const PISOS = { dias: 28, entregas: 20, ocorrenciasPorDiaDaSemana: 4 };
  const EXCEPCIONAIS = [['2026-11-23', '2026-11-29'], ['2026-12-24', '2027-01-03']];   // Black Friday e fim de ano: fora do ritmo normal
  const d = (typeof squadData !== 'undefined') ? squadData[SQUAD] : null;
  if (!d || !Array.isArray(d.cards) || !d.cards.length) {
    const carrega = typeof SQUADS !== 'undefined' && SQUADS.some(s => s.id === SQUAD);
    console.warn(carrega ? 'Os cards do squad "' + SQUAD + '" ainda não carregaram. Espere o Painel terminar e rode de novo.' : 'Esta página não carrega o squad "' + SQUAD + '". Abra o painel.html (produção) e rode de novo.');
    return null;
  }

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

  // Dois jeitos de datar a entrega, porque o squad pode ter mais de uma coluna de fim (ex.: Validação → Concluído).
  const ordem = id => colunas.findIndex(c => c.id === id);
  const ultima = entrega.slice().sort((a, b) => ordem(a) - ordem(b)).pop();
  const novoCenario = nome => ({ nome, porDia: {}, validas: 0, arquivadas: 0, reaberturas: 0, descartes: { aindaNaoChegou: 0, semEventoDeEntrega: 0, importados: 0, criadosNoFim: 0, antesDoCorte: 0, diaDeHoje: 0, foraDoHistorico: 0 } });
  const cenarios = { ultimaColuna: novoCenario('Entrega = chegar em "' + nomeDe(ultima) + '"'), primeiraChegada: novoCenario('Entrega = chegar em qualquer coluna de fim') };
  const comuns = { cancelados: 0, semData: 0, dataInvalida: 0, carimboDoReset: 0, agregadores: 0, duplicados: 0 };
  const vistos = new Set();
  let emFim = 0, arquivados = 0;
  const registra = (cen, c, f, ev, log) => {
    if (!ev) { cen.descartes[f.imported ? 'importados' : 'semEventoDeEntrega']++; return; }
    if (ev.from === '—') { cen.descartes.criadosNoFim++; return; }
    const ms = Date.parse(ev.at);
    if (Number.isNaN(ms)) { cen.descartes.semEventoDeEntrega++; return; }
    if (!Number.isNaN(corteMs) && ms <= corteMs) { cen.descartes.antesDoCorte++; return; }
    const s = dia(ms);
    if (s >= hoje) { cen.descartes.diaDeHoje++; return; }
    if (s < primeiroDia) { cen.descartes.foraDoHistorico++; return; }
    cen.porDia[s] = (cen.porDia[s] || 0) + 1;
    cen.validas++;
    if (c.archived) cen.arquivadas++;
    cen.reaberturas += log.filter(e => e && fins.includes(e.from) && !fins.includes(e.to)).length;
  };

  d.cards.forEach(c => {
    if (!c) return;
    if (c.archived) arquivados++;
    if (vistos.has(c.id)) { comuns.duplicados++; return; }
    vistos.add(c.id);
    if (!fins.includes(c.col)) return;
    emFim++;
    if (cancelamento(c.col)) { comuns.cancelados++; return; }
    const f = c.flow || {};
    if (!f.doneAt) { comuns.semData++; return; }
    if (Number.isNaN(Date.parse(f.doneAt))) { comuns.dataInvalida++; return; }
    if (f.resetAt && f.doneAt === f.resetAt) { comuns.carimboDoReset++; return; }
    if ((c.childCardIds || []).length) { comuns.agregadores++; return; }
    const log = (Array.isArray(f.log) ? f.log : []).filter(Boolean);
    if (c.col === ultima) registra(cenarios.ultimaColuna, c, f, log.filter(e => e.to === ultima && e.from !== ultima).pop(), log);
    else cenarios.ultimaColuna.descartes.aindaNaoChegou++;
    registra(cenarios.primeiraChegada, c, f, log.filter(e => fins.includes(e.to) && !fins.includes(e.from)).pop(), log);
  });

  const resumir = cen => {
    const diario = [];
    for (let s = primeiroDia; s < hoje; s = soma(s, 1)) diario.push({ dia: s, entregas: cen.porDia[s] || 0, excepcional: excepcional(s) });
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
    const semEvento = cen.descartes.semEventoDeEntrega + cen.descartes.importados + cen.descartes.criadosNoFim;
    return { nome: cen.nome, entregasValidas: cen.validas, arquivadasEntregues: cen.arquivadas, reaberturasNasValidas: cen.reaberturas, descartes: cen.descartes, semEventoConfiavelPct: Math.round(semEvento / Math.max(1, cen.validas + semEvento) * 100),
      janela: { dias: JANELA, diasComparaveis: recentes.length, entregas: entregasJanela, diasSemEntrega: recentes.filter(x => !x.entregas).length, ocorrenciasPorDiaDaSemana: Object.fromEntries(NOMES.map((n, i) => [n, ocorrencias[i]])) },
      atende, razaoDoRitmo: razao, semanas, entregasPorDia: cen.porDia };
  };
  const resultado = { ultimaColuna: resumir(cenarios.ultimaColuna), primeiraChegada: resumir(cenarios.primeiraChegada) };

  const alertas = [];
  if (cfgFalhou) alertas.push('Não consegui ler a configuração de fluxo; usei a coluna de fim deduzida pelo Painel.');
  if (!configuradas.length) alertas.push('O squad não tem colunas de fim configuradas; confirme se a coluna deduzida é a de entrega.');
  if (entrega.length > 1) alertas.push('Há mais de uma coluna de fim; escolha qual dos dois cenários representa a entrega.');
  if (!Number.isNaN(corteMs) && dia(corteMs) >= soma(hoje, -JANELA)) alertas.push('A contagem de fluxo foi zerada dentro da janela de ' + JANELA + ' dias.');
  Object.values(resultado).forEach(r => {
    if (r.semEventoConfiavelPct > 20) alertas.push(r.nome + ': mais de 20% das conclusões não têm um evento de entrega confiável.');
    if (!r.atende.dias || !r.atende.entregas || !r.atende.ocorrenciasPorDiaDaSemana) alertas.push(r.nome + ': o histórico ainda não atinge os pisos da previsão.');
    if (r.razaoDoRitmo === null) alertas.push(r.nome + ': ainda não há 4 semanas comparáveis para medir a estabilidade do ritmo.');
    else if (!r.atende.ritmoEstavel) alertas.push(r.nome + ': o ritmo das 2 últimas semanas mudou em relação às 2 anteriores.');
  });

  const resumo = {
    squad: SQUAD, geradoEm: hoje, primeiroDiaConsiderado: primeiroDia, contagemZeradaEm: Number.isNaN(corteMs) ? null : dia(corteMs),
    colunasDeFim: fins.map(id => ({ nome: nomeDe(id), contaComoEntrega: entrega.includes(id) })), origemDasColunas: configuradas.length ? 'configuração do squad' : 'deduzida pelo Painel',
    cards: { total: vistos.size, emColunaDeFim: emFim, arquivados }, descartesComuns: comuns, pisos: PISOS, cenarios: resultado, alertas,
  };
  window.__mcCobertura = resumo;
  console.table(resultado.ultimaColuna.semanas.map((x, i) => ({ semana: x.inicio, [nomeDe(ultima)]: x.entregas, 'qualquer coluna de fim': resultado.primeiraChegada.semanas[i].entregas })));
  console.log(alertas.length ? '⚠ ' + alertas.join('\n⚠ ') : '✅ Nenhum alerta.');
  const json = JSON.stringify(resumo);
  try { if (typeof copy === 'function') { copy(json); console.log('📋 Resultado copiado. Cole na conversa com o Claude.'); } } catch (e) {}
  console.log(json);
  return resumo;
})();
