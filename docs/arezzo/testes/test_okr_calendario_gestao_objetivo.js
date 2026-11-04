// 🎯 Script de console que cria o OKR "Calendário de gestão do Digital" no Radar (docs/arezzo/okr_calendario_gestao.js): simulação não grava, aplicar grava
// o Objetivo + 13 Marcos + 3 comentários, é idempotente, e o Radar renderiza tudo. Boot REAL (okr-dev.html) com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_okr_calendario_gestao_objetivo.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8941/okr-dev.html';
const SRC = fs.readFileSync(__dirname + '/../okr_calendario_gestao.js', 'utf8');
const U = { uid: 'caio', email: 'caio@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { okr: { objetivos: {}, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { caio: { uid: 'caio', nome: 'Caio Soares', email: 'caio@ciahering.com.br', inscrito: true, init: 'CS', role: 'adm', squads: { dados: true } }, rafa: { uid: 'rafa', nome: 'Rafael Silva', email: 'rafael@ciahering.com.br', inscrito: true, init: 'RS', role: 'adm', squads: { dados: true } } },
  usuarios_publicos: { caio: { uid: 'caio', nome: 'Caio Soares', init: 'CS', email: 'caio@ciahering.com.br', role: 'adm' }, rafa: { uid: 'rafa', nome: 'Rafael Silva', init: 'RS', email: 'rafael@ciahering.com.br', role: 'adm' } },
  config: { adm_emails: ['caio@ciahering.com.br', 'rafael@ciahering.com.br'] }, squads: { dados: { dados: { columns: [{ id: 'todo', name: 'A fazer' }], tags: [], cards_index: {}, cards: {} } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = [], logs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => logs.push(m.text()));
  await p.goto(BASE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
  const st = () => p.evaluate(() => ({ obj: window.__store.kanban.okr.objetivos, marcos: window.__store.kanban.okr.marcos, com: window.__store.kanban.okr.marco_comments }));
  const roda = (src) => p.evaluate(s => (0, eval)(s), src);

  logs.length = 0; await roda(SRC); await p.waitForTimeout(600);
  let s = await st();
  t('A. simulação (APLICAR=false) NÃO grava nada', Object.keys(s.obj || {}).length === 0 && !s.com && logs.some(l => /SIMULAÇÃO/.test(l)), logs.slice(-3));
  t('B. a simulação acha o Rafael entre os ADMs e responsabiliza os dois', logs.some(l => /Responsáveis do Objetivo/.test(l)) && logs.every(l => !/Rafael não foi achado/.test(l)), logs.slice(0, 3));
  t('C. nenhum aviso de limite de caracteres da apresentação (todos os textos cabem)', !logs.some(l => /Acima do limite/.test(l)), logs.filter(l => /Acima do limite/.test(l)));

  logs.length = 0; await roda(SRC.replace('const APLICAR = false;', 'const APLICAR = true;')); await p.waitForTimeout(800);
  s = await st(); const o = (s.obj || {}).obj_calendario_gestao_digital, ms = Object.values(s.marcos || {}), cm = Object.values((s.com || {}).marco_calgestao_7 || {});
  t('D. criou o Objetivo (torre digital, 4T e 1T27, os 2 responsáveis)', !!o && o.torre === 'digital' && o.trimestres.join() === '4T,1T27' && o.responsaveis.join() === 'caio,rafa', o && { t: o.torre, r: o.responsaveis });
  t('E. listas preenchidas: 4 indicadores, 7 progressos, 6 próximos passos, 6 riscos, 4 planos de ação', o && o.indicadores.length === 4 && o.progressos.length === 7 && o.proximosPassos.length === 6 && o.riscos.length === 6 && o.planosAcao.length === 4, o && Object.keys(o));
  t('F. 13 Marcos: 7 concluídos e 6 não iniciados, todos ligados ao Objetivo', ms.length === 13 && ms.filter(m => m.progresso === 'concluido').length === 7 && ms.filter(m => m.progresso === 'nao_iniciado').length === 6 && ms.every(m => m.objetivoId === 'obj_calendario_gestao_digital'), ms.length);
  t('G. os Marcos a fazer NÃO têm prazo inventado; os feitos têm a data real (03/11 e 04/11)', ms.filter(m => m.progresso === 'nao_iniciado').every(m => m.prazo === '') && ms.filter(m => m.progresso === 'concluido').every(m => /^2026-11-0[34]$/.test(m.prazo)), ms.map(m => m.prazo));
  t('H. o Marco "validar com o Rafael" é do Rafael; os outros do Caio', ms.find(m => /com o Rafael/.test(m.nome)).responsavel === 'rafa' && ms.filter(m => !/com o Rafael/.test(m.nome)).every(m => m.responsavel === 'caio'), '');
  t('I. 3 comentários (decisões, riscos, resumo) no Marco "Decisões, riscos e limites"', cm.length === 3 && /DECISÕES/.test(cm[0].text) && /RISCOS/.test(cm.map(c => c.text).join('')) && cm.every(c => c.uid === 'caio' && typeof c.ts === 'string'), cm.map(c => c.text.slice(0, 20)));
  t('J. nenhum campo undefined/NaN gravado (o Firebase recusaria)', !/undefined|NaN/.test(JSON.stringify(s)), '');
  t('K. o histórico do Objetivo registra a criação', o && o.history[0].what.startsWith('criou o Objetivo') && o.history[0].tipo === 'criado', o && o.history);

  const antes = JSON.stringify(s); logs.length = 0; await roda(SRC.replace('const APLICAR = false;', 'const APLICAR = true;')); await p.waitForTimeout(500);
  t('L. rodar de novo NÃO duplica nem regrava (idempotente): avisa que já existe', JSON.stringify(await st()) === antes && logs.some(l => /já existe/.test(l)), logs.slice(-2));

  // o Radar renderiza: o Objetivo aparece na lista e abre sem erro, com os marcos
  await p.evaluate(() => { if (typeof _okrEntrarTorre === 'function') _okrEntrarTorre('digital'); }); await p.waitForTimeout(800);
  t('M. o Radar lista o Objetivo novo', await p.evaluate(() => /Calendário de gestão do Digital/.test(document.body.innerText)), (await p.evaluate(() => document.body.innerText)).slice(0, 200));
  await p.evaluate(() => openOkrObjetivo('obj_calendario_gestao_digital')); await p.waitForTimeout(700);
  t('N. abrir o Objetivo mostra riscos, próximos passos e os Marcos', await p.evaluate(() => { const x = document.body.innerText; return /Regras do banco do calendário abertas/.test(x) && /Ponte de leitura com o Google Agenda/.test(x); }), '');
  await p.evaluate(() => { closeOkrObjetivo && closeOkrObjetivo(); }); await p.waitForTimeout(200);
  await p.evaluate(() => openOkrMarco && openOkrMarco('marco_calgestao_7')); await p.waitForTimeout(900);
  t('O. o Marco de decisões abre e mostra os comentários', await p.evaluate(() => /DECISÕES \(03\/11\/2026\)/.test(document.body.innerText) && /RISCOS E COMO MITIGAMOS/.test(document.body.innerText)), (await p.evaluate(() => document.body.innerText)).slice(0, 200));
  t('P. sem erro de JS', errs.length === 0, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
