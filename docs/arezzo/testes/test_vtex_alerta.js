// 🚨 Alerta de incidente da VTEX: o Comunicado que a função vtexStatus gera (functions/vtex/statusVtex.js) aparece de verdade como popup no Maré
// (kanban-dev), com o texto escapado, o link da VTEX, e a notificação `vtex_incidente` no sino abre o Mural. Roda o boot real com o Firebase falso.
// Uso (servidor estático na raiz, porta 8941):  node docs/arezzo/testes/test_vtex_alerta.js      (K=kanban pra testar a prod depois da promoção)
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const V = require(path.join(__dirname, '..', '..', '..', 'functions', 'vtex', 'statusVtex.js'))._test;
const K = process.env.K || 'kanban-dev';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + (JSON.stringify(d) || '').slice(0, 300))); };

const xml = `<rss><channel><item><title><![CDATA[Checkout <b>errors</b> & timeouts]]></title><link>https://status.vtex.com//incidents/01TESTINC</link><guid>https://status.vtex.com//incidents/01TESTINC</guid><pubDate>Tue, 13 Oct 2026 20:00:00 GMT</pubDate><description><![CDATA[<b>Status: Investigating</b><br/><br/>We are investigating errors on checkout.<br/><br/><b>Affected components</b><ul><li>Order Placement (Partial outage)</li></ul>]]></description></item></channel></rss>`;
const [item] = V.parseFeed(xml);
const com = V.comunicadoDe(item, 'aberto', Date.now(), null);
const id = 'vtex_' + V.chaveDe(item.guid);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await fake.install(ctx, { kanban: {
    usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AN', role: 'membro', squads: { dev: true },
      notificacoes: { ['vtex_' + V.chaveDe(item.guid)]: { id, type: 'vtex_incidente', title: '🚨 VTEX: ' + item.titulo, sub: 'Order Placement', comunicadoId: id, link: item.link, read: false, ts: new Date().toISOString() } } } },
    usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AN' } }, config: { adm_emails: [] }, squads_meta: {}, squads: { dev: { cards: {} } },
    comunicados: { [id]: com },
  } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U);
  await p.waitForFunction(() => { const o = document.getElementById('comunicado-ov'); return o && (o.classList.contains('open') || o.classList.contains('active') || getComputedStyle(o).display !== 'none'); }, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
  const popup = await p.evaluate(() => ({ titulo: document.getElementById('comunicado-titulo')?.textContent, corpo: document.getElementById('comunicado-corpo')?.innerHTML || '', badge: document.getElementById('comunicado-tipo-badge')?.textContent, visivel: (() => { const o = document.getElementById('comunicado-ov'); return !!o && getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden' && o.offsetHeight > 0; })() }));
  t('o popup abre sozinho com o Comunicado gerado pela função', popup.visivel, popup);
  t('título em texto puro (o <b> do feed não vira HTML) e com o prefixo 🚨 VTEX', popup.titulo === '🚨 VTEX: Checkout <b>errors</b> & timeouts', popup.titulo);
  t('selo "Urgente"', /Urgente/.test(popup.badge || ''), popup.badge);
  t('corpo: situação em português, componente afetado e link pra página de status', /Situação: Investigando/.test(popup.corpo) && /Order Placement/.test(popup.corpo) && /href="https:\/\/status\.vtex\.com\/incidents\/01TESTINC"/.test(popup.corpo), popup.corpo);
  t('corpo sem HTML injetado do feed', !/<script|onerror=/i.test(popup.corpo), popup.corpo);
  // dispensa e o sino
  await p.evaluate(() => { try { dismissComunicado(); } catch (e) {} }); await p.waitForTimeout(700);
  const sino = await p.evaluate(() => { const l = typeof NOTIF_ICONS !== 'undefined' ? NOTIF_ICONS.vtex_incidente : null; return { icone: l, naLista: /VTEX/.test(document.body.innerText) }; });
  t('o sino conhece o ícone 🚨 do tipo vtex_incidente', sino.icone === '🚨', sino);
  const abre = await p.evaluate(() => { let r = null; const orig = window.openMural; window.openMural = () => { r = 'mural'; }; try { openNotif('vtex_x', '', 'dev', '', 'vtex_incidente'); } catch (e) { r = 'erro: ' + e.message; } window.openMural = orig; return r; });
  t('clicar na notificação abre o Mural', abre === 'mural', abre);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
