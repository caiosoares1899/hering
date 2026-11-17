// 🔒 17/11/2026 (/monitorarbugs, trava de edição do card, pensando na Black Friday). Card aberto por outra pessoa = "modo leitura"
// (pointer-events:none no corpo do modal). Este teste prova que NENHUM caminho de gravação passa por cima de quem está editando:
// teclado (Tab + digitar), Ctrl+S e botões do rodapé.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const pub = (n, i) => ({ nome: n, init: i, role: 'membro', inscrito: true, squads: { site: true } });
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: pub('Adrian Teste', 'AD'), jm: pub('Juliana Teste', 'JM') },
  config: { adm_emails: [] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }, { id: 'prog', name: 'In Progress' }],
    cards_index: { c1: 'k0' }, cards_updated_at: { c1: '2026-11-17T10:00:00.000Z' },
    card_locks: { c1: { uid: 'jm', who: 'Juliana Teste', init: 'JM', ts: Date.now() + 3600e3 } },
    cards: { k0: { id: 'c1', title: 'Card da Juliana', col: 'prog', owner: 'JM', desc: 'texto da Juliana', updatedAt: '2026-11-17T10:00:00.000Z' } } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900); return { ctx, p, errs }; };
  const banco = p => p.evaluate(() => window.__store.kanban.squads.site.dados.cards.k0);
  try {
    { const { ctx, p } = await abrir();
      t('card travado pela Juliana abre em modo leitura', await p.evaluate(() => document.querySelector('#card-ov .modal-body').classList.contains('locked-ro')), '');
      // a) teclado: Tab até o título e digitar
      await p.evaluate(() => document.getElementById('m-title').focus());
      await p.keyboard.type(' EDITADO PELO ADRIAN'); await p.waitForTimeout(2500);
      let c = await banco(p);
      t('teclado (Tab + digitar) NÃO grava no card travado', c.title === 'Card da Juliana', c.title);
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      // b) Ctrl+S
      await p.evaluate(() => { document.getElementById('m-desc').value = 'por cima'; });
      await p.keyboard.press('Control+s'); await p.waitForTimeout(2500);
      let c = await banco(p);
      t('Ctrl+S NÃO grava no card travado', c.desc === 'texto da Juliana', c.desc);
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      // c) botões do rodapé: quais ficam clicáveis?
      const cl = await p.evaluate(() => ['btn-save-card', 'btn-archive-card', 'btn-del-card', 'btn-pause-card', 'btn-continuo-card'].map(id => { const el = document.getElementById(id); if (!el) return id + ':—'; const r = el.getBoundingClientRect(); if (!r.width) return id + ':oculto'; const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const ro = !!el.closest('.locked-ro'); return id + ':' + (top && (top === el || el.contains(top)) && getComputedStyle(el).pointerEvents !== 'none' && !ro ? 'CLICÁVEL' : 'bloqueado'); }));
      console.log('botões:', cl.join(' · '));
      const sv = await p.$('#btn-save-card');
      if (sv) { await p.evaluate(() => { document.getElementById('m-desc').value = 'por cima (botão)'; }); await sv.click({ force: false, timeout: 2000 }).catch(e => console.log('clique bloqueado:', e.message.split('\n')[0])); await p.waitForTimeout(2500); }
      const c = await banco(p);
      t('💾 Salvar NÃO grava no card travado', c.desc === 'texto da Juliana', c.desc);
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      await p.click('#btn-pause-card').catch(() => {}); await p.waitForTimeout(2000);
      let c = await banco(p);
      t('⏸ Pausar NÃO mexe no card travado', !c.paused, { paused: c.paused });
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      await p.click('#btn-continuo-card').catch(() => {}); await p.waitForTimeout(2000);
      let c = await banco(p);
      t('♾️ Contínuo NÃO mexe no card travado', !c.continuo, { continuo: c.continuo });
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      await p.click('#btn-archive-card').catch(() => {}); await p.waitForTimeout(1500);
      await p.evaluate(() => { const ok = [...document.querySelectorAll('button')].find(x => /^(Arquivar|Confirmar|OK)$/i.test((x.textContent || '').trim()) && x.offsetParent); if (ok) ok.click(); }); await p.waitForTimeout(2000);
      let c = await banco(p);
      t('📦 Arquivar NÃO mexe no card travado', !c.archived, { archived: c.archived });
      await ctx.close(); }
    // sem trava: tudo funciona como antes (o card é meu)
    { const { ctx, p } = await abrir();
      await p.evaluate(() => { closeOv('card-ov'); }); await p.waitForTimeout(300);
      await p.evaluate(() => window._remove(window._ref(window._db, 'kanban/squads/site/dados/card_locks/c1'))); await p.waitForTimeout(300);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      t('card livre abre editável', !(await p.evaluate(() => document.querySelector('#card-ov .modal-body').classList.contains('locked-ro'))), '');
      await p.evaluate(() => document.getElementById('m-title').focus()); await p.keyboard.type(' (meu)'); await p.waitForTimeout(2500);
      t('card livre: digitar grava normalmente', (await banco(p)).title === 'Card da Juliana (meu)', (await banco(p)).title);
      // perdi a trava com um autosave pendente (a Juliana assumiu pelo "Pedir o card")
      await p.evaluate(() => document.getElementById('m-title').focus()); await p.keyboard.type(' X');
      await p.evaluate(() => window._set(window._ref(window._db, 'kanban/squads/site/dados/card_locks/c1'), { uid: 'jm', who: 'Juliana Teste', init: 'JM', ts: Date.now() + 3600e3 }));
      await p.waitForTimeout(2500);
      t('perdi a trava no meio do debounce: o autosave pendente NÃO grava por cima', (await banco(p)).title === 'Card da Juliana (meu)', (await banco(p)).title);
      await ctx.close(); }
    // liberação pelo servidor (onDisconnect): a página some sem beforeunload (iframe fechado no Oceano, celular, queda)
    { const { ctx, p } = await abrir();
      const LP = 'kanban/squads/site/dados/card_locks/c1';
      await p.evaluate(() => { closeOv('card-ov'); }); await p.waitForTimeout(300);
      await p.evaluate(() => window._remove(window._ref(window._db, 'kanban/squads/site/dados/card_locks/c1'))); await p.waitForTimeout(300);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      t('ao pegar a trava, o servidor fica armado para apagá-la se a conexão cair', await p.evaluate(lp => (window.__onDisc || {})[lp] === 'remove', LP), await p.evaluate(() => window.__onDisc));
      await p.evaluate(() => window.__simDisconnect()); await p.waitForTimeout(600);
      const re = await p.evaluate(lp => ({ lock: lp.split('/').reduce((a, k) => a && a[k], window.__store), armado: (window.__onDisc || {})[lp] }), LP);
      t('queda passageira: o servidor apagou e o modal reassumiu e re-armou na hora', re.lock && re.lock.uid === 'ad' && re.armado === 'remove', re);
      // a Juliana assume (pedido vencido): minha liberação pelo servidor é cancelada
      await p.evaluate(() => window._set(window._ref(window._db, 'kanban/squads/site/dados/card_locks/c1'), { uid: 'jm', who: 'Juliana Teste', init: 'JM', ts: Date.now() + 3600e3 })); await p.waitForTimeout(600);
      t('perdi a trava: a minha conexão caindo não apaga a trava da Juliana', await p.evaluate(lp => !(window.__onDisc || {})[lp], LP), await p.evaluate(() => window.__onDisc));
      await p.evaluate(() => window.__simDisconnect()); await p.waitForTimeout(300);
      t('…a trava da Juliana continua no banco', await p.evaluate(lp => (lp.split('/').reduce((a, k) => a && a[k], window.__store) || {}).uid === 'jm', LP), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      const LP = 'kanban/squads/site/dados/card_locks/c1';
      await p.evaluate(() => { closeOv('card-ov'); }); await p.waitForTimeout(300);
      await p.evaluate(() => window._remove(window._ref(window._db, 'kanban/squads/site/dados/card_locks/c1'))); await p.waitForTimeout(300);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      await p.evaluate(() => closeOv('card-ov')); await p.waitForTimeout(900);
      const fim = await p.evaluate(lp => ({ lock: lp.split('/').reduce((a, k) => a && a[k], window.__store) || null, armado: (window.__onDisc || {})[lp] || null }), LP);
      t('fechar o card pelo ✕: trava removida e liberação pelo servidor cancelada', !fim.lock && !fim.armado, fim);
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
