// ⏲ Timer e Produtividade (2026-11-01): seção no modal do card (abaixo do checklist) + atalho "⏲ Timers" no topo.
// Boot REAL do Maré com Firebase falso. K=kanban-dev (padrão); a produção só ganha o recurso quando for promovido.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_timers_card.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, col) => ({ id, title: 'Card ' + id, col, createdAt: '2026-10-20', desc: 'texto', owner: 'EV', flow: flow(col), updatedAt: '2026-10-27T10:00:00.000Z' });
const mk = () => ({ kanban: { usuarios: {
    eve: { uid: 'eve', nome: 'Eve Alves', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } },
    bob: { uid: 'bob', nome: 'Bob Lima', email: 'bob@ciahering.com.br', inscrito: true, init: 'BL', role: 'membro', squads: { [SQ]: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Alves', init: 'EV', role: 'po', squads: { [SQ]: true } }, bob: { uid: 'bob', nome: 'Bob Lima', init: 'BL', role: 'membro', squads: { [SQ]: true } } },
  config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: { 0: card('c1', 'backlog') }, cards_index: { c1: '0' }, cards_updated_at: { c1: '2026-10-27T10:00:00.000Z' },
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (uid, nome, seed, vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1400, height: 900 } }); await fake.install(ctx, JSON.parse(JSON.stringify(seed || mk()))); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U(uid, nome)); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); return { ctx, p, errs }; };
  const store = (p, path) => p.evaluate(path => path.split('/').reduce((a, k) => (a == null ? undefined : a[k]), window.__store), path);
  const cria = async (p, { nome, tipo, min, para, ini }) => { await p.click('#m-timer-add'); await p.fill('#tm-f-nome', nome); if (tipo) await p.selectOption('#tm-f-tipo', tipo); if (min) await p.fill('#tm-f-min', String(min)); if (para) await p.selectOption('#tm-f-para', para);
    if (ini === false) await p.evaluate(() => { document.getElementById('tm-f-ini').checked = false; }); await p.click('#m-timer-form .btn-teal'); await p.waitForTimeout(400); };
  const tsPath = id => `kanban/squads/${SQ}/dados/card_timers/c1/${id}`;
  const timers = async p => Object.values((await store(p, `kanban/squads/${SQ}/dados/card_timers/c1`)) || {});

  // A) eve: cronômetro para ela mesma
  { const { ctx, p, errs } = await abre('eve', 'Eve Alves'); await p.evaluate(() => openCard('c1')); await p.waitForTimeout(500);
    const ordem = await p.evaluate(() => { const a = document.getElementById('m-checklist-sec'), b = document.getElementById('m-timers-sec'), c = document.getElementById('m-riscos-sec'); return !!(a.compareDocumentPosition(b) & 4) && !!(b.compareDocumentPosition(c) & 4); });
    t('A1. a seção "Timer e Produtividade" fica abaixo do Checklist (e acima de Riscos)', ordem, ordem);
    t('A2. sem timers: texto de estado vazio e sem total', (await p.textContent('#m-timers')).includes('Nenhum timer') && (await p.textContent('#m-timers-total')) === '', null);
    // detalhes já na configuração inicial (antes de dar o start)
    await p.click('#m-timer-add'); await p.fill('#tm-f-nome', 'Revisar peças'); await p.fill('#tm-f-desc', 'Peças da campanha de novembro'); await p.fill('#tm-f-tag', 'Feature'); await p.selectOption('#tm-f-partes select', 'bob');
    t('A2b. o formulário de criação já traz descrição, tag e participantes', (await p.locator('#tm-f-partes .part-chip').count()) === 1, null);
    await p.click('#m-timer-form .btn-teal'); await p.waitForTimeout(400);
    { const r0 = (await timers(p))[0]; t('A2c. detalhes gravados na criação, sem precisar iniciar nem expandir', r0.desc === 'Peças da campanha de novembro' && r0.tag === 'Feature' && Array.isArray(r0.partes) && r0.partes[0] === 'bob', r0); }
    let l = await timers(p); t('A3. cronômetro criado já rodando', l.length === 1 && l[0].status === 'rodando' && l[0].tipo === 'cron' && l[0].uid === 'eve' && l[0].sq === SQ, l);
    const idx = await store(p, 'kanban/timers_ativos/eve'); t('A4. índice pessoal gravado', idx && Object.values(idx)[0]?.status === 'rodando' && Object.values(idx)[0]?.cardId === 'c1', idx);
    await p.waitForTimeout(2300); const txt = await p.textContent('.tm-row .tm-time'); t('A5. o tempo anda sozinho na linha (≥ 00:02)', /^00:0[2-9]$/.test(txt.trim()), txt);
    t('A6. selo do topo mostra 1 em andamento', (await p.textContent('#tb-timers-n')).trim() === '1' && await p.evaluate(() => document.getElementById('tb-timers').classList.contains('tm-on')), null);
    t('A7. total somado no topo da seção', /^Total 00:0\d$/.test((await p.textContent('#m-timers-total')).trim()), await p.textContent('#m-timers-total'));
    // vários ao mesmo tempo
    await cria(p, { nome: 'Daily', tipo: 'timer', min: 15 }); l = await timers(p);
    t('A8. um 2º timer roda ao mesmo tempo (vários por pessoa)', l.length === 2 && l.every(x => x.status === 'rodando'), l.map(x => x.status));
    t('A9. timer de 15 min mostra a contagem regressiva (14:5x)', /^14:5\d$/.test((await p.locator('.tm-row').nth(1).locator('.tm-time').textContent()).trim()), await p.locator('.tm-row').nth(1).locator('.tm-time').textContent());
    // pausar / retomar / encerrar o primeiro
    await p.locator('.tm-row').nth(0).locator('[data-tm-ac="pause"]').click(); await p.waitForTimeout(300); l = await timers(p); const a = l.find(x => x.atividade === 'Revisar peças');
    t('A10. pausar guarda o tempo acumulado e zera startedAt', a.status === 'pausado' && a.accMs >= 1500 && !a.startedAt, a);
    const acc = a.accMs; await p.waitForTimeout(1200); l = await timers(p); t('A11. pausado não conta tempo', l.find(x => x.atividade === 'Revisar peças').accMs === acc, null);
    await p.locator('.tm-row').nth(0).locator('[data-tm-ac="play"]').click(); await p.waitForTimeout(300); l = await timers(p);
    t('A12. retomar volta a rodar preservando o acumulado', l.find(x => x.atividade === 'Revisar peças').status === 'rodando' && l.find(x => x.atividade === 'Revisar peças').accMs === acc, null);
    await p.locator('.tm-row').nth(0).locator('[data-tm-ac="stop"]').click(); await p.waitForTimeout(400); l = await timers(p);
    t('A13. encerrar fecha a atividade e tira do índice pessoal', l.find(x => x.atividade === 'Revisar peças').status === 'encerrado' && !Object.values((await store(p, 'kanban/timers_ativos/eve')) || {}).some(x => x.atividade === 'Revisar peças'), null);
    // expandido: descrição, tag, participantes
    await p.locator('.tm-row').filter({ hasText: 'Daily' }).locator('.tm-main').click(); await p.waitForTimeout(200);
    await p.fill('.tm-det textarea', 'Alinhamento diário'); await p.fill('.tm-det input[list]', 'Feature'); await p.locator('.tm-det input[list]').blur(); await p.waitForTimeout(300);
    await p.selectOption('.tm-det select', 'bob'); await p.waitForTimeout(400); l = await timers(p); const d = l.find(x => x.atividade === 'Daily');
    t("A14. descrição, tag e participante gravados no registro", d.desc === "Alinhamento diário" && d.tag === "Feature" && Array.isArray(d.partes) && d.partes[0] === "bob", JSON.stringify({desc:d.desc,tag:d.tag,partes:d.partes}));
    t('A15. nome e total continuam coerentes depois do re-render', (await p.textContent('.tm-det')).includes('Bob Lima'), null);
    t('A16. sem erro de JS', !errs.length, errs); await ctx.close(); }

  // B) eve cria para o bob; bob controla; eve é avisada quando ele encerra
  const seedB = mk();
  { const { ctx, p } = await abre('eve', 'Eve Alves', seedB); await p.evaluate(() => openCard('c1')); await p.waitForTimeout(400);
    await cria(p, { nome: 'Roteiro do vídeo', tipo: 'cron', para: 'bob' }); const l = await timers(p);
    t('B1. criado para outra pessoa nasce "novo" (aguardando início)', l.length === 1 && l[0].status === 'novo' && l[0].uid === 'bob' && l[0].porUid === 'eve', l);
    t('B2. o índice do bob recebe a atividade', Object.values((await store(p, 'kanban/timers_ativos/bob')) || {})[0]?.status === 'novo', null);
    const ns = Object.values((await store(p, 'kanban/usuarios/bob/notificacoes')) || {}); t('B3. o bob é notificado ("criou uma atividade para você")', ns.length === 1 && ns[0].type === 'timer_criado' && ns[0].cardId === 'c1', ns);
    t('B4. quem criou não vê play/pausa/encerrar na linha do bob', (await p.locator('.tm-row [data-tm-ac]').count()) === 0, null);
    t('B5. selo do topo da eve não conta a atividade do bob', await p.evaluate(() => document.getElementById('tb-timers-n').style.display === 'none'), null);
    await p.evaluate(() => { window.__seedSnap = JSON.parse(JSON.stringify(window.__store)); }); seedB.kanban = await p.evaluate(() => window.__store.kanban); await ctx.close(); }
  { const { ctx, p } = await abre('bob', 'Bob Lima', seedB);
    t('B6. o bob vê o selo com 1 atividade esperando', (await p.textContent('#tb-timers-n')).trim() === '1' && await p.evaluate(() => document.getElementById('tb-timers-n').classList.contains('espera')), null);
    await p.click('#tb-timers'); await p.waitForTimeout(200); t('B7. popover lista a atividade com o card', (await p.textContent('#tm-pop-list')).includes('Roteiro do vídeo') && (await p.textContent('#tm-pop-list')).includes('Card c1'), await p.textContent('#tm-pop-list'));
    await p.locator('#tm-pop [data-tm-ac="play"]').click(); await p.waitForTimeout(400); const r = Object.values(await store(p, `kanban/squads/${SQ}/dados/card_timers/c1`))[0];
    t('B8. o bob inicia pelo atalho do topo', r.status === 'rodando' && !!r.startedAt && !!r.iniciadoEm, r);
    await p.waitForTimeout(1300); await p.locator('#tm-pop [data-tm-ac="stop"]').click(); await p.waitForTimeout(500);
    const r2 = Object.values(await store(p, `kanban/squads/${SQ}/dados/card_timers/c1`))[0]; t('B9. encerrar pelo atalho grava o tempo', r2.status === 'encerrado' && r2.accMs >= 1000, r2);
    const ne = Object.values((await store(p, 'kanban/usuarios/eve/notificacoes')) || {}); t('B10. a eve é avisada de que a atividade foi encerrada', ne.length === 1 && ne[0].type === 'timer_encerrado' && ne[0].cardId === 'c1', ne);
    await p.keyboard.press('Escape'); t('B11. Esc fecha o popover', !(await p.evaluate(() => document.getElementById('tm-pop').classList.contains('open'))), null); await ctx.close(); }

  // C) quem não é o dono não controla; quem criou para outro só edita/exclui enquanto "novo"
  { const seed = mk(); seed.kanban.squads[SQ].dados.card_timers = { c1: { tx1: { id: 'tx1', sq: SQ, cardId: 'c1', uid: 'bob', porUid: 'bob', atividade: 'Do bob', tipo: 'cron', status: 'rodando', startedAt: Date.now() - 5000, accMs: 0, criadoEm: new Date().toISOString() } } };
    const { ctx, p } = await abre('eve', 'Eve Alves', seed); await p.evaluate(() => openCard('c1')); await p.waitForTimeout(500);
    t('C1. o timer de outra pessoa aparece (com o tempo andando) mas sem botões de controle', (await p.locator('.tm-row').count()) === 1 && (await p.locator('.tm-row [data-tm-ac]').count()) === 0 && /^00:0\d$/.test((await p.locator('.tm-time').textContent()).trim()), await p.locator('.tm-time').textContent());
    await p.evaluate(() => tmAcao(window.ACTIVE_SQUAD || 'x', 'c1', 'tx1', 'stop')); await p.waitForTimeout(200); t('C2. tentar encerrar o timer de outra pessoa não faz nada', (await timers(p))[0].status === 'rodando', null);
    await p.locator('.tm-main').click(); await p.waitForTimeout(200); t('C3. detalhes do timer alheio ficam só para leitura (sem excluir)', (await p.locator('.tm-det textarea[disabled]').count()) === 1 && (await p.locator('.tm-det button:has-text("Excluir")').count()) === 0, null); await ctx.close(); }

  // D) card novo, celular e temas
  { const { ctx, p, errs } = await abre('eve', 'Eve Alves', mk(), { width: 390, height: 800 }); await p.evaluate(() => openNewCard('backlog')); await p.waitForTimeout(500);
    t('D1. card ainda não salvo pede para salvar antes', (await p.textContent('#m-timers')).includes('Salve o card') && await p.evaluate(() => document.getElementById('m-timer-add').style.display === 'none'), null);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCard('c1'); }); await p.waitForTimeout(400);
    await p.click('#m-timer-add'); await p.waitForTimeout(150);
    const larg = await p.evaluate(() => { const s = document.getElementById('m-timers-sec').getBoundingClientRect(); return { sec: Math.round(s.right), vw: innerWidth, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth }; });
    t('D2. celular 390 px: sem rolagem lateral e a seção cabe na tela', larg.sec <= larg.vw && larg.sw <= larg.vw + 1, larg);
    await p.fill('#tm-f-nome', 'Atividade com um nome bem comprido para testar o corte de texto na linha do timer no celular'); await p.click('#m-timer-form .btn-teal'); await p.waitForTimeout(400);
    const alvo = await p.evaluate(() => { const b = document.querySelector('.tm-b'); const r = b.getBoundingClientRect(); const row = document.querySelector('.tm-main').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rowR: Math.round(row.right), vw: innerWidth }; });
    t('D3. nome longo é cortado dentro da linha (sem estourar a tela)', alvo.rowR <= alvo.vw, alvo);
    for (const tema of ['', 'light', 'vice']) { await p.evaluate(x => { if (x) document.documentElement.setAttribute('data-theme', x); else document.documentElement.removeAttribute('data-theme'); }, tema);
      await p.locator('#m-timers-sec').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/claude-0/-home-user-hering/6d9105d6-b81e-55b1-b178-9c90fb7df259/scratchpad/timer_390_' + (tema || 'abrolhos') + '.png' });
      const cor = await p.evaluate(() => { const e = document.querySelector('.tm-name'); return getComputedStyle(e).color; }); t('D4. tema "' + (tema || 'abrolhos') + '": texto da atividade tem cor definida', !!cor && cor !== 'rgba(0, 0, 0, 0)', cor); }
    t('D5. sem erro de JS', !errs.length, errs); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
