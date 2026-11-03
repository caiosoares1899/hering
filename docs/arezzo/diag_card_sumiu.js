// 🔎 SÓ LEITURA — cole no console (F12) do kanban.html logado (ADM/PO), na squad midiacriativa, com o board carregado.
// Responde: o card ainda existe? Foi excluído de propósito, arquivado, movido pra outra squad ou apagado por regravação? E quem gravou perto da hora?
(async () => {
  const ID = 'c1793384127157_bzg';
  const ler = async p => { try { return (await fbGet(p)).val(); } catch (e) { return '(erro de leitura: ' + e.message + ')'; } };
  const brt = iso => iso ? new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(5, 19).replace('T', ' ') : '—';
  const R = {};
  R.indice = await ler(FB + '/cards_index/' + ID);
  R.updated_at = await ler(FB + '/cards_updated_at/' + ID);
  R.arquivado = await ler(FB + '/cards_archived/' + ID);
  R.excluido_de_proposito = await ler(FB + '/cards_deleted_intentionally/' + ID);
  const todos = (await ler(FB + '/cards')) || [];
  const lista = Array.isArray(todos) ? todos : Object.values(todos);
  const nele = lista.findIndex(c => c && c.id === ID);
  R.dentro_do_array_cards = nele >= 0 ? 'SIM, posição ' + nele : 'não';
  R.na_memoria_desta_aba = (typeof cards !== 'undefined' && cards.some(c => c.id === ID)) ? 'SIM' : 'não';
  console.log('%c1) Onde o card está', 'font-weight:bold'); console.table([R]);
  if (nele >= 0) { const c = lista[nele]; console.log('%cO card EXISTE no banco:', 'font-weight:bold', { titulo: c.title, coluna: c.col, arquivado: c.archived, criado: c.createdAt, updatedAt: c.updatedAt, hist: (c.history || []).length }); window._diagCard = c; }
  // comentários (ficam em outro nó e não somem com o card)
  const com = await ler(FB + '/card_comments/' + ID);
  const comL = com && typeof com === 'object' ? Object.values(com).filter(Boolean).sort((a, b) => String(a.ts).localeCompare(String(b.ts))) : [];
  console.log('%c2) Comentários do card (' + comL.length + ')', 'font-weight:bold'); console.table(comL.map(x => ({ quando: brt(x.ts), autor: x.author, texto: String(x.text || '').slice(0, 120) })));
  // alarmes e resgates
  const inc = Object.values((await ler(FB + '/cards_incidentes_sumico')) || {}).filter(x => x && (x.cardId === ID));
  console.log('%c3) Alarmes de "card sumiu" deste card (' + inc.length + ')', 'font-weight:bold'); console.table(inc);
  const resg = Object.entries((await ler(FB + '/cards_resgates')) || {}).filter(([k, v]) => k === ID || (v && v.cardId === ID));
  console.log('4) Resgates deste card:', resg);
  // cards-pai que ainda o listam (o histórico do pai guarda título/hora/quem vinculou)
  const pais = (typeof cards !== 'undefined' ? cards : []).filter(c => (c.childCardIds || []).includes(ID));
  console.log('5) Cards-pai que listam este card como filho:', pais.map(p => ({ id: p.id, titulo: p.title, col: p.col })));
  const hp = pais.flatMap(p => (p.history || []).filter(h => /bzg|filho/i.test(JSON.stringify(h))).map(h => ({ pai: p.title, quando: brt(h.at), quem: h.who, o_que: h.what })));
  if (hp.length) console.table(hp);
  // gravações em massa perto da hora (criado em 30/10 15:15 BRT; olhamos de 30/10 em diante)
  const aud = Object.values((await ler(FB + '/cards_auditoria')) || {}).filter(a => a && a.em && a.em >= '2026-10-30T18:00:00').sort((a, b) => String(a.em).localeCompare(String(b.em)));
  console.log('%c6) Gravações em massa desde 30/10 18:00 UTC (' + aud.length + ') — procure uma em que "cardsLocais" seja menor que o normal', 'font-weight:bold');
  console.table(aud.map(a => ({ em_brasilia: brt(a.em), por: a.por, versao: a.ver, origem: a.origem, cardsLocais: a.nLocal, resgatados: a.resgatados, tocados: a.tocados })));
  // outras squads: movido via "Enviar pra outro squad"?
  const squads = ['dados', 'prf', 'midiacriativa', 'dev'].filter(s => s !== ACTIVE_SQUAD);
  const outras = [];
  for (const s of squads) { const p = await ler('kanban/squads/' + s + '/dados/cards_index/' + ID); if (p != null && typeof p !== 'string') outras.push({ squad: s, posicao: p }); else if (p != null) outras.push({ squad: s, posicao: p }); }
  console.log('7) Existe em outra squad?', outras.length ? outras : 'não');
  window._diagSumiu = { R, comL, inc, aud, pais, outras };
  console.log('Pronto. Me mande o que aparecer (principalmente o quadro 1, 2, 3 e 6). window._diagSumiu guarda tudo.');
})();
