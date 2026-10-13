// 🗓️ Escala — filtros em CHIPS (squad e subtime) e 📊 Visão Gantt do dia.
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
const seed = () => ({ kanban: {
  squads_meta: { dev: { label: 'Dev', emoji: '🧪' } },
  usuarios_publicos: pubs(),
  escala: {
    [D(0)]: {
      dados: { ana: { t: 'trab', i: '09:00', f: '18:00', por: 'ana', ts: 1 }, bru: { t: 'plant', i: '08:00', f: '20:00', n: 'plantão BF', por: 'pau', ts: 1 }, pau: { t: 'trab', por: 'pau', ts: 1 } },
      dev: { zeca: { t: 'trab', i: '10:00', f: '19:00', por: 'zeca', ts: 1 }, org: { t: 'plant', i: '14:00', por: 'org', ts: 1 }, ana: { t: 'folga', por: 'ana', ts: 1 } },
    },
    [D(1)]: { dados: { pau: { t: 'trab', por: 'pau', ts: 1 } } },
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
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, opts.seed || seed());
    const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + PAGE + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(600); return { ctx, p, errs };
  };
  const txts = async (p, sel) => { if (/^#f-/.test(sel)) await p.abreFiltros(); return p.$$eval(sel, a => a.map(x => x.textContent.trim().replace(/\s+/g, ' '))); };
  const pressed = (p, g) => txts(p, '#' + g + ' [aria-pressed="true"]');
  const linhas = p => p.$$eval('tbody th.sqn .nm', a => a.map(e => e.textContent.trim().replace(/^\S+\s/, '')));
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);

  // ── CHIPS DE SQUAD ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados');
    t('visão da squad: chips de squad mostram qual está em foco (Dados) — sem chip "Todas"', (await pressed(p, 'f-sqs')).join() === '📊 Dados' && !(await txts(p, '#f-sqs .fchip')).includes('Todas'), await pressed(p, 'f-sqs'));
    t('subtimes da squad em foco viram chips (Designers · Redatores), nenhum marcado ("Todos")', (await txts(p, '#f-subs .fchip')).join('|') === 'Todos|Designers|Redatores' && (await pressed(p, 'f-subs')).join() === 'Todos', await txts(p, '#f-subs .fchip'));
    await p.click('#f-sqs [data-fsq="dev"]'); await p.waitForTimeout(150);
    t('clicar no chip de outra squad troca a squad (select acompanha) e os chips de subtime mudam (Backend)', await p.inputValue('#sel-squad') === 'dev' && (await pressed(p, 'f-sqs')).join() === '🧪 Dev' && (await txts(p, '#f-subs .fchip')).join('|') === 'Todos|Backend', [await p.inputValue('#sel-squad'), await txts(p, '#f-subs .fchip')]);
    t('o limpar não aparece só por estar numa squad', !(await vis(p, '#f-badge')), 0);
    t('sem erro de JS (chips da squad)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?visao=global&semana=' + D(0));
    t('global: "Todas" marcado e as squads listadas', (await pressed(p, 'f-sqs')).join() === 'Todas' && (await linhas(p)).join() === 'Dados,Dev', [await pressed(p, 'f-sqs'), await linhas(p)]);
    await p.click('#f-sqs [data-fsq="dev"]'); await p.waitForTimeout(150);
    t('global: marcar Dev mostra só a Dev; o chip "Todas" desmarca; limpar aparece; entra na URL (f_sq)', (await linhas(p)).join() === 'Dev' && (await pressed(p, 'f-sqs')).join() === '🧪 Dev' && await vis(p, '#f-badge') && await p.evaluate(() => /f_sq=dev/.test(location.search)), [await linhas(p), await p.evaluate(() => location.search)]);
    t('subtimes só das squads em foco (Dev: Backend)', (await txts(p, '#f-subs .fchip')).join('|') === 'Todos|Backend', await txts(p, '#f-subs .fchip'));
    await p.click('#f-sqs [data-fsq="dados"]'); await p.waitForTimeout(150);
    t('global: várias squads ao mesmo tempo (multi-seleção)', (await linhas(p)).join() === 'Dados,Dev' && (await pressed(p, 'f-sqs')).length === 2, await pressed(p, 'f-sqs'));
    await p.click('#f-sqs [data-fsq=""]'); await p.waitForTimeout(150);
    t('chip "Todas" volta tudo e tira f_sq da URL', (await pressed(p, 'f-sqs')).join() === 'Todas' && await p.evaluate(() => !/f_sq/.test(location.search)) && !(await vis(p, '#f-badge')), await pressed(p, 'f-sqs'));
    await p.click('#f-sqs [data-fsq="dev"]'); await p.click('#f-subs [data-fsub="Backend"]'); await p.waitForTimeout(150);
    await p.click('#f-limpar'); await p.waitForTimeout(150);
    t('✕ Limpar filtros zera squad E subtime', (await pressed(p, 'f-sqs')).join() === 'Todas' && (await pressed(p, 'f-subs')).join() === 'Todos', 0);
    // subtime sumindo do escopo deixa de filtrar
    await p.click('#f-subs [data-fsub="Designers"]'); await p.click('#f-sqs [data-fsq="dev"]'); await p.waitForTimeout(150);
    t('subtime que some do escopo (Designers saiu quando só a Dev ficou) deixa de filtrar', (await linhas(p)).join() === 'Dev' && (await pressed(p, 'f-subs')).join() === 'Todos', [await linhas(p), await pressed(p, 'f-subs')]);
    // multi-seleção de subtime
    await p.click('#f-sqs [data-fsq=""]'); await p.click('#f-subs [data-fsub="Designers"]'); await p.click('#f-subs [data-fsub="Backend"]'); await p.waitForTimeout(150);
    t('subtime em chips é multi-seleção (Designers + Backend = Dados e Dev) e vai na URL separado por vírgula', (await linhas(p)).join() === 'Dados,Dev' && await p.evaluate(() => /f_sub=Designers(,|%2C)Backend/.test(location.search)), await p.evaluate(() => location.search));
    await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?visao=global&f_sq=dev&f_sub=Backend&semana=' + D(0));
    t('?f_sq e ?f_sub do link já vêm aplicados', (await linhas(p)).join() === 'Dev' && (await pressed(p, 'f-subs')).join() === 'Backend', [await linhas(p), await pressed(p, 'f-subs')]);
    await ctx.close(); }
  { // o cadastro e o JPG respeitam o escopo escolhido nos chips
    const { ctx, p } = await open(ANA, '?visao=global&semana=' + D(0)); await p.click('#f-sqs [data-fsq="dev"]'); await p.click('#b-jpg'); await p.waitForSelector('#j-prev canvas');
    t('JPG da visão global com chip de squad: o modal diz só a squad escolhida', /Vale pra\s+Dev/.test(await p.textContent('.md .sub')) && !/Todas as squads/.test(await p.textContent('.md .sub')), await p.textContent('.md .sub'));
    await ctx.close(); }

  // ── VISÃO GANTT (detalhe do dia) ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.click('th.dia >> nth=0'); await p.waitForSelector('.md');
    t('o detalhe do dia abre na Lista (padrão) e oferece 📊 Visão Gantt', (await p.$$eval('#d-modo [aria-selected="true"]', a => a.map(x => x.textContent))).join() === '📋 Lista' && !!(await p.$('.lista-dia')) && !(await p.$('.gt')), 0);
    await p.click('#d-modo [data-dm="gantt"]'); await p.waitForSelector('.gt');
    t('Gantt: modal alarga, uma linha por pessoa que está no dia (plantão primeiro: Bruno, Paulo, Ana) — sem folga', await p.evaluate(() => document.querySelector('.md').classList.contains('gantt')) && (await txts(p, '.gt-row:not(.gt-cob) .who2 > b')).join() === 'Bruno,Paulo,Ana', await txts(p, '.gt-row:not(.gt-cob) .who2 > b'));
    const bar = n => p.evaluate(nn => { const r = [...document.querySelectorAll('.gt-row')].find(x => (x.querySelector('.who2 > b') || {}).textContent === nn); const e = r && r.querySelector('.gt-bar'); return e ? { l: parseFloat(e.style.left), w: parseFloat(e.style.width), cls: e.className, txt: e.textContent.trim() } : null; }, n);
    const ana = await bar('Ana'), bru = await bar('Bruno'), pau = await bar('Paulo');
    t('eixo ajustado aos horários (07h–21h): Ana 09:00–18:00 = 14,3 % → +64,3 %', ana && Math.abs(ana.l - 14.2857) < .1 && Math.abs(ana.w - 64.2857) < .1 && ana.txt === '09:00–18:00', ana);
    t('plantão em laranja (classe plant) e o horário 08:00–20:00 ocupa quase tudo', bru && /plant/.test(bru.cls) && Math.abs(bru.l - 7.1428) < .1 && Math.abs(bru.w - 85.714) < .1, bru);
    t('sem horário cadastrado: barra listrada de ponta a ponta com "dia todo"', pau && /semh/.test(pau.cls) && pau.l === 0 && pau.w === 100 && pau.txt === 'dia todo', pau);
    const cob = await txts(p, '.gt-cob .c');
    t('cobertura por hora: 14 colunas; 07h só Paulo (dia todo)=1; 08h = 2; 09–17h = 3; 18h e 19h = 2; 20h = 1', cob.length === 14 && cob[0] === '1' && cob[1] === '2' && cob[2] === '3' && cob[10] === '3' && cob[11] === '2' && cob[12] === '2' && cob[13] === '1', cob);
    t('eixo com horas de 2 em 2 (07h … 21h) quando o dia é longo', (await txts(p, '.gt-ax span')).join() === ['07h', '09h', '11h', '13h', '15h', '17h', '19h', '21h'].join(), await txts(p, '.gt-ax span'));
    t('a escolha (Gantt) fica lembrada ao abrir outro dia', await p.evaluate(() => localStorage.getItem('escala_dia_modo') === 'gantt'), 0);
    await p.keyboard.press('Escape'); await p.click('th.dia >> nth=1'); await p.waitForSelector('.gt');
    t('outro dia já abre no Gantt (Paulo sem horário → eixo padrão 08h–18h)', (await txts(p, '.gt-ax span'))[0] === '08h' && (await txts(p, '.gt-ax span')).slice(-1)[0] === '18h', await txts(p, '.gt-ax span'));
    await p.click('#d-modo [data-dm="lista"]'); await p.waitForSelector('.lista-dia');
    t('voltar pra Lista funciona e o modal volta ao tamanho normal', !(await p.evaluate(() => document.querySelector('.md').classList.contains('gantt'))), 0);
    t('sem erro de JS (Gantt)', !errs.length, errs); await ctx.close(); }
  { // global: grupos por squad, folga à parte, barra aberta (só entrada), marcador de agora só no dia de hoje
    const { ctx, p } = await open(ANA, '?visao=global&semana=' + D(0));
    await p.click('.gdia[data-gs="dev"][data-gd="' + D(0) + '"]'); await p.waitForSelector('.md'); await p.click('#d-modo [data-dm="gantt"]'); await p.waitForSelector('.gt');
    t('global: cabeçalho por squad (Dados, Dev) dentro do Gantt', (await txts(p, '.gt-sq')).join() === '📊 Dados,🧪 Dev', await txts(p, '.gt-sq'));
    const org = await p.evaluate(() => { const r = [...document.querySelectorAll('.gt-row')].find(x => (x.querySelector('.who2 > b') || {}).textContent === 'Olga'); const e = r && r.querySelector('.gt-bar'); return e ? { cls: e.className, txt: e.textContent.trim(), w: parseFloat(e.style.width), l: parseFloat(e.style.left) } : null; });
    t('só entrada cadastrada (14:00 →): barra aberta pra direita até o fim do eixo', org && /aberta-d/.test(org.cls) && /14:00/.test(org.txt) && Math.abs(org.l + org.w - 100) < .01, org);
    t('folga (Ana, na Dev) vai na linha 🏖️ à parte; Ana tem uma única barra (a da Dados)', /🏖️ Folga: Ana/.test(await p.textContent('.gt-folga')) && (await txts(p, '.gt-row:not(.gt-cob) .who2 > b')).filter(x => x === 'Ana').length === 1, await txts(p, '.gt-folga'));
    await ctx.close(); }
  { // marcador "agora": só no dia de hoje e só se a hora atual cabe no eixo (eixo do dia = 08h–18h, Ana 09:00–18:00 → 08h–19h)
    const hoje = iso(new Date()), sd = seed(); sd.kanban.escala[hoje] = Object.assign({}, sd.kanban.escala[hoje], { dados: Object.assign({}, (sd.kanban.escala[hoje] || {}).dados, { ana: { t: 'trab', i: '00:00', f: '23:59', por: 'ana', ts: 1 } }) });
    const { ctx, p } = await open(ANA, '?squad=dados', { seed: sd });
    await p.evaluate(() => localStorage.setItem('escala_dia_modo', 'gantt'));
    await p.click('th.dia.hj, th.hj'); await p.waitForSelector('.md'); await p.click('#d-modo [data-dm="gantt"]'); await p.waitForSelector('.gt');
    t('hoje: marcador "agora" cruza as linhas (uma risca por pessoa)', (await p.$$('.gt-agora')).length === 2, (await p.$$('.gt-agora')).length);
    await p.keyboard.press('Escape'); await p.click('th.dia >> nth=' + ((new Date().getDay() + 6) % 7 === 0 ? 1 : 0)); await p.waitForSelector('.gt');
    t('outro dia que não é hoje: sem marcador "agora"', (await p.$$('.gt-agora')).length === 0, 0);
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
