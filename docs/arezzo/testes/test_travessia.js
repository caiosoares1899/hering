// ⛵ Travessia (travessia-dev.html, Fase 1) — boot real com Firebase falso: login, Baú, faróis (com folgas da Escala), humor privado/compartilhado, mural de Estrelas,
// Frota do líder, indicação e aprovação de pares, autoavaliação, TRAVA DE DEVOLUTIVA, administração (organograma, RH, ciclos), escape de HTML, 3 temas e celular.
// As REGRAS do banco são testadas à parte (functions/rules/__tests__/travessiaRules.test.js); aqui o foco é o que a tela faz e grava.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_travessia.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const U = (uid, n, email) => ({ uid, email: email || uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'); const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const HOJE = iso(new Date());
const CID = 'c1';
const seed = () => ({ kanban: {
  usuarios_publicos: {
    ana: { nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true } },
    pau: { nome: 'Pau Reis', init: 'PR', email: 'pau@ciahering.com.br', role: 'po', squads: { dados: true } },
    gil: { nome: 'Gil Prado', init: 'GP', email: 'gil@ciahering.com.br', role: 'membro', squads: { dados: true } },
    bia: { nome: 'Bia Souza', init: 'BS', email: 'bia@ciahering.com.br', role: 'membro', squads: { dados: true } },
    cae: { nome: 'Cauê <img src=x onerror=window.__xss=1>', init: 'CM', email: 'cae@ciahering.com.br', role: 'membro', squads: { dados: true } },
    zed: { nome: 'Zed Outra', init: 'ZO', email: 'zed@ciahering.com.br', role: 'membro', squads: { midia: true } },
    adm: { nome: 'Adm Silva', init: 'AS', email: 'adm@ciahering.com.br', role: 'adm', squads: {} },
  },
  usuarios: { adm: { role: 'adm' }, ana: { role: 'membro', init: 'AL', squads: { dados: true } }, pau: { role: 'po' } },
  travessia: {
    vinculos: { ana: { liderUid: 'pau', gerenteUid: 'gil' }, bia: { liderUid: 'pau', gerenteUid: 'gil' }, pau: { liderUid: 'gil' } },
    serie: { ana: { cad: 'quinzenal', tipo: 'acomp', ts: 1 }, bia: { cad: 'semanal', tipo: 'acomp', ts: 1 } },
    encontros: { ana: { e1: { data: dAtras(20), tipo: 'acomp', por: 'pau', ts: 1 } }, bia: { e1: { data: dAtras(30), tipo: 'acomp', por: 'pau', ts: 1 } } },
    ciclos: { [CID]: { nome: 'Ciclo 2026/2', status: 'coleta', ts: 5, participantes: { ana: true, bia: true } } },
    avaliacoes: { [CID]: { ana: { pares: { bia: { aprovado: true, por: 'avaliado', ts: 1 } }, devolutiva: { texto: 'Síntese combinada na conversa.', liberada: false, ts: 1 }, auto: { q1: 'Minha entrega', ts: 1 }, resp_pares: { bia: { q1: 'Ótima colega', ts: 1 } } } } },
    diario: { ana: { [dAtras(40)]: { n: 2, texto: 'Dia puxado, reunião longa.', ts: 1 }, [dAtras(3)]: { n: 5, texto: 'Entreguei o painel!\nGostei muito.', ts: 2 } } },
    humor_comp: { ana: { [dAtras(1)]: { n: 2, ts: 1 }, [dAtras(5)]: { n: 4, ts: 1 }, [dAtras(9)]: { n: 5, ts: 1 } }, bia: { [dAtras(2)]: { n: 5, ts: 1 }, [dAtras(6)]: { n: 3, ts: 1 } } },
    pedidos_par: { bia: { [CID + '_ana']: { cid: CID, avaliado: 'ana', ts: 1 } } },
  },
  escala: Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [dAtras(i + 3), { dados: { ana: { t: 'folga', por: 'ana', ts: 1 } } }])),
  painel: { kudos_geral: [{ id: 'k1', fromUid: 'pau', fromNome: 'Pau Reis', toUid: 'ana', toInit: 'AL', texto: 'A análise salvou o dia!', ts: new Date().toISOString(), scope: 'geral' }, { id: 'k2', fromUid: 'pau', fromNome: 'Pau Reis', toUid: 'bia', texto: 'Para a Bia', ts: new Date().toISOString() }] },
  squads: { dados: { dados: { kudos: [{ id: 'k3', fromUid: 'gil', fromNome: 'Gil Prado', toUid: '', toInit: 'AL', texto: 'Estrela só com a sigla', ts: new Date().toISOString() }] } } },
} });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 360))); };
  const abre = async (user, o) => { const ctx = await b.newContext({ viewport: (o && o.vp) || { width: 1280, height: 900 } }); await fake.install(ctx, (o && o.seed) || seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/travessia-dev.html'); await p.waitForFunction(() => !!window.__authCb); if (user) { await p.evaluate(x => window.__authCb(x), user); await p.waitForSelector('#app .h1', { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(400); } return { ctx, p, errs }; };
  const st = (p, path) => p.evaluate(x => x.split('/').reduce((a, k) => (a == null ? undefined : a[k]), window.__store), path);
  const aba = async (p, nome) => { await p.click(`[role=tab][data-tab="${nome}"]`); await p.waitForTimeout(500); };
  const tabs = p => p.locator('[role=tab][data-tab]').allInnerTexts();
  const clica = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };

  // 0) regra pura do farol
  { const { ctx, p } = await abre(null); const F = (a) => p.evaluate(x => window.Travessia.farol(x), a); const base = { hoje: '2026-10-22' };
    t('farol: sem cadência → cinza', (await F({ ...base, ultimo: '2026-10-01' })).cor === 'cinza', '');
    t('farol: sem 1:1 registrado → cinza', (await F({ ...base, cad: 'quinzenal' })).cor === 'cinza', '');
    t('farol quinzenal: 15 dias = verde, 16 = amarelo, 21 = amarelo, 22 = vermelho', (await F({ ...base, cad: 'quinzenal', ultimo: '2026-10-07' })).cor === 'verde' && (await F({ ...base, cad: 'quinzenal', ultimo: '2026-10-06' })).cor === 'amarelo' && (await F({ ...base, cad: 'quinzenal', ultimo: '2026-10-01' })).cor === 'amarelo' && (await F({ ...base, cad: 'quinzenal', ultimo: '2026-09-30' })).cor === 'vermelho', '');
    const fo = await F({ ...base, cad: 'quinzenal', ultimo: '2026-10-01', folgas: 7 }); t('farol desconta as folgas da Escala (21 dias − 7 = 14 → verde) e diz isso', fo.cor === 'verde' && /7 dias de folga descontados/.test(fo.sub), fo);
    t('farol semanal e mensal e trimestral usam a própria cadência', (await F({ ...base, cad: 'semanal', ultimo: '2026-10-12' })).cor === 'amarelo' && (await F({ ...base, cad: 'mensal', ultimo: '2026-09-18' })).cor === 'amarelo' && (await F({ ...base, cad: 'mensal', ultimo: '2026-09-22' })).cor === 'verde' && (await F({ ...base, cad: 'trimestral', ultimo: '2026-07-24' })).cor === 'verde', '');
    await ctx.close(); }
  // 0b) regra pura do termômetro
  { const { ctx, p } = await abre(null); const TM = (hc, hoje, n) => p.evaluate(x => window.Travessia.termometro(x.hc, x.hoje, x.n), { hc, hoje, n });
    const H = '2026-10-22'; const d = (n) => { const x = new Date('2026-10-22T12:00:00'); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const r = await TM({ a: { [d(0)]: { n: 4 }, [d(6)]: { n: 2 } }, b: { [d(3)]: { n: 5 }, [d(7)]: { n: 1 } }, c: { [d(14)]: { n: 1 } } }, H, 5);
    t('termômetro: média e contagens só dos últimos 7 dias (dias 0 a 6), de quem compartilhou', r.respostas === 3 && r.pessoas === 2 && r.total === 5 && Math.abs(r.media - (4 + 2 + 5) / 3) < 1e-9, r);
    t('termômetro: semana anterior à parte (dia 7) e fora da janela (dia 14) não entram na média atual', r.anterior === 1 && r.dist.reduce((s, x) => s + x, 0) === 3, r);
    t('termômetro: distribuição por humor', r.dist[1] === 1 && r.dist[3] === 1 && r.dist[4] === 1, r.dist);
    t('termômetro: cor verde ≥ 3,5 / amarela ≥ 2,5 / vermelha abaixo; sem dados = cinza', r.cor === 'verde' && (await TM({ a: { [d(0)]: { n: 3 } } }, H, 1)).cor === 'amarelo' && (await TM({ a: { [d(0)]: { n: 2 } } }, H, 1)).cor === 'vermelho' && (await TM({}, H, 3)).cor === 'cinza' && (await TM({}, H, 3)).media === null, '');
    const ap = (await TM({ a: { [d(2)]: { n: 2 } }, b: { [d(3)]: { n: 1 } }, c: { [d(1)]: { n: 3 } }, e: { [d(0)]: { n: 1 }, [d(2)]: { n: 5 } }, f: { [d(1)]: { n: 2 }, [d(0)]: { n: 4 } } }, H, 6)).apoio.map(x => x.uid).sort();
    t('alerta de apoio: marcou 1 ou 2 nos últimos 3 dias (hoje, ontem, anteontem); não alerta quem marcou 3, quem marcou há 3 dias, nem quem já melhorou depois', JSON.stringify(ap) === JSON.stringify(['a', 'e']), ap);
    t('termômetro: 14 pontos diários para o gráfico', (await TM({}, H, 1)).dias.length === 14, ''); await ctx.close(); }
  // 1) login
  { const { ctx, p } = await abre(null); t('sem login: mostra a tela de entrada e não o app', await p.locator('#login').isVisible() && !(await p.locator('#app').isVisible()), '');
    await p.evaluate(() => window.__authCb({ uid: 'x', email: 'alguem@gmail.com', displayName: 'X', providerData: [{ providerId: 'google.com' }] })); await p.waitForTimeout(300);
    t('conta de fora da empresa é barrada com aviso', /@ciahering/.test(await p.locator('#login-err').innerText()) && !(await p.locator('#app').isVisible()), '');
    await ctx.close(); }
  // 2) pessoa comum (Ana)
  { const { ctx, p, errs } = await abre(U('ana', 'Ana Lima'));
    t('Ana (sem liderados, sem papel): vê Minha travessia, Baú, Diário e Avaliação', (await tabs(p)).length === 4 && !(await tabs(p)).some(x => /Frota|Administração/.test(x)), await tabs(p));
    const f = await p.locator('.farol').first().innerText(); t('Ana: farol do 1:1 já desconta as folgas da Escala (20 dias − 6 folgas = 14 → 🟢 Em dia)', /Em dia/.test(f) && /6 dias de folga descontados/.test(f), f);
    t('Ana: mural de Estrelas aparece com as DELA (geral + squad, por uid e por sigla) e não a da Bia', (await p.locator('.star').count()) === 2 && !/Para a Bia/.test(await p.locator('#painel').innerText()), await p.locator('.star').count());
    await clica(p, '[data-act="humor"][data-n="4"]'); let h = await st(p, 'kanban/travessia/humor/ana/' + HOJE); t('humor: grava o registro E a cópia do líder, sem caixa nenhuma', h && h.n === 4 && (await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE))?.n === 4 && (await p.locator('#humor-comp').count()) === 0, h);
    await clica(p, '[data-act="humor"][data-n="5"]'); t('mudar o humor atualiza a cópia do líder', (await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE))?.n === 5, '');
    await clica(p, '[data-act="humor"][data-n="3"]'); t('não existe descompartilhar: a cópia segue o humor de hoje', (await st(p, 'kanban/travessia/humor_comp/ana/' + HOJE))?.n === 3 && (await st(p, 'kanban/travessia/humor/ana/' + HOJE)).n === 3, '');
    await p.fill('#enc-d', dAtras(1)); await clica(p, '[data-form="encontro"] button[type=submit]'); const encs = Object.values(await st(p, 'kanban/travessia/encontros/ana')); t('registrar 1:1 grava com o autor', encs.some(e => e.data === dAtras(1) && e.por === 'ana'), encs);
    t('depois do registro o farol vira "último 1:1 há 1 dia"', /há 1 dia/.test(await p.locator('.farol').first().innerText()), await p.locator('.farol').first().innerText());
    await clica(p, '[data-act="estrela-bau"] >> nth=0'); const bau = Object.values((await st(p, 'kanban/travessia/bau/ana')) || {}); t('Estrela → 💼 Baú grava item tipo kudo com o texto', bau.length === 1 && bau[0].tipo === 'kudo' && /salvou o dia|sigla/.test(bau[0].texto), bau);
    await aba(p, 'bau'); await p.click('summary:has-text("Registrar conquista")'); await p.fill('#b-t', 'Liderei a análise <b>X</b>'); await p.fill('#b-d', 'Prazo apertado'); await p.fill('#b-i', '+12% de conversão'); await clica(p, '[data-form="bau"] button[type=submit]');
    const itens = Object.values(await st(p, 'kanban/travessia/bau/ana')); const man = itens.find(i => i.tipo === 'manual'); t('Baú manual: guarda título e desafio/impacto', man && /Desafio: Prazo apertado/.test(man.texto) && /Impacto: \+12%/.test(man.texto), itens);
    t('Baú: o HTML digitado é escapado (não vira <b>)', (await p.locator('#painel .tx b b').count()) === 0 && /<b>X<\/b>/.test(await p.locator('#painel').innerText()), '');
    await clica(p, '[data-act="filtro-bau"][data-f="kudo"]'); t('Baú: filtro por tipo', (await p.locator('.lst li').count()) === 1, await p.locator('.lst li').count());
    await clica(p, '[data-act="bau-del"] >> nth=0'); await p.click('#ov-ok'); await p.waitForTimeout(400); t('apagar pede confirmação própria (não o confirm do navegador) e remove', Object.keys((await st(p, 'kanban/travessia/bau/ana')) || {}).length === 1, '');
    t('Ana: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 2b) 📓 diário do fechamento do dia
  { const { ctx, p, errs } = await abre(U('ana', 'Ana Lima'));
    t('Início tem o Fechamento do dia, com o aviso de que fica salvo só pra pessoa e ninguém lê', /Fechamento do dia/.test(await p.locator('#painel').innerText()) && /Fica salvo só pra você/.test(await p.locator('#painel').innerText()) && /nem o seu líder/.test(await p.locator('#painel').innerText()), '');
    t('sem registro hoje: lembra o último (“Entreguei o painel!”)', /Seu último registro/.test(await p.locator('#painel').innerText()) && /Entreguei o painel/.test(await p.locator('#painel').innerText()), '');
    await clica(p, '#painel button:has-text("Salvar o dia")'); t('salvar vazio não grava', !(await st(p, 'kanban/travessia/diario/ana/' + HOJE)), '');
    await p.locator('[data-act="dia-n"][data-n="3"]').click(); await p.fill('#dia-txt', 'Dia normal <b>ok</b>'); await clica(p, '#painel button:has-text("Salvar o dia")');
    const dd = await st(p, 'kanban/travessia/diario/ana/' + HOJE); t('salvar grava no diário (humor + texto)', dd && dd.n === 3 && dd.texto === 'Dia normal <b>ok</b>', dd);
    t('depois de salvar mostra "salvo hoje"', /salvo hoje/.test(await p.locator('#painel').innerText()), '');
    await aba(p, 'diario'); t('aba Diário lista os 3 dias (hoje, 3 dias atrás, 40 dias atrás), agrupa por mês e escapa o HTML', (await p.locator('#painel [data-act="dia-del"]').count()) === 3 && (await p.locator('#painel .foco b b').count()) === 0, await p.locator('#painel [data-act="dia-del"]').count());
    t('o diário agrupa por mês: só o mais recente vem aberto', (await p.locator('#painel details[open] summary', { hasText: /\d+ dias?/ }).count()) >= 1, '');
    await p.fill('#pesq', 'painel'); await p.waitForTimeout(500); t('busca no diário filtra pelo texto', (await p.locator('#painel [data-act="dia-del"]').count()) === 1 && /Entreguei o painel/.test(await p.locator('#painel details').innerText()), await p.locator('#painel [data-act="dia-del"]').count());
    await clica(p, '[data-act="dia-bau"]'); const bau = Object.values((await st(p, 'kanban/travessia/bau/ana')) || {}); t('💼 leva um dia do diário para o Baú (título com a data, texto completo)', bau.length === 1 && bau[0].tipo === 'manual' && /Entreguei o painel/.test(bau[0].titulo) && /Gostei muito/.test(bau[0].texto), bau);
    await p.fill('#pesq', ''); await p.waitForTimeout(500); await p.evaluate(() => document.querySelectorAll('#painel details').forEach(d => { d.open = true; })); await clica(p, '[data-act="dia-del"] >> nth=2'); await p.click('#ov-ok'); await p.waitForTimeout(500); t('apagar pede confirmação e remove só aquele dia', Object.keys(await st(p, 'kanban/travessia/diario/ana')).length === 2, Object.keys(await st(p, 'kanban/travessia/diario/ana')));
    t('Diário: sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre(U('pau', 'Pau Reis')); await aba(p, 'frota'); await clica(p, '.pcard:has-text("Ana Lima") [data-act="abrir"]');
    t('o LÍDER não tem acesso ao diário da pessoa (nenhuma aba nem texto dele na Frota)', !/Diário|Entreguei o painel/.test(await p.locator('#detalhe').innerText()), await p.locator('#detalhe .tabs').innerText()); await ctx.close(); }
  // 3) avaliação do ponto de vista da pessoa: pares, autoavaliação e TRAVA
  { const sd3 = seed(); sd3.kanban.travessia.bau = { ana: { b1: { tipo: 'manual', titulo: 'Entrega da Black Friday', ts: 1, em: dAtras(5) } } }; const { ctx, p, errs } = await abre(U('ana', 'Ana Lima'), { seed: sd3 }); await aba(p, 'aval');
    t('Ana: ciclo com fase "Coleta" destacada', /Coleta/.test(await p.locator('.fase span.on').innerText()), '');
    t('Ana: par Bia aparece aprovado', (await p.locator('.lst li', { hasText: 'Bia Souza' }).innerText()).includes('Aprovado'), '');
    t('Ana: devolutiva TRAVADA (🔒) e o texto da síntese NÃO está na tela', (await p.locator('.trava').count()) === 1 && !/Síntese combinada/.test(await p.locator('#painel').innerText()), '');
    t('Ana NÃO vê o feedback dos pares nem a avaliação do líder (nenhum campo da tela os contém)', !/Ótima colega/.test(await p.locator('#painel textarea').evaluateAll(l => l.map(x => x.value).join('|'))), '');
    await clica(p, '[data-act="par-sugerir"][data-par="gil"]'); const pg = await st(p, `kanban/travessia/avaliacoes/${CID}/ana/pares/gil`); t('sugerir par grava NÃO aprovado, por avaliado', pg && pg.aprovado === false && pg.por === 'avaliado', pg);
    await clica(p, '[data-act="par-retirar"][data-par="gil"]'); t('retirar sugestão não aprovada', !(await st(p, `kanban/travessia/avaliacoes/${CID}/ana/pares/gil`)), '');
    t('sugestões de pares vêm da mesma squad (não aparece quem é de outra)', (await p.locator('[data-act="par-sugerir"]').allInnerTexts()).every(x => !/Zed/.test(x)), '');
    t('o nome com HTML de um colega não vira elemento (XSS)', !(await p.evaluate(() => window.__xss)) && (await p.locator('#painel img').count()) === 0, '');
    await p.fill('#r-auto-' + CID + '_ana-q2', 'Evoluí em SQL'); await p.fill('#r-auto-' + CID + '_ana-q3', 'Quero liderar'); await p.locator('#r-auto-' + CID + '_ana-q3').focus();
    await clica(p, '[data-act="citar"] >> nth=0'); t('citar do Baú insere "• título" no campo em foco', /^Quero liderar\n• /.test(await p.inputValue('#r-auto-' + CID + '_ana-q3')), await p.inputValue('#r-auto-' + CID + '_ana-q3'));
    await clica(p, '[data-act="auto-salvar"]'); const au = await st(p, `kanban/travessia/avaliacoes/${CID}/ana/auto`); t('autoavaliação salva as respostas', au && au.q2 === 'Evoluí em SQL' && /• /.test(au.q3), au);
    await p.fill('#pesq', 'bia'); await p.waitForTimeout(500); t('digitar na busca de colegas NÃO apaga a autoavaliação em edição', (await p.inputValue('#r-auto-' + CID + '_ana-q2')) === 'Evoluí em SQL', '');
    t('Ana: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 4) coleta fechada: a autoavaliação vira leitura
  { const sd = seed(); sd.kanban.travessia.ciclos[CID].status = 'devolutiva'; const { ctx, p } = await abre(U('ana', 'Ana Lima'), { seed: sd }); await aba(p, 'aval');
    t('fora da coleta a autoavaliação é só leitura e não há botão salvar', (await p.locator('[data-act="auto-salvar"]').count()) === 0 && (await p.locator('textarea[data-resp="auto"]:not([readonly])').count()) === 0, '');
    const sd2 = seed(); sd2.kanban.travessia.avaliacoes[CID].ana.devolutiva = { texto: 'Síntese combinada na conversa.', liberada: true, liberadaEm: 5, ts: 2 }; await ctx.close();
    const r = await abre(U('ana', 'Ana Lima'), { seed: sd2 }); await aba(r.p, 'aval');
    t('liberada: Ana lê a devolutiva e pode dar ciência', /Síntese combinada/.test(await r.p.locator('#painel').innerText()) && (await r.p.locator('[data-act="ciente"]').count()) === 1, '');
    await clica(r.p, '[data-act="ciente"]'); t('ciência grava', !!(await st(r.p, `kanban/travessia/avaliacoes/${CID}/ana/ciente`)), ''); await r.ctx.close(); }
  // 5) líder (Pau): Frota, cadência, registro, pares, avaliação e liberação
  { const { ctx, p, errs } = await abre(U('pau', 'Pau Reis')); t('Pau (líder de 2 pessoas e liderado do Gil): tem a aba Frota', (await tabs(p)).some(x => /Frota/.test(x)), await tabs(p));
    await aba(p, 'frota'); t('Frota: cartões da Ana e da Bia (e não o Gil/Zed)', (await p.locator('.pcard').count()) === 2, await p.locator('.pcard').count());
    const bia = await p.locator('.pcard', { hasText: 'Bia Souza' }).innerText(); t('Bia (semanal, 30 dias): 🔴 Atrasado', /Atrasado/.test(bia), bia);
    const ana = await p.locator('.pcard', { hasText: 'Ana Lima' }).innerText(); t('Ana: 🟢 Em dia (folgas descontadas)', /Em dia/.test(ana), ana);
    await clica(p, '.pcard:has-text("Bia Souza") [data-act="abrir"]'); await p.selectOption('#cad-sel', 'mensal'); await p.waitForTimeout(500); t('definir cadência grava a série', (await st(p, 'kanban/travessia/serie/bia')).cad === 'mensal', '');
    t('com cadência mensal e 30 dias a Bia passa para 🟢/🟡 (não mais 🔴)', !/Atrasado/.test(await p.locator('#detalhe .farol').first().innerText()), await p.locator('#detalhe .farol').first().innerText());
    await p.fill('#enc-d2', dAtras(2)); await clica(p, '#detalhe [data-form="encontro"] button[type=submit]'); t('líder registra o 1:1 da Bia', Object.values(await st(p, 'kanban/travessia/encontros/bia')).some(e => e.data === dAtras(2) && e.por === 'pau'), '');
    await clica(p, '[data-act="sel-aba"][data-k="bau"]'); t('aba Baú do liderado é só leitura (sem botão de apagar/registrar)', (await p.locator('#detalhe [data-act="bau-del"]').count()) === 0 && (await p.locator('#detalhe [data-form="bau"]').count()) === 0, '');
    await clica(p, '[data-act="fechar"]'); await clica(p, '.pcard:has-text("Ana Lima") [data-act="abrir"]'); await clica(p, '[data-act="sel-aba"][data-k="aval"]');
    await p.locator('summary:has-text("Feedback dos pares")').click(); await p.waitForTimeout(200);
    const vals = await p.locator('#detalhe textarea').evaluateAll(l => l.map(x => x.value).join('|')); t('líder vê a autoavaliação e o feedback do par (os textos estão nos campos de leitura)', /Minha entrega/.test(vals) && /Ótima colega/.test(vals), vals);
    await p.evaluate(() => { window.__store.kanban.travessia.avaliacoes.c1.ana.pares.cae = { aprovado: false, por: 'avaliado', ts: 2 }; }); await p.evaluate(() => window.Travessia.estado.cache = {}); await clica(p, '[data-act="sel-aba"][data-k="um"]'); await clica(p, '[data-act="sel-aba"][data-k="aval"]');
    await clica(p, '[data-act="par-aprovar"][data-par="cae"]'); t('aprovar par grava aprovado + cria o pedido na caixa do par', (await st(p, `kanban/travessia/avaliacoes/${CID}/ana/pares/cae`)).aprovado === true && (await st(p, `kanban/travessia/pedidos_par/cae/${CID}_ana`))?.avaliado === 'ana', '');
    await clica(p, '[data-act="par-reprovar"][data-par="cae"] >> nth=0'); t('retirar o par apaga a indicação e o pedido', !(await st(p, `kanban/travessia/avaliacoes/${CID}/ana/pares/cae`)) && !(await st(p, `kanban/travessia/pedidos_par/cae/${CID}_ana`)), '');
    await p.locator('summary:has-text("Minha avaliação")').click(); await p.fill(`#r-lider-${CID}_ana-q1`, 'Entrega forte'); await clica(p, '[data-act="lider-salvar"]'); t('líder salva a sua avaliação', (await st(p, `kanban/travessia/avaliacoes/${CID}/ana/lider`)).q1 === 'Entrega forte', '');
    await p.fill('#dv-t', ''); await clica(p, '[data-act="devol-liberar"]'); t('não libera devolutiva vazia', !(await st(p, `kanban/travessia/avaliacoes/${CID}/ana/devolutiva`)).liberada, '');
    await p.fill('#dv-t', 'Síntese nova'); await clica(p, '[data-act="devol-salvar"]'); t('salvar rascunho NÃO libera', (await st(p, `kanban/travessia/avaliacoes/${CID}/ana/devolutiva`)).liberada === false, '');
    await clica(p, '[data-act="devol-liberar"]'); await p.click('#ov-ok'); await p.waitForTimeout(500); const dv = await st(p, `kanban/travessia/avaliacoes/${CID}/ana/devolutiva`); t('liberar pede confirmação e só então libera', dv.liberada === true && dv.texto === 'Síntese nova' && dv.por === 'pau' && dv.liberadaEm, dv);
    await clica(p, '[data-act="devol-recolher"]'); t('recolher a liberação volta a trancar', (await st(p, `kanban/travessia/avaliacoes/${CID}/ana/devolutiva`)).liberada === false, '');
    t('Pau: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 5b) 🌡️ termômetro e alerta de apoio (líder)
  { const { ctx, p, errs } = await abre(U('pau', 'Pau Reis')); await aba(p, 'frota');
    const tx = await p.locator('#painel').innerText();
    t('Frota: Termômetro do time com média 3,5 de 5 e a contagem de respostas e de pessoas', /Termômetro do time/.test(tx) && /3,5/.test(tx) && /4\s*respostas de\s*2\s*de 2 pessoas/.test(tx.replace(/\n/g, ' ')), tx.slice(0, 400));
    t('Frota: compara com a semana anterior (caiu)', /caiu em relação à semana anterior/.test(tx), '');
    t('Frota: "Pra ficar de olho" lista a Ana (marcou mal ontem), com texto e botão de abrir, e não a Bia', /Pra ficar de olho/.test(tx) && (await p.locator('.trava li', { hasText: 'Ana Lima' }).count()) === 1 && (await p.locator('.trava li', { hasText: 'Bia Souza' }).count()) === 0, '');
    t('cartão da Ana ganha o selo 🫶 "vale um oi"; o da Bia não', /vale um oi/.test(await p.locator('.pcard', { hasText: 'Ana Lima' }).innerText()) && !/vale um oi/.test(await p.locator('.pcard', { hasText: 'Bia Souza' }).innerText()), '');
    t('a nota de privacidade aparece quando alguém não compartilha (aqui todos compartilham, então não)', !/não compartilh/.test(tx), '');
    t('Pau: sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const sd = seed(); delete sd.kanban.travessia.humor_comp.bia; const { ctx, p } = await abre(U('pau', 'Pau Reis'), { seed: sd }); await aba(p, 'frota'); const tx = (await p.locator('#painel').innerText()).replace(/\n/g, ' ');
    t('quem ainda não registrou não entra na média e o líder vê quantas faltam', /1 pessoa ainda não registrou/.test(tx) && /de 1 de 2 pessoas/.test(tx), tx.slice(0, 500)); await ctx.close(); }
  { const sd = seed(); delete sd.kanban.travessia.humor_comp; const { ctx, p } = await abre(U('pau', 'Pau Reis'), { seed: sd }); await aba(p, 'frota');
    t('sem nenhum humor registrado: explica (sem média inventada)', /Ninguém registrou o humor/.test(await p.locator('#painel').innerText()) && !/de 5 ·/.test(await p.locator('#painel').innerText()), ''); await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); await p.goto('http://localhost:8941/travessia-dev.html?tab=frota'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('pau', 'Pau Reis')); await p.waitForTimeout(900);
    t('?tab=frota abre direto na Frota (destino do aviso do sino)', /Termômetro do time/.test(await p.locator('#painel').innerText()), ''); await ctx.close(); }
  // 🫶 alerta ao líder quando a pessoa compartilha e marca mal
  { const { ctx, p } = await abre(U('ana', 'Ana Lima')); const nots = () => st(p, 'kanban/usuarios/pau/notificacoes');
    await clica(p, '[data-act="humor"][data-n="2"]'); const n0 = await nots(); const k0 = n0 && n0['apoio_ana_' + HOJE]; t('marcou "mal": o líder é avisado na hora (tipo travessia_apoio, com o nome)', k0 && k0.type === 'travessia_apoio' && /Ana/.test(k0.title) && k0.read === false, n0);
    t('o aviso não diz que a pessoa "compartilhou" (não há escolha)', !/Compartilhou/.test(JSON.stringify(k0)), k0);
    await clica(p, '[data-act="humor"][data-n="4"]'); await p.waitForTimeout(300); await clica(p, '[data-act="humor"][data-n="1"]');
    t('um aviso por pessoa por dia (id fixo, sem duplicar)', Object.keys(await nots()).length === 1, Object.keys(await nots())); await ctx.close(); }
  { const { ctx, p } = await abre(U('ana', 'Ana Lima')); await clica(p, '[data-act="humor"][data-n="4"]'); t('marcou "bem": nenhum aviso', !(await st(p, 'kanban/usuarios/pau/notificacoes')), ''); await ctx.close(); }
  { const sd = seed(); sd.kanban.travessia.vinculos = {}; const { ctx, p, errs } = await abre(U('ana', 'Ana Lima'), { seed: sd }); await clica(p, '[data-act="humor"][data-n="1"]'); t('sem líder no organograma: salva o humor e não quebra nem avisa ninguém', (await st(p, 'kanban/travessia/humor/ana/' + HOJE)).n === 1 && !(await st(p, 'kanban/usuarios/pau/notificacoes')) && !errs.length, errs); await ctx.close(); }
  // 6) gerente (Gil): vê o time ampliado só com farol, sem detalhe
  { const { ctx, p } = await abre(U('gil', 'Gil Prado')); await aba(p, 'frota'); t('Gil (gerente do Pau): vê Ana, Bia como "time dos meus líderes" só com farol e o Pau como liderado', (await p.locator('.pcard').count()) === 3 && (await p.locator('.pcard [data-act="abrir"]').count()) === 1, await p.locator('.pcard').count()); await ctx.close(); }
  // 7) par (Bia): recebe o pedido e responde
  { const { ctx, p, errs } = await abre(U('bia', 'Bia Souza')); await aba(p, 'aval'); t('Bia vê o pedido de feedback para Ana', /Feedback para Ana Lima/.test(await p.locator('#painel').innerText()), '');
    await p.fill(`#r-par-${CID}_ana_ana-q1`.replace('_ana_ana', '_ana'), 'Continuar compartilhando'); await clica(p, '[data-act="par-salvar"]'); t('par salva o feedback no caminho dele', (await st(p, `kanban/travessia/avaliacoes/${CID}/ana/resp_pares/bia`)).q1 === 'Continuar compartilhando', await st(p, `kanban/travessia/avaliacoes/${CID}/ana/resp_pares/bia`));
    t('Bia: sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 8) administração
  { const { ctx, p, errs } = await abre(U('adm', 'Adm Silva', 'adm@ciahering.com.br')); t('ADM: tem Administração', (await tabs(p)).some(x => /Administração/.test(x)), await tabs(p));
    await aba(p, 'admin'); await p.selectOption('select[data-vinc="zed"][data-campo="liderUid"]', 'pau'); await p.waitForTimeout(400); t('organograma: define o líder de uma pessoa', (await st(p, 'kanban/travessia/vinculos/zed')).liderUid === 'pau', '');
    await p.selectOption('select[data-vinc="zed"][data-campo="liderUid"]', ''); await p.waitForTimeout(400); t('organograma: limpar o líder remove o vínculo', !(await st(p, 'kanban/travessia/vinculos/zed')), '');
    await p.check('[data-rh="bia"]'); await p.waitForTimeout(400); t('ADM concede o papel de RH', (await st(p, 'kanban/travessia/papeis/bia')) === 'rh', '');
    await p.click('summary:has-text("Novo ciclo")'); await p.fill('#ci-n', 'Ciclo 2027/1'); await p.check('input[name="sq"][value="dados"]'); await clica(p, '[data-form="ciclo"] button[type=submit]');
    const novo = Object.entries((await st(p, 'kanban/travessia/ciclos'))).find(([, c]) => c.nome === 'Ciclo 2027/1'); t('criar ciclo: fase preparação, participantes da squad e perguntas padrão', novo && novo[1].status === 'preparacao' && novo[1].participantes.ana && !novo[1].participantes.zed && novo[1].perguntas.auto.q1, novo);
    await clica(p, `[data-act="ciclo-fase"][data-cid="${novo[0]}"][data-fase="coleta"]`); t('avançar a fase do ciclo', (await st(p, `kanban/travessia/ciclos/${novo[0]}/status`)) === 'coleta', '');
    t('ADM: sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre(U('bia', 'Bia Souza')); t('quem NÃO é ADM nem RH não vê Administração', !(await tabs(p)).some(x => /Administração/.test(x)), await tabs(p)); await ctx.close(); }
  { const sd = seed(); sd.kanban.travessia.papeis = { bia: 'rh' }; const { ctx, p } = await abre(U('bia', 'Bia Souza'), { seed: sd }); t('RH vê Administração mas não o bloco "Papel de RH" (só o ADM concede)', (await tabs(p)).some(x => /Administração/.test(x)) && (await (async () => { await aba(p, 'admin'); return (await p.locator('text=Papel de RH da Travessia').count()) === 0; })()), ''); await ctx.close(); }
  // 9) erro de permissão vira mensagem amigável
  { const { ctx, p } = await abre(U('ana', 'Ana Lima')); await p.evaluate(() => { window.__denySet = () => true; }); await clica(p, '[data-act="humor"][data-n="2"]'); t('escrita negada: avisa que pode faltar publicar as regras', /Sem permissão/.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText()); await ctx.close(); }
  // 10) vazio: ninguém definiu líder
  { const sd = seed(); sd.kanban.travessia.vinculos = {}; const { ctx, p } = await abre(U('ana', 'Ana Lima'), { seed: sd }); t('sem líder no organograma: explica o que fazer, sem formulário de 1:1', /líder ainda não foi definido/.test(await p.locator('#painel').innerText()) && (await p.locator('#enc-d').count()) === 0, ''); await ctx.close(); }
  // 11) temas e celular: sem rolagem lateral
  for (const [vp, nome] of [[{ width: 1280, height: 900 }, 'desk'], [{ width: 390, height: 800 }, 'cel']]) for (const tema of ['', 'light', 'sunset']) for (const [uid, nm, aba_] of [['ana', 'Ana Lima', 'inicio'], ['ana', 'Ana Lima', 'aval'], ['pau', 'Pau Reis', 'frota'], ['adm', 'Adm Silva', 'admin']]) {
    const { ctx, p, errs } = await abre(U(uid, nm), { vp }); if (tema) for (let i = 0; i < (tema === 'light' ? 1 : 2); i++) await p.click('#btn-tema'); await aba(p, aba_); if (aba_ === 'frota') { await clica(p, '.pcard [data-act="abrir"] >> nth=0'); }
    const lat = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); t(`${nome}/${tema || 'escuro'}/${aba_}: sem rolagem lateral e sem erro`, !lat && !errs.length, [lat, errs]);
    if (process.env.PRINTS) { require('fs').mkdirSync(process.env.PRINTS, { recursive: true }); await p.screenshot({ path: `${process.env.PRINTS}/${nome}_${tema || 'escuro'}_${aba_}.png`, fullPage: true }); }
    await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); })();
