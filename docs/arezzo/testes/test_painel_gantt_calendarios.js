// 📊 Painel → ⚙ Configurações → 📊 Gantt (13/11/2026): o ADM envia o .xlsx do Calendário de Marca e do Comercial Digital,
// vê a prévia (novas / mudaram / saem) e publica em kanban/calendarios_gantt_dev/{marca|comercial}. Planilhas SINTÉTICAS (xlsx_sintetico.js).
// Servir a raiz em BASE_URL; node docs/arezzo/testes/test_painel_gantt_calendarios.js
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const home = os.homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb'); const X = require('./xlsx_sintetico');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const PAGE = process.env.PAGE || 'painel-dev.html'; const NO = 'calendarios_gantt' + (/-dev\.html$/.test(PAGE) ? '_dev' : '');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gantt-xlsx-'));
const arq = (nome, abas) => { const p = path.join(tmp, nome); fs.writeFileSync(p, X.xlsx(abas)); return p; };

const MARCA = arq('Calendário de Campanhas 2026.xlsx', [
  { nome: 'LINK ANOS ANTERIORES', celulas: { '2,2': 'BACKUP 2025' } },
  X.marca(2026, [
    { r: 4, rot: 'COLEÇÃO SELLOUT', barras: [['2026-07-16', '2026-11-04', 'COLEÇÃO TESTE A'], ['2026-11-05', '2026-12-31', 'COLEÇÃO TESTE B']] },
    { r: 7, rot: 'WEB', barras: [['2026-04-16', '2026-05-10', 'DIA DAS MÃES'], ['2026-07-16', '2026-08-09', 'DIA DOS PAIS'], ['2026-10-31', '2026-11-30', 'BLACK FRIDAY']] },
    { r: 9, rot: '2a ATIVAÇÃO (LOJAS + WEB)', barras: [['2026-03-06', '2026-03-15', 'SEMANA DO CONSUMIDOR']] },
    { r: 11, rot: 'ACELERADORES WEB', barras: [['2026-05-26', '2026-06-05', 'ACELERADOR TESTE']] },
    { r: 12, rot: 'EXCLUSIVO WEB', barras: [['2026-02-01', '2026-02-10', 'NÃO ENTRA']] },
    { r: 18, rot: 'REDE SOCIAIS | HERING', barras: [['2026-11-27', '2026-11-29', 'BLACK FRIDAY'], ['2026-11-10', '2026-11-17', '<img src=x onerror="window.__xss=1"> CAMPANHA TESTE']] },
    { r: 24, rot: 'CANAIS INTIMATES (SITE E CRM)', barras: [['2026-11-01', '2026-11-20', 'COLEÇÃO INTIMATES TESTE']] },
    { r: 26, rot: 'CANAIS SPORTS (SITE E CRM)', barras: [['2026-11-03', '2026-11-25', 'COLEÇÃO SPORTS TESTE']] },
    { r: 27, rot: 'REDE SOCIAIS | SPORTS', barras: [['2026-01-15', '2026-01-30', 'SPORTS NÃO ENTRA']] },
  ]),
  X.marca(2026, [
    { r: 4, rot: 'COLEÇÃO SELLOUT', barras: [['2026-10-16', '2026-12-31', 'KIDS COLEÇÃO TESTE']] },
    { r: 6, rot: 'WEB', barras: [['2026-11-01', '2026-12-01', 'BLACK FRIDAY']] },
    { r: 8, rot: '2a ATIVAÇÃO (LOJAS + WEB)', barras: [['2026-10-25', '2026-10-31', 'KIDS NÃO ENTRA']] },
    { r: 15, rot: 'REDES SOCIAIS | KIDS', barras: [['2026-11-05', '2026-11-12', 'KIDS REDES TESTE']] },
  ], 'KIDS 2026', 46023),
]);
const novSemanas = [
  [[1, null, [5], 'FERIADO'], [6, 'Ação App', [1, 2], 'APP VIRADA DO MÊS'], [2, 'SITE TODO - Não remarcados', [6, 7], 'AÇÃO SITE TESTE'], [4, 'SITE - TODO SALDOS', [1, 2, 3, 4, 5, 6, 7], 'OFERTA FICTÍCIA A'], [8, 'CRM', [2, 3], 'AÇÃO CRM TESTE']],
  [[4, 'SITE - TODO SALDOS', [8, 9], 'OFERTA FICTÍCIA A'], [1, null, [12], '12h - LANÇAMENTO TESTE']],
  [],
  [[4, 'SITE - TODO SALDOS', [27, 28], 'OFERTA FICTÍCIA B']],   // 4ª semana de nov/2026 (22–28)
];
const DEZ26 = () => X.comercialMes('Dez26', 2026, 12, [[[2, 'SITE E APP TODO - Não remarcados', [1, 2], 'AÇÃO SITE E APP TESTE'], [4, 'SITE E APP - TODO SALDOS', [3], 'SALDO SITE E APP TESTE'], [6, 'APP E SITE PROMO', [4], 'RÓTULO DESCONHECIDO TESTE']]]);
const COM = arq('Calendário Comercial Hering.xlsx', [
  X.comercialMes('Nov25', 2025, 11, [[[4, 'SITE - TODO SALDOS', [3], 'ANO VELHO NÃO ENTRA']]]),
  X.comercialMes('Out26', 2026, 10, [[[4, 'SITE - TODO SALDOS', [1, 2, 3], 'AÇÃO OUTUBRO TESTE']], [[2, 'MÍDIA', [5], 'MÍDIA TESTE']], [], [], [[6, 'Ação App', [30, 31], 'APP VIRADA DO MÊS']]]),
  X.comercialMes('Nov26', 2026, 11, novSemanas, { '71,4': '*Cupom Mensal Para CRM - nota de rodapé' }),
  // Dez26 já com os nomes NOVOS do time ("Site e App") e um rótulo que o leitor não conhece
  DEZ26(),
  X.comercialMes('Jun26. RASCUNHO n considerar', 2026, 6, [[[4, 'SITE - TODO SALDOS', [3], 'RASCUNHO NÃO ENTRA']]]),
  Object.assign(X.comercialMes('Dez26 oculta', 2026, 12, [[[4, 'SITE - TODO SALDOS', [3], 'OCULTA NÃO ENTRA']]]), { oculta: true }),
]);
// 2º envio do Comercial: a planilha inteira de novo (é assim que o time mantém), com a oferta da 4ª semana estendida até 30/11
// e o feriado removido. Troca o calendário todo: outubro continua porque está no arquivo.
const COM2 = arq('Calendário Comercial Hering (v2).xlsx', [
  X.comercialMes('Out26', 2026, 10, [[[4, 'SITE - TODO SALDOS', [1, 2, 3], 'AÇÃO OUTUBRO TESTE']], [[2, 'MÍDIA', [5], 'MÍDIA TESTE']], [], [], [[6, 'Ação App', [30, 31], 'APP VIRADA DO MÊS']]]),
  X.comercialMes('Nov26', 2026, 11, [novSemanas[0].filter(x => x[3] !== 'FERIADO'), novSemanas[1], [], novSemanas[3], [[4, 'SITE - TODO SALDOS', [29, 30], 'OFERTA FICTÍCIA B']]]),
  DEZ26(),
]);
// Marketplace: NOVEMBRO 26 (visível) + Outubro 26 (oculta, entra) + abas que ficam de fora
const novMkt = X.mktMes('NOVEMBRO 26', 2026, 11, [
  { r: 23, rot: 'AMAZON', ate: 25, barras: [[23, 3, 30, 'AMAZON OFERTA TESTE'], [24, 11, 11, 'AMAZON DIA TESTE']] },
  { r: 26, rot: 'MELI  + FULL', ate: 28, barras: [[26, 1, 9, 'MELI CUPOM TESTE'], [28, 5, 5, 'MELI ESTOQUE TESTE']] },
  { r: 30, rot: 'TIKTOKSHOP', ate: 31, barras: [[31, 10, 10, 'TIKTOK LIVE TESTE']] },
  { r: 34, rot: 'SHOPEE', ate: 34, barras: [[34, 1, 30, 'SHOPEE KITS TESTE']] },
], { celulas: { '33,45': 'SOBRA FORA DA MESCLA NÃO ENTRA', '60,40': 45962, '60,41': 'Sábado', '60,43': 'TABELA SOLTA NÃO ENTRA' } });
const MKT = arq('Calendário Mktplace + Rede de Campanhas.xlsx', [
  { nome: 'Mktplace Resumo', celulas: { '1,1': 'RESUMO NÃO ENTRA' } },
  novMkt,
  X.mktMes('Outubro 26', 2026, 10, [{ r: 23, rot: 'AMAZON', ate: 23, barras: [[23, 25, 31, 'AMAZON OUTUBRO TESTE']] }], { oculta: true }),
  X.mktMes('NOVEMBRO BF', 2026, 11, [{ r: 23, rot: 'AMAZON', ate: 23, barras: [[23, 1, 2, 'BF NÃO ENTRA']] }]),
  X.mktMes('Julho provisório', 2026, 7, [{ r: 23, rot: 'AMAZON', ate: 23, barras: [[23, 1, 2, 'PROVISÓRIO NÃO ENTRA']] }]),
]);
// Outlet: 1 planilha por mês
const OUT_NOV = arq('Outlet | Calendário Novembro 2026.xlsx', X.outletMes(2026, 11, { 'AÇÃO PRINCIPAL': [[1, 4, 'OUTLET PRINCIPAL A'], [5, 6, 'OUTLET PRINCIPAL B']], 'AÇÃO DA MADRUGADA': [[10, 10, 'MADRUGADA TESTE']] }));
const OUT_DEZ = arq('Outlet | Calendário Dezembro 2026.xlsx', X.outletMes(2026, 12, { 'AÇÃO PRINCIPAL': [[1, 10, 'OUTLET DEZEMBRO']] }));
const OUT_NOV2 = arq('calendario-sem-mes-no-nome.xlsx', X.outletMes(2026, 11, { 'AÇÃO PRINCIPAL': [[1, 4, 'OUTLET PRINCIPAL A'], [5, 8, 'OUTLET PRINCIPAL B']], 'AÇÕES MÍDIA 02': [[20, 22, 'MÍDIA TESTE']] }, true));
const LIXO = arq('nao-e-planilha.xlsx', []); fs.writeFileSync(LIXO, 'isto não é um zip');

