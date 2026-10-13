// 🗓️ Escala no mês do 📅 Calendários (kanban-dev): minha escala + quantos escalados em cada dia, interruptor "👥 Escala", clique abre a Escala na semana do dia.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'), hoje = new Date(), Y = hoje.getFullYear(), M = hoje.getMonth() + 1;
const dia = n => Y + '-' + pad(M) + '-' + pad(n);
const P = {
  ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
  bia: { uid: 'bia', nome: 'Bia Reis', init: 'BR', email: 'bia@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
  caio: { uid: 'caio', nome: 'Caio Souza', init: 'CS', email: 'caio@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  zed: { uid: 'zed', nome: 'Zed Fora', init: 'ZF', email: 'zed@ciahering.com.br', role: 'membro', squads: { prf: true }, squads_roles: { prf: 'membro' } },
};
const e = (t, o) => Object.assign({ t, por: 'caio', ts: 1 }, o || {});
const seed = () => ({ kanban: { usuarios: { ana: Object.assign({ inscrito: true }, P.ana) }, usuarios_publicos: P, config: { adm_emails: [] },
  escala: { [dia(10)]: { dados: { ana: e('trab', { i: '09:00', f: '18:00' }), bia: e('trab'), caio: e('plant') }, prf: { zed: e('trab') } }, [dia(11)]: { dados: { ana: e('folga'), bia: e('trab') } }, [dia(12)]: { dados: { bia: e('trab') } } } } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/kanban-dev.html?squad=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('ana', 'Ana Lima')); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  await p.evaluate(() => openCal()); await p.waitForTimeout(800);
  const cel = d => p.evaluate(n => { const c = [...document.querySelectorAll('#cal-grid .cal-day:not(.other-month)')].find(x => x.querySelector('.cal-day-num').textContent.trim() === String(n)); const r = c && c.querySelector('.cal-esc-row'); return r ? { me: (r.querySelector('.cal-esc-me') || {}).textContent || '', meCls: (r.querySelector('.cal-esc-me') || {}).className || '', n: (r.querySelector('.cal-esc-n') || {}).textContent || '' } : null; }, d);
  let c10 = await cel(10), c11 = await cel(11), c12 = await cel(12), c13 = await cel(13);
  t('dia 10: a MINHA escala (✅ 09:00–18:00) e "👥 3 · 🔥1" (Ana, Bia e Caio de plantão; quem é de outra squad não conta)', c10 && /09:00–18:00/.test(c10.me) && /t-trab/.test(c10.meCls) && /👥\s*3\s*·\s*🔥1/.test(c10.n), c10);
  t('dia 11: minha folga (🏖️) e só 1 escalado', c11 && /🏖️/.test(c11.me) && /t-folga/.test(c11.meCls) && /👥\s*1$/.test(c11.n.trim()), c11);
  t('dia 12: sem escala minha — só a contagem (👥 1)', c12 && !c12.me && /👥\s*1/.test(c12.n), c12);
  t('dia sem nada cadastrado não ganha linha de escala', c13 === null, c13);
  t('só o intervalo visível foi lido (startAt/endAt em kanban/escala)', await p.evaluate(() => window.__log.filter(l => l[0] === 'get' && l[1] === 'kanban/escala').length === 1), await p.evaluate(() => window.__log.filter(l => l[1] === 'kanban/escala')));
  // popover do dia
  await p.evaluate(() => { [...document.querySelectorAll('#cal-grid .cal-day:not(.other-month)')].find(x => x.querySelector('.cal-day-num').textContent.trim() === '10').click(); }); await p.waitForTimeout(300);
  const pop = await p.evaluate(() => document.getElementById('cal-day-pop-body').innerText.replace(/\s+/g, ' '));
  t('clicar no dia lista quem está: plantão (Caio), escalados (Ana 09:00–18:00, Bia)', /Plantão.*Caio/.test(pop) && /Escalados.*Ana.*09:00–18:00.*Bia/.test(pop) && !/Zed/.test(pop), pop);
  // abrir na Escala
  await p.evaluate(() => calAbrirEscala('2026-10-10'.replace(/^\d{4}-\d{2}/, (document.querySelector('#cal-month-lbl').textContent, '' + new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'))))); await p.waitForTimeout(500);
  const fr = await p.evaluate(() => ({ src: document.getElementById('cal-escala-fr').getAttribute('src'), esc: document.getElementById('cal-ov').classList.contains('cal-esc') }));
  t('"Abrir na Escala" muda pra aba 👥 e carrega a Escala na semana do dia', fr.esc && /escala-dev\.html\?squad=dados&semana=\d{4}-\d{2}-10&embed=1/.test(fr.src), fr);
  // voltar pra Tudo relê (o iframe pode ter cadastrado) e interruptor
  await p.evaluate(() => changeCalView('both')); await p.waitForTimeout(800);
  t('voltar da Escala relê o mês (2 leituras no total) e as marcas continuam', await p.evaluate(() => window.__log.filter(l => l[0] === 'get' && l[1] === 'kanban/escala').length === 2) && !!(await cel(10)), 0);
  await p.click('#cal-esc-toggle'); await p.waitForTimeout(300);
  t('interruptor "👥 Escala ✗" tira as marcas do mês e fica lembrado neste aparelho', (await cel(10)) === null && await p.evaluate(() => localStorage.getItem('mare_cal_escala') === '0' && /✗/.test(document.getElementById('cal-esc-toggle').textContent)), 0);
  await p.click('#cal-esc-toggle'); await p.waitForTimeout(800);
  t('ligar de novo traz as marcas de volta', !!(await cel(10)), 0);
  t('sem erro de JS (Maré)', !errs.length, errs);
  await ctx.close();
  // conta sem permissão de leitura: o mês segue normal, sem marcas e sem erro
  { const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx2, seed());
    await ctx2.addInitScript(() => { window.__denyGet = pa => pa === 'kanban/escala'; });
    const q = await ctx2.newPage(); const er2 = []; q.on('pageerror', e => er2.push(e.message));
    await q.goto('http://localhost:8941/kanban-dev.html?squad=dados'); await q.waitForFunction(() => !!window.__authCb); await q.evaluate(x => window.__authCb(x), G('ana', 'Ana Lima')); await q.waitForTimeout(3000);
    await q.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCal(); }); await q.waitForTimeout(800);
    t('sem permissão de leitura: o calendário abre normal, sem marcas e sem erro', await q.evaluate(() => document.querySelectorAll('#cal-grid .cal-day').length > 20 && !document.querySelector('.cal-esc-row')) && !er2.length, er2);
    await ctx2.close(); }
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); await b.close(); process.exit(ok ? 0 : 1);
})();
