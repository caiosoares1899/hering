// 🐟 Metas e desafios ("O mar tá pra peixe") no Maré (kanban-dev): aba lateral 📊 Dados com 2 abas (Squad | Digital), popup dos peixes a cada 20 %,
// atualizar valor (definir/somar), ⚙ Config → 🐟 Metas (criar/editar/excluir), permissões, caminhos _dev. Roda o BOOT REAL do kanban com o Firebase falso.
// K=kanban testa a prod depois da promoção (aí os caminhos NÃO têm _dev: SFX='').
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js');
const K = process.env.K || 'kanban-dev', SFX = /-dev$/.test(K) ? '_dev' : '';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const U = S.U('eve', 'Eve Souza');
  const abre = async (papel, o) => {
    o = o || {};
    const seed = S.seed(papel, { semMarcoFresco: o.semMarcoFresco }); if (o.mut) o.mut(seed);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed);
    if (o.init) await ctx.addInitScript(o.init);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);
  const abreDados = async p => { await p.evaluate(() => toggleDados()); await p.waitForTimeout(500); };

  // ── POPUP DOS PEIXES (marco fresco, nunca visto) ──
  { const { ctx, p, errs } = await abre('po');
    t('ao abrir o Maré, o marco novo vira popup 🐟 "O mar tá pra peixe!" (1º o do Digital)', await vis(p, '.mm-fish') && /O mar tá pra peixe/.test(await txt(p, '.mm-fish')) && /Black Friday 2026/.test(await txt(p, '.mm-fish')) && /40%/.test(await txt(p, '.mm-fish')), await txt(p, '.mm-fish-ov'));
    t('o popup do Digital fala "da meta do Digital", mostra o próximo peixe e tem peixes pulando', /meta do Digital/.test(await txt(p, '.mm-fish')) && /Próximo peixe em 60%/.test(await txt(p, '.mm-fish')) && (await p.evaluate(() => document.querySelectorAll('.mm-fish .stage .f').length)) >= 3, await txt(p, '.mm-fish'));
    await p.click('.mm-fish .go'); await p.waitForTimeout(700);
    t('fechar mostra o próximo da fila (o da squad: 40 %)', /Site Hering/.test(await txt(p, '.mm-fish')), await txt(p, '.mm-fish-ov'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    t('o 3º é a meta batida (100 %): título de comemoração', /Meta batida/.test(await txt(p, '.mm-fish')) && /100%/.test(await txt(p, '.mm-fish')) && await p.evaluate(() => !!document.querySelector('.mm-fish.cem')), await txt(p, '.mm-fish-ov'));
    await p.click('.mm-fish .go'); await p.waitForTimeout(700);
    t('fila acabou: nenhum popup sobrando', !(await vis(p, '.mm-fish')), 0);
    const vistos = await p.evaluate(sfx => JSON.parse(localStorage.getItem('mare_peixes_vistos' + sfx) || '{}'), SFX);
    t('o que já foi visto fica guardado no aparelho (g:40, a:40, c:100)', vistos.g === 40 && vistos.a === 40 && vistos.c === 100, vistos);
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    t('recarregar a página NÃO repete o popup', !(await vis(p, '.mm-fish')), await txt(p, '.mm-fish-ov'));
    t('sem erro de JS (popup)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('po', { mut: s => { const antes = Date.now() - 8 * 3600e3; s.kanban['metas_squads' + SFX].dev.a.marcoTs = antes; s.kanban['metas_squads' + SFX].dev.c.marcoTs = antes; s.kanban['metas_digital' + SFX].g.marcoTs = antes; } });
    t('marco VELHO (> 6 h) não vira popup — quem abre o Maré depois não leva enxurrada', !(await vis(p, '.mm-fish')), await txt(p, '.mm-fish-ov'));
    t('…e é marcado como visto em silêncio', await p.evaluate(sfx => { const v = JSON.parse(localStorage.getItem('mare_peixes_vistos' + sfx) || '{}'); return v.g === 40 && v.a === 40 && v.c === 100; }, SFX), 0);
    await ctx.close(); }

  // ── ABA DADOS: SQUAD | DIGITAL ──
  { const { ctx, p, errs } = await abre('po', { semMarcoFresco: true });
    await abreDados(p);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#dados-body .mm-tab')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    t('duas abas: a da squad (com a contagem) e "Digital"; a da squad vem primeiro e abre selecionada', tabs.length === 2 && /dev\s*4/i.test(tabs[0]) && /Digital\s*2/.test(tabs[1]) && await p.evaluate(() => document.querySelector('[data-dtab="squad"]').classList.contains('on')), tabs);
    const hero = await txt(p, '#dados-pane .mm-hero');
    t('Squad: meta principal em destaque — título, 42 %, valor, situação e KPIs', /Black Friday — Site Hering/.test(hero) && /42%/.test(hero) && /R\$ 840 mil/.test(hero) && /de R\$ 2 mi/.test(hero) && /Atenção/.test(hero) && /Falta/i.test(hero) && /Restam/i.test(hero) && /Precisa\/dia/i.test(hero), hero);
    const marcos = await p.evaluate(() => ({ on: document.querySelectorAll('#dados-pane .mm-hero .mm-mfish span.on').length, tot: document.querySelectorAll('#dados-pane .mm-hero .mm-mfish span').length, prox: document.querySelector('#dados-pane .mm-hero .mm-next')?.innerText }));
    t('barra de marcos: 5 degraus, 2 peixes conquistados (20 e 40), "próximo peixe em 60%"', marcos.tot === 5 && marcos.on === 2 && /Próximo peixe em 60%/.test(marcos.prox), marcos);
    const ring = await p.evaluate(() => { const a = document.querySelector('#dados-pane .mm-hero .mm-arc'); return a && a.getAttribute('stroke-dasharray'); });
    t('anel de progresso desenhado (arco proporcional a 42 %)', !!ring && (() => { const [d, c] = ring.split(' ').map(Number); return Math.abs(d / c - .42) < .01; })(), ring);
    const cards = await p.evaluate(() => [...document.querySelectorAll('#dados-pane .mm-card .mm-card-t > b')].map(x => x.textContent));
    t('desafios da squad viram cartões (a inativa fica de fora): Kids, Mercado Livre, Conversão do App', cards.join('|') === 'Camisetas Hering Kids|Marketplace — Mercado Livre|Conversão do App', cards);
    const kids = await txt(p, '#dados-pane .mm-card[data-mm-id="b"]');
    t('desafio de um dia: tags de dia e submarca, "180 / 500 camisetas", "é hoje!", e aviso de desatualizado ⏰', /Kids Comercial/.test(kids) && /180 \/ 500 camisetas/.test(kids) && /é hoje/.test(kids) && /⏰.*atualize/.test(kids), kids);
    const ml = await txt(p, '#dados-pane .mm-card[data-mm-id="c"]');
    t('desafio batido: 100 %, 🏆 "Meta batida", tag do canal, SEM aviso de desatualizado', /100%/.test(ml) && /Meta batida/.test(ml) && /Mercado Livre \(ME1\)/.test(ml) && !/atualize/.test(ml), ml);
    t('quem é da squad vê ✏️ Atualizar valor na meta e nos desafios; ninguém vê ⚙ Editar aqui', (await p.evaluate(() => document.querySelectorAll('#dados-pane [data-mm-act="reg"]').length)) === 4 && !(await p.evaluate(() => !!document.querySelector('#dados-pane [data-mm-act="edit"]'))), 0);
    // gráfico de evolução
    await p.click('#dados-pane .mm-hero [data-mm-act="graf"]'); await p.waitForTimeout(500);
    const graf = await p.evaluate(() => ({ svg: !!document.querySelector('#dados-pane .mm-hero .mm-chart svg'), pts: document.querySelectorAll('#dados-pane .mm-hero .mm-chart svg circle').length, leg: document.querySelector('#dados-pane .mm-hero .mm-leg')?.innerText.replace(/\s+/g, ' ') }));
    t('📈 Evolução: gráfico com os pontos do histórico, linha real, ritmo ideal e meta', graf.svg && graf.pts >= 14 && /real/.test(graf.leg) && /ritmo ideal/.test(graf.leg) && /meta/.test(graf.leg), graf);
    await p.click('#dados-pane .mm-hero [data-mm-act="graf"]'); await p.waitForTimeout(100);
    t('clicar de novo recolhe o gráfico', !(await vis(p, '#dados-pane .mm-hero .mm-chart')), 0);

    await p.click('[data-dtab="digital"]'); await p.waitForTimeout(500);
    const dg = await txt(p, '#dados-pane .mm-hero');
    t('Digital: meta global em destaque (47 %, R$ 5,6 mi de R$ 12 mi) e a escolha da aba fica lembrada', /Black Friday 2026 — Captação do Digital/.test(dg) && /47%/.test(dg) && /R\$ 5,6 mi/.test(dg) && /de R\$ 12 mi/.test(dg) && await p.evaluate(() => localStorage.getItem('mare_dados_tab') === 'digital'), dg);
    t('Digital: desafio do Digital aparece como cartão (ainda não começou)', /Dia 27: 1 milhão de peças/.test(await txt(p, '#dados-pane')) && /Ainda não começou/.test(await txt(p, '#dados-pane .mm-card[data-mm-id="h"]')), 0);
    const rank = await p.evaluate(() => [...document.querySelectorAll('#dados-pane .mm-rk')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    t('ranking das squads: só quem marcou "mostrar na visão global" (prf 93 %, dev 42 %, dados 30 %) em ordem; a meta interna do Dados não entra', rank.length === 3 && /prf.*93%/.test(rank[0]) && /dev.*42%/.test(rank[1]) && /dados.*30%/.test(rank[2]) && !/Interna do Dados/.test(await txt(p, '#dados-pane')), rank);
    t('Digital: cartões das metas globais das squads com a squad indicada', /Black Friday — Site Hering/.test(await txt(p, '#dados-pane')) && /Captação Dados/.test(await txt(p, '#dados-pane')) && /Camisetas Hering Kids/.test(await txt(p, '#dados-pane')), 0);
    t('a captação do dia (Databricks) continua logo abaixo, na aba Digital', /Captação do dia/i.test(await txt(p, '#dados-body')) && /Nenhum resultado publicado|Captação hoje/i.test(await txt(p, '#dados-body')), await txt(p, '#dados-body'));
    t('membro/PO não ADM NÃO atualiza a meta do Digital (é no Painel), mas atualiza as da própria squad que aparecem aqui', !(await p.evaluate(() => !!document.querySelector('#dados-pane .mm-hero [data-mm-act="reg"]'))) && (await p.evaluate(() => !!document.querySelector('#dados-pane .mm-card[data-mm-sq="dev"] [data-mm-act="reg"]'))) && !(await p.evaluate(() => !!document.querySelector('#dados-pane .mm-card[data-mm-sq="dados"] [data-mm-act="reg"]'))), 0);
    t('sem erro de JS (aba Dados)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('adm', { semMarcoFresco: true }); await abreDados(p); await p.click('[data-dtab="digital"]'); await p.waitForTimeout(400);
    t('ADM atualiza a meta do Digital pelo Maré (✏️ no hero)', await p.evaluate(() => !!document.querySelector('#dados-pane .mm-hero [data-mm-act="reg"]')), 0); await ctx.close(); }
  { const { ctx, p } = await abre('po', { semMarcoFresco: true, mut: s => { delete s.kanban['metas_squads' + SFX]; delete s.kanban['metas_digital' + SFX]; } }); await abreDados(p);
    t('sem nenhuma meta: mensagem amigável apontando onde criar (Config → 🐟 Metas)', /ainda não tem meta/.test(await txt(p, '#dados-pane')) && /Metas/.test(await txt(p, '#dados-pane')), await txt(p, '#dados-pane'));
    await p.click('[data-dtab="digital"]'); await p.waitForTimeout(300);
    t('Digital vazio: explica que a meta global é cadastrada no Painel', /Painel/.test(await txt(p, '#dados-pane')), await txt(p, '#dados-pane')); await ctx.close(); }

  // ── ATUALIZAR VALOR ──
  { const { ctx, p, errs } = await abre('po', { semMarcoFresco: true }); await abreDados(p);
    await p.click('#dados-pane .mm-hero [data-mm-act="reg"]'); await p.waitForTimeout(250);
    t('✏️ abre "Atualizar valor" mostrando o valor de hoje', /Atualizar valor/.test(await txt(p, '.mm-md')) && /R\$ 840 mil/.test(await txt(p, '.mm-md')), await txt(p, '.mm-md'));
    await p.click('#mm-r-ok'); await p.waitForTimeout(100);
    t('sem número: avisa e não grava', /Informe um número/.test(await txt(p, '#mm-r-e')) && (await store(p, 'kanban/metas_squads' + SFX + '/dev/a')).atual === 840000, await txt(p, '#mm-r-e'));
    await p.fill('#mm-r-v', '1250000'); await p.waitForTimeout(150);
    t('prévia ao vivo: vai pra 63 %, situação "No ritmo" e avisa do novo peixe (60 %)', /63%/.test(await txt(p, '#mm-r-p')) && /No ritmo/.test(await txt(p, '#mm-r-p')) && /Novo peixe/.test(await txt(p, '#mm-r-p')) && /60%/.test(await txt(p, '#mm-r-p')), await txt(p, '#mm-r-p'));
    await p.fill('#mm-r-n', 'fechamento das 14h'); await p.click('#mm-r-ok'); await p.waitForTimeout(700);
    const a = await store(p, 'kanban/metas_squads' + SFX + '/dev/a');
    t('grava atual + marco 60 + carimbo de quem/quando', a.atual === 1250000 && a.marco === 60 && Math.abs(a.marcoTs - Date.now()) < 15000 && a.atualizadoPor === 'eve' && a.atualizadoNome === 'Eve Souza' && Math.abs(a.atualizadoEm - Date.now()) < 15000, a);
    const lg = Object.values((await store(p, 'kanban/metas_log' + SFX + '/a')) || {}).filter(x => x.v === 1250000);
    t('grava o valor no histórico (com a nota) — o que alimenta o gráfico', lg.length === 1 && lg[0].nota === 'fechamento das 14h' && lg[0].por === 'eve', lg);
    t('a tela já mostra o novo valor e a data de atualização (ao vivo, sem recarregar)', /63%/.test(await txt(p, '#dados-pane .mm-hero')) && /Atualizado agora há pouco/.test(await txt(p, '#dados-pane .mm-hero')), await txt(p, '#dados-pane .mm-hero'));
    t('cruzou 60 %: o popup 🐟 aparece pra quem atualizou (e pra todo mundo que estiver com o Maré aberto)', await vis(p, '.mm-fish') && /60%/.test(await txt(p, '.mm-fish')), await txt(p, '.mm-fish-ov'));
    await p.click('.mm-fish .go'); await p.waitForTimeout(500);
    // somar
    await p.click('#dados-pane .mm-hero [data-mm-act="reg"]'); await p.click('[data-m="somar"]'); await p.fill('#mm-r-v', '100000'); await p.waitForTimeout(150);
    t('modo "somar": prévia soma ao atual (R$ 1,25 mi + 100 mil = R$ 1,35 mi → 68 %)', /R\$ 1,35 mi/.test(await txt(p, '#mm-r-p')) && /68%/.test(await txt(p, '#mm-r-p')) && !/Novo peixe/.test(await txt(p, '#mm-r-p')), await txt(p, '#mm-r-p'));
    await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    const a2 = await store(p, 'kanban/metas_squads' + SFX + '/dev/a');
    t('somar grava o total (1,35 mi), mantém o marco 60 e NÃO dispara popup novo', a2.atual === 1350000 && a2.marco === 60 && !(await vis(p, '.mm-fish')), a2);
    // corrigir pra baixo
    await p.click('#dados-pane .mm-hero [data-mm-act="reg"]'); await p.fill('#mm-r-v', '700000'); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    const a3 = await store(p, 'kanban/metas_squads' + SFX + '/dev/a');
    t('corrigir o valor pra BAIXO não derruba o marco (a conquista fica) nem dispara popup', a3.atual === 700000 && a3.marco === 60 && !(await vis(p, '.mm-fish')), a3);
    t('sem erro de JS (atualizar)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('po', { semMarcoFresco: true, init: () => { window.__denySet = (pa, v) => /metas_/.test(pa) || (v && typeof v === 'object' && Object.keys(v).some(k => /metas_/.test(k))); } }); await abreDados(p);
    await p.click('#dados-pane .mm-hero [data-mm-act="reg"]'); await p.fill('#mm-r-v', '900000'); await p.click('#mm-r-ok'); await p.waitForTimeout(500);
    t('banco negou: mensagem clara (regras/permissão), modal aberto e botão volta', /Sem permissão/.test(await txt(p, '#mm-r-e')) && await p.evaluate(() => !document.getElementById('mm-r-ok').disabled), await txt(p, '#mm-r-e')); await ctx.close(); }

  // ── 🔔 LEMBRETE DE PREENCHIMENTO: clique na notificação e link ?dados= ──
  { const { ctx, p } = await abre('po', { semMarcoFresco: true });
    const abaAtiva = () => p.evaluate(() => document.querySelector('#dados-body .mm-tab.on')?.dataset.dtab || null);
    await p.evaluate(() => openNotif('n1', '', 'dev', '', 'meta_lembrete', 'digital')); await p.waitForTimeout(500);
    t('clicar no lembrete de meta do Digital abre a aba 📊 Dados já na aba 🌊 Digital', await p.evaluate(() => document.getElementById('dados-drawer').classList.contains('open')) && await abaAtiva() === 'digital', await abaAtiva());
    await p.evaluate(() => { toggleDados(); openNotif('n2', '', 'dev', '', 'meta_lembrete', 'squad'); }); await p.waitForTimeout(500);
    t('clicar no lembrete de meta da squad abre a aba da squad', await p.evaluate(() => document.getElementById('dados-drawer').classList.contains('open')) && await abaAtiva() === 'squad', await abaAtiva());
    t('o ícone 🐟 do tipo existe no sino do Maré', await p.evaluate(() => NOTIF_ICONS.meta_lembrete === '🐟' && MareNotif.TIPOS.some(x => x.id === 'meta_lembrete')), 0);
    await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, S.seed('po', { semMarcoFresco: true }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=dev&dados=digital'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(4200);
    t('?dados=digital no link abre a aba lateral Dados na aba Digital (é o que o lembrete do Painel/Radar/Oceano usa)', await p.evaluate(() => document.getElementById('dados-drawer').classList.contains('open')) && await p.evaluate(() => document.querySelector('#dados-body .mm-tab.on')?.dataset.dtab) === 'digital', 0);
    t('sem erro de JS (link)', !errs.length, errs); await ctx.close(); }

  // ── ⚙ CONFIG → 🐟 METAS ──
  { const { ctx, p, errs } = await abre('po', { semMarcoFresco: true });
    await p.evaluate(() => { openCfg(); swCfgTab('metas'); }); await p.waitForTimeout(400);
    const abas = await p.evaluate(() => [...document.querySelectorAll('#cfg-tabs .ag-tab')].map(x => x.textContent.trim()));
    t('a aba 🐟 Metas existe no ⚙ Configurações (e a ordem das abas segue alinhada com o conteúdo)', abas.includes('🐟 Metas') && await p.evaluate(() => document.getElementById('cfgtab-metas').classList.contains('on') && [...document.querySelectorAll('#cfg-tabs .ag-tab')].find(x => x.classList.contains('on')).textContent.includes('Metas')), abas);
    t('lista TODAS as metas da squad (5, inclusive a inativa, esmaecida) com ⚙ Editar', (await p.evaluate(() => document.querySelectorAll('#cfg-metas-lista .mm-card').length)) === 5 && /inativa/.test(await txt(p, '#cfg-metas-lista')) && (await p.evaluate(() => document.querySelectorAll('#cfg-metas-lista [data-mm-act="edit"]').length)) === 5, 0);
    t('os outros painéis do ⚙ Configurações não foram afetados (Ágil continua abrindo)', await p.evaluate(() => { swCfgTab('agil'); const ok = document.getElementById('cfgtab-agil').classList.contains('on') && !document.getElementById('cfgtab-metas').classList.contains('on'); swCfgTab('metas'); return ok; }), 0);
    // criar
    await p.evaluate(() => metasNova('desafio')); await p.waitForTimeout(250);
    t('"Novo desafio" abre o formulário já no tipo Desafio, com título certo', /Novo desafio/.test(await txt(p, '.mm-md h3')) && await p.evaluate(() => document.querySelector('#mm-tipo [data-t="desafio"]').getAttribute('aria-pressed') === 'true'), await txt(p, '.mm-md h3'));
    await p.click('#mm-f-ok'); await p.waitForTimeout(100);
    t('sem nome: bloqueia com aviso', /nome/i.test(await txt(p, '#mm-f-err')), await txt(p, '#mm-f-err'));
    await p.fill('#mm-f-t', 'Camisetas Hering Teen no dia 27'); await p.click('#mm-f-ok'); await p.waitForTimeout(100);
    t('sem alvo: bloqueia com aviso', /alvo/i.test(await txt(p, '#mm-f-err')), await txt(p, '#mm-f-err'));
    await p.click('#mm-fmt [data-f="num"]'); t('formato "quantidade" mostra o campo de unidade', await vis(p, '#mm-sufw'), 0);
    await p.fill('#mm-f-s', 'camisetas'); await p.fill('#mm-f-a', '800'); await p.click('#mm-em [data-e="👕"]'); await p.click('#mm-hoje');
    await p.selectOption('#mm-f-sm', 'tag_sm_teen_com'); await p.selectOption('#mm-f-cv', 'tag_cv_dafiti'); await p.check('#mm-f-g');
    await p.selectOption('#mm-f-lem', 'horarios'); t('lembrete "horário exato" mostra os horários e esconde os outros modos', await vis(p, '#mm-lem-horarios') && !(await vis(p, '#mm-lem-cada')), 0);
    await p.fill('.mm-l-hs >> nth=0', '09:00'); await p.fill('.mm-l-hs >> nth=1', '15:30'); await p.click('#mm-resp [data-u="ana"]');
    await p.click('#mm-f-ok'); await p.waitForTimeout(700);
    const novos = await store(p, 'kanban/metas_squads' + SFX + '/dev'); const nid = Object.keys(novos).find(k => novos[k].titulo === 'Camisetas Hering Teen no dia 27'); const n = novos[nid];
    t('grava o desafio na squad (caminho _dev): tipo, formato, alvo, unidade, ícone, dia, submarca, canal, global, lembrete e responsável', n && n.tipo === 'desafio' && n.fmt === 'num' && n.alvo === 800 && n.sufixo === 'camisetas' && n.emoji === '👕' && n.inicio === n.fim && /^\d{4}-\d{2}-\d{2}$/.test(n.inicio) && n.submarca === 'tag_sm_teen_com' && n.canal === 'tag_cv_dafiti' && n.global === true && n.lembrete.modo === 'horarios' && n.lembrete.horas.join() === '09:00,15:30' && n.responsaveis.join() === 'ana' && n.ativo === true && n.criadoPor === 'eve', n);
    t('o modal fecha e a lista já tem o novo cartão (6)', !(await vis(p, '.mm-md')) && (await p.evaluate(() => document.querySelectorAll('#cfg-metas-lista .mm-card').length)) === 6, 0);
    t('NÃO grava no caminho de produção (sem _dev) nem em outro squad', !(await store(p, 'kanban/metas_squads')) && !(await store(p, 'kanban/metas_digital')), 0);
    // editar
    await p.click('#cfg-metas-lista .mm-card[data-mm-id="b"] [data-mm-act="edit"]'); await p.waitForTimeout(250);
    const pre = await p.evaluate(() => ({ t: document.getElementById('mm-f-t').value, a: document.getElementById('mm-f-a').value, g: document.getElementById('mm-f-g').checked, lem: document.getElementById('mm-f-lem').value, sm: document.getElementById('mm-f-sm').value, h: document.querySelector('.mm-md h3').innerText }));
    t('editar abre com os dados atuais preenchidos', pre.t === 'Camisetas Hering Kids' && pre.a === '500' && pre.g === true && pre.lem === 'cada' && pre.sm === 'tag_sm_kids_com' && /Editar desafio/.test(pre.h), pre);
    await p.fill('#mm-f-t', 'Camisetas Kids (renomeado)'); await p.fill('#mm-f-a', '600'); await p.click('#mm-f-ok'); await p.waitForTimeout(600);
    const b2 = await store(p, 'kanban/metas_squads' + SFX + '/dev/b');
    t('salvar edição muda título/alvo e PRESERVA valor atual, quem atualizou e histórico de criação', b2.titulo === 'Camisetas Kids (renomeado)' && b2.alvo === 600 && b2.atual === 180 && b2.atualizadoNome === 'Bruno' && b2.criadoEm === 2 && b2.ordem === 2, b2);
    // excluir
    await p.click('#cfg-metas-lista .mm-card[data-mm-id="d"] [data-mm-act="edit"]'); await p.waitForTimeout(200); await p.click('#mm-f-rm'); await p.waitForTimeout(600);
    t('excluir (com confirmação) tira a meta e o histórico dela', !(await store(p, 'kanban/metas_squads' + SFX + '/dev/d')) && (await p.evaluate(() => document.querySelectorAll('#cfg-metas-lista .mm-card').length)) === 5, 0);
    // desativar
    await p.click('#cfg-metas-lista .mm-card[data-mm-id="c"] [data-mm-act="edit"]'); await p.waitForTimeout(200); await p.uncheck('#mm-f-ativo'); await p.click('#mm-f-ok'); await p.waitForTimeout(500);
    t('desmarcar "Ativa" tira a meta da aba Dados (sem apagar)', (await store(p, 'kanban/metas_squads' + SFX + '/dev/c')).ativo === false && !(await p.evaluate(() => { toggleDados(); return false; })), 0);
    await p.waitForTimeout(400);
    t('…e a aba Dados da squad não mostra mais a desativada', !/Mercado Livre/.test(await txt(p, '#dados-pane')), await txt(p, '#dados-pane'));
    t('sem erro de JS (config)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('membro', { semMarcoFresco: true });
    await p.evaluate(() => { openCfg(); swCfgTab('metas'); }); await p.waitForTimeout(300);
    t('membro: a aba 🐟 Metas explica que só PO/Organizador/ADM criam, sem botões de criar', /Só PO, Organizador e ADM/.test(await txt(p, '#cfg-metas-lista')) && !(await vis(p, '#cfg-metas-bar')), await txt(p, '#cfg-metas-lista'));
    await p.evaluate(() => { closeOv('cfg-ov'); toggleDados(); }); await p.waitForTimeout(400);
    t('membro atualiza o valor das metas da squad (✏️) mas não vê ⚙ Editar', (await p.evaluate(() => document.querySelectorAll('#dados-pane [data-mm-act="reg"]').length)) === 4 && !(await p.evaluate(() => !!document.querySelector('#dados-pane [data-mm-act="edit"]'))), 0);
    await ctx.close(); }
  { const { ctx, p } = await abre('organizador', { semMarcoFresco: true }); await p.evaluate(() => { openCfg(); swCfgTab('metas'); }); await p.waitForTimeout(300);
    t('Organizador também cria/edita (botões visíveis, lista com ⚙)', await vis(p, '#cfg-metas-bar') && (await p.evaluate(() => document.querySelectorAll('#cfg-metas-lista [data-mm-act="edit"]').length)) === 5, 0); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
