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
    { r: 27, rot: 'REDE SOCIAIS | SPORTS', barras: [['2026-01-15', '2026-01-30', 'SPORTS NÃO ENTRA']] },
  ]),
  { nome: 'KIDS 2026', celulas: { '4,1': 'COLEÇÃO SELLOUT', '4,9': 'KIDS NÃO ENTRA' } },
]);
const novSemanas = [
  [[1, null, [5], 'FERIADO'], [6, 'Ação App', [1, 2], 'APP VIRADA DO MÊS'], [2, 'SITE TODO - Não remarcados', [6, 7], 'AÇÃO SITE TESTE'], [4, 'SITE - TODO SALDOS', [1, 2, 3, 4, 5, 6, 7], 'OFERTA FICTÍCIA A'], [8, 'CRM', [2, 3], 'AÇÃO CRM TESTE']],
  [[4, 'SITE - TODO SALDOS', [8, 9], 'OFERTA FICTÍCIA A'], [1, null, [12], '12h - LANÇAMENTO TESTE']],
  [],
  [[4, 'SITE - TODO SALDOS', [27, 28], 'OFERTA FICTÍCIA B']],   // 4ª semana de nov/2026 (22–28)
];
const COM = arq('Calendário Comercial Hering.xlsx', [
  X.comercialMes('Nov25', 2025, 11, [[[4, 'SITE - TODO SALDOS', [3], 'ANO VELHO NÃO ENTRA']]]),
  X.comercialMes('Out26', 2026, 10, [[[4, 'SITE - TODO SALDOS', [1, 2, 3], 'AÇÃO OUTUBRO TESTE']], [[2, 'MÍDIA', [5], 'MÍDIA TESTE']], [], [], [[6, 'Ação App', [30, 31], 'APP VIRADA DO MÊS']]]),
  X.comercialMes('Nov26', 2026, 11, novSemanas, { '71,4': '*Cupom Mensal Para CRM - nota de rodapé' }),
  X.comercialMes('Jun26. RASCUNHO n considerar', 2026, 6, [[[4, 'SITE - TODO SALDOS', [3], 'RASCUNHO NÃO ENTRA']]]),
  Object.assign(X.comercialMes('Dez26 oculta', 2026, 12, [[[4, 'SITE - TODO SALDOS', [3], 'OCULTA NÃO ENTRA']]]), { oculta: true }),
]);
// 2º envio do Comercial: a planilha inteira de novo (é assim que o time mantém), com a oferta da 4ª semana estendida até 30/11
// e o feriado removido. Troca o calendário todo: outubro continua porque está no arquivo.
const COM2 = arq('Calendário Comercial Hering (v2).xlsx', [
  X.comercialMes('Out26', 2026, 10, [[[4, 'SITE - TODO SALDOS', [1, 2, 3], 'AÇÃO OUTUBRO TESTE']], [[2, 'MÍDIA', [5], 'MÍDIA TESTE']], [], [], [[6, 'Ação App', [30, 31], 'APP VIRADA DO MÊS']]]),
  X.comercialMes('Nov26', 2026, 11, [novSemanas[0].filter(x => x[3] !== 'FERIADO'), novSemanas[1], [], novSemanas[3], [[4, 'SITE - TODO SALDOS', [29, 30], 'OFERTA FICTÍCIA B']]]),
]);
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
  const envia = async (p, cal, arquivo) => { await p.setInputFiles(`#pcfg-gantt-cards input[data-cal="${cal}"]`, arquivo); await p.waitForFunction(c => !!document.querySelector(`.pg-card[data-cal="${c}"] .pg-pv`), cal); };
  const pv = (p, cal) => p.evaluate(c => { const e = document.querySelector(`.pg-card[data-cal="${c}"] .pg-pv`); return e ? e.innerText : ''; }, cal);
  const store = (p, cal) => p.evaluate(([n, c]) => JSON.parse(JSON.stringify((window.__store.kanban[n] || {})[c] || null)), [NO, cal]);

  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 });
    t('A. aba 📊 Gantt nas Configurações, com os dois calendários', await p.evaluate(() => document.querySelectorAll('#pcfg-gantt-cards .pg-card').length === 2 && /Ainda não publicado/.test(document.getElementById('pcfg-gantt-cards').innerText)));
    await envia(p, 'marca', MARCA); let txt = await pv(p, 'marca');
    t('B. Marca: prévia com as 3 linhas certas (sellout 2, web 3, redes 2) e tudo como "novas"', /Coleção sellout 2/.test(txt) && /Web 3/.test(txt) && /Redes sociais 2/.test(txt) && /＋ 7 novas/.test(txt), txt);
    t('C. Marca: não entram ACELERADORES WEB, EXCLUSIVO WEB, 2a ATIVAÇÃO, REDES | SPORTS nem a aba KIDS', !/ACELERADOR|NÃO ENTRA|CONSUMIDOR/.test(txt), txt);
    await p.click('.pg-card[data-cal="marca"] .btn-p'); await p.waitForTimeout(300);
    const m = await store(p, 'marca'); const bs = Object.values(m.barras);
    const acha = (lin, txtRe) => bs.find(x => x.linha === lin && txtRe.test(x.txt));
    t('D. Marca publicada no nó ' + NO + '/marca com meta, linhas e barras', !!m && m.meta.porNome === 'Ana ADM' && /Campanhas/.test(m.meta.arquivo) && Object.keys(m.linhas).join() === 'sellout,web,redes' && bs.length === 7, m && m.meta);
    t('E. datas certas (âncora na linha dos dias, não no cabeçalho adiantado): Mães até 10/05, Pais até 09/08, BF web 31/10–30/11, BF redes 27–29/11',
      acha('web', /MÃES/).fim === '2026-05-10' && acha('web', /PAIS/).fim === '2026-08-09' && acha('web', /BLACK/).ini === '2026-10-31' && acha('web', /BLACK/).fim === '2026-11-30' && acha('redes', /BLACK/).ini === '2026-11-27' && acha('redes', /BLACK/).fim === '2026-11-29', bs);
    t('F. o texto da planilha vira só texto (nada executa na prévia)', await p.evaluate(() => !window.__xss));
    // reenviar o mesmo arquivo: nada muda
    await envia(p, 'marca', MARCA); txt = await pv(p, 'marca');
    t('G. reenviar o mesmo arquivo: "Nada mudou" e o Publicar fica desligado', /Nada mudou/.test(txt) && await p.evaluate(() => document.querySelector('.pg-card[data-cal="marca"] .btn-p').disabled), txt);
    await p.click('.pg-card[data-cal="marca"] .err-filter-btn:not(label)');
    // Comercial
    await envia(p, 'comercial', COM); txt = await pv(p, 'comercial');
    t('H. Comercial: só 2026 (Out e Nov); fora rascunho, aba oculta e 2025', /2 abas de mês/.test(txt) && !/NÃO ENTRA/.test(txt), txt);
    await p.click('.pg-card[data-cal="comercial"] .btn-p'); await p.waitForTimeout(300);
    const c = await store(p, 'comercial'); const cb = Object.values(c.barras);
    const um = re => cb.filter(x => re.test(x.txt));
    t('I. dias seguidos viram 1 barra, até virando a semana: OFERTA FICTÍCIA A 01–09/11', um(/OFERTA FICTÍCIA A/).length === 1 && um(/OFERTA FICTÍCIA A/)[0].ini === '2026-11-01' && um(/OFERTA FICTÍCIA A/)[0].fim === '2026-11-09', um(/OFERTA FICTÍCIA A/));
    t('J. linhas: lançamentos (FERIADO, 12h LANÇAMENTO) antes do 1º rótulo; site, saldos, CRM, mídia', ['lancamentos', 'site', 'saldos', 'crm', 'midia'].every(k => c.linhas[k]) && um(/FERIADO/)[0].linha === 'lancamentos' && um(/LANÇAMENTO TESTE/)[0].linha === 'lancamentos' && um(/AÇÃO CRM TESTE/)[0].linha === 'crm', c.linhas);
    t('J2. oferta da 4ª semana 27–28/11 na linha de saldos', um(/OFERTA FICTÍCIA B/).length === 1 && um(/OFERTA FICTÍCIA B/)[0].ini === '2026-11-27' && um(/OFERTA FICTÍCIA B/)[0].fim === '2026-11-28', um(/OFERTA FICTÍCIA B/));
    t('J3. barra que atravessa a virada do mês (30/10 → 02/11, abas diferentes) vira 1 barra só', um(/APP VIRADA/).length === 1 && um(/APP VIRADA/)[0].ini === '2026-10-30' && um(/APP VIRADA/)[0].fim === '2026-11-02' && um(/APP VIRADA/)[0].linha === 'app', um(/APP VIRADA/));
    t('K. nota de rodapé do mês não vira barra no último dia', !um(/rodapé/).length, um(/rodapé/));
    // 2º envio: só novembro
    await envia(p, 'comercial', COM2); txt = await pv(p, 'comercial');
    t('L. 2º envio (planilha inteira): prévia mostra a oferta que mudou e o feriado que sai', /✎ 1 mudaram/.test(txt) && /− 1 saem/.test(txt) && /FERIADO/.test(txt), txt);
    await p.click('.pg-card[data-cal="comercial"] .btn-p'); await p.waitForTimeout(300);
    const c2 = Object.values((await store(p, 'comercial')).barras);
    const vira = c2.filter(x => /APP VIRADA/.test(x.txt));
    t('M. depois do 2º envio: outubro segue, a oferta vai até 30/11, o feriado saiu e a barra da virada do mês continua 1 só (sem duplicar)', c2.some(x => /AÇÃO OUTUBRO TESTE/.test(x.txt)) && c2.find(x => /OFERTA FICTÍCIA B/.test(x.txt)).fim === '2026-11-30' && !c2.some(x => /FERIADO/.test(x.txt)) && vira.length === 1 && vira[0].fim === '2026-11-02', c2.map(x => x.txt + ' ' + x.ini + '→' + x.fim));
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
    t('Q. quem não é ADM vê o cadeado e nenhum envio', await p.evaluate(() => /Só ADM/.test(document.getElementById('pcfg-gantt-cards').innerText) && !document.querySelector('#pcfg-gantt-cards input[type=file]')));
    await ctx.close(); }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
