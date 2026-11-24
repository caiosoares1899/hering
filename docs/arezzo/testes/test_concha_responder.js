// 🐚 Concha — ↩️ Responder (etapa 4, 24/11/2026). A resposta guarda só o id da original (resp); a citação é montada na tela; quem foi
// respondido recebe aviso (índice privado com r: true + notificação genérica), sem duplicar com a @menção e nunca para si.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_responder.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => {
  const msgs = { '-Nold': { uid: 'bru', ts: agora - 3600e3, texto: 'Mensagem bem antiga do Bruno' } };
  for (let i = 0; i < 52; i++) msgs['-Nf' + String(i).padStart(2, '0')] = { uid: i % 2 ? 'car' : 'bru', ts: agora - (60 - i) * 60000, texto: 'enchimento ' + i };
  msgs['-Nm1'] = { uid: 'bru', ts: agora - 3 * 60000, texto: 'Proposta A para o painel' };
  msgs['-Nm2'] = { uid: 'ana', ts: agora - 2 * 60000, texto: 'minha mensagem' };
  msgs['-Nm3'] = { uid: 'car', ts: agora - 1 * 60000, texto: 'vai ser apagada' };
  msgs['-Nr0'] = { uid: 'car', ts: agora - 30000, texto: 'respondendo a antiga', resp: '-Nold' };
  return { kanban: {
    usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } }, car: { role: 'membro', squads: { dados: true } } },
    usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR'), car: pub('car', 'Carla Dias', 'CD') },
    cardume: {
      canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } }, membros: { dados: { ana: true, bru: true, car: true }, prf: { ana: true } }, meus: { ana: { dados: true, prf: true } },
      msgs: { dados: msgs }, ultima: { dados: { ts: agora - 30000, uid: 'car', id: '-Nr0' } },
    },
  } };
};
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; });   // limitToLast(50) de verdade: a original antiga fica FORA das carregadas
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban)));
  const minhas = async () => Object.entries((await S()).cardume.msgs.dados).filter(([k, v]) => !/^-N(old|f\d\d|m\d|r0)$/.test(k) && v.uid === 'ana').map(([k, v]) => Object.assign({ k }, v)).sort((a, c) => a.ts - c.ts);
  const responder = async id => { await p.hover('[data-msg="' + id + '"]'); await p.click('[data-msg="' + id + '"] >> text=↩️ Responder'); await p.waitForTimeout(100); };

  // citação de mensagem fora das 50 carregadas: busca o trecho
  await p.waitForTimeout(400);
  t('a original antiga está mesmo fora das 50 carregadas', !(await p.$('[data-msg="-Nold"]')), 0);
  t('citação de uma original fora das 50 carregadas mostra o trecho (buscado)', /Mensagem bem antiga do Bruno/.test(await p.textContent('[data-msg="-Nr0"] .citacao')), await p.textContent('[data-msg="-Nr0"] .citacao'));

  // a original fora das 50 é apagada DEPOIS de a citação ter carregado: a citação atualiza sem recarregar (achado do Codex na #1959)
  await p.evaluate(async () => { const mm = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'); await mm.set(mm.ref({}, 'kanban/cardume/msgs/dados/-Nold'), { uid: 'bru', ts: Date.now() - 3600e3, apagada: true }); });
  await p.waitForTimeout(300);
  t('original fora das 50 apagada depois: a citação passa a "(mensagem apagada)" na hora', /mensagem apagada/.test(await p.textContent('[data-msg="-Nr0"] .citacao')) && !/bem antiga/.test(await p.textContent('[data-msg="-Nr0"] .citacao')), await p.textContent('[data-msg="-Nr0"] .citacao'));
  // responder ao Bruno
  await responder('-Nm1');
  t('↩️ Responder abre a barra "Respondendo a…" com o trecho, e o foco vai para o campo', await p.isVisible('#resp-barra') && /Respondendo a Bruno Reis/.test(await p.textContent('#resp-barra')) && /Proposta A/.test(await p.textContent('#resp-barra')) && await p.evaluate(() => document.activeElement.id === 'entrada'), await p.textContent('#resp-barra'));
  await p.fill('#entrada', 'concordo com a A'); await p.press('#entrada', 'Enter'); await p.waitForTimeout(400);
  let s = await S(); let m = (await minhas()).pop();
  t('a resposta grava resp = id da original', m && m.texto === 'concordo com a A' && m.resp === '-Nm1', m);
  t('a barra fecha depois de enviar', await p.isHidden('#resp-barra'), 0);
  const recs = Object.values((s.cardume.mencoes || {}).bru || {});
  t('o Bruno recebe aviso de RESPOSTA no índice privado (r: true)', recs.length === 1 && recs[0].r === true && recs[0].m === m.k && recs[0].de === 'ana', recs);
  const nots = Object.values((s.usuarios.bru || {}).notificacoes || {});
  t('…e no Sino, genérica: "respondeu você na Concha" (sem trecho nem canal)', nots.length === 1 && /Ana respondeu você na Concha/.test(nots[0].title) && !/Proposta|Dados/.test(JSON.stringify(nots[0])), nots);
  t('a resposta mostra a citação de quem e do quê', /Bruno Reis/.test(await p.textContent('[data-msg="' + m.k + '"] .citacao')) && /Proposta A/.test(await p.textContent('[data-msg="' + m.k + '"] .citacao')), 0);
  await p.click('[data-msg="' + m.k + '"] .citacao'); await p.waitForTimeout(200);
  t('clicar na citação leva à original (destaque)', await p.evaluate(() => document.querySelector('[data-msg="-Nm1"]').classList.contains('destaque')), 0);

  // resposta + @menção da mesma pessoa = um aviso só
  await responder('-Nm1'); await p.fill('#entrada', 'oi @Bruno Reis de novo'); await p.click('#b-enviar'); await p.waitForTimeout(400);
  s = await S(); const recs2 = Object.values(s.cardume.mencoes.bru);
  t('resposta que também @menciona a pessoa: um aviso só (o de menção)', recs2.length === 2 && recs2.filter(r => r.r === true).length === 1, recs2);
  // responder a si mesma não avisa
  const antes = JSON.stringify(s.cardume.mencoes);
  await responder('-Nm2'); await p.fill('#entrada', 'complementando'); await p.press('#entrada', 'Enter'); await p.waitForTimeout(400);
  s = await S(); m = (await minhas()).pop();
  t('responder a si mesma grava o resp, mas não avisa ninguém', m.resp === '-Nm2' && JSON.stringify(s.cardume.mencoes) === antes, s.cardume.mencoes);
  // Esc e troca de canal cancelam
  await responder('-Nm1'); await p.press('#entrada', 'Escape'); await p.waitForTimeout(80);
  t('Esc cancela a resposta', await p.isHidden('#resp-barra'), 0);
  await responder('-Nm1'); await p.click('[data-canal="prf"]'); await p.waitForTimeout(250);
  t('trocar de canal cancela a resposta', await p.isHidden('#resp-barra'), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  await responder('-Nm1'); await p.click('#b-mencoes'); await p.waitForTimeout(250);
  t('abrir @ Menções cancela a resposta e solta a escuta das citações (auditoria do Antigravity na #1959)', await p.isHidden('#resp-barra') && await p.evaluate(() => !(window.__lis || []).some(l => /msgs\/dados\/-Nold$/.test(l.p))), await p.evaluate(() => (window.__lis || []).map(l => l.p)));
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  // original apagada
  await responder('-Nm3'); await p.fill('#entrada', 'respondendo a Carla'); await p.press('#entrada', 'Enter'); await p.waitForTimeout(400);
  const rc = (await minhas()).pop();
  await p.evaluate(async () => { const mm = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'); await mm.set(mm.ref({}, 'kanban/cardume/msgs/dados/-Nm3'), { uid: 'car', ts: Date.now() - 60000, apagada: true }); });
  await p.waitForTimeout(300);
  t('original apagada: a citação diz "(mensagem apagada)"', /mensagem apagada/.test(await p.textContent('[data-msg="' + rc.k + '"] .citacao')), await p.textContent('[data-msg="' + rc.k + '"] .citacao'));

  const esc = (await p.evaluate(() => window.__escritas || [])).filter(e => !/kanban\/cardume\/msgs\/dados\/-N(m3|old)$/.test(e.p));   // o apagar da Carla foi simulado (não é escrita da Ana)
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
