// TESTE — ⌨️ Atalhos personalizáveis do Maré (kanban-dev/kanban): clicar em "Definir" e apertar a combinação TEM de gravar o atalho; também o disparo do atalho, conflito, reservado e remoção.
// Roda o BOOT REAL com o Firebase falso.   (python3 -m http.server 8941 &)   node docs/arezzo/testes/test_atalhos_captura.js      K=kanban para a página de produção
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = () => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'membro', squads: { dev: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'membro', squads: { dev: true } } }, config: { adm_emails: [] } } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(`http://localhost:8941/${K}.html?squad=dev`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(2800);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  const salvo = () => p.evaluate(() => JSON.parse(JSON.stringify(((window.__store.kanban.usuarios.eve || {}).atalhos_custom) || {})));
  await p.evaluate(() => openAtalhos()); await p.waitForTimeout(300);
  const ids = await p.evaluate(() => [...document.querySelectorAll('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]')].map(x => x.getAttribute('onclick')));
  t('A tela lista ações para personalizar (aba Board)', ids.length >= 5, ids);
  // 1) clicar em Definir da 1ª ação e apertar Ctrl+Shift+Y (TECLADO DE VERDADE, sem chamar a função direto)
  const primeiro = (ids[0].match(/_atalhoIniciarCaptura\((.*)\)/) || [])[1];
  await p.locator('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]').first().click(); await p.waitForTimeout(150);
  const foco = await p.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, onclick: a && a.getAttribute && a.getAttribute('onclick') }; });
  t('Depois de clicar em Definir, o foco fica no botão "armado" (senão a tecla não chega)', /_atalhoIniciarCaptura/.test(foco.onclick || ''), foco);
  await p.keyboard.press('Control+Shift+Y'); await p.waitForTimeout(300);
  let s = await salvo();
  t('Apertar Ctrl+Shift+Y grava o atalho em usuarios/{uid}/atalhos_custom', Object.values(s).includes('mod+shift+y'), s);
  const lbl = await p.evaluate(() => document.getElementById('atalhos-body').innerText);
  t('A linha mostra a combinação escolhida', /Ctrl\+Shift\+Y/.test(lbl), lbl.slice(0, 200));
  // 2) segunda ação, mesma combinação => conflito
  await p.locator('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]').nth(1).click(); await p.waitForTimeout(150);
  await p.keyboard.press('Control+Shift+Y'); await p.waitForTimeout(300);
  s = await salvo(); t('Combinação repetida é recusada (só 1 ação com ela)', Object.values(s).filter(v => v === 'mod+shift+y').length === 1, s);
  // 3) reservada
  await p.locator('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]').nth(1).click(); await p.waitForTimeout(150);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  s = await salvo(); t('Ctrl+K (fixo do sistema) é recusado', !Object.values(s).includes('mod+k'), s);
  await p.locator('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]').nth(1).click(); await p.waitForTimeout(150);
  await p.keyboard.press('Control+Shift+T'); await p.waitForTimeout(300);
  s = await salvo(); t('Ctrl+Shift+T (reabrir aba, o navegador pega antes) é recusado', !Object.values(s).includes('mod+shift+t'), s);
  // 4) tecla de função sozinha
  await p.locator('#atalhos-body button[onclick^="_atalhoIniciarCaptura"]').nth(1).click(); await p.waitForTimeout(150);
  await p.keyboard.press('F8'); await p.waitForTimeout(300);
  s = await salvo(); t('F8 sozinho é aceito', Object.values(s).includes('f8'), s);
  // 5) remover
  await p.locator('#atalhos-body button[onclick^="_atalhoLimpar"]').first().click(); await p.waitForTimeout(300);
  s = await salvo(); t('✕ remove o atalho', Object.keys(s).length === 1, s);
  // 6) o atalho DISPARA a ação (fecha a tela e aperta a combinação no board)
  const acaoId = Object.keys(s)[0], combo = s[acaoId];
  await p.evaluate(() => closeOv('atalhos-ov')); await p.evaluate(id => { window.__disparou = 0; ATALHO_ACOES[id].run = () => { window.__disparou++; }; }, acaoId);
  await p.keyboard.press(combo === 'f8' ? 'F8' : 'Control+Shift+Y'); await p.waitForTimeout(200);
  t('Apertar o atalho salvo executa a ação', (await p.evaluate(() => window.__disparou)) === 1, combo);
  t('Sem erro de JS', !erros.length, erros);
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
