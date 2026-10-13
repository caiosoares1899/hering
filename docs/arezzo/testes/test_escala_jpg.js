// 🖼️ Escala → Baixar JPG (dia · semana · mês): modal, prévia desenhada no canvas, download real, respeito à visão/subtime. Playwright + fakefb.
// SHOTS=1 salva as imagens geradas em /tmp/escala_jpg_*.jpg pra olhar.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const fs = require('fs');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const D = i => iso(add(seg, i));
const pubs = () => {
  const o = {}; const nomes = ['Ana Lima', 'Bruno Reis', 'Paulo PO', 'Carla Dias', 'Caio Souza', 'Duda Melo', 'Eva Rocha', 'Fábio Lemos'];
  nomes.forEach((n, i) => { const u = n.split(' ')[0].toLowerCase(); o[u] = { uid: u, nome: n, init: n.split(' ').map(x => x[0]).join(''), email: u + '@ciahering.com.br', role: i === 2 ? 'po' : 'membro', squads: { dados: true, dev: i > 3 }, squads_roles: { dados: i === 2 ? 'po' : 'membro', dev: 'membro' } }; });
  return o;
};
const seed = () => {
  const esc = {}; const P = pubs();
  for (let i = 0; i < 28; i++) { const dt = D(i - 7), wd = (i - 7 + 70) % 7; if (wd > 4) { if (i % 7 === 5) esc[dt] = { dados: { bruno: { t: 'plant', i: '08:00', f: '14:00', por: 'x', ts: 1 }, paulo: { t: 'plant', por: 'x', ts: 1 } } }; continue; }
    esc[dt] = { dados: {}, dev: {} }; Object.keys(P).forEach((u, k) => { const sq = P[u].squads.dev ? 'dev' : 'dados'; if ((i + k) % 5 === 0) esc[dt][sq][u] = { t: 'folga', por: 'x', ts: 1 }; else esc[dt][sq][u] = { t: 'trab', i: k % 2 ? '09:00' : '', f: k % 2 ? '18:00' : '', n: k === 1 ? 'reunião cliente' : undefined, por: 'x', ts: 1 }; if (esc[dt][sq][u].n === undefined) delete esc[dt][sq][u].n; }); }
  return { kanban: { squads_meta: { dev: { label: 'Dev', emoji: '🧪' } }, usuarios_publicos: P, escala: esc, squads: { dados: { dados: { subtimes: [{ id: 's1', name: 'Designers', members: ['AL', 'BR'] }] } } } } };
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + PAGE + '?squad=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('paulo', 'Paulo PO')); await p.waitForTimeout(900);
  const dims = () => p.evaluate(() => { const c = document.querySelector('#j-prev canvas'); return c ? { w: c.width, h: c.height, vazio: (() => { const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, 60).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] > 150) n++; return n; })() } : null; });
  const shot = async nome => { if (process.env.SHOTS) { const d = await p.evaluate(() => document.querySelector('#j-prev canvas').toDataURL('image/jpeg', .92)); fs.writeFileSync('/tmp/escala_jpg_' + nome + '.jpg', Buffer.from(d.split(',')[1], 'base64')); } };
  t('botão 🖼️ Baixar JPG na barra', await p.evaluate(() => !!document.getElementById('b-jpg') && /JPG/.test(document.getElementById('b-jpg').textContent)), 0);
  await p.click('#b-jpg'); await p.waitForSelector('#j-prev canvas');
  t('abre o modal; padrão = Semana, com a prévia desenhada', await p.evaluate(() => document.querySelector('#j-modo [aria-selected="true"]').dataset.m === 'semana') && !!(await dims()) && (await dims()).vazio > 50, await dims());
  t('"Baixar JPG" habilitado quando a imagem está pronta', await p.evaluate(() => !document.getElementById('j-baixar').disabled), 0);
  await shot('semana_squad');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#j-baixar')]);
  const f = '/tmp/escala_dl.jpg'; await dl.saveAs(f); const buf = fs.readFileSync(f);
  t('baixa um .jpg de verdade (assinatura FFD8) com nome descritivo', buf[0] === 0xFF && buf[1] === 0xD8 && buf.length > 20000 && /^escala-dados-semana-\d{4}-\d{2}-\d{2}\.jpg$/.test(dl.suggestedFilename()), [buf.length, dl.suggestedFilename()]);
  await p.click('#j-modo [data-m="dia"]'); await p.waitForTimeout(600); await p.waitForSelector('#j-prev canvas'); await shot('dia_squad');
  t('modo Dia: título do dia e imagem gerada', /\d{2}\/\d{2}\/\d{4}/.test(await p.textContent('#j-per')) && !!(await dims()), await p.textContent('#j-per'));
  await p.click('#j-modo [data-m="mes"]'); await p.waitForTimeout(800); await p.waitForSelector('#j-prev canvas'); await shot('mes_squad');
  t('modo Mês: título "Mês de ano" e imagem maior', /de \d{4}/.test(await p.textContent('#j-per')) && (await dims()).h > 700, [await p.textContent('#j-per'), await dims()]);
  await p.fill('#j-ref', D(14)); await p.dispatchEvent('#j-ref', 'change'); await p.waitForTimeout(700);
  t('mudar a data de referência refaz a imagem', !!(await dims()), 0);
  await p.click('#j-fechar'); await p.waitForTimeout(200);
  // global
  await p.click('#v-global'); await p.waitForTimeout(300); await p.click('#b-jpg'); await p.waitForSelector('#j-prev canvas'); await shot('semana_global');
  t('visão global: modal avisa "Todas as squads"', /Todas as squads/.test(await p.textContent('.md .sub')), await p.textContent('.md .sub'));
  await p.click('#j-modo [data-m="mes"]'); await p.waitForTimeout(800); await p.waitForSelector('#j-prev canvas'); await shot('mes_global');
  await p.click('#j-modo [data-m="dia"]'); await p.waitForTimeout(700); await shot('dia_global');
  t('global: Dia e Mês geram imagem', !!(await dims()), 0);
  await p.click('#j-fechar');
  // filtro de subtime respeitado
  await p.click('#f-subs [data-fsub="Designers"]'); await p.waitForTimeout(200); await p.click('#v-squad'); await p.click('#b-jpg'); await p.waitForSelector('#j-prev canvas'); await shot('semana_subtime');
  t('com subtime filtrado o modal diz o subtime', /subtime\s+Designers/i.test(await p.textContent('.md .sub')), await p.textContent('.md .sub'));
  await p.click('#j-fechar');
  // atalho no detalhe do dia
  await p.click('th.dia >> nth=0'); await p.waitForSelector('#d-jpg'); await p.click('#d-jpg'); await p.waitForSelector('#j-prev canvas');
  t('atalho 🖼️ JPG do dia (no detalhe do dia) abre direto no modo Dia', await p.evaluate(() => document.querySelector('#j-modo [aria-selected="true"]').dataset.m === 'dia'), 0);
  // corrida: troca rápida de modo não deixa imagem velha
  await p.click('#j-modo [data-m="mes"]'); await p.click('#j-modo [data-m="semana"]'); await p.waitForTimeout(1200);
  t('troca rápida de modo: vale o último clique', await p.evaluate(() => document.querySelector('#j-modo [aria-selected="true"]').dataset.m === 'semana') && /Semana/.test(await p.textContent('#j-per')), await p.textContent('#j-per'));
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
