// 🐟 Cardume (cardume-dev.html) — etapa 3: prévia do card colado e "📝 Registrar no card" (docs/ideias/cardume-v0-banco.md › "Etapa 3").
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_cardume_card.js
// BASE_URL, CHROME e PLAYWRIGHT_MODULE substituem os caminhos (padrão: ~/hering-tools do Mac).
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const PAGE = process.env.PAGE || 'cardume-dev.html';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const MARE = 'https://caiosoares1899.github.io/hering/';
const agora = Date.now();
const msg = (uid, min, texto) => ({ uid, ts: agora - min * 60000, texto });
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR') },
  cardume: {
    canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } },
    msgs: { dados: {
      '-Nm0': { uid: 'bru', ts: agora - 10 * 60000, apagada: true },
      '-Nm1': msg('bru', 9, 'Olha esse card: ' + MARE + 'kanban.html?squad=dados&opencard=c1'),
      '-Nm2': msg('bru', 8, 'Esse é de outra squad ' + MARE + 'kanban-dev.html?card=c9&squad=prf e esse não existe ' + MARE + 'kanban.html?squad=dados&opencard=c404'),
      '-Nm3': msg('ana', 7, 'Link falso https://evil.example/hering/kanban.html?squad=dados&opencard=c1'),
      '-Nm4': msg('bru', 6, '@Agente Ágil resume isso, @Ana Lima decide. Meu e-mail: bru@ciahering.com.br'),
      '-Nm5': msg('ana', 5, 'Fechado: vamos com a versão B.'),
    } },
    ultima: { dados: { ts: agora - 5 * 60000, uid: 'ana', id: '-Nm5' } },
  },
  squads: {
    dados: { dados: { cards_index: { c1: '0' }, cards: { 0: { id: 'c1', title: 'Painel de vendas' } } } },
    prf: { dados: { cards_index: { c9: '0' }, cards: { 0: { id: 'c9', title: 'Segredo da prf' } } } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 600))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
