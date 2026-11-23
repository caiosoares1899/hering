// 🗓️ Escala (escala-dev.html) — 🎧 horário de atendimento humano do CX na semana da Black Friday 2026 (pedido do Caio, 23/11/2026).
// É do time (ATENDIMENTO_CX na página), não de uma pessoa. Não há squad de CX no Maré: aparece para qualquer squad, só com o botão 🎧 Atendimento CX ligado.
// PAGE=escala.html testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pub = (uid, nome, init, sq) => ({ uid, nome, init, email: uid + '@ciahering.com.br', role: 'membro', squads: { [sq]: true }, squads_roles: { [sq]: 'membro' } });
const seed = () => ({ kanban: {
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL', 'dados'), bru: pub('bru', 'Bruno Reis', 'BR', 'prf') },
  escala: { '2026-11-25': { dados: { ana: { t: 'trab', i: '08:00', f: '17:00', por: 'ana', ts: 1 } } }, '2026-11-27': { dados: { ana: { t: 'plant', i: '06:00', f: '22:00', por: 'ana', ts: 1 } } } },
}});
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const abrir = async qs => { await p.goto('http://localhost:8941/' + PAGE + qs); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('ana', 'Ana Lima')); await p.waitForTimeout(600); };
  await abrir('?squad=dados&semana=2026-11-23');
  t('sem apertar o botão, nada de atendimento', await p.isVisible('#b-atd') && !(await p.$('tr.atd')) && (await p.getAttribute('#b-atd', 'aria-pressed')) === 'false', 0);
  await p.click('#b-atd'); await p.waitForTimeout(150);
  const linha = await p.$$eval('tr.atd td', a => a.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  t('botão ligado: linha 🎧 com 8h–3h (qua), 6h–3h (qui), 6h–22h (sex) e nada nos outros dias',
    linha[2].startsWith('8h–3h') && /madrugada de 26\/11/.test(linha[2]) && linha[3].startsWith('6h–3h') && linha[4] === '6h–22h' && linha[0] === '–' && linha[5] === '–', linha);
  await p.click('th.dia[data-dia="2026-11-25"]'); await p.waitForSelector('.md');
  t('resumo do dia diz o atendimento humano', /Atendimento humano CX:\s*das 8h às 3h da manhã \(26\/11\)/.test(await p.textContent('.atd-dia')), await p.textContent('.atd-dia').catch(() => ''));
  await p.click('#d-modo [data-dm="gantt"]'); await p.waitForSelector('.gt-atd');
  const bars = await p.$$eval('.gt-atd .gt-bar', a => a.map(x => [x.classList.contains('herica') ? 'herica' : 'humano', x.title]));
  t('Gantt de 25/11: Herica de 0h a 8h (com 🤖) e humano de 8h até 24h', bars.length === 2 && bars[0][0] === 'herica' && /🤖 Atendimento exclusivo Herica · 00:00–08:00/.test(bars[0][1]) && bars[1][0] === 'humano' && /08:00–24:00/.test(bars[1][1]), bars);
  t('Gantt do dia com atendimento vai de 00h a 24h', /^00h/.test(await p.textContent('.gt-ax span:first-child')) && /^24h/.test(await p.textContent('.gt-ax span:last-child')), 0);
  await p.keyboard.press('Escape');
  await p.click('th.dia[data-dia="2026-11-27"]'); await p.waitForSelector('.gt-atd');
  const b27 = await p.$$eval('.gt-atd .gt-bar', a => a.map(x => x.classList.contains('herica') ? 'H' : 'h').join(''));
  t('27/11: humano (madrugada do dia 26) · Herica 3h–6h · humano 6h–22h · Herica depois das 22h', b27 === 'hHhH', b27);
  await p.keyboard.press('Escape');
  await abrir('?squad=prf&semana=2026-11-23');
  t('o botão fica ligado (lembrado) e vale para outra squad', (await p.getAttribute('#b-atd', 'aria-pressed')) === 'true' && !!(await p.$('tr.atd')), 0);
  await p.click('#v-global'); await p.waitForTimeout(200);
  t('Todas as squads também mostra a linha', !!(await p.$('tr.atd')), 0);
  await p.click('#b-atd'); await p.waitForTimeout(150);
  t('desligar tira a linha', !(await p.$('tr.atd')), 0);
  await abrir('?squad=dados&semana=2026-11-30');
  t('semana sem horário: o botão nem aparece', !(await p.isVisible('#b-atd')), 0);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
