// 🗓️ Escala (escala-dev.html): visão squad + visão global + cadastro (próprio usuário ou PO/Organizador/ADM).
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
  squads_meta: { dev: { label: 'Dev', emoji: '🧪' }, vazia: { label: 'Squad Vazia', emoji: '🫥' } },
  usuarios_publicos: pubs(),
  escala: {
    [D(0)]: { dados: { ana: { t: 'trab', i: '09:00', f: '18:00', por: 'ana', ts: 1 }, bru: { t: 'plant', n: 'lançamento da campanha', por: 'pau', ts: 1 } } },
    [D(1)]: { dados: { ana: { t: 'folga', por: 'ana', ts: 1 } }, dev: { ana: { t: 'trab', por: 'ana', ts: 1 } } },
    [D(2)]: { dados: { cv: { t: 'trab', por: 'pau', ts: 1 } } },   // convidado não conta
    [D(5)]: { dados: { ana: { t: 'trab', por: 'ana', ts: 1 }, bru: { t: 'plant', por: 'pau', ts: 1 }, pau: { t: 'trab', por: 'pau', ts: 1 } }, dev: { zeca: { t: 'trab', por: 'zeca', ts: 1 } } },
  },
  squads: {
    dados: { dados: { subtimes: [{ id: 's1', name: 'Designers', members: ['AL', 'BR'] }, { id: 's2', name: 'Redatores', members: ['PP'] }] } },
    dev: { dados: { subtimes: [{ id: 's3', name: 'designers', members: ['ZD'] }] } },
  },
}});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
  const open = async (user, qs, opts) => {
    opts = opts || {};
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); await fake.install(ctx, opts.seed || seed());
    if (opts.init) await ctx.addInitScript(opts.init);
    const p = await ctx.newPage(); const errs = []; const dialogs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await p.goto('http://localhost:8941/' + PAGE + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    if (user) await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(600); return { ctx, p, errs, dialogs };
  };
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);
  const store = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.escala || {})));

  // ── sem login / conta errada ──
  { const { ctx, p, errs } = await open(null, '?squad=dados');
    t('sem login: tela de entrar com Google e nada de escala', await vis(p, '#login') && !(await vis(p, '#app')), 0);
    await p.evaluate(x => window.__authCb(x), EXT); await p.waitForTimeout(300);
    t('conta que não é @ciahering não entra', await vis(p, '#login') && !(await vis(p, '#app')), 0);
    t('sem erro de JS (login)', !errs.length, errs); await ctx.close(); }

  // ── VISÃO SQUAD (membro) ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados');
    t('logado: abre a visão da squad pedida com a semana atual', await vis(p, 'table.grid') && (await p.evaluate(() => window.__escala.estado)).squad === 'dados' && (await p.evaluate(() => window.__escala.estado)).semana === D(0), await p.evaluate(() => window.__escala.estado));
    const linhas = await p.evaluate(() => [...document.querySelectorAll('tbody tr:not(.cob) th.pess .pnome > div > b')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    t('lista só quem é da squad (sem convidado), eu primeiro', linhas.join('|') === 'Ana Lima (você)|Bruno Reis|Paulo PO', linhas);
    const c0 = await p.evaluate(d => document.querySelector('.cel[data-u="ana"][data-d="' + d + '"]')?.innerText.replace(/\s+/g, ' ').trim(), D(0));
    const c1 = await p.evaluate(d => document.querySelector('.cel[data-u="ana"][data-d="' + d + '"]')?.innerText.replace(/\s+/g, ' ').trim(), D(1));
    const cb = await p.evaluate(d => document.querySelector('.cel[data-u="bru"][data-d="' + d + '"]')?.innerText.replace(/\s+/g, ' ').trim(), D(0));
    t('chips: escalado com horário / folga / plantão com 💬', /✅.*09:00–18:00/.test(c0) && /🏖/.test(c1) && /🔥/.test(cb) && /💬/.test(cb), [c0, c1, cb]);
    const cob = await p.evaluate(() => [...document.querySelectorAll('tr.cob td')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    t('cobertura do dia: segunda 2 (1 plantão), terça 0 útil sinalizado, convidado não conta (quarta ⚠️)', /^2 · 🔥1$/.test(cob[0]) && /⚠️ 0/.test(cob[1]) && /⚠️ 0/.test(cob[2]), cob);
    const pode = await p.evaluate(() => ({ ana: document.querySelector('.cel[data-u="ana"]').classList.contains('edit'), bru: document.querySelector('.cel[data-u="bru"]').classList.contains('edit') }));
    t('membro edita só a própria linha', pode.ana && !pode.bru, pode);
    // clicar na célula de outra pessoa não abre nada
    await p.click('.cel[data-u="bru"][data-d="' + D(3) + '"]', { force: true }); await p.waitForTimeout(150);
    t('clicar na célula de outro (sem ser gestor) não abre cadastro', !(await vis(p, '.md')), 0);
    // editar 1 dia: quinta vira plantão 20:00–23:00
    await p.click('.cel[data-u="ana"][data-d="' + D(3) + '"]'); await p.waitForTimeout(150);
    const pre = await p.evaluate(() => ({ de: document.getElementById('c-de').value, ate: document.getElementById('c-ate').value, ds: [...document.querySelectorAll('#c-dsem .chip[aria-pressed="true"]')].map(x => x.textContent), uidDisabled: document.getElementById('c-uid').disabled }));
    t('célula abre o cadastro já com aquele dia e só aquele dia da semana; pessoa travada em mim', pre.de === D(3) && pre.ate === D(3) && pre.ds.join() === 'Qui' && pre.uidDisabled, pre);
    await p.click('[data-t="plant"]'); await p.fill('#c-i', '20:00'); await p.fill('#c-f', '23:00'); await p.fill('#c-n', 'sobreaviso'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const e1 = (await store(p))[D(3)]?.dados?.ana;
    t('grava em escala/{data}/{squad}/{uid} com tipo, horário, nota e autor', e1 && e1.t === 'plant' && e1.i === '20:00' && e1.f === '23:00' && e1.n === 'sobreaviso' && e1.por === 'ana' && typeof e1.ts === 'number', e1);
    t('modal fecha e a tela já mostra o plantão novo', !(await vis(p, '.md')) && /🔥/.test(await p.evaluate(d => document.querySelector('.cel[data-u="ana"][data-d="' + d + '"]').innerText, D(3))), 0);
    // saída antes da entrada
    await p.click('.cel[data-u="ana"][data-d="' + D(4) + '"]'); await p.fill('#c-i', '18:00'); await p.fill('#c-f', '09:00'); await p.click('#c-salvar'); await p.waitForTimeout(150);
    t('saída antes da entrada: bloqueia com aviso', /depois da entrada/.test(await txt(p, '#c-msg')) && !(await store(p))[D(4)], await txt(p, '#c-msg'));
    // folga some horário e limpa
    await p.click('[data-t="folga"]'); t('folga esconde horário', !(await vis(p, '#c-hora')), 0);
    await p.click('#c-salvar'); await p.waitForTimeout(400);
    const e2 = (await store(p))[D(4)]?.dados?.ana; t('folga grava sem horário', e2 && e2.t === 'folga' && !e2.i && !e2.f, e2);
    // limpar um dia
    await p.click('.cel[data-u="ana"][data-d="' + D(4) + '"]'); await p.click('#c-limpar'); await p.waitForTimeout(400);
    t('🗑 Limpar apaga o dia (e pergunta antes)', !(await store(p))[D(4)]?.dados?.ana, await store(p));
    t('sem erro de JS (squad)', !errs.length, errs); await ctx.close(); }

  // ── CADASTRO EM PERÍODO (próprio usuário) ──
  { const { ctx, p } = await open(ANA, '?squad=dados');
    await p.click('#b-cad'); await p.waitForTimeout(150);
    const f = await p.evaluate(() => ({ de: document.getElementById('c-de').value, ate: document.getElementById('c-ate').value, ds: [...document.querySelectorAll('#c-dsem .chip[aria-pressed="true"]')].map(x => x.textContent).join(), prev: document.getElementById('c-prev').innerText, uid: document.getElementById('c-uid').disabled, sq: [...document.querySelectorAll('#c-sq option')].map(o => o.textContent.trim()) }));
    t('botão Cadastrar: semana visível, seg–sex marcados, prévia de 5 dias, pessoa fixa em mim', f.de === D(0) && f.ate === D(6) && f.ds === 'Seg,Ter,Qua,Qui,Sex' && /^5 dias/.test(f.prev) && f.uid, f);
    t('só lista squads em que eu estou inscrita', f.sq.length === 2 && f.sq.some(x => /Dados/.test(x)) && f.sq.some(x => /Dev/.test(x)) && !f.sq.some(x => /Vazia/.test(x)), f.sq);
    await p.fill('#c-de', D(10)); await p.fill('#c-ate', D(2)); await p.evaluate(() => document.getElementById('c-de').dispatchEvent(new Event('input')));
    t('período invertido: prévia avisa', /antes da inicial/.test(await txt(p, '#c-prev')), await txt(p, '#c-prev'));
    await p.fill('#c-de', D(7)); await p.fill('#c-ate', D(13)); await p.evaluate(() => document.getElementById('c-de').dispatchEvent(new Event('input')));
    await p.click('[data-t="plant"]'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const st = await store(p); const dias = Object.keys(st).filter(d => st[d].dados?.ana?.t === 'plant');
    t('grava 5 dias úteis da semana seguinte e pula o fim de semana', dias.length === 5 && dias.includes(D(7)) && dias.includes(D(11)) && !dias.includes(D(12)), dias);
    t('pula pra semana do cadastro quando ela está fora da visível', (await p.evaluate(() => window.__escala.estado)).semana === D(7), await p.evaluate(() => window.__escala.estado));
    // remover período
    await p.click('#b-cad'); await p.waitForTimeout(100); await p.click('#c-limpar'); await p.waitForTimeout(400);
    const st2 = await store(p); t('🗑 Limpar período apaga só os dias do período marcado', !Object.keys(st2).some(d => st2[d].dados?.ana?.t === 'plant' && d >= D(7)) && st2[D(0)]?.dados?.ana?.t === 'trab', Object.keys(st2));
    await ctx.close(); }

  // ── PO cadastra pelos outros ──
  { const { ctx, p } = await open(PAU, '?squad=dados');
    const pode = await p.evaluate(() => [...document.querySelectorAll('tbody tr:not(.cob) .cel')].every(c => c.classList.contains('edit')));
    t('PO da squad edita a linha de todo mundo', pode, 0);
    await p.click('#b-cad'); await p.waitForTimeout(120);
    const opts = await p.evaluate(() => [...document.querySelectorAll('#c-uid option')].map(o => o.textContent.trim()));
    t('PO escolhe a pessoa (sem convidado)', opts.join('|') === 'Paulo PO (você)|Ana Lima|Bruno Reis', opts);
    await p.selectOption('#c-uid', 'bru'); await p.click('[data-atalho="bf"]');
    const bf = await p.evaluate(() => ({ de: document.getElementById('c-de').value, ate: document.getElementById('c-ate').value, ds: document.querySelectorAll('#c-dsem .chip[aria-pressed="true"]').length, prev: document.getElementById('c-prev').innerText }));
    const hoje = new Date(); let bfd = new Date(hoje.getFullYear(), 10, 1); bfd = new Date(hoje.getFullYear(), 10, 1 + ((4 - bfd.getDay() + 7) % 7) + 21 + 1); if (new Date(bfd.getFullYear(), bfd.getMonth(), bfd.getDate() + 7) < hoje) { bfd = new Date(hoje.getFullYear() + 1, 10, 1); bfd = new Date(hoje.getFullYear() + 1, 10, 1 + ((4 - bfd.getDay() + 7) % 7) + 21 + 1); }
    t('atalho "Semana da Black Friday": 7 dias, semana que contém a Black Friday (sexta)', bf.ds === 7 && bf.de <= iso(bfd) && iso(bfd) <= bf.ate && /^7 dias/.test(bf.prev), [bf, iso(bfd)]);
    await p.click('[data-t="plant"]'); await p.fill('#c-n', 'Black Friday'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const st = await store(p); const k = Object.keys(st).filter(d => d >= bf.de && st[d].dados?.bru?.t === 'plant');
    t('PO grava a escala do Bruno (por = PO), 7 dias', k.length === 7 && k.every(d => st[d].dados.bru.por === 'pau' && st[d].dados.bru.n === 'Black Friday'), k.length);
    t('a tela pulou pra semana da Black Friday e marca a sexta', (await p.evaluate(() => window.__escala.estado)).semana === bf.de && /BLACK FRIDAY/i.test(await p.evaluate(() => document.querySelector('th.bfdia')?.innerText || '')), await p.evaluate(() => window.__escala.estado));
    await ctx.close(); }

  // ── Organizador de OUTRA squad / ADM ──
  { const { ctx, p } = await open(ORG, '?squad=dados');
    const pode = await p.evaluate(() => [...document.querySelectorAll('tbody tr:not(.cob) .cel')].some(c => c.classList.contains('edit')));
    t('Organizador da Dev não edita a squad Dados (onde ele não está)', !pode, 0);
    await p.click('#b-cad'); const sqs = await p.evaluate(() => [...document.querySelectorAll('#c-sq option')].map(o => o.textContent.trim())); t('cadastro só oferece a squad dele (Dev)', sqs.length === 1 && /Dev/.test(sqs[0]), sqs);
    await ctx.close(); }
  { const { ctx, p } = await open(ADM, '?squad=dev');
    const pode = await p.evaluate(() => [...document.querySelectorAll('tbody tr:not(.cob) .cel')].every(c => c.classList.contains('edit')));
    t('ADM edita qualquer squad (mesmo sem ser inscrito)', pode && (await p.evaluate(() => window.__escala.estado)).souAdm, 0);
    await p.click('#b-cad'); const sqs = await p.evaluate(() => [...document.querySelectorAll('#c-sq option')].length); t('ADM vê todas as squads no cadastro', sqs === 6, sqs);
    const sel = await p.evaluate(() => ({ v: document.getElementById('c-uid').value, opts: [...document.querySelectorAll('#c-uid option')].map(o => o.value) }));
    t('ADM numa squad onde não está: a pessoa mostrada é a primeira da squad (não ele mesmo)', sel.v === sel.opts[0] && sel.v !== 'adm', sel);
    await p.click('[data-t="plant"]'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    const ea = await store(p); const gravou = Object.keys(ea).filter(d => ea[d].dev && ea[d].dev[sel.v] && ea[d].dev[sel.v].por === 'adm');
    t('ADM grava pela pessoa escolhida (por = adm) e nada em nome dele', gravou.length === 5 && !Object.keys(ea).some(d => ea[d].dev && ea[d].dev.adm), gravou);
    await ctx.close(); }

  // ── VISÃO GLOBAL ──
  { const { ctx, p, errs } = await open(ANA, '?visao=global');
    const linhas = await p.evaluate(() => [...document.querySelectorAll('tbody th.sqn .nm')].map(e => e.textContent.trim()));
    t('global: uma linha por squad com gente (Dados e Dev; a vazia não aparece)', linhas.join('|') === '📊 Dados|🧪 Dev', linhas);
    const sub = await p.evaluate(() => [...document.querySelectorAll('tbody th.sqn small')].map(e => e.innerText.replace(/\s+/g, ' ')));
    t('squads com cadastro na semana não mostram "sem escala cadastrada"', sub.every(x => !/sem escala/.test(x)), sub);
    const cel = await p.evaluate(d => { const c = document.querySelector('.gdia[data-gs="dados"][data-gd="' + d + '"]'); return { av: c.querySelectorAll('.av').length, plant: c.querySelectorAll('.av.plant').length, n: c.querySelector('.n')?.innerText }; }, D(0));
    t('global: segunda em Dados mostra 2 pessoas (1 em plantão destacado)', cel.av === 2 && cel.plant === 1 && /^2/.test(cel.n), cel);
    const dev = await p.evaluate(d => document.querySelector('.gdia[data-gs="dev"][data-gd="' + d + '"]').querySelectorAll('.av').length, D(1));
    t('global: terça em Dev mostra a Ana', dev === 1, dev);
    const aviso = await txt(p, '#avisos');
    t('buracos: lista dias úteis sem ninguém escalado nas squads que já têm escala', /Dados/.test(aviso) && /Qua/.test(aviso), aviso);
    // detalhe do dia + copiar menções
    await p.click('.gdia[data-gs="dados"][data-gd="' + D(0) + '"]'); await p.waitForTimeout(150);
    const det = await txt(p, '.md');
    t('clicar no dia abre a lista com nome, @iniciais e tipo', /Bruno Reis/.test(det) && /@BR/.test(det) && /Ana Lima/.test(det) && /lançamento da campanha/.test(det), det);
    const ordem = await p.evaluate(() => [...document.querySelectorAll('.md .lista-dia li > div > b')].map(e => e.textContent));
    t('plantão vem primeiro', ordem[0] === 'Bruno Reis', ordem);
    await p.click('#d-menc'); await p.waitForTimeout(150);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    t('📋 Copiar menções entrega "@BR @AL" (quem trabalha, sem folga)', clip.split(' ').sort().join(' ') === '@AL @BR', clip);
    await p.keyboard.press('Escape'); t('Esc fecha o modal', !(await vis(p, '.md')), 0);
    // ver squad
    await p.click('[data-ver="dev"]'); await p.waitForTimeout(150);
    t('"ver squad ›" leva pra visão da squad certa', (await p.evaluate(() => window.__escala.estado)).visao === 'squad' && (await p.evaluate(() => window.__escala.estado)).squad === 'dev', await p.evaluate(() => window.__escala.estado));
    t('sem erro de JS (global)', !errs.length, errs); await ctx.close(); }
  { // squad sem cadastro nenhum não vira ⚠️ em tudo
    const s = seed(); s.kanban.escala = {}; const { ctx, p } = await open(ANA, '?visao=global', { seed: s });
    const sub = await p.evaluate(() => [...document.querySelectorAll('tbody th.sqn small')].map(e => e.innerText.replace(/\s+/g, ' ')));
    t('semana toda vazia: nenhuma squad sinalizada com ⚠️ (só "sem escala cadastrada")', sub.every(x => /sem escala cadastrada/.test(x)) && !(await vis(p, '#avisos')) && !(await p.evaluate(() => document.querySelector('.gdia.vazio'))), sub);
    await ctx.close(); }

  // ── NAVEGAÇÃO ──
  { const { ctx, p } = await open(ANA, '?squad=dados');
    await p.click('#b-next'); await p.waitForTimeout(200);
    t('▶ avança uma semana e esvazia a tela (dados da outra semana não ficam)', (await p.evaluate(() => window.__escala.estado)).semana === D(7) && !(await p.evaluate(() => document.querySelector('#view .ct'))), await p.evaluate(() => window.__escala.estado));
    await p.click('#b-hoje'); await p.waitForTimeout(200); t('Hoje volta pra semana atual', (await p.evaluate(() => window.__escala.estado)).semana === D(0), 0);
    await p.click('#b-bf'); await p.waitForTimeout(200);
    t('🔥 Black Friday pula pra semana dela e marca o dia', /BLACK FRIDAY/i.test(await p.evaluate(() => document.querySelector('th.bfdia')?.innerText || '')), await p.evaluate(() => window.__escala.estado));
    await ctx.close(); }
  { // corrida: leitura lenta da semana A termina DEPOIS da leitura rápida da semana B
    let n = 0;
    const { ctx, p } = await open(ANA, '?squad=dados', { init: () => { let c = 0; window.__getDelay = path => (path === 'kanban/escala' ? (++c === 2 ? 900 : 0) : 0); } });
    await p.click('#b-next'); await p.click('#b-prev'); await p.waitForTimeout(1400);
    const st = await p.evaluate(() => window.__escala.estado);
    const tem = await p.evaluate(() => !!document.querySelector('#view .ct'));
    t('corrida de semanas: vale só a última leitura (voltei pra atual e os chips dela aparecem)', st.semana === D(0) && tem, [st, tem]);
    await ctx.close(); }

  // ── ERROS ──
  { const { ctx, p } = await open(ANA, '?squad=dados', { init: () => { window.__denySet = p => /^kanban\/escala/.test(p); } });
    await p.click('.cel[data-u="ana"][data-d="' + D(5) + '"]'); await p.click('#c-salvar'); await p.waitForTimeout(500);
    t('permissão negada ao gravar: mensagem clara e botão volta (sem travar)', /Sem permissão/.test(await txt(p, '#c-msg')) && await p.evaluate(() => !document.getElementById('c-salvar').disabled), await txt(p, '#c-msg'));
    await p.click('#c-salvar'); await p.waitForTimeout(400); t('pode tentar de novo depois do erro (trava solta)', (await p.evaluate(() => window.__escala.estado)).gravando === false, 0);
    await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?squad=dados', { init: () => { window.__denyGet = p => p === 'kanban/escala'; } });
    t('leitura negada (regras ainda não publicadas): aviso claro, página não quebra', /regras do banco/.test(await txt(p, '#erro')) && await vis(p, 'table.grid'), await txt(p, '#erro'));
    await ctx.close(); }
  { // duplo clique em Cadastrar não grava duas vezes
    const { ctx, p } = await open(ANA, '?squad=dados', { init: () => { window.__setDelay = p => /^kanban\/escala/.test(p) ? 400 : 0; } });
    await p.click('.cel[data-u="ana"][data-d="' + D(5) + '"]'); await p.evaluate(() => { const b = document.getElementById('c-salvar'); b.click(); b.click(); b.click(); }); await p.waitForTimeout(900);
    const n = await p.evaluate(() => window.__log.filter(x => x[0] === 'update' && x[1] === 'kanban/escala').length);
    t('cliques repetidos em Cadastrar gravam uma vez só', n === 1, n);
    await ctx.close(); }

  // ── FILTRO DE SUBTIME ──
  { const { ctx, p, errs } = await open(ANA, '?visao=global');
    const linhas = () => p.evaluate(() => [...document.querySelectorAll('tbody th.sqn .nm')].map(e => e.textContent.trim().replace(/^\S+\s/, '')));
    const opts = id => p.evaluate(i => [...document.querySelectorAll('#' + i + ' option')].map(o => o.textContent.trim()), id);
    const av = (sq, d) => p.evaluate(([s, dd]) => [...document.querySelectorAll('.gdia[data-gs="' + s + '"][data-gd="' + dd + '"] .av b')].map(e => e.textContent).sort().join(), [sq, d]);
    t('global: só o filtro de subtime (sem squad nem submarca) e sem "limpar"', await vis(p, '#f-sub') && !(await p.evaluate(() => !!document.getElementById('f-squad') || !!document.getElementById('f-sm'))) && !(await vis(p, '#f-limpar')), 0);
    t('subtimes juntam pelo nome entre squads (Designers/designers = 1) e listam Redatores', (await opts('f-sub')).join('|') === 'Todos os subtimes|Designers|Redatores', await opts('f-sub'));
    await p.selectOption('#f-sub', 'Redatores'); await p.waitForTimeout(100);
    t('subtime Redatores: só quem é Redator (Dados) — a Dev, sem ninguém, some', (await linhas()).join() === 'Dados' && await av('dados', D(5)) === 'PP' && await vis(p, '#f-limpar'), [await linhas(), await av('dados', D(5))]);
    await p.selectOption('#f-sub', 'Designers'); await p.waitForTimeout(100);
    t('subtime Designers vale pra todas as squads (Dados: AL,BR · Dev: ZD)', (await linhas()).join() === 'Dados,Dev' && await av('dados', D(0)) === 'AL,BR' && await av('dev', D(5)) === 'ZD', [await av('dados', D(0)), await av('dev', D(5))]);
    t('o filtro entra na URL (link compartilhável)', await p.evaluate(() => /f_sub=Designers/.test(location.search)), 0);
    await p.click('.gdia[data-gs="dados"][data-gd="' + D(5) + '"]'); await p.waitForTimeout(100);
    const det = await txt(p, '.md'); t('detalhe do dia respeita o filtro (Designers: Ana e Bruno, sem o Paulo)', /Ana Lima/.test(det) && /Bruno Reis/.test(det) && !/Paulo PO/.test(det), det);
    await p.keyboard.press('Escape');
    await p.click('#f-limpar'); await p.waitForTimeout(100);
    t('limpar volta tudo e tira da URL', (await linhas()).join() === 'Dados,Dev' && !(await vis(p, '#f-limpar')) && await p.evaluate(() => !/f_sub/.test(location.search)), await linhas());
    t('sem erro de JS (filtro global)', !errs.length, errs); await ctx.close(); }
  { // filtro chega por link
    const { ctx, p } = await open(ANA, '?visao=global&f_sub=Designers&semana=' + D(0));
    const st = await p.evaluate(() => ({ sub: document.getElementById('f-sub').value, url: location.search }));
    t('?f_sub do link já vem aplicado', st.sub === 'Designers' && /f_sub=Designers/.test(st.url), st);
    await ctx.close(); }
  { // visão da squad
    const { ctx, p } = await open(ANA, '?squad=dados');
    await p.selectOption('#f-sub', 'Designers'); await p.waitForTimeout(100);
    const nomes = await p.evaluate(() => [...document.querySelectorAll('tbody tr:not(.cob) th.pess .pnome > div > b')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    t('squad: subtime Designers esconde o Paulo (Redator); a cobertura recalcula só com os Designers', nomes.join('|') === 'Ana Lima (você)|Bruno Reis', nomes);
    await p.click('#v-global'); await p.waitForTimeout(100);
    t('trocar de visão mantém o filtro que ainda vale', await p.evaluate(() => document.getElementById('f-sub').value === 'Designers'), 0);
    await p.selectOption('#f-sub', 'Redatores'); await p.click('#v-squad'); await p.waitForTimeout(100);
    t('Redatores existe na squad Dados, então o filtro continua na visão da squad', await p.evaluate(() => document.getElementById('f-sub').value === 'Redatores'), 0);
    await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?squad=dev'); t('squad Dev (subtime "designers"): filtro presente', await vis(p, '#f-sub'), 0); await ctx.close(); }
  { const s0 = seed(); delete s0.kanban.squads; const { ctx, p } = await open(ANA, '?squad=dados', { seed: s0 }); t('squad sem nenhum subtime: a barra de filtro some', !(await vis(p, '#filtros')), 0); await ctx.close(); }
  { // o filtro não atrapalha o cadastro (lista todas as pessoas da squad)
    const { ctx, p } = await open(PAU, '?squad=dados'); await p.selectOption('#f-sub', 'Designers'); await p.click('#b-cad'); await p.waitForTimeout(120);
    const opts = await p.evaluate(() => [...document.querySelectorAll('#c-uid option')].map(o => o.textContent.trim()));
    t('cadastro continua listando todos da squad mesmo com filtro ativo', opts.join('|') === 'Paulo PO (você)|Ana Lima|Bruno Reis', opts); await ctx.close(); }

  // ── INTEGRAÇÃO: botão no Maré, atalho no Painel, Ajuda ──
  { const K = PAGE.replace(/^escala/, 'kanban'), seedK = { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'membro', squads: { dev: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'membro', squads: { dev: true } } } } };
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seedK);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G('eve', 'Eve')); await p.waitForTimeout(2800);
    await p.evaluate(() => { document.querySelectorAll('.ov.open,.modal-ov.open').forEach(e => e.classList.remove('open')); });
    t('Maré: botão 🗓️ Escala existe na barra', await vis(p, '#btn-escala'), 0);
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(() => document.getElementById('btn-escala').click())]);
    t('Maré: o botão abre a Escala em outra aba, já na squad atual', new URL(pop.url()).pathname.endsWith('/' + PAGE) && new URL(pop.url()).searchParams.get('squad') === 'dev', pop.url());
    const ajuda = await p.evaluate(() => JSON.stringify(HELP_CONTENT).includes('Escala (quem trabalha quando)'));
    t('Maré: Central de Ajuda tem a entrada da Escala', ajuda, 0);
    t('Maré: atalho configurável "🗓️ Escala" cadastrado', await p.evaluate(() => !!ATALHO_ACOES.escala), 0);
    t('Maré: sem erro de JS', !errs.length, errs);
    const pn = require('fs').readFileSync('/home/user/hering/' + PAGE.replace(/^escala/, 'painel'), 'utf8');
    t('Painel: aba-atalho "Escala ↗" abre a visão global em outra aba', new RegExp('id="ptab-escala" href="' + PAGE + '\\?visao=global" target="_blank"').test(pn), 0);
    await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
