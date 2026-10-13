// 🗓️ Escala → aviso à pessoa (sino + push) quando um gestor cadastra/limpa a escala dela. Playwright + fakefb.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const P = {
  paulo: { uid: 'paulo', nome: 'Paulo PO', init: 'PP', email: 'paulo@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
};
const seed = () => ({ kanban: { usuarios: { ana: Object.assign({ inscrito: true }, P.ana), paulo: Object.assign({ inscrito: true }, P.paulo) }, usuarios_publicos: P, config: { adm_emails: [] }, escala: {} } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 300))); };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const notifs = async (p, uid) => Object.values(await store(p, 'kanban/usuarios/' + uid + '/notificacoes') || {});
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/escala-dev.html?squad=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('paulo', 'Paulo PO')); await p.waitForTimeout(900);
    const cadastra = async (uid, extra) => { await p.click('#b-cad'); await p.waitForSelector('#c-sq'); if (uid) await p.selectOption('#c-uid', uid); if (extra) await extra(); };
    // 1) PO cadastra a Ana (seg–sex, escalado 09:00–18:00)
    await cadastra('ana', async () => { await p.fill('#c-i', '09:00'); await p.fill('#c-f', '18:00'); });
    await p.click('#c-salvar'); await p.waitForTimeout(700);
    let n = await notifs(p, 'ana');
    t('Ana recebe UMA notificação do tipo escala', n.length === 1 && n[0].type === 'escala', n);
    t('título "Sua escala foi cadastrada", não lida, com squad e a 1ª data (semana certa)', n[0] && /cadastrada/.test(n[0].title) && n[0].read === false && n[0].squad === 'dados' && n[0].okrObjId === iso(seg), n[0]);
    t('o texto diz squad, período (5 dias), tipo/horário e quem cadastrou', n[0] && /Dados/.test(n[0].sub) && /5 dias/.test(n[0].sub) && /09:00–18:00/.test(n[0].sub) && /por Paulo/.test(n[0].sub), n[0] && n[0].sub);
    t('quem cadastrou não recebe aviso de si mesmo', (await notifs(p, 'paulo')).length === 0, await notifs(p, 'paulo'));
    // 2) PO cadastra a PRÓPRIA escala → ninguém é avisado
    await cadastra('paulo'); await p.click('#c-salvar'); await p.waitForTimeout(700);
    t('cadastrar a própria escala não gera aviso pra ninguém', (await notifs(p, 'paulo')).length === 0 && (await notifs(p, 'ana')).length === 1, [await notifs(p, 'paulo'), await notifs(p, 'ana')].map(a => a.length));
    // 3) PO limpa o período da Ana
    await cadastra('ana'); await p.click('#c-limpar'); await p.waitForTimeout(700);
    n = (await notifs(p, 'ana')).sort((a, c) => a.ts.localeCompare(c.ts));
    t('limpar o período avisa "Sua escala foi removida"', n.length === 2 && /removida/.test(n[1].title) && /escala removida/.test(n[1].sub), n.map(x => x.title));
    t('sem erro de JS (Escala)', !errs.length, errs); await ctx.close(); }
  // 4) o clique no sino do Maré abre a Escala na semana cadastrada
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const s = seed(); s.kanban.usuarios.ana.notificacoes = { n1: { id: 'n1', type: 'escala', title: '🗓️ Sua escala foi cadastrada', sub: 'Dados · 23/11', squad: 'dados', okrObjId: '2026-11-23', read: false, ts: new Date().toISOString() } };
    await fake.install(ctx, s);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/kanban-dev.html?squad=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('ana', 'Ana Lima')); await p.waitForTimeout(3000);
    await p.evaluate(() => { window.__aberto = null; window.open = u => { window.__aberto = u; return { opener: null }; }; });
    await p.evaluate(() => openNotif('n1', null, 'dados', null, 'escala', '2026-11-23')); await p.waitForTimeout(300);
    const u = await p.evaluate(() => window.__aberto);
    t('clicar abre escala-dev.html na squad e semana certas', /escala-dev\.html\?visao=squad&squad=dados&semana=2026-11-23$/.test(u || ''), u);
    t('o ícone 🗓️ está no catálogo do sino', await p.evaluate(() => NOTIF_ICONS.escala === '🗓️' && MareNotif.ICONS.escala === '🗓️' && !!MareNotif.TIPOS.find(x => x.id === 'escala')), 0);
    t('sem erro de JS (Maré)', !errs.length, errs); await ctx.close(); }
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); await b.close(); process.exit(ok ? 0 : 1);
})();
