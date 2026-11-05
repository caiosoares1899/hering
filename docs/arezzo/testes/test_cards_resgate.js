// 🛟 fbSaveAll nunca apaga um card que existe no banco só porque o aparelho ainda não o recebeu (relato de produção 2026-10-28, squad midiacriativa: "cards sumindo").
// Boot REAL do Maré com Firebase falso. K=kanban roda o MESMO teste contra a produção (o cenário A deve FALHAR lá — é a prova de que o teste pega o bug).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_cards_resgate.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa'; const FBP = 'kanban/squads/' + SQ + '/dados';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col, extra) => Object.assign({ id, title, col, createdAt: '2026-10-20', desc: 'conteudo de ' + title, flow: flow(col), updatedAt: '2026-10-26T10:00:00.000Z' }, extra || {});
const montaSeed = () => { const cards = {}, idx = {}, upd = {}, arq = {};
  for (let i = 0; i < 10; i++) { cards[i] = card('c' + i, 'Card ' + i, i % 2 ? 'doing' : 'backlog'); }
  cards[10] = card('cArq', 'Card arquivado', 'done', { archived: true });
  Object.entries(cards).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; if (c.archived) arq[c.id] = true; });
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
    squads: { [SQ]: { dados: { cards, cards_index: idx, cards_updated_at: upd, cards_archived: arq, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, montaSeed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(4200);
    await p.evaluate(() => { window.uiConfirm = async () => true; window.uiPrompt = async () => 'EXCLUIR'; }); return { ctx, p, errs }; };
  const banco = p => p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const arr = (Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards)).filter(Boolean);
    return { ids: arr.map(c => c.id), index: Object.keys(dd.cards_index || {}), marcas: Object.keys(dd.cards_deleted_intentionally || {}), resgates: Object.keys(dd.cards_resgates || {}).length, arquivados: Object.keys(dd.cards_arquivados || dd.cards_archived || {}) }; }, SQ);
  // "outra pessoa" cria um card: o aparelho NÃO sabe (nenhum evento ao vivo chega) — é exatamente o aparelho atrasado
  const outraPessoaCria = p => p.evaluate(async () => { const novo = { id: 'cNovo', title: 'Card NOVO de outra pessoa', col: 'doing', createdAt: '2026-10-28', desc: 'x', flow: { enteredAt: { doing: '2026-10-28T12:00:00.000Z' }, log: [{ from: '—', to: 'doing', at: '2026-10-28T12:00:00.000Z' }], firstStartAt: null, doneAt: null }, updatedAt: '2026-10-28T12:00:00.000Z' };
    await window._set(fb(FB + '/cards/11'), novo); await window._set(fb(FB + '/cards_index/cNovo'), '11'); await window._set(fb(FB + '/cards_updated_at/cNovo'), novo.updatedAt); });

  { const { ctx, p, errs } = await abre(); await outraPessoaCria(p);
    t('A0. o aparelho está atrasado: não conhece o card que outra pessoa criou', await p.evaluate(() => !cards.some(c => c && c.id === 'cNovo')), '');
    await p.evaluate(() => fbSaveAll(undefined, ['c1']));     // qualquer ação em massa / reordenar coluna
    const r = await banco(p);
    t('A. o save estrutural NÃO apaga o card criado por outra pessoa (nem de /cards, nem do índice)', r.ids.includes('cNovo') && r.index.includes('cNovo'), r);
    t('A2. os outros cards e o arquivado continuam todos lá', ['c0', 'c1', 'c9', 'cArq'].every(id => r.ids.includes(id)) && r.ids.length === 12, r.ids);
    t('A3. o card resgatado entra no array local e o resgate fica registrado (cards_resgates)', (await p.evaluate(() => cards.some(c => c && c.id === 'cNovo'))) && r.resgates === 1, r.resgates);
    t('A4. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre();       // B: exclusão de propósito continua valendo (a marca vai em `extra`)
    await p.evaluate(() => { cards = cards.filter(c => c.id !== 'c3'); return fbSaveAll({ 'cards_deleted_intentionally/c3': true }, []); }); const r = await banco(p);
    t('B. excluir de propósito (com a marca) continua excluindo — o resgate não ressuscita', !r.ids.includes('c3') && !r.index.includes('c3') && r.ids.length === 10, r); await ctx.close(); }

  { const { ctx, p } = await abre();       // C: as exclusões que não gravavam a marca agora gravam, e o card não volta
    await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<input type="checkbox" class="cleanup-chk" data-id="c4" checked><input type="checkbox" class="arch-chk" data-id="cArq" checked>'); });
    await p.evaluate(async () => { await deleteSelectedOldCards(); }); await p.waitForTimeout(600);
    let r = await banco(p); t('C1. "Cards antigos → excluir" apaga de vez e grava a marca de exclusão', !r.ids.includes('c4') && r.marcas.includes('c4'), r);
    await p.evaluate(async () => { await deleteSelectedArchived(); }); await p.waitForTimeout(600);
    r = await banco(p); t('C2. "Arquivados → excluir selecionados" apaga de vez e grava a marca', !r.ids.includes('cArq') && r.marcas.includes('cArq'), r);
    await p.evaluate(() => fbSaveAll(undefined, ['c1'])); r = await banco(p);
    t('C3. um save seguinte (outro aparelho) NÃO traz de volta o que foi excluído de propósito', !r.ids.includes('c4') && !r.ids.includes('cArq') && r.resgates === 0, r); await ctx.close(); }

  { const { ctx, p } = await abre();       // D: substituir tudo de propósito (restaurar backup / Trello sem mesclar)
    await p.evaluate(() => { cards = cards.filter(c => c.id === 'c0'); return fbSaveAll(undefined, undefined, { substituirTudo: true }); }); const r = await banco(p);
    t('D. com substituirTudo (restaurar backup / importar sem mesclar) o conjunto é substituído, sem resgate', r.ids.includes('c0') && !r.ids.includes('c5') && r.resgates === 0, r); await ctx.close(); }

  { const { ctx, p } = await abre();       // E: 🔒 se a leitura do índice falhar, o save estrutural é RECUSADO e nada é apagado (05/11/2026; antes seguia e gravava null nos cards ausentes)
    await p.evaluate(() => { window.__denyGet = path => /cards_index$/.test(path); });
    const antes = await banco(p);
    const rec = await p.evaluate(async () => { const c = cards.find(x => x.id === 'c2'); c.title = 'Card 2 editado'; try { await fbSaveAll(undefined, ['c2']); return 'gravou'; } catch (e) { return e.name; } });
    const r = await banco(p);
    t('E. leitura do índice falhou → save recusado (VersaoDesatualizada) e NENHUM card/índice saiu do banco', rec === 'VersaoDesatualizada' && r.ids.length === antes.ids.length && r.index.length === antes.index.length, [rec, antes.ids.length, r.ids.length]);
    await p.evaluate(() => { window.__denyGet = null; });
    t('E2. o mesmo save, com a leitura de volta, passa', await p.evaluate(async () => { try { await fbSaveAll(undefined, ['c2']); return true; } catch (e) { return String(e); } }) === true, '');
    await ctx.close(); }

  { const { ctx, p } = await abre();       // E3: carimbo de autoria atômico (cards_write_meta/ultimo) + ids removidos sem marca
    await p.evaluate(() => { async function salvarDeTeste() { return fbSaveAll({ 'cards_deleted_intentionally/c5': true }, []); } cards = cards.filter(c => c.id !== 'c5'); return salvarDeTeste(); });
    const m = await p.evaluate(sq => (window.__store.kanban.squads[sq].dados.cards_write_meta || {}).ultimo || null, SQ);
    t('E3. fbSaveAll grava cards_write_meta/ultimo (uid, versão, origem = função que chamou, sinais, e o marcador de horário do servidor `.sv` chega inteiro ao banco); exclusão intencional NÃO entra em idsRemovidos', !!m && m.uid === 'eve' && !!m.ver && !!m.clienteEm && 'abaAbertaMin' in m && m.resgate && m.resgate.status === 'ok' && !(m.idsRemovidos || []).includes('c5') && m.origem === 'salvarDeTeste' && !!m.servidorEm && m.servidorEm['.sv'] === 'timestamp', m); await ctx.close(); }

  { const { ctx, p } = await abre();       // E4: evento ao vivo dentro da janela de 2 s é REAGENDADO, não perdido
    const r = await p.evaluate(async () => { _hasLocalSession = true; _lastLocalSave = Date.now(); window._cardsByKey['11'] = { id: 'cLive', title: 'Ao vivo', col: 'doing', updatedAt: 'x' }; window._scheduleCardsSync();   // o caminho real de um evento ao vivo (debounce 150 ms → guarda dos 2 s)
      await new Promise(res => setTimeout(res, 400));
      const logo = cards.some(c => c && c.id === 'cLive'); await new Promise(res => setTimeout(res, 2400)); return { logo, depois: cards.some(c => c && c.id === 'cLive') }; });
    t('E4. evento ao vivo recebido dentro dos 2 s após um save local não é aplicado na hora, mas é reagendado e aplicado sozinho quando a janela fecha', r.logo === false && r.depois === true, r); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaCria(p);   // F: o helper de conferência (usado no script de console) não mexe em nada
    const ach = await p.evaluate(async () => (await _resgatarCardsAusentes(undefined, true)).map(c => c.id)); const tem = await p.evaluate(() => cards.some(c => c && c.id === 'cNovo'));
    t('F. _resgatarCardsAusentes(..., true) só CONFERE: lista o que faltaria e não altera o array local', ach.join() === 'cNovo' && !tem, [ach, tem]); await ctx.close(); }
  { const { ctx, p, errs } = await abre();   // G: restaurar backup (função real) continua SUBSTITUINDO o conjunto de cards
    await p.evaluate(async () => { const c = n => cards.find(x => x.id === n); const payload = { squad: ACTIVE_SQUAD, version: 'teste', exportedAt: new Date().toISOString(), board: { cards: [JSON.parse(JSON.stringify(c('c0'))), JSON.parse(JSON.stringify(c('c1')))], columns: JSON.parse(JSON.stringify(columns)), tags: [], agilCfg: {}, qlItems: { recorrentes: [], modelos: [], agendamentos: [] }, links: [], calEvents: [], autoRules: [] } };
      await _applyRestorePayload(payload); }); await p.waitForTimeout(500); const r = await banco(p);
    t('G. restaurar backup (_applyRestorePayload) substitui os cards pelos do backup — sem o resgate trazê-los de volta', r.ids.includes('c0') && r.ids.includes('c1') && !r.ids.includes('c5') && !r.ids.includes('c9') && r.resgates === 0, r);
    t('G2. sem erro de JS', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
