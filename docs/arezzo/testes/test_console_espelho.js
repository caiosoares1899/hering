// 🔒 Teste do script de console da carga do diretório (console_espelho_diretorio.js, fase A3).
// Roda o script no Painel dev (fakefb), como ADM: 1ª vez só o plano (nada gravado); com a flag, grava; cada escrita é conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_console_espelho.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const SCRIPT = fs.readFileSync(path.join(__dirname, 'console_espelho_diretorio.js'), 'utf8');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ADM = { uid: 'adm', email: 'adm@ciahering.com.br', displayName: 'Adm', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: {
  usuarios: {
    adm: { uid: 'adm', nome: 'Adm', email: 'adm@ciahering.com.br', inscrito: true, init: 'AD', role: 'adm', squads: { dados: true }, torre: 'digital' },
    ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AN', role: 'membro', squads: { dados: true }, torre: 'digital', gestorOkr: true },
    bia: { uid: 'bia', nome: 'Bia', email: 'bia@ciahering.com.br', inscrito: true, init: 'BI', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' }, torre: 'comercial', diretoria: 'digital' },
    cai: { uid: 'cai', nome: 'Cai', email: 'cai@ciahering.com.br', inscrito: true, init: 'CA', role: 'membro', torre: 'Torre Errada' },
    dan: { uid: 'dan', nome: 'Dan', email: 'dan@ciahering.com.br', inscrito: true, init: 'DA', role: 'membro', torre: 'digital' },
  },
  usuarios_publicos: {
    adm: { uid: 'adm', nome: 'Adm', init: 'AD', torre: 'digital' },          // já em dia
    ana: { uid: 'ana', nome: 'Ana', init: 'AN' },                             // falta torre e gestorOkr
    cai: { uid: 'cai', nome: 'Cai', init: 'CA' },                             // torre inválida no cadastro: pula
    dan: { uid: 'dan', nome: 'Dan', init: 'DA', torre: 'digital', gestorOkr: true },   // gestorOkr no espelho sem fonte: tira
    // bia: sem espelho nenhum → ganha o básico + torre + diretoria
  },
  config: { adm_emails: ['adm@ciahering.com.br'] }, squads_meta: {},
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text()));
  await p.goto(base + '/painel-dev.html'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ADM); await p.waitForTimeout(2500);
  const store = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.usuarios_publicos)));
  const antes = await store();
  await p.evaluate(() => { window.__escritas = []; });
  await p.evaluate(SCRIPT); await p.waitForTimeout(500);
  t('1ª rodada: só o plano, nada gravado', JSON.stringify(await store()) === JSON.stringify(antes) && !(await p.evaluate(() => (window.__escritas || []).length)), 0);
  t('o plano conta 3 a ajustar (ana, bia nova, dan) e avisa a torre inválida do cai', logs.some(l => /a ajustar: 3 \(espelho novo: 1\)/.test(l)) && logs.some(l => /Pulados/.test(l)), logs.filter(l => /ajustar|Pulados/.test(l)));
  await p.evaluate(() => { window.__ESPELHO_GRAVAR = true; }); await p.evaluate(SCRIPT); await p.waitForTimeout(600);
  const depois = await store();
  t('ana: ganhou torre e Gestor OKR', depois.ana.torre === 'digital' && depois.ana.gestorOkr === true, depois.ana);
  t('bia: espelho novo com o básico, torre e diretoria', depois.bia && depois.bia.nome === 'Bia' && depois.bia.role === 'po' && depois.bia.squads_roles.dados === 'po' && depois.bia.torre === 'comercial' && depois.bia.diretoria === 'digital', depois.bia);
  t('cai: torre inválida não foi copiada', !('torre' in depois.cai), depois.cai);
  t('dan: Gestor OKR sem fonte saiu do espelho', !('gestorOkr' in depois.dan) && depois.dan.torre === 'digital', depois.dan);
  t('adm: já em dia, intocado', JSON.stringify(depois.adm) === JSON.stringify(antes.adm), depois.adm);
  t('a flag se desliga depois de gravar', !(await p.evaluate(() => window.__ESPELHO_GRAVAR)), 0);
  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ADM), mapa); } finally { Date.now = real; } if (!r) ruins.push(Object.keys(mapa)); }
  t('CADA escrita do script passa nas regras reais (como ADM)', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('relata sucesso', logs.some(l => /Espelho ajustado para 3 pessoa/.test(l)), logs.filter(l => /ajustado|Falharam/.test(l)));
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
