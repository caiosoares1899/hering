// 🗓️ Escala — 🔎 mini tela de filtros (botão na barra), ☕ pausas no cadastro/lista/Gantt e 🖼️ JPG da Visão Gantt.
// SHOTS=1 salva as imagens em /tmp/escala_pausas_*.jpg pra olhar.
// PAGE=escala.html testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome, email) => ({ uid, email: email || uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const ANA = G('ana', 'Ana Lima'), BRU = G('bru', 'Bruno Reis'), PAU = G('pau', 'Paulo PO'), ORG = G('org', 'Olga Org'), ADM = G('adm', 'Adm Geral'), EXT = { uid: 'ext', email: 'x@gmail.com', displayName: 'Ext', photoURL: '', providerData: [{ providerId: 'google.com' }] };
// datas relativas ao dia do teste: semana corrente (segunda..domingo) — o teste calcula tudo a partir de hoje
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const D = i => iso(add(seg, i));   // D(0)=segunda ... D(6)=domingo da semana atual
const pubs = () => ({
  ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true, dev: true }, squads_roles: { dados: 'membro', dev: 'membro' } },
  bru: { uid: 'bru', nome: 'Bruno Reis', init: 'BR', email: 'bru@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
  pau: { uid: 'pau', nome: 'Paulo PO', init: 'PP', email: 'pau@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  zeca: { uid: 'zeca', nome: 'Zeca Dev', init: 'ZD', email: 'zeca@ciahering.com.br', role: 'membro', squads: { dev: true }, squads_roles: { dev: 'membro' } },
  org: { uid: 'org', nome: 'Olga Org', init: 'OO', email: 'org@ciahering.com.br', role: 'membro', squads: { dev: true }, squads_roles: { dev: 'organizador' } },
  adm: { uid: 'adm', nome: 'Adm Geral', init: 'AG', email: 'adm@ciahering.com.br', role: 'adm', squads: {} },
  cv: { uid: 'cv', nome: 'Convidado', init: 'CV', email: 'cv@ciahering.com.br', role: 'convidado', squads: { dados: true }, squads_roles: { dados: 'convidado' } },
});
const fs = require('fs');
const seed = () => ({ kanban: {
  squads_meta: { dev: { label: 'Dev', emoji: '🧪' } },
  usuarios_publicos: pubs(),
  escala: {
    [D(0)]: {
      dados: { ana: { t: 'trab', i: '09:00', f: '18:00', p: '12:00-13:00', por: 'ana', ts: 1 }, bru: { t: 'plant', i: '08:00', f: '20:00', p: '12:00-12:30;15:00-15:15', n: 'plantão BF', por: 'pau', ts: 1 }, pau: { t: 'trab', por: 'pau', ts: 1 } },
      dev: { zeca: { t: 'trab', i: '10:00', f: '19:00', por: 'zeca', ts: 1 }, ana: { t: 'folga', por: 'ana', ts: 1 } },
    },
  },
  squads: {
    dados: { dados: { subtimes: [{ id: 's1', name: 'Designers', members: ['AL', 'BR'] }, { id: 's2', name: 'Redatores', members: ['PP'] }] } },
    dev: { dados: { subtimes: [{ id: 's3', name: 'Backend', members: ['ZD', 'OO'] }] } },
  },
}});
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const open = async (user, qs, opts) => {
    opts = opts || {};
    const ctx = await b.newContext({ viewport: opts.vp || { width: 1280, height: 900 }, acceptDownloads: true }); await fake.install(ctx, opts.seed || seed());
    const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + PAGE + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(600); return { ctx, p, errs };
  };
  const txts = (p, sel) => p.$$eval(sel, a => a.map(x => x.textContent.trim().replace(/\s+/g, ' ')));
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
  const store = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.escala || {})));

  // ── MINI TELA DE FILTROS ──
  { const { ctx, p, errs } = await open(ANA, '?visao=global&semana=' + D(0));
    const alturaAntes = await p.evaluate(() => document.querySelector('#view').getBoundingClientRect().top);
    t('a barra de chips saiu da página: só o botão 🔎 Filtros (sem selo enquanto nada filtra)', await vis(p, '#b-filtros') && !(await p.$('#filtros')) && !(await p.$('#f-sqs')) && !(await vis(p, '#f-badge')), 0);
    t('a escala começa mais acima (a faixa de filtros não ocupa mais espaço)', alturaAntes < 330, alturaAntes);
    await p.click('#b-filtros'); await p.waitForSelector('#f-sqs');
    const dim = await p.evaluate(() => { const m = document.querySelector('.md'); return { w: m.getBoundingClientRect().width, mini: m.classList.contains('mini') }; });
    t('abre uma mini tela estreita (≤ 430 px) com os chips de squad e de subtime', dim.mini && dim.w <= 431 && (await txts(p, '#f-sqs .fchip')).slice(0, 3).join('|') === 'Todas|📊 Dados|🧪 Dev' && (await txts(p, '#f-subs .fchip')).join('|') === 'Todos|Backend|Designers|Redatores', [dim, await txts(p, '#f-subs .fchip')]);
    await p.click('#f-sqs [data-fsq="dev"]'); await p.click('#f-subs [data-fsub="Backend"]'); await p.waitForTimeout(150);
    t('clicar nos chips filtra a página por trás SEM fechar a mini tela; o selo mostra 2 filtros', (await p.$$eval('tbody th.sqn .nm', a => a.length)) === 1 && !!(await p.$('#f-sqs')) && (await txts(p, '#f-badge')).join() === '2' && /Dev, Backend/.test(await p.getAttribute('#b-filtros', 'title')), await p.getAttribute('#b-filtros', 'title'));
    t('o botão "Pronto" mostra quantos filtros e fecha a mini tela', (await txts(p, '#f-fechar')).join() === 'Pronto (2)', await txts(p, '#f-fechar'));
    await p.click('#f-fechar'); await p.waitForTimeout(100);
    t('fechada: a página segue filtrada e o botão da barra fica em destaque', !(await p.$('#f-sqs')) && (await p.$$eval('tbody th.sqn .nm', a => a.length)) === 1 && await p.evaluate(() => document.getElementById('b-filtros').classList.contains('on')), 0);
    await p.click('#b-filtros'); await p.waitForSelector('#f-sqs'); await p.click('#f-limpar'); await p.waitForTimeout(100);
    t('✕ Limpar filtros dentro da mini tela zera tudo (selo some, botão sai do destaque)', !(await vis(p, '#f-badge')) && (await p.$$eval('tbody th.sqn .nm', a => a.length)) === 2 && await p.evaluate(() => !document.getElementById('b-filtros').classList.contains('on')), 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    t('Esc fecha a mini tela', !(await p.$('#f-sqs')), 0);
    t('sem erro de JS (mini tela)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?squad=dados&semana=' + D(0), { vp: { width: 390, height: 780 } });
    const sem = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    await p.click('#b-filtros'); await p.waitForSelector('#f-sqs');
    t('celular (390 px): sem rolagem lateral e a mini tela cabe na largura', sem && await p.evaluate(() => document.querySelector('.md').getBoundingClientRect().width <= window.innerWidth), 0);
    await ctx.close(); }

  // ── PAUSAS NO CADASTRO ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.click('#b-cad'); await p.waitForSelector('#c-pausas', { state: 'attached' });
    t('o cadastro tem a seção ☕ Pausas (vazia) e o botão de adicionar', (await p.$$('#c-pausas .prow')).length === 0 && await vis(p, '#c-addp'), 0);
    await p.click('[data-ds="0"]'); for (const i of [1, 2, 3, 4]) await p.click('[data-ds="' + i + '"]');   // desmarca seg–sex
    await p.click('[data-ds="2"]'); await p.fill('#c-de', D(2)); await p.fill('#c-ate', D(2)); await p.evaluate(() => document.getElementById('c-de').dispatchEvent(new Event('input')));
    await p.fill('#c-i', '09:00'); await p.fill('#c-f', '18:00');
    await p.click('#c-addp'); await p.click('#c-addp');
    t('"Adicionar pausa" cria linhas (saída/volta) e some ao chegar em 3', (await p.$$('#c-pausas .prow')).length === 2 && await vis(p, '#c-addp'), 0);
    await p.click('#c-addp'); t('limite de 3 pausas: o botão some', (await p.$$('#c-pausas .prow')).length === 3 && !(await vis(p, '#c-addp')), 0);
    await p.click('#c-pausas [data-pdel="2"]'); await p.click('#c-pausas [data-pdel="1"]');
    t('✕ remove a pausa (sobra 1) e o botão volta', (await p.$$('#c-pausas .prow')).length === 1 && await vis(p, '#c-addp'), 0);
    await p.fill('#c-pausas [data-pa]', '12:00'); await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('pausa só com a saída (sem a volta): avisa em vez de gravar', /Preencha a saída e a volta/.test(await p.textContent('#c-msg')) && !(((await store(p))[D(2)] || {}).dados || {}).ana, await p.textContent('#c-msg'));
    await p.fill('#c-pausas [data-pa]', '13:00'); await p.fill('#c-pausas [data-pb]', '12:00'); await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('volta antes da saída: recusa', /volta precisa ser depois da saída/.test(await p.textContent('#c-msg')), await p.textContent('#c-msg'));
    await p.fill('#c-pausas [data-pa]', '08:00'); await p.fill('#c-pausas [data-pb]', '08:30'); await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('pausa antes da entrada: recusa', /antes da entrada/.test(await p.textContent('#c-msg')), await p.textContent('#c-msg'));
    await p.fill('#c-pausas [data-pa]', '17:30'); await p.fill('#c-pausas [data-pb]', '18:30'); await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('pausa que termina depois da saída: recusa', /depois da saída/.test(await p.textContent('#c-msg')), await p.textContent('#c-msg'));
    await p.fill('#c-pausas [data-pa]', '12:00'); await p.fill('#c-pausas [data-pb]', '13:00'); await p.click('#c-addp'); const ins = await p.$$('#c-pausas [data-pa]'); await ins[1].fill('12:30'); const fins = await p.$$('#c-pausas [data-pb]'); await fins[1].fill('12:45');
    await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('pausas sobrepostas/fora de ordem: recusa', /em ordem e sem se sobrepor/.test(await p.textContent('#c-msg')), await p.textContent('#c-msg'));
    await ins[1].fill('15:00'); await fins[1].fill('15:15'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const e = ((await store(p))[D(2)] || {}).dados && (await store(p))[D(2)].dados.ana;
    t('grava o campo p: "12:00-13:00;15:00-15:15" junto com a entrada e a saída', e && e.i === '09:00' && e.f === '18:00' && e.p === '12:00-13:00;15:00-15:15' && e.t === 'trab', e);
    t('sem erro de JS (cadastro com pausas)', !errs.length, errs); await ctx.close(); }
  { // editar o dia: a pausa vem preenchida; trocar pra Folga descarta a pausa
    const { ctx, p } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.click('.cel.edit[data-u="ana"][data-d="' + D(0) + '"]'); await p.waitForSelector('#c-pausas', { state: 'attached' });
    t('editar um dia que já tem pausa abre com ela preenchida', (await p.$$eval('#c-pausas [data-pa]', a => a.map(x => x.value))).join() === '12:00' && (await p.$$eval('#c-pausas [data-pb]', a => a.map(x => x.value))).join() === '13:00', 0);
    await p.click('[data-t="folga"]'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const e = (await store(p))[D(0)].dados.ana;
    t('virar Folga grava sem horário e sem pausa', e.t === 'folga' && !e.i && !e.p, e); await ctx.close(); }

  // ── PAUSAS NA LISTA, NA CÉLULA E NO GANTT ──
  { const { ctx, p } = await open(ANA, '?squad=dados&semana=' + D(0));
    t('célula da semana: ☕ e a pausa no tooltip', /☕/.test(await p.textContent('.cel[data-u="ana"][data-d="' + D(0) + '"]')) && /pausa 12:00–13:00/.test(await p.getAttribute('.cel[data-u="ana"][data-d="' + D(0) + '"] .ct', 'title')), 0);
    await p.click('th.dia >> nth=0'); await p.waitForSelector('.md');
    t('lista do dia: "☕ pausa 12:00–13:00" na linha da Ana', /☕ pausa 12:00–13:00/.test(await p.textContent('.lista-dia')), await p.textContent('.lista-dia'));
    await p.click('#d-modo [data-dm="gantt"]'); await p.waitForSelector('.gt');
    const ana = await p.evaluate(() => { const r = [...document.querySelectorAll('.gt-row')].find(x => (x.querySelector('.who2 > b') || {}).textContent === 'Ana'); return { barras: [...r.querySelectorAll('.gt-bar')].map(e => ({ l: parseFloat(e.style.left), w: parseFloat(e.style.width), txt: e.textContent.trim() })), pausas: [...r.querySelectorAll('.gt-pausa')].map(e => ({ l: parseFloat(e.style.left), w: parseFloat(e.style.width), t: e.title })) }; });
    // eixo 07h–21h (840 min): Ana 09–12 e 13–18; pausa 12–13
    t('Gantt: a barra da Ana é cortada em duas (09:00–12:00 e 13:00–18:00) com o intervalo tracejado no meio', ana.barras.length === 2 && Math.abs(ana.barras[0].l - 14.2857) < .1 && Math.abs(ana.barras[0].w - 21.4286) < .1 && Math.abs(ana.barras[1].l - 42.857) < .1 && Math.abs(ana.barras[1].w - 35.714) < .1 && ana.pausas.length === 1 && ana.pausas[0].t === 'Pausa 12:00–13:00' && Math.abs(ana.pausas[0].l - 35.714) < .1, ana);
    t('o horário "09:00–18:00" aparece uma vez só, no trecho maior', ana.barras.filter(x => x.txt === '09:00–18:00').length === 1 && ana.barras[1].txt === '09:00–18:00', ana.barras);
    const cob = await txts(p, '.gt-cob .c');
    // Bruno 08–20 (pausas 12:00–12:30 e 15:00–15:15), Ana 09–18 (pausa 12–13), Paulo dia todo. 12h: Ana fora, Bruno só 30 min (conta), Paulo → 2. 13h–14h: 3.
    t('cobertura por hora considera as pausas: às 12h a Ana não conta (2 pessoas), às 13h voltam os 3', cob[5] === '2' && cob[6] === '3', cob);
    t('sem erro de JS (Gantt com pausas)', true, 0); await ctx.close(); }

  // ── JPG DA VISÃO GANTT ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.evaluate(() => localStorage.setItem('escala_dia_modo', 'gantt'));
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(600);
    await p.click('th.dia >> nth=0'); await p.waitForSelector('.gt');
    t('no Gantt o botão do dia vira "JPG do Gantt"', /JPG do Gantt/.test(await p.textContent('#d-jpg')), await p.textContent('#d-jpg'));
    await p.click('#d-jpg'); await p.waitForSelector('#j-prev canvas');
    t('abre já no estilo Gantt (seletor Lista | Gantt visível só no modo Dia)', await vis(p, '#j-estilo') && (await p.$$eval('#j-estilo [aria-selected="true"]', a => a.map(x => x.dataset.e))).join() === 'gantt', 0);
    const wG = await p.evaluate(() => document.querySelector('#j-prev canvas').width);
    if (process.env.SHOTS) fs.writeFileSync('/tmp/escala_pausas_gantt.jpg', Buffer.from((await p.evaluate(() => document.querySelector('#j-prev canvas').toDataURL('image/jpeg', .92))).split(',')[1], 'base64'));
    const pix = await p.evaluate(() => { const c = document.querySelector('#j-prev canvas'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let claros = 0, verdes = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) claros++; if (d[i] < 80 && d[i + 1] > 180 && d[i + 2] > 130 && d[i + 2] < 190) verdes++; } return { claros, verdes, w: c.width, h: c.height }; });
    t('a imagem do Gantt tem as barras (verde de trabalho) e texto, e é mais larga que a da Lista (1000 × 2 px)', pix.verdes > 3000 && pix.claros > 500 && wG === 2000, pix);
    await p.click('#j-estilo [data-e="lista"]'); await p.waitForTimeout(500);
    const wL = await p.evaluate(() => document.querySelector('#j-prev canvas').width);
    t('trocar pra Lista redesenha no formato antigo (860 × 2 px)', wL === 1720 && (await p.$$eval('#j-estilo [aria-selected="true"]', a => a.map(x => x.dataset.e))).join() === 'lista', wL);
    await p.click('#j-estilo [data-e="gantt"]'); await p.waitForTimeout(500);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#j-baixar')]);
    const buf = fs.readFileSync(await dl.path());
    t('baixa um JPG de verdade com "-gantt" no nome', buf[0] === 0xFF && buf[1] === 0xD8 && buf.length > 20000 && /^escala-dados-dia-gantt-\d{4}-\d{2}-\d{2}\.jpg$/.test(dl.suggestedFilename()), [buf.length, dl.suggestedFilename()]);
    await p.click('#j-modo [data-m="semana"]'); await p.waitForTimeout(500);
    t('em Semana/Mês o seletor de estilo some', !(await vis(p, '#j-estilo')), 0);
    t('sem erro de JS (JPG Gantt)', !errs.length, errs); await ctx.close(); }
  { // global com várias squads + folga + dia vazio
    const { ctx, p } = await open(ANA, '?visao=global&semana=' + D(0));
    await p.evaluate(() => localStorage.setItem('escala_dia_modo', 'gantt'));
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(600);
    await p.click('#b-jpg'); await p.waitForSelector('#j-prev canvas'); await p.click('#j-modo [data-m="dia"]'); await p.fill('#j-ref', D(0)); await p.evaluate(() => document.getElementById('j-ref').dispatchEvent(new Event('change'))); await p.waitForTimeout(500);
    if (process.env.SHOTS) fs.writeFileSync('/tmp/escala_pausas_gantt_global.jpg', Buffer.from((await p.evaluate(() => document.querySelector('#j-prev canvas').toDataURL('image/jpeg', .92))).split(',')[1], 'base64'));
    const dim = await p.evaluate(() => { const c = document.querySelector('#j-prev canvas'); return { w: c.width, h: c.height }; });
    t('global: Gantt de todas as squads gera a imagem (mais alta, por causa dos cabeçalhos de squad)', dim.w === 2000 && dim.h > 700, dim);
    await p.fill('#j-ref', D(3)); await p.evaluate(() => document.getElementById('j-ref').dispatchEvent(new Event('change'))); await p.waitForTimeout(500);
    t('dia sem ninguém: imagem com a mensagem, sem erro', await p.evaluate(() => !!document.querySelector('#j-prev canvas')), 0);
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
