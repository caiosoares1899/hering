(async () => {
  // ♻️ RECUPERAR CARDS PERDIDOS a partir de (1) um ARQUIVO de backup carregado na tela ⚙ Config → Backup e/ou (2) os snapshots do Maré no Firebase (backups/AAAA-MM-DD).
  // O backup semanal automático fica no Cloud Storage (todo domingo 04:00): backups/midiacriativa/AAAA-MM-DD.json — baixe o mais recente e carregue na tela de Backup (SEM clicar em restaurar).
  // PADRÃO = SIMULAÇÃO: só LÊ e mostra o que SERIA restaurado. Para gravar de verdade, mude APLICAR para true e rode de novo.
  // Rode no console (F12) de https://caiosoares1899.github.io/hering/kanban.html?squad=midiacriativa, logado como ADM/PO, com o board carregado.
  const APLICAR = false;
  const DESDE = '2026-10-27T03:00:00.000Z';        // sumiços registrados a partir de 27/10 00:00 (Brasília)
  const ID_ALVO = 'c1793384127157_bzg';                // só este card (03/11/2026) — os outros alarmes ficam de fora
  const IDS_EXTRA = [ID_ALVO];             // cards que você sabe que sumiram e podem não ter alarme (ex.: o da Juliana)
  const CARDS_EXTRA = [];                           // cards achados no cache do navegador de alguém (cole aqui o JSON que o script de busca no cache devolveu)
  const IGNORAR = [];                               // ids que você NÃO quer restaurar (preencha depois de ver a simulação)
  const PULAR_TITULO_JA_EXISTENTE = true;           // não restaura se já existe um card ativo com o MESMO título (a equipe já recriou)
  if (typeof canBulkDelete === 'function' && !canBulkDelete()) { console.error('🔒 Só ADM/PO/Organizador pode restaurar cards.'); return; }
  const SQ = ACTIVE_SQUAD, ler = async p => (await fbGet(p)).val();
  const brt = iso => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');
  // 1) o que sumiu: alarmes do board + ids que você informou, menos o que já existe / foi excluído de propósito / ignorado
  const inc = Object.values((await ler(FB + '/cards_incidentes_sumico')) || {}).filter(x => x && x.cardId === ID_ALVO && x.detectadoEm >= DESDE);
  const noIndice = (await ler(FB + '/cards_index')) || {};
  const tituloDoAlarme = {}; inc.forEach(x => { if (x.cardTitle) tituloDoAlarme[x.cardId] = x.cardTitle; });
  const candidatos = [...new Set(inc.map(x => x.cardId).concat(IDS_EXTRA, CARDS_EXTRA.map(c => c && c.id).filter(Boolean)))].filter(id => !IGNORAR.includes(id));
  const jaExiste = id => cards.some(c => c && c.id === id) || noIndice[id] != null;
  const pendentes = candidatos.filter(id => !jaExiste(id) && !_intentionalDeleteIds.has(id));
  // 2) fontes, da mais explícita para a mais antiga: o arquivo que você carregou na tela de Backup e depois os snapshots do Firebase (mais novo primeiro)
  const achados = {}; const usados = [];
  const absorve = (lista, nome) => { const faltam = pendentes.filter(id => !achados[id]); (lista || []).filter(Boolean).forEach(c => { if (c.id && faltam.includes(c.id) && !achados[c.id]) achados[c.id] = { card: c, snapshot: nome }; }); };
  const arq = (typeof _restoreParsedPayload !== 'undefined') ? _restoreParsedPayload : null;
  if (arq && arq.board) { const lst = Array.isArray(arq.board.cards) ? arq.board.cards : Object.values(arq.board.cards || {}); usados.push('ARQUIVO carregado (exportado em ' + (arq.exportedAt || '?') + ', squad ' + (arq.squad || '?') + ', ' + lst.filter(Boolean).length + ' cards)'); absorve(lst, 'arquivo ' + String(arq.exportedAt || '?').slice(0, 10)); }
  if (CARDS_EXTRA.length) { usados.push('CACHE de outro navegador (' + CARDS_EXTRA.length + ' cards)'); absorve(CARDS_EXTRA, 'cache de outro navegador'); }
  const datas = []; for (let i = 0; i < 12; i++) datas.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));   // as chaves dos snapshots são a data em UTC
  for (const d of datas) {
    if (!pendentes.filter(id => !achados[id]).length) break;
    const meta = await ler('kanban/squads/' + SQ + '/backups/' + d + '/meta'); if (!meta) continue;
    const bruto = await ler('kanban/squads/' + SQ + '/backups/' + d + '/data/board/cards');
    usados.push('snapshot ' + d + ' (' + (meta.cards || '?') + ' cards)'); absorve(Array.isArray(bruto) ? bruto : Object.values(bruto || {}), 'snapshot de ' + d);
  }
  const linhas = [], restaurar = [];
  pendentes.forEach(id => {
    const a = achados[id]; const titulo = a ? a.card.title : (tituloDoAlarme[id] || '(título desconhecido)');
    const repetido = a && PULAR_TITULO_JA_EXISTENTE && cards.some(c => c && !c.archived && c.title === a.card.title);
    const criadoEm = /^c(\d{13})/.exec(id); const quando = criadoEm ? brt(new Date(+criadoEm[1]).toISOString()) : '?';
    const jaRecriado = !a && titulo && !/desconhecido/.test(titulo) && cards.some(c => c && !c.archived && c.title === titulo);
    let situacao = jaRecriado ? 'não está em nenhuma fonte, mas já existe card ativo com esse título (a equipe recriou) — nada a fazer' : 'NÃO está em nenhuma fonte lida (criado depois do último backup) — recriar à mão';
    if (a && repetido) situacao = 'está na fonte, mas já existe card ativo com o mesmo título — pulado';
    else if (a) { situacao = 'SERÁ RESTAURADO de: ' + a.snapshot; restaurar.push(a.card); }
    linhas.push({ id, titulo: String(titulo).slice(0, 70), criadoEmBRT: quando, situacao });
  });
  const colunaInvalida = restaurar.filter(c => !columns.some(x => x.id === c.col));
  console.log('Fontes lidas: ' + (usados.join(' · ') || 'NENHUMA — carregue o arquivo do backup semanal na tela ⚙ Config → Backup (sem restaurar) e rode de novo') + ' · ' + candidatos.length + ' candidatos · ' + pendentes.length + ' ainda ausentes · ' + restaurar.length + ' restauráveis');
  console.table(linhas);
  if (colunaInvalida.length) console.warn(colunaInvalida.length + ' card(s) estavam numa coluna que não existe mais; voltam para a 1ª coluna do board:', colunaInvalida.map(c => c.title));
  if (!APLICAR) { console.log('🔎 SIMULAÇÃO — nada foi gravado. Se a lista estiver certa, mude APLICAR para true e rode de novo. Para tirar algum card, ponha o id em IGNORAR.'); window._resultadosRecuperar = { simulacao: true, linhas, restaurar: restaurar.map(c => c.id) }; return linhas; }
  if (!restaurar.length) { console.log('Nada a restaurar.'); window._resultadosRecuperar = { aplicado: false, linhas }; return linhas; }
  // 3) grava com as MESMAS funções do botão "↩ Restaurar" do Maré (inserir no array + fbSaveAll só dos ids restaurados)
  const ids = restaurar.map(c => c.id);
  _inserirCardsRestaurados(restaurar);
  await fbSaveAll(undefined, ids);
  renderBoard();
  const indiceDepois = (await ler(FB + '/cards_index')) || {};
  const ok = ids.filter(id => indiceDepois[id] != null);
  console.log('✅ ' + ok.length + ' de ' + ids.length + ' card(s) restaurados e confirmados no banco.' + (ok.length < ids.length ? ' ⚠ Faltaram: ' + ids.filter(id => !ok.includes(id)).join(', ') : ''));
  window._resultadosRecuperar = { aplicado: true, restaurados: ok, linhas }; return linhas;
})();