function conferirEscritas(escritas, quem) {
  const real = Date.now; const ruins = [];
  for (const e of escritas) {
    const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v]));
    Date.now = () => e.t;
    let r; try { r = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; }
    if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) });
  }
  return ruins;
}

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  // a prf não é da Ana: no banco de verdade a leitura seria liberada (toda a Hering lê), aqui simulamos a negação para ver o estado "sem acesso"
  await ctx.addInitScript(() => { window.__denyGet = p => /^kanban\/squads\/prf\//.test(p); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/' + PAGE + '?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(700);
  const chips = () => p.evaluate(() => [...document.querySelectorAll('#log .card-chip')].map(a => ({ msg: a.closest('[data-msg]').dataset.msg, txt: a.textContent, href: a.href })));

  // ── prévia do card colado ──
  const cs = await chips();
  const c1 = cs.find(c => c.msg === '-Nm1');
  t('link do card vira chip com o título e a squad', !!c1 && /Painel de vendas/.test(c1.txt) && /Dados/.test(c1.txt), cs);
  t('o chip abre o card no Maré (destino montado, não o texto colado)', !!c1 && c1.href === MARE + 'kanban.html?squad=dados&opencard=c1', c1);
  const m2 = cs.filter(c => c.msg === '-Nm2');
  t('formato ?card= do kanban-dev também vale; sem acesso → "card sem acesso"', m2.some(c => /card sem acesso/.test(c.txt) && c.href === MARE + 'kanban-dev.html?squad=prf&opencard=c9') && !m2.some(c => /Segredo/.test(c.txt)), m2);
  t('card que não existe → "card não encontrado"', m2.some(c => /card não encontrado/.test(c.txt)), m2);
  t('link de outra origem não vira chip', !cs.some(c => c.msg === '-Nm3'), cs);

  // ── 📝 Registrar no card ──
  await p.hover('[data-msg="-Nm4"]'); await p.click('[data-msg="-Nm4"] button[aria-label="Registrar no card do Maré"]'); await p.waitForTimeout(300);
  t('abre o modal com a mensagem marcada', await p.isVisible('.md.registrar') && await p.isChecked('.md.registrar input[value="-Nm4"]'), 0);
  t('mensagens apagadas não entram na lista; as outras, sim', (await p.locator('.md.registrar .reg-item').count()) === 5, await p.locator('.md.registrar .reg-item').count());
  t('card citado na conversa já vem escolhido', /Painel de vendas/.test(await p.evaluate(() => { const s = document.querySelector('.md.registrar select'); return s.options[s.selectedIndex].text; })), 0);
  await p.waitForTimeout(200);
  const aviso = await p.textContent('.md.registrar .aviso-reg');
  t('o aviso diz que a Hering inteira pode abrir o card', /Qualquer pessoa da Hering pode abrir esse card/.test(aviso) && /Painel de vendas/.test(aviso), aviso);
  await p.check('.md.registrar input[value="-Nm5"]'); await p.waitForTimeout(150);
  const prev = await p.textContent('.md.registrar .prev-reg');
  t('prévia: cabeçalho, nome de cada autor e as duas mensagens', /^🐟 Do Cardume · #Dados/.test(prev) && /\*\*Bruno Reis\*\* \(/.test(prev) && /\*\*Ana Lima\*\* \(/.test(prev) && /versão B/.test(prev), prev);
  t('prévia: @menções viram só o nome (não aciona o Agente), e-mail fica', !/@agente/i.test(prev) && /Agente Ágil resume/.test(prev) && !/@Ana/.test(prev) && /bru@ciahering\.com\.br/.test(prev), prev);
  // link colado inválido
  await p.selectOption('.md.registrar select', ''); await p.fill('.md.registrar input[type="url"]', 'https://evil.example/hering/kanban.html?squad=dados&opencard=c1'); await p.waitForTimeout(150);
  t('link colado que não é do Maré: avisa', /não é de um card do Maré/.test(await p.textContent('.md.registrar .aviso-reg')), await p.textContent('.md.registrar .aviso-reg'));
  await p.fill('.md.registrar input[type="url"]', MARE + 'kanban.html?squad=dados&opencard=c1'); await p.waitForTimeout(200);
  await p.click('.md.registrar button[type="submit"]'); await p.waitForTimeout(400);
  const s = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const coms = Object.values(((s.kanban.squads.dados.dados.card_comments || {}).c1) || {});
  const cm = coms[0] || {};
  t('grava um comentário no card c1', coms.length === 1 && !(await p.isVisible('.md.registrar')), coms);
  t('formato do Maré: id, uid, author, init, ts ISO (string), text', /^c\d+[a-z0-9]{0,3}$/.test(cm.id || '') && cm.uid === 'ana' && cm.author === 'Ana Lima' && cm.init === 'AL' && typeof cm.ts === 'string' && !isNaN(Date.parse(cm.ts)), cm);
  t('campo cardume aponta para a 1ª mensagem marcada', cm.cardume && cm.cardume.c === 'dados' && cm.cardume.m === '-Nm4', cm.cardume);
  t('texto gravado sem "@agente" (gatilho do Agente Ágil)', typeof cm.text === 'string' && !cm.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('@agente agil'), cm.text);
  t('nada foi gravado no card da prf nem no c404', !s.kanban.squads.prf.dados.card_comments && !(s.kanban.squads.dados.dados.card_comments || {}).c404, 0);
  t('toast confirma o registro', /Registrado no card/.test(await p.textContent('#toast')), await p.textContent('#toast'));
  const ruins = conferirEscritas(await p.evaluate(() => window.__escritas || []), ANA);
  t('CADA escrita da página passa nas regras reais do banco', !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);

  // celular: sem rolagem lateral com chip e modal
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  await p.hover('[data-msg="-Nm5"]'); await p.click('[data-msg="-Nm5"] button[aria-label="Registrar no card do Maré"]').catch(() => {}); await p.waitForTimeout(200);
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  t('celular: sem rolagem lateral com o modal aberto', sobra <= 0, sobra);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
