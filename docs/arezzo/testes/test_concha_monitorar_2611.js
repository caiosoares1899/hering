// 🐚 Concha — /monitorarbugs de 26/11/2026 (código novo: 📌 fixadas, 📝 Minhas notas, ⚙️ Configurações).
// 1) A fixada do topo que estava entre as mensagens carregadas e SAI da janela (chegam 100+ mensagens novas) continuava aparecendo como "…"
//    para sempre: só ganhava escuta própria quem estava fora da janela NO MOMENTO em que as fixadas chegavam.
// 2) ⚙️ Configurações › Organizar seções…: ao fechar Seções o foco caía no nada (voltava para um botão que já não existia).
// 3) Desativar Minhas notas com elas abertas deixava ?c=eu-… na URL e no aparelho: recarregar reabria as notas desativadas por um instante.
// Rodar na raiz: python3 -m http.server 8949  →  node docs/arezzo/testes/test_concha_monitorar_2611.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = U('pau', 'Paula PO');
const ag = Date.now();
const P = n => ({ nome: n, email: n.split(' ')[0].toLowerCase() + '@ciahering.com.br' });
const seed = () => {
  const msgs = { fixa: { uid: 'pau', ts: ag - 60000, texto: 'Decisão: o banner sai na segunda' } };
  for (let i = 0; i < 10; i++) msgs['n' + i] = { uid: 'pau', ts: ag - 50000 + i * 100, texto: 'mensagem ' + i };
  return { kanban: {
    usuarios: { pau: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } } },
    usuarios_publicos: { pau: P('Paula PO') },
    cardume: {
      canais: { dados: { nome: 'Dados' } }, membros: { dados: { pau: true } }, meus: { pau: { dados: true } },
      msgs: { dados: msgs, 'eu-pau': { x1: { uid: 'pau', ts: ag - 1000, texto: 'minha nota' } } },
      fixadas: { dados: { fixa: { por: 'pau', em: ag - 5000, t: 'topo' } } },
      notas: { pau: true },
    } } };
};
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const DBURL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (url) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + url); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(1000);
    return { ctx, p, errs };
  };
  const faixa = p => p.evaluate(() => (document.querySelector('#faixa-fix .fix-txt') || {}).textContent || '');

  // ── 1) fixada que sai da janela ──
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados');
    t('a fixada (dentro da janela) aparece na faixa', /Decisão: o banner/.test(await faixa(p)), await faixa(p));
    await p.evaluate(async (u) => {   // 120 mensagens novas chegam de outra pessoa: a fixada sai das 100 do canal
      const m = await import(u); const mapa = {}; const t0 = Date.now();
      for (let i = 0; i < 120; i++) mapa['z' + String(i).padStart(3, '0')] = { uid: 'pau', ts: t0 + i, texto: 'nova ' + i };
      await m.update(m.ref(null, 'kanban/cardume/msgs/dados'), mapa);   // no nó das mensagens: o banco real só avisa quem escuta ali
    }, DBURL);
    await p.waitForTimeout(600);
    const f = await faixa(p);
    t('depois que ela sai da janela a faixa ainda mostra o texto (não "…")', /Decisão: o banner/.test(f), f);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── 2) foco ao fechar Seções aberto pelas Configurações ──
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados');
    await p.click('#b-config'); await p.waitForTimeout(150);
    await p.click('.md.cfg button:has-text("Organizar seções")'); await p.waitForTimeout(150);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    const foco = await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    t('fechar Seções (vindo de ⚙️) devolve o foco ao botão ⚙️', foco === 'b-config', foco);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── 3) desativar as notas com elas abertas ──
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=eu-pau');
    t('as notas abriram', await p.evaluate(() => window.__cardume.estado.atual === 'eu-pau'), await p.evaluate(() => window.__cardume.estado));
    p.on('dialog', d => d.accept());
    await p.click('#b-config'); await p.waitForTimeout(150);
    await p.click('.md.cfg button:has-text("Desativar")'); await p.waitForTimeout(400);
    const st = await p.evaluate(() => ({ atual: window.__cardume.estado.atual, url: location.search, ls: localStorage.getItem('cardume_canal') }));
    t('desativar fecha as notas e tira o eu-… da URL e do aparelho', st.atual === '' && !/eu-pau/.test(st.url) && st.ls !== 'eu-pau', st);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