const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = adm => ({ kanban: { squads_meta: { dados: { id: 'dados', label: 'Squad Dados', icon: '📊' } }, usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: U.email, inscrito: true, init: 'AA', role: adm ? 'adm' : 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: adm ? [U.email] : [] } } });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async (vp, adm = true) => {
    const ctx = await b.newContext({ viewport: vp }); await fake.install(ctx, seed(adm)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => openCfg(SQUADS[0].id)); await p.waitForTimeout(200);   // caminho real: ⚙ de uma squad → aba 📊 Gantt
    await p.click('#pcfg-tab-gantt'); await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  const envia = async (p, cal, arquivo) => { await p.setInputFiles(`#pcfg-gantt-cards input[data-cal="${cal}"]`, arquivo); await p.waitForFunction(c => !!document.querySelector(`.pg-card[data-cal="${c}"] .pg-pv:not(.pg-pv-lendo)`), cal); };
  const pv = (p, cal) => p.evaluate(c => { const e = document.querySelector(`.pg-card[data-cal="${c}"] .pg-pv`); return e ? e.innerText : ''; }, cal);
  const store = (p, cal) => p.evaluate(([n, c]) => JSON.parse(JSON.stringify((window.__store.kanban[n] || {})[c] || null)), [NO, cal]);

  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 });
    t('A. aba 📊 Gantt nas Configurações, com os quatro calendários (Marca, Comercial Hering, Marketplace, Outlet)', await p.evaluate(() => document.querySelectorAll('#pcfg-gantt-cards .pg-card').length === 4 && /Comercial Outlet/.test(document.getElementById('pcfg-gantt-cards').innerText) && /Comercial Hering/.test(document.getElementById('pcfg-gantt-cards').innerText) && /Comercial Marketplace/.test(document.getElementById('pcfg-gantt-cards').innerText) && /Ainda não publicado/.test(document.getElementById('pcfg-gantt-cards').innerText)));
    await envia(p, 'marca', MARCA); let txt = await pv(p, 'marca');
    t('B. Marca: prévia com as linhas certas da HERING (sellout 2, web 3, redes 2, Canais Intimates 1, Canais Sports 1) e da KIDS (sellout, web, redes 1 cada)', /^Coleção sellout 2/m.test(txt) && / Web 3/.test(txt) && / Redes sociais 2/.test(txt) && /Canais Intimates \(site e CRM\) 1/.test(txt) && /Canais Sports \(site e CRM\) 1/.test(txt) && /Kids · Coleção sellout 1/.test(txt) && /Kids · Web 1/.test(txt) && /Kids · Redes sociais 1/.test(txt) && /＋ 12 novas/.test(txt), txt);
    t('C. Marca: não entram ACELERADORES WEB, EXCLUSIVO WEB, 2a ATIVAÇÃO (nem a da KIDS) e REDES | SPORTS', !/ACELERADOR|NÃO ENTRA|CONSUMIDOR/.test(txt), txt);
    await p.click('.pg-card[data-cal="marca"] .btn-p'); await p.waitForTimeout(300);
    const m = await store(p, 'marca'); const bs = Object.values(m.barras);
    const acha = (lin, txtRe) => bs.find(x => x.linha === lin && txtRe.test(x.txt));
    t('D. Marca publicada no nó ' + NO + '/marca com meta, linhas e barras', !!m && m.meta.porNome === 'Ana ADM' && /Campanhas/.test(m.meta.arquivo) && Object.keys(m.linhas).join() === 'sellout,web,redes,intimates,sports,kids_sellout,kids_web,kids_redes' && bs.length === 12, m && m.meta);
    t('D2. aba KIDS com a data no cabeçalho (em vez de "JANEIRO"): datas certas — Black Friday Kids 01/11–01/12', acha('kids_web', /BLACK/).ini === '2026-11-01' && acha('kids_web', /BLACK/).fim === '2026-12-01' && acha('kids_redes', /REDES TESTE/).fim === '2026-11-12', bs.filter(x => /^kids/.test(x.linha)));
    const hm = await p.evaluate(n => Object.values(((window.__store.kanban[n.replace('calendarios_gantt', 'calendarios_gantt_hist')] || {}).marca) || {}), NO);
    t('D2. publicar pelo Painel também entra no 🕘 Histórico (com cópia)', hm.length === 1 && hm[0].acao === 'publicou' && hm[0].porNome === 'Ana ADM' && hm[0].n === 12, hm);
    t('E. datas certas (âncora na linha dos dias, não no cabeçalho adiantado): Mães até 10/05, Pais até 09/08, BF web 31/10–30/11, BF redes 27–29/11',
      acha('web', /MÃES/).fim === '2026-05-10' && acha('web', /PAIS/).fim === '2026-08-09' && acha('web', /BLACK/).ini === '2026-10-31' && acha('web', /BLACK/).fim === '2026-11-30' && acha('redes', /BLACK/).ini === '2026-11-27' && acha('redes', /BLACK/).fim === '2026-11-29', bs);
    t('F. o texto da planilha vira só texto (nada executa na prévia)', await p.evaluate(() => !window.__xss));
    // reenviar o mesmo arquivo: nada muda
    await envia(p, 'marca', MARCA); txt = await pv(p, 'marca');
    t('G. reenviar o mesmo arquivo: "Nada mudou" e o Publicar fica desligado', /Nada mudou/.test(txt) && await p.evaluate(() => document.querySelector('.pg-card[data-cal="marca"] .btn-p').disabled), txt);
    await p.click('.pg-card[data-cal="marca"] .err-filter-btn:not(label)');
    // Comercial
    await envia(p, 'comercial', COM); txt = await pv(p, 'comercial');
    t('H. Comercial: só 2026 (Out, Nov, Dez); fora rascunho, aba oculta e 2025', /3 abas de mês/.test(txt) && !/NÃO ENTRA/.test(txt), txt);
    t('H2. rótulo da coluna B que o leitor não conhece aparece como aviso na prévia (com a aba)', /Rótulos da coluna B que não reconheci.*APP E SITE PROMO \(Dez26\)/.test(txt), txt);
    await p.click('.pg-card[data-cal="comercial"] .btn-p'); await p.waitForTimeout(300);
    const c = await store(p, 'comercial'); const cb = Object.values(c.barras);
    const um = re => cb.filter(x => re.test(x.txt));
    t('I. dias seguidos viram 1 barra, até virando a semana: OFERTA FICTÍCIA A 01–09/11', um(/OFERTA FICTÍCIA A/).length === 1 && um(/OFERTA FICTÍCIA A/)[0].ini === '2026-11-01' && um(/OFERTA FICTÍCIA A/)[0].fim === '2026-11-09', um(/OFERTA FICTÍCIA A/));
    t('J. linhas: lançamentos (FERIADO, 12h LANÇAMENTO) antes do 1º rótulo; site, saldos, CRM, mídia', ['lancamentos', 'site', 'saldos', 'crm', 'midia'].every(k => c.linhas[k]) && um(/FERIADO/)[0].linha === 'lancamentos' && um(/LANÇAMENTO TESTE/)[0].linha === 'lancamentos' && um(/AÇÃO CRM TESTE/)[0].linha === 'crm', c.linhas);
    t('J2. oferta da 4ª semana 27–28/11 na linha de saldos', um(/OFERTA FICTÍCIA B/).length === 1 && um(/OFERTA FICTÍCIA B/)[0].ini === '2026-11-27' && um(/OFERTA FICTÍCIA B/)[0].fim === '2026-11-28', um(/OFERTA FICTÍCIA B/));
    t('J3. barra que atravessa a virada do mês (30/10 → 02/11, abas diferentes) vira 1 barra só', um(/APP VIRADA/).length === 1 && um(/APP VIRADA/)[0].ini === '2026-10-30' && um(/APP VIRADA/)[0].fim === '2026-11-02' && um(/APP VIRADA/)[0].linha === 'app', um(/APP VIRADA/));
    t('J4. nomes NOVOS da planilha ("SITE E APP TODO", "SITE E APP - TODO SALDOS") caem em site e saldos', um(/AÇÃO SITE E APP TESTE/)[0].linha === 'site' && um(/SALDO SITE E APP TESTE/)[0].linha === 'saldos', [um(/SITE E APP/)]);
    t('K. nota de rodapé do mês não vira barra no último dia', !um(/rodapé/).length, um(/rodapé/));
    // 2º envio: só novembro
    await envia(p, 'comercial', COM2); txt = await pv(p, 'comercial');
    t('L. 2º envio (planilha inteira): prévia mostra a oferta que mudou e o feriado que sai', /✎ 1 mudaram/.test(txt) && /− 1 saem/.test(txt) && /FERIADO/.test(txt), txt);
    await p.click('.pg-card[data-cal="comercial"] .btn-p'); await p.waitForTimeout(300);
    const c2 = Object.values((await store(p, 'comercial')).barras);
    const vira = c2.filter(x => /APP VIRADA/.test(x.txt));
    t('M. depois do 2º envio: outubro segue, a oferta vai até 30/11, o feriado saiu e a barra da virada do mês continua 1 só (sem duplicar)', c2.some(x => /AÇÃO OUTUBRO TESTE/.test(x.txt)) && c2.find(x => /OFERTA FICTÍCIA B/.test(x.txt)).fim === '2026-11-30' && !c2.some(x => /FERIADO/.test(x.txt)) && vira.length === 1 && vira[0].fim === '2026-11-02', c2.map(x => x.txt + ' ' + x.ini + '→' + x.fim));
    // Marketplace
    await envia(p, 'mktplace', MKT); txt = await pv(p, 'mktplace');
    t('M2. Marketplace: só abas de MÊS (NOVEMBRO 26 + Outubro 26 oculta); fora BF, provisório e resumo', /2 abas de mês/.test(txt) && !/NÃO ENTRA/.test(txt), txt);
    await p.click('.pg-card[data-cal="mktplace"] .btn-p'); await p.waitForTimeout(300);
    const mk = await store(p, 'mktplace'); const mb = Object.values(mk.barras); const um2 = re => mb.filter(x => re.test(x.txt));
    t('M3. bloco do mês no fim da linha 1 ("Novembro 2026"): datas certas e barra mesclada 03→30/11', um2(/AMAZON OFERTA/)[0].ini === '2026-11-03' && um2(/AMAZON OFERTA/)[0].fim === '2026-11-30' && um2(/AMAZON OUTUBRO/)[0].ini === '2026-10-25' && um2(/AMAZON OUTUBRO/)[0].fim === '2026-10-31', mb);
    t('M4. sublinhas pela mescla do rótulo: Amazon (2), Meli+Full, TikTok (sublinha), Shopee', um2(/AMAZON DIA/)[0].linha === 'mkt_amazon' && um2(/MELI ESTOQUE/)[0].linha === 'mkt_meli' && um2(/TIKTOK LIVE/)[0].linha === 'mkt_tiktok' && um2(/SHOPEE KITS/)[0].linha === 'mkt_shopee', mb.map(x => x.linha + ':' + x.txt));
    t('M5. NÃO entram: bloco antigo copiado, Web da marca, linha fora da mescla, tabela solta de baixo', !mb.some(x => /NÃO ENTRA/.test(x.txt)) && mb.length === 7, mb.map(x => x.txt));
    // Outlet: mês a mês
    await envia(p, 'outlet', OUT_NOV); txt = await pv(p, 'outlet');
    t('O1. Outlet novembro: linhas pelo cabeçalho (Ação principal, Ação da madrugada); fora métricas (Meta, Margem)', /Ação principal 2/.test(txt) && /Ação da madrugada 1/.test(txt) && !/MARGEM|Meta captado/i.test(txt), txt);
    await p.click('.pg-card[data-cal="outlet"] .btn-p'); await p.waitForTimeout(300);
    await envia(p, 'outlet', OUT_DEZ); txt = await pv(p, 'outlet');
    t('O2. dezembro depois: prévia diz que NADA de novembro sai (só entra dezembro)', /＋ 1 novas/.test(txt) && /− 0 saem/.test(txt), txt);
    await p.click('.pg-card[data-cal="outlet"] .btn-p'); await p.waitForTimeout(300);
    let ob = Object.values((await store(p, 'outlet')).barras);
    t('O3. depois de dezembro, novembro continua publicado (só criou mais um mês)', ob.some(x => /PRINCIPAL A/.test(x.txt) && x.ini === '2026-11-01' && x.fim === '2026-11-04') && ob.some(x => /DEZEMBRO/.test(x.txt) && x.ini === '2026-12-01' && x.fim === '2026-12-10'), ob.map(x => x.ini + ' ' + x.txt));
    await envia(p, 'outlet', OUT_NOV2); txt = await pv(p, 'outlet');
    t('O4. novembro de novo, SEM o mês no nome do arquivo: descobre pelas datas e troca só novembro (madrugada sai, B muda, mídia entra)', /＋ 1 novas/.test(txt) && /✎ 1 mudaram/.test(txt) && /− 1 saem/.test(txt), txt);
    await p.click('.pg-card[data-cal="outlet"] .btn-p'); await p.waitForTimeout(300);
    ob = Object.values((await store(p, 'outlet')).barras);
    t('O5. dezembro intocado; novembro atualizado', ob.some(x => /DEZEMBRO/.test(x.txt)) && ob.find(x => /PRINCIPAL B/.test(x.txt)).fim === '2026-11-08' && !ob.some(x => /MADRUGADA TESTE/.test(x.txt)) && ob.some(x => /MÍDIA TESTE/.test(x.txt)), ob.map(x => x.ini + '→' + x.fim + ' ' + x.txt));
    // arquivo inválido
    await envia(p, 'marca', LIXO); txt = await pv(p, 'marca');
    t('N. arquivo que não é planilha: erro claro, sem publicar', /não parece um arquivo \.xlsx/i.test(txt) && !await p.evaluate(() => !!document.querySelector('.pg-card[data-cal="marca"] .btn-p')), txt);
    t('O. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  { const { ctx, p } = await abre({ width: 390, height: 800 });
    await envia(p, 'marca', MARCA);
    t('P. celular 390 px: sem rolagem lateral na aba, botão Publicar alcançável', await p.evaluate(() => { const pn = document.querySelector('.cfg-body'); const bt = document.querySelector('.pg-card[data-cal="marca"] .btn-p').getBoundingClientRect(); return pn.scrollWidth <= pn.clientWidth + 1 && bt.right <= innerWidth && bt.height >= 36; }));
    await ctx.close(); }
  { const { ctx, p } = await abre({ width: 1280, height: 900 }, false);
    t('Q. quem não é ADM também envia (13/11: a atualização é de todo mundo da Hering; o histórico guarda quem)', await p.evaluate(() => !/Só ADM/.test(document.getElementById('pcfg-gantt-cards').innerText) && document.querySelectorAll('#pcfg-gantt-cards input[type=file]').length === 4));
    await ctx.close(); }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
