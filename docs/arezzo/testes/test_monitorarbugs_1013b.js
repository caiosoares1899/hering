// /monitorarbugs (13/10, 2ª rodada — Escala): (1) no celular a barra da semana ("Hoje", "🔥 Black Friday") estourava a largura (rolagem lateral na página);
// (2) "📋 Copiar menções" do dia na visão global repetia @fulano (e inflava o contador) quando a pessoa está em duas squads.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hoje = iso(new Date());
const P = {
  paulo: { uid: 'paulo', nome: 'Paulo PO', init: 'PP', email: 'paulo@ciahering.com.br', role: 'po', squads: { dados: true, dev: true }, squads_roles: { dados: 'po', dev: 'po' } },
  ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true, dev: true }, squads_roles: { dados: 'membro', dev: 'membro' } },   // nas DUAS squads
  bia: { uid: 'bia', nome: 'Bia Reis', init: 'BR', email: 'bia@ciahering.com.br', role: 'membro', squads: { dev: true }, squads_roles: { dev: 'membro' } },
};
const e = { t: 'trab', por: 'paulo', ts: 1 };
const seed = () => ({ kanban: { squads_meta: { dev: { label: 'Dev', emoji: '🧪' } }, usuarios_publicos: P, escala: { [hoje]: { dados: { ana: e }, dev: { ana: e, bia: e } } } } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 300))); };
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); await p.goto('http://localhost:8941/escala-dev.html?squad=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('paulo', 'Paulo PO')); await p.waitForTimeout(900);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    t('celular (390 px): a página não ganha rolagem lateral', m.sw <= m.cw, m); await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); await p.goto('http://localhost:8941/escala-dev.html?visao=global'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('paulo', 'Paulo PO')); await p.waitForTimeout(900);
    await p.evaluate(h => { window.__copiado = ''; navigator.clipboard.writeText = async t => { window.__copiado = t; }; }, hoje);
    await p.click('.gdia[data-gd="' + hoje + '"]'); await p.waitForSelector('#d-menc');
    const rot = await p.textContent('#d-menc');
    await p.click('#d-menc'); await p.waitForTimeout(200);
    const txt = await p.evaluate(() => window.__copiado), ms = txt.split(' ').filter(Boolean);
    t('"Copiar menções": cada pessoa uma vez só (Ana está nas duas squads)', ms.length === 2 && new Set(ms).size === 2 && /\(2\)/.test(rot), { txt, rot });
    await ctx.close(); }
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); await b.close(); process.exit(ok ? 0 : 1);
})();
