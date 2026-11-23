// 🗓️ Escala (escala-dev.html) — 🕒 filtro por horário (pedido do time, 23/11/2026): "quem está trabalhando às HH:MM".
// Folga sai; sem horário = dia todo; pausa no horário = fora. Vale pra grade, resumo do dia, faixa "Hoje", avisos e URL.
// PAGE=escala.html testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = G('pau', 'Paulo PO');
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const D = i => iso(add(seg, i));
const pub = (uid, nome, init, role) => ({ uid, nome, init, email: uid + '@ciahering.com.br', role, squads: { dados: true }, squads_roles: { dados: role } });
const seed = () => ({ kanban: {
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL', 'membro'), bru: pub('bru', 'Bruno Reis', 'BR', 'membro'), pau: pub('pau', 'Paulo PO', 'PP', 'po'), car: pub('car', 'Carla Dias', 'CD', 'membro') },
  escala: { [D(1)]: { dados: {
    ana: { t: 'trab', i: '09:00', f: '18:00', p: '12:00-13:00', por: 'ana', ts: 1 },
    bru: { t: 'plant', i: '20:00', f: '23:00', por: 'pau', ts: 1 },
    pau: { t: 'trab', por: 'pau', ts: 1 },
    car: { t: 'folga', por: 'car', ts: 1 },
  } } },
}});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const abrir = async qs => { await p.goto('http://localhost:8941/' + PAGE + qs); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(600); };
  const naCelula = () => p.evaluate(d => ['ana', 'bru', 'pau', 'car'].filter(u => /✅|🔥|🏖/.test(document.querySelector('.cel[data-u="' + u + '"][data-d="' + d + '"]')?.innerText || '')), D(1));
  const hora = async v => { await p.fill('#f-hora', v); await p.dispatchEvent('#f-hora', 'change'); await p.waitForTimeout(150); };

  await abrir('?squad=dados&semana=' + D(0));
  t('sem filtro: os 4 aparecem na terça (inclusive a folga)', (await naCelula()).join() === 'ana,bru,pau,car', await naCelula());
  t('o botão 🔎 Filtros aparece mesmo com uma squad só e sem subtime', await p.isVisible('#b-filtros'), 0);
  await p.click('#b-filtros'); await p.waitForSelector('#f-hora');
  await hora('10:00');
  t('10:00 → Ana e Paulo (Bruno ainda não entrou, Carla de folga)', (await naCelula()).join() === 'ana,pau', await naCelula());
  t('selo conta o filtro de horário', (await p.textContent('#f-badge')).trim() === '1', await p.textContent('#f-badge'));
  await hora('12:30');
  t('12:30 → só Paulo (Ana em pausa)', (await naCelula()).join() === 'pau', await naCelula());
  await hora('21:00');
  t('21:00 → Bruno (plantão) e Paulo (sem horário = dia todo)', (await naCelula()).join() === 'bru,pau', await naCelula());
  t('horário entra na URL (f_hora)', await p.evaluate(() => new URL(location.href).searchParams.get('f_hora') === '21:00'), 0);
  await p.click('#f-fechar');
  t('faixa avisa o filtro ativo', /às 21:00/.test(await p.textContent('#fhora')) && await p.isVisible('#fhora'), await p.textContent('#fhora'));
  await p.click('th.dia[data-dia="' + D(1) + '"]'); await p.waitForSelector('.lista-dia');
  const nomes = await p.$$eval('.lista-dia li b', a => a.map(x => x.textContent));
  t('resumo do dia segue o filtro e diz o horário', nomes.join() === 'Bruno Reis,Paulo PO' && /às 21:00/.test(await p.textContent('.md .sub')), [nomes, await p.textContent('.md .sub')]);
  await p.keyboard.press('Escape');
  await p.click('#fhora-x'); await p.waitForTimeout(150);
  t('"Ver o dia todo" tira o filtro, a faixa e o f_hora da URL', (await naCelula()).length === 4 && !(await p.isVisible('#fhora')) && await p.evaluate(() => !/f_hora/.test(location.search)), await naCelula());
  await abrir('?squad=dados&semana=' + D(0) + '&f_hora=10:00');
  t('link com f_hora abre já filtrado', (await naCelula()).join() === 'ana,pau', await naCelula());
  await abrir('?squad=dados&semana=' + D(0) + '&f_hora=<b>');
  t('f_hora inválido na URL é ignorado', (await naCelula()).length === 4 && !(await p.isVisible('#fhora')), await naCelula());
  await p.click('#b-cad'); await p.waitForSelector('#c-de');
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
