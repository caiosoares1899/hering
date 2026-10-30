// ⛵ Ganchos do Travessia nos outros produtos: 💼 no card do Maré (e no menu de clique direito), 🌤️ humor dentro do 🌅 Meu Dia e 💼 no Marco do Radar.
// Boot real das páginas -dev com Firebase falso. Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_travessia_ganchos.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const fs = require('fs');
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'); const d0 = new Date(); const HOJE = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate());
const mare = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dev: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { dev: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  squads_meta: { dev: { label: 'Dev', emoji: '💻', color: '#1de9b6' } },
  squads: { dev: { dados: { columns: [{ id: 'todo', name: 'A fazer' }], tags: [], cards_index: { c1: 'k1' }, cards: { k1: { id: 'c1', title: 'Modelo de churn <b>x</b>', col: 'todo', owner: 'AA' } } } } } } });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', torre: 'digital', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], ordem: 0, indicadores: [], progressoPct: 0, ...o });
const radar = () => ({ kanban: { okr: { objetivos: { d1: mk('d1', 'Fidelidade do cliente') }, marcos: { m1: { id: 'm1', objetivoId: 'd1', nome: 'Lançar o novo CRM', progresso: 'concluido' } }, tags: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dev: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (pag, sd, qs) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, sd); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + pag + '-dev.html' + (qs || '')); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('ana', 'Ana')); await p.waitForTimeout(2200); await p.evaluate(() => { try { document.getElementById('boasvindas-ov')?.classList.remove('open'); } catch (e) {} }); return { ctx, p, errs }; };
  const st = (p, path) => p.evaluate(x => x.split('/').reduce((a, k) => (a == null ? undefined : a[k]), window.__store), path);
  // ── Maré: 💼 no card ──
  { const { ctx, p, errs } = await abre('kanban', mare(), '?squad=dev'); await p.evaluate(() => openCard('c1')); await p.waitForTimeout(600);
    t('Maré: o botão 💼 existe no topo do card, com rótulo acessível', (await p.locator('#m-travessia-btn').count()) === 1 && /Travessia/.test(await p.locator('#m-travessia-btn').getAttribute('aria-label')), '');
    await p.evaluate(() => document.getElementById('m-travessia-btn').click()); await p.waitForTimeout(400);
    const bau = await st(p, 'kanban/travessia/bau/ana'); const it = bau && bau.card_dev_c1; t('💼 grava no Baú da própria pessoa (tipo card, squad, link relativo da página atual)', it && it.tipo === 'card' && it.squad === 'dev' && it.titulo === 'Modelo de churn <b>x</b>' && it.link === 'kanban-dev.html?squad=dev&card=c1' && /^\d{4}-\d{2}-\d{2}$/.test(it.em), bau);
    await p.evaluate(() => document.getElementById('m-travessia-btn').click()); await p.waitForTimeout(300); t('clicar de novo atualiza em vez de duplicar', Object.keys(await st(p, 'kanban/travessia/bau/ana')).length === 1, '');
    t('avisa com toast', /Baú da Travessia/.test(await p.evaluate(() => document.body.innerText)), '');
    await p.evaluate(() => { window.__denySet = () => true; document.getElementById('m-travessia-btn').click(); }); await p.waitForTimeout(400);
    const tx = await p.evaluate(() => (document.querySelector('.toast,#toast,[role=status]') || {}).innerText || document.body.innerText); t('sem permissão: avisa que as regras ainda não foram publicadas', /regras da Travessia ainda não foram publicadas|Não deu pra guardar/.test(tx), tx.slice(0, 120));
    const src = fs.readFileSync(__dirname + '/../../../kanban-dev.html', 'utf8'); t('o menu de clique direito do card também tem "Guardar na Travessia"', /guardarNaTravessia\(\$\{jsq\(cardId\)\}\)[\s\S]{0,120}Guardar na Travessia/.test(src), '');
    t('Maré: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // ── Maré: humor no Meu Dia ──
  { const { ctx, p, errs } = await abre('kanban', mare(), '?squad=dev'); await p.evaluate(() => openMeuDia()); await p.waitForTimeout(900);
    t('Meu Dia: 5 carinhas e a caixa de compartilhar, desmarcada', (await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').count()) === 5 && !(await p.locator('#meudia-humor-comp').isChecked()), await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').count());
    await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').nth(3).click(); await p.waitForTimeout(500);
    let h = await st(p, 'kanban/travessia/humor/ana/' + HOJE); t('escolher grava o humor do dia, PRIVADO (sem cópia pro líder)', h && h.n === 4 && !(await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE)), h);
    t('a carinha escolhida fica marcada (aria-pressed)', (await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"][aria-pressed="true"]').count()) === 1, '');
    await p.check('#meudia-humor-comp'); await p.waitForTimeout(500); t('marcar "compartilhar" grava a cópia do líder', (await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE))?.n === 4, '');
    await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').nth(1).click(); await p.waitForTimeout(500); const c2 = await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE); t('mudar de humor com "compartilhar" marcado atualiza a cópia também', c2 && c2.n === 2 && (await st(p, 'kanban/travessia/humor/ana/' + HOJE)).n === 2, c2);
    await p.uncheck('#meudia-humor-comp'); await p.waitForTimeout(500); t('desmarcar apaga a cópia e mantém o registro privado', !(await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE)) && (await st(p, 'kanban/travessia/humor/ana/' + HOJE)).n === 2, '');
    // 🌙 fechamento do dia
    t('Meu Dia: bloco "Fechamento do dia" com 5 carinhas, caixa de texto e o aviso de que fica salvo só pra pessoa, no Travessia', (await p.locator('#meudia-humor [data-dia-n]').count()) === 5 && (await p.locator('#meudia-dia-txt').count()) === 1 && /só pra você/.test(await p.locator('#meudia-humor').innerText()) && /Diário da Travessia/.test(await p.locator('#meudia-humor').innerText()) && (await p.locator('#meudia-humor a[href="travessia-dev.html"]').count()) === 1, await p.locator('#meudia-humor').innerText());
    await p.click('#meudia-humor button:has-text("Salvar o dia")'); await p.waitForTimeout(300); t('salvar sem humor e sem texto avisa e não grava', !(await st(p, 'kanban/travessia/diario/ana')), '');
    await p.locator('#meudia-humor [data-dia-n="4"]').click(); await p.fill('#meudia-dia-txt', 'Fechei a análise <i>x</i> e ajudei a Bia.'); await p.locator('#meudia-humor button[aria-label="Muito mal"]').first().click(); await p.waitForTimeout(500);
    t('o rascunho do fechamento sobrevive quando o humor da manhã redesenha o bloco', (await p.inputValue('#meudia-dia-txt')) === 'Fechei a análise <i>x</i> e ajudei a Bia.', await p.inputValue('#meudia-dia-txt'));
    await p.locator('#meudia-humor [data-dia-n="4"]').click(); await p.click('#meudia-humor button:has-text("Salvar o dia")'); await p.waitForTimeout(500);
    const dd = await st(p, 'kanban/travessia/diario/ana/' + HOJE); t('salvar grava humor + texto no diário PRIVADO do dia', dd && dd.n === 4 && dd.texto === 'Fechei a análise <i>x</i> e ajudei a Bia.' && dd.ts, dd);
    t('depois de salvar mostra "salvo hoje" e o texto volta preenchido; o texto HTML é escapado', /salvo hoje/.test(await p.locator('#meudia-humor').innerText()) && (await p.inputValue('#meudia-dia-txt')).includes('<i>x</i>') && (await p.locator('#meudia-humor i').count()) === 0, '');
    t('o fechamento NÃO vazou pro humor compartilhado com o líder', !(await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE)), '');
    t('Meu Dia: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 🫶 aviso de apoio ao líder (Meu Dia)
  const mareComLider = () => { const sd = mare(); sd.kanban.travessia = { vinculos: { ana: { liderUid: 'pau' } } }; sd.kanban.usuarios_publicos.pau = { uid: 'pau', nome: 'Pau', init: 'PP', role: 'po', squads: { dev: true } }; return sd; };
  { const { ctx, p } = await abre('kanban', mareComLider(), '?squad=dev'); await p.evaluate(() => openMeuDia()); await p.waitForTimeout(900); const nots = () => st(p, 'kanban/usuarios/pau/notificacoes');
    await p.locator('#meudia-humor ' + 'button[onclick^="_meuDiaHumorSet"]').nth(1).click(); await p.waitForTimeout(500); t('Meu Dia: marcou "mal" SEM compartilhar → o líder NÃO é avisado', !(await nots()), await nots());
    await p.check('#meudia-humor-comp'); await p.waitForTimeout(700); const n1 = await nots(); const k1 = n1 && n1['apoio_ana_' + HOJE]; t('Meu Dia: compartilhar depois de marcar "mal" avisa o líder (tipo travessia_apoio, com o nome da pessoa)', k1 && k1.type === 'travessia_apoio' && /Ana/.test(k1.title) && k1.read === false, n1);
    await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').nth(0).click(); await p.waitForTimeout(600); t('muito mal com compartilhar ligado não duplica o aviso do dia', Object.keys(await nots()).length === 1, Object.keys(await nots()));
    t('o texto da caixa explica o que o líder passa a ver e o aviso', /termômetro do time/.test(await p.locator('#meudia-humor').innerText()) && /aviso/.test(await p.locator('#meudia-humor').innerText()), ''); await ctx.close(); }
  { const { ctx, p } = await abre('kanban', mareComLider(), '?squad=dev'); await p.evaluate(() => openMeuDia()); await p.waitForTimeout(900); await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').nth(3).click(); await p.waitForTimeout(500); await p.check('#meudia-humor-comp'); await p.waitForTimeout(600); t('Meu Dia: compartilhando e marcando "bem" → nenhum aviso', !(await st(p, 'kanban/usuarios/pau/notificacoes')), ''); await ctx.close(); }
  { const src = fs.readFileSync(__dirname + '/../../../kanban-dev.html', 'utf8'); t('o sino do Maré sabe o ícone e abre a Frota da Travessia para o aviso', /travessia_apoio: '🫶'/.test(src) && /type==='travessia_apoio'[\s\S]{0,200}MareNotif\.abrirPagina/.test(src), ''); }
  { const { ctx, p } = await abre('kanban', mare(), '?squad=dev'); await p.evaluate(() => { window.__denyGet = () => true; }); await p.evaluate(() => openMeuDia()); await p.waitForTimeout(900);
    t('sem as regras publicadas (leitura negada) o bloco do humor some em silêncio e o Meu Dia segue funcionando', (await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').count()) === 0 && (await p.locator('#meudia-body').count()) === 1, ''); await ctx.close(); }
  // ── Radar: 📌 no Marco ──
  { const { ctx, p, errs } = await abre('okr', radar(), '?torre=digital'); await p.evaluate(() => openOkrMarco('m1', 'd1')); await p.waitForTimeout(500);
    t('Radar: Marco existente mostra o 💼', await p.locator('#okr-marco-bau-btn').isVisible(), '');
    await p.click('#okr-marco-bau-btn'); await p.waitForTimeout(400); const it = (await st(p, 'kanban/travessia/bau/ana') || {}).marco_m1; t('💼 grava o Marco no Baú (tipo marco, objetivo no texto, link do Radar)', it && it.tipo === 'marco' && it.titulo === 'Lançar o novo CRM' && /Fidelidade do cliente/.test(it.texto) && it.link === 'okr-dev.html?okr=d1', it);
    await p.evaluate(() => { _okrTryCloseMarco && _okrTryCloseMarco(); }); await p.evaluate(() => openOkrMarco(null, 'd1')); await p.waitForTimeout(400); t('Marco novo (ainda não existe) NÃO mostra o 📌', !(await p.locator('#okr-marco-bau-btn').isVisible()), '');
    t('Radar: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // ── Dica e Ajuda ──
  { const src = fs.readFileSync(__dirname + '/../../../mare-dicas-dev.js', 'utf8'); const k = fs.readFileSync(__dirname + '/../../../kanban-dev.html', 'utf8');
    t('Dica "bau" existe no catálogo do Maré e aponta para um tópico que existe na Ajuda', /id:'bau'/.test(src) && /title:'Baú da Travessia \(💼\)'/.test(k) && /title:'Humor do dia \(Meu Dia\)'/.test(k), ''); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); })();
