// 🐚 Concha — @menção também ao EDITAR uma mensagem (pedido do Caio, 24/11/2026): o @ no editor abre a lista de pessoas do canal,
// com setas/Enter/Tab para escolher e Esc fechando só a lista (o segundo Esc cancela a edição). O compositor segue igual.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_mencao_edicao.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR'), car: pub('car', 'Carla Dias', 'CD') },
  cardume: {
    canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true, car: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { '-Nm1': { uid: 'ana', ts: agora - 60000, texto: 'Bom dia, time' } } },
    ultima: { dados: { ts: agora - 60000, uid: 'ana', id: '-Nm1' } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(800);
  const ed = '[data-msg="-Nm1"] .editor textarea';

  await p.hover('[data-msg="-Nm1"]'); await p.click('[data-msg="-Nm1"] [aria-label="Editar"]'); await p.waitForTimeout(150);
  await p.focus(ed); await p.keyboard.press('End'); await p.keyboard.type(' @Br');
  await p.waitForTimeout(150);
  const lista = await p.$$eval('#sug-ed .sugestao', xs => xs.map(x => [...x.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')));   // só o nome (a foto/iniciais vêm antes)
  t('@ no editor abre a lista do próprio editor, filtrada', lista.length === 1 && lista[0] === '@Bruno Reis' && await p.isVisible('#sug-ed'), lista);
  t('a lista do compositor fica fechada', await p.isHidden('#sugestoes'), 0);
  t('acessibilidade: o editor aponta a opção destacada', (await p.getAttribute(ed, 'aria-activedescendant')) === 'sug-ed-0', await p.getAttribute(ed, 'aria-activedescendant'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  t('Enter escolhe a pessoa (não salva)', (await p.inputValue(ed)) === 'Bom dia, time @Bruno Reis ' && await p.isVisible(ed), await p.inputValue(ed));
  await p.keyboard.type('e @'); await p.waitForTimeout(120);
  const todos = (await p.$$eval('#sug-ed .sugestao', xs => xs.map(x => [...x.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')))).filter(x => !/^(🗂 @card:|🎯 @objetivo:)/.test(x));   // as pessoas (sem os atalhos de citar)   // só o nome (a foto/iniciais vêm antes)
  t('@ sozinho lista os membros (menos eu)', todos.length === 2 && !todos.includes('@Ana Lima'), todos);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
  t('seta + Tab escolhem a segunda pessoa', /@Carla Dias $/.test(await p.inputValue(ed)), await p.inputValue(ed));
  await p.keyboard.type('@Ca'); await p.waitForTimeout(100);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  t('Esc com a lista aberta fecha só a lista (a edição continua)', await p.isHidden('#sug-ed') && await p.isVisible(ed), 0);
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const msg = s.kanban.cardume.msgs.dados['-Nm1'];
  t('Enter com a lista fechada salva o texto com as menções', msg.texto === 'Bom dia, time @Bruno Reis e @Carla Dias' && typeof msg.editado === 'number', msg);
  t('na mensagem salva, as menções aparecem destacadas', (await p.$$eval('[data-msg="-Nm1"] .mencao', xs => xs.map(x => x.textContent))).join('|') === '@Bruno Reis|@Carla Dias', 0);

  // o compositor segue funcionando
  await p.fill('#entrada', 'oi @Bru'); await p.dispatchEvent('#entrada', 'input'); await p.waitForTimeout(120);
  t('compositor: a lista dele continua abrindo', await p.isVisible('#sugestoes') && (await p.textContent('#sugestoes')).includes('@Bruno Reis'), 0);
  await p.keyboard.press('Escape');
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
