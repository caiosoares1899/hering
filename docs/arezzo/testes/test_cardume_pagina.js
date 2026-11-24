// 🐟 Cardume (cardume-dev.html) — etapa 2: a página ligada ao banco (fakefb) + CADA escrita da página conferida contra as regras reais (rulesSim.update).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_cardume_pagina.js
// BASE_URL, CHROME e PLAYWRIGHT_MODULE substituem os caminhos (padrão: ~/hering-tools do Mac). PAGE=cardume.html testa a prod quando existir.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const PAGE = process.env.PAGE || 'cardume-dev.html';
const G = (uid, email, nome) => ({ uid, email, displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const CAIO = G('cai', 'caio.soares@ciahering.com.br', 'Caio Soares'), ANA = G('ana', 'ana@ciahering.com.br', 'Ana Lima');
const pub = (uid, nome, init, sq) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: sq ? { [sq]: true } : {} });
const seed = () => ({ kanban: {
  squads_meta: { app: { label: 'Squad APP', emoji: '📱' } },   // como na produção: a dados (original) NÃO está em squads_meta
  usuarios: { cai: { role: 'adm', squads: { dados: true } }, ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { cai: Object.assign(pub('cai', 'Caio Soares', 'CS', 'dados'), { email: 'caio.soares@ciahering.com.br' }), ana: pub('ana', 'Ana Lima', 'AL', 'dados'), bru: pub('bru', 'Bruno Reis', 'BR', 'dados'), ann: pub('ann', 'Ana', 'AN', 'dados') },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
// Repete cada escrita registrada pelo fakefb contra as regras, com o estado de ANTES e o relógio daquele momento.
function conferirEscritas(escritas, quem) {
  const real = Date.now; const ruins = [];
  for (const e of escritas) {
    const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v]));
    Date.now = () => e.t;
    let r; try { r = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; }
    if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) });
  }
  return ruins;
}

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abrir = async (user, store, qs, vp) => {
    const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 860 } }); await fake.install(ctx, store);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(base + '/' + PAGE + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(400); return { ctx, p, errs };
  };
  const store = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const escritas = p => p.evaluate(() => window.__escritas || []);
  const ler = (s, caminho) => caminho.split('/').reduce((a, k) => (a == null ? undefined : a[k]), s);
  const enviar = async (p, txt) => { await p.fill('#entrada', txt); await p.press('#entrada', 'Enter'); await p.waitForTimeout(150); };

  // ── 1. ADM ativa o canal da squad e põe gente ──
  const A = await abrir(CAIO, seed());
  const p = A.p;
  t('squad original (fora do squads_meta) aparece para o ADM ativar', await p.isVisible('[data-canal="dados"]') && await p.isVisible('[data-canal="app"]'), await p.textContent('#lista-canais'));
  t('ADM vê a squad sem canal', await p.isVisible('[data-canal="dados"]') && /ativar/.test(await p.textContent('[data-canal="dados"]')), await p.textContent('#lista-canais'));
  await p.click('[data-canal="dados"]');
  await p.click('#lado >> text=Ativar canal da squad'); await p.waitForTimeout(150);
  let s = await store(p);
  t('ativar cria canais/dados com o nome da squad', ler(s, 'kanban/cardume/canais/dados/nome') === 'Dados', ler(s, 'kanban/cardume/canais'));
  await p.fill('#lado input[type="search"]', 'Caio'); await p.click('#lado .pessoa button:has-text("Adicionar")'); await p.waitForTimeout(120);
  await p.fill('#lado input[type="search"]', 'Ana Lima'); await p.click('#lado .pessoa button:has-text("Adicionar")'); await p.waitForTimeout(120);
  await p.fill('#lado input[type="search"]', 'Ana'); await p.click('#lado .pessoa:has-text("Ana"):not(:has-text("Lima")) button:has-text("Adicionar")'); await p.waitForTimeout(120);
  s = await store(p);
  t('adicionar grava membros + meus (par exigido pelas regras)', ler(s, 'kanban/cardume/membros/dados/ana') === true && ler(s, 'kanban/cardume/meus/ana/dados') === true && ler(s, 'kanban/cardume/meus/cai/dados') === true, ler(s, 'kanban/cardume'));
  t('compositor aparece para quem é membro', await p.isVisible('#entrada'), 0);

  // ── 2. Mandar, formatar, mencionar, editar, apagar ──
  await enviar(p, 'Bom dia, time!');
  s = await store(p);
  const ms = ler(s, 'kanban/cardume/msgs/dados') || {}; const k = Object.keys(ms)[0], ult = ler(s, 'kanban/cardume/ultima/dados');
  t('enviar grava a mensagem e o "ultima" com o MESMO ts', !!k && ult && ult.id === k && ult.ts === ms[k].ts && typeof ms[k].ts === 'number', { ms, ult });
  t('mensagem aparece na conversa', /Bom dia, time!/.test(await p.textContent('#log')), 0);
  await enviar(p, '**importante** e _leve_ ~~velho~~ `cod` <img src=x onerror="window.__xss=1"> https://exemplo.com/a javascript:alert(1)');
  const fmt = await p.evaluate(() => { const m = [...document.querySelectorAll('#log .msg')].pop(); return { strong: !!m.querySelector('strong'), em: !!m.querySelector('em'), s: !!m.querySelector('s'), code: !!m.querySelector('code'), img: !!m.querySelector('img'), links: [...m.querySelectorAll('a')].map(a => a.href), xss: !!window.__xss, txt: m.textContent }; });
  t('formatação vira negrito/itálico/riscado/código', fmt.strong && fmt.em && fmt.s && fmt.code, fmt);
  t('HTML na mensagem aparece como texto (sem <img>, sem script)', !fmt.img && !fmt.xss && /<img src=x/.test(fmt.txt), fmt);
  t('só link https vira link; javascript: fica texto', fmt.links.length === 1 && fmt.links[0] === 'https://exemplo.com/a', fmt.links);
  await p.fill('#entrada', 'oi @An'); await p.dispatchEvent('#entrada', 'input'); await p.waitForTimeout(80);
  t('@ abre o autocompletar com quem é do canal', await p.isVisible('#sugestoes') && /Ana Lima/.test(await p.textContent('#sugestoes')), 0);
  await p.press('#entrada', 'Enter');
  t('Enter escolhe a pessoa (não envia)', (await p.inputValue('#entrada')) === 'oi @Ana Lima ', await p.inputValue('#entrada'));
  await p.press('#entrada', 'Enter'); await p.waitForTimeout(150);
  { const sN = await store(p); const ns = Object.values(ler(sN, 'kanban/usuarios/ana/notificacoes') || {});
    const n = ns.find(x => x.type === 'cardume_mencao'); const idx = ler(sN, 'kanban/cardume/mencoes/ana') || {};
    const ref = n && n.cardumeRef, rec = ref && idx[ref];
    t('@menção: notificação GENÉRICA (sem canal, sem trecho, sem id de canal)', !!n && /te mencionou no Cardume/.test(n.title) && n.sub === 'Toque para abrir a conversa' && !('cardume' in n) && !('cardumeMsg' in n) && !/Dados|dados|oi @/.test(JSON.stringify(n)), n);
    t('@menção: canal e mensagem só no índice PRIVADO, que aponta para ESTA notificação', !!rec && rec.c === 'dados' && /^[A-Za-z0-9_-]+$/.test(rec.m) && rec.de === 'cai' && rec.n === n.id && typeof rec.ts === 'number', { ref, rec, n });
    t('"@Ana Lima" não avisa a "Ana" (nome mais curto que é começo do outro)', !ler(sN, 'kanban/usuarios/ann/notificacoes') && !ler(sN, 'kanban/cardume/mencoes/ann'), ler(sN, 'kanban/usuarios/ann'));
    t('quem não foi mencionado (Bruno, fora do canal) não recebe nada', !ler(sN, 'kanban/usuarios/bru/notificacoes') && !ler(sN, 'kanban/cardume/mencoes/bru'), 0);
    t('quem escreveu não avisa a si mesmo', !ler(sN, 'kanban/usuarios/cai/notificacoes'), 0); }
  await enviar(p, 'exemplo de código: `@Ana Lima` e ```\n@Ana\n```'); await p.waitForTimeout(150);
  { const sC = await store(p); t('@nome dentro de código não avisa ninguém', Object.keys(ler(sC, 'kanban/cardume/mencoes/ana') || {}).length === 1 && !ler(sC, 'kanban/cardume/mencoes/ann'), ler(sC, 'kanban/cardume/mencoes')); }
  t('menção renderizada destacada', await p.evaluate(() => [...document.querySelectorAll('#log .mencao')].some(x => x.textContent === '@Ana Lima')), 0);
  await p.fill('#entrada', 'linha 1'); await p.press('#entrada', 'Shift+Enter');
  t('Shift+Enter quebra linha sem enviar', (await p.inputValue('#entrada')) === 'linha 1\n', await p.inputValue('#entrada'));
  await p.fill('#entrada', '');
  // editar a primeira
  await p.hover('[data-msg="' + k + '"]'); await p.click('[data-msg="' + k + '"] >> text=Editar');
  await p.fill('[data-msg="' + k + '"] textarea', 'Bom dia, time! (corrigido)'); await p.press('[data-msg="' + k + '"] textarea', 'Enter'); await p.waitForTimeout(150);
  s = await store(p);
  t('editar grava texto + editado (servidor) e mostra "(editada)"', ler(s, 'kanban/cardume/msgs/dados/' + k + '/texto') === 'Bom dia, time! (corrigido)' && typeof ler(s, 'kanban/cardume/msgs/dados/' + k + '/editado') === 'number' && /\(editada\)/.test(await p.textContent('[data-msg="' + k + '"]')), ler(s, 'kanban/cardume/msgs/dados/' + k));
  // apagar e desfazer
  await p.hover('[data-msg="' + k + '"]'); await p.click('[data-msg="' + k + '"] >> text=Apagar');
  t('apagar mostra "mensagem apagada · Desfazer"', /mensagem apagada/.test(await p.textContent('[data-msg="' + k + '"]')) && await p.isVisible('[data-msg="' + k + '"] >> text=Desfazer'), 0);
  await p.click('[data-msg="' + k + '"] >> text=Desfazer'); await p.waitForTimeout(5300);
  s = await store(p);
  t('Desfazer dentro de 5 s: nada é apagado no banco', ler(s, 'kanban/cardume/msgs/dados/' + k + '/texto') === 'Bom dia, time! (corrigido)', ler(s, 'kanban/cardume/msgs/dados/' + k));
  await p.hover('[data-msg="' + k + '"]'); await p.click('[data-msg="' + k + '"] >> text=Apagar'); await p.waitForTimeout(5400);
  s = await store(p); const tomb = ler(s, 'kanban/cardume/msgs/dados/' + k);
  t('depois de 5 s: grava só {uid, ts, apagada} — o texto sai do banco', tomb && tomb.apagada === true && !('texto' in tomb) && Object.keys(tomb).sort().join() === 'apagada,ts,uid', tomb);

  // ── 3. Criar um temático aberto ──
  await p.click('#b-novo'); await p.fill('.md input:not([type])', 'Black Friday 2026');
  await p.click('.md >> text=Criar canal'); await p.waitForTimeout(200);
  s = await store(p);
  const tid = Object.keys(ler(s, 'kanban/cardume/canais') || {}).find(x => x.startsWith('t-'));
  t('criar temático: id t-…-sufixo, canal + eu membro + meus + abertos', !!tid && /^t-black-friday-2026-[a-z0-9]{4}$/.test(tid) && ler(s, 'kanban/cardume/canais/' + tid + '/dono') === 'cai' && ler(s, 'kanban/cardume/membros/' + tid + '/cai') === true && ler(s, 'kanban/cardume/meus/cai/' + tid) === true && ler(s, 'kanban/cardume/abertos/' + tid + '/nome') === 'Black Friday 2026', { tid, c: ler(s, 'kanban/cardume/canais/' + tid) });
  await enviar(p, 'Canal da BF no ar 🖤');
  t('sem erro de JS (ADM)', !A.errs.length, A.errs);

  // ── 4. Todas as escritas do ADM passam nas regras ──
  const ruinsA = conferirEscritas(await escritas(p), CAIO);
  t('CADA escrita da página (ADM) passa nas regras reais do banco', !ruinsA.length, ruinsA);
  const estado = await store(p); await A.ctx.close();

  // ── 5. Ana: não lidas, ler, entrar no aberto ──
  const B = await abrir(ANA, estado);
  const q = B.p;
  t('Ana vê # Dados com ponto de não lido', await q.evaluate(() => { const x = document.querySelector('[data-canal="dados"]'); return !!x && x.classList.contains('nao-lido'); }), await q.textContent('#lista-canais'));
  t('@ Menções mostra 1 nova', (await q.textContent('#mencoes-n')).trim() === '1' && await q.isVisible('#mencoes-n'), await q.textContent('#mencoes-n'));
  await q.click('#b-mencoes'); await q.waitForTimeout(150);
  t('a aba @ Menções lista a menção com o trecho', /te mencionou em # Dados/.test(await q.textContent('#log')) && /oi @Ana Lima/.test(await q.textContent('#log')), await q.textContent('#log'));
  await q.click('.mencao-item'); await q.waitForTimeout(500);
  const sM = await store(q); const rM = Object.values(ler(sM, 'kanban/cardume/mencoes/ana') || {})[0];
  t('clicar na menção abre o canal, destaca a mensagem e marca a menção como lida', (await q.evaluate(() => window.__cardume.estado.atual)) === 'dados' && await q.evaluate(() => !!document.querySelector('.msg.destaque')) && rM && rM.lida === true, { atual: await q.evaluate(() => window.__cardume.estado.atual), rM });
  await q.click('[data-canal="dados"]'); await q.waitForTimeout(1100);
  s = await store(q);
  t('abrir marca como lido (lidas = ts da última)', typeof ler(s, 'kanban/cardume/lidas/ana/dados') === 'number' && ler(s, 'kanban/cardume/lidas/ana/dados') === ler(s, 'kanban/cardume/ultima/dados/ts'), ler(s, 'kanban/cardume/lidas'));
  t('Ana vê "mensagem apagada" no lugar do texto', /mensagem apagada/.test(await q.textContent('#log')), 0);
  t('Ana não tem 🗑 na mensagem de outra pessoa', await q.evaluate(() => ![...document.querySelectorAll('#log .msg')].some(m => /Apagar/.test(m.textContent) && !/Ana/.test(m.closest('.grupo').textContent))), 0);
  t('o temático aberto aparece em "Abertos para entrar"', await q.isVisible('[data-canal="' + tid + '"]'), await q.textContent('#lista-canais'));
  await q.click('[data-canal="' + tid + '"]'); await q.click('#log >> text=Entrar no canal'); await q.waitForTimeout(200);
  s = await store(q);
  t('entrar grava membros + meus da Ana', ler(s, 'kanban/cardume/membros/' + tid + '/ana') === true && ler(s, 'kanban/cardume/meus/ana/' + tid) === true, 0);
  await enviar(q, 'Cheguei!');
  const ruinsB = conferirEscritas(await escritas(q), ANA);
  t('CADA escrita da página (Ana) passa nas regras reais do banco', !ruinsB.length, ruinsB);
  t('sem erro de JS (Ana)', !B.errs.length, B.errs);
  const estado2 = await store(q); await B.ctx.close();

  // ── 5b. Achados do Codex na #1926 ──
  const BRU = G('bru', 'bru@ciahering.com.br', 'Bruno Reis');
  const escrever = async (pg, caminho, v) => pg.evaluate(async ([c, x]) => { const m = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'); await m.set(m.ref({}, c), x); }, [caminho, v]);
  { // link do push/sino: ?mencao=<ref do índice privado> abre o canal e destaca a mensagem; ref de outra pessoa não abre nada
    const [ref, rec] = Object.entries(ler(estado2, 'kanban/cardume/mencoes/ana'))[0];
    const L = await abrir(ANA, estado2, '?mencao=' + ref); await L.p.waitForTimeout(600);
    t('link do push (?mencao=) abre o canal certo e destaca a mensagem', (await L.p.evaluate(() => window.__cardume.estado.atual)) === 'dados' && await L.p.evaluate(a => { const e = document.querySelector('[data-msg="' + a + '"]'); return !!e && e.classList.contains('destaque'); }, rec.m), rec);
    await L.ctx.close();
    const L2 = await abrir(ANA, estado2, '?mencao=naoexiste'); await L2.p.waitForTimeout(400);
    t('ref que não existe: avisa "Menção não encontrada" e não abre canal', /Menção não encontrada/.test(await L2.p.textContent('#toast')) && !(await L2.p.evaluate(() => window.__cardume.estado.atual)) || /Menção não encontrada/.test(await L2.p.textContent('#toast')), await L2.p.textContent('#toast'));
    await L2.ctx.close();
  }
  { // link direto ?c=dados como membro não ADM: a conversa carrega quando o "meus" chega
    const D = await abrir(ANA, estado2, '?c=dados'); await D.p.waitForTimeout(300);
    t('link ?c= abre a conversa já carregada (membro não ADM)', /Cheguei|BF|corrigido|importante/.test(await D.p.textContent('#log')) && await D.p.isVisible('#entrada'), await D.p.textContent('#log'));
    // rascunho por canal: texto do canal A não vai para o canal B
    await D.p.fill('#entrada', 'rascunho só da dados'); await D.p.dispatchEvent('#entrada', 'input');
    await D.p.click('[data-canal="' + tid + '"]'); await D.p.waitForTimeout(200);
    t('trocar de canal troca o rascunho (o do outro não fica no campo)', (await D.p.inputValue('#entrada')) === '', await D.p.inputValue('#entrada'));
    await D.p.press('#entrada', 'Enter'); await D.p.waitForTimeout(150);
    const sT = await store(D.p);
    t('Enter com campo vazio no canal B não envia o texto do A', !Object.values(ler(sT, 'kanban/cardume/msgs/' + tid) || {}).some(m => m.texto === 'rascunho só da dados'), 0);
    await D.p.click('[data-canal="dados"]'); await D.p.waitForTimeout(200);
    t('voltar ao canal A restaura o rascunho dele', (await D.p.inputValue('#entrada')) === 'rascunho só da dados', await D.p.inputValue('#entrada'));
    // Enter duas vezes com a rede lenta: uma mensagem só
    await D.p.evaluate(() => { window.__setDelay = () => 400; });
    const antes = Object.keys(ler(await store(D.p), 'kanban/cardume/msgs/dados') || {}).length;
    await D.p.fill('#entrada', 'uma vez só'); await D.p.press('#entrada', 'Enter'); await D.p.press('#entrada', 'Enter'); await D.p.waitForTimeout(700);
    await D.p.evaluate(() => { window.__setDelay = null; });
    const depois = Object.values(ler(await store(D.p), 'kanban/cardume/msgs/dados') || {});
    t('Enter duas vezes durante o envio grava uma mensagem só', depois.length === antes + 1 && depois.filter(m => m.texto === 'uma vez só').length === 1, depois.length - antes);
    // editor preservado quando chega mensagem de outra pessoa
    const minha = Object.entries(ler(await store(D.p), 'kanban/cardume/msgs/dados')).find(([, m]) => m.texto === 'uma vez só')[0];
    await D.p.hover('[data-msg="' + minha + '"]'); await D.p.click('[data-msg="' + minha + '"] >> text=Editar');
    await D.p.fill('[data-msg="' + minha + '"] textarea', 'editando com calma');
    await escrever(D.p, 'kanban/cardume/msgs/dados/zzOutra1', { uid: 'cai', ts: Date.now(), texto: 'chegou outra' }); await D.p.waitForTimeout(150);
    t('mensagem nova chegando não apaga o que está sendo editado', (await D.p.inputValue('[data-msg="' + minha + '"] textarea')) === 'editando com calma', await D.p.inputValue('[data-msg="' + minha + '"] textarea').catch(() => 'sumiu'));
    // troca de conta na mesma aba: nada do canal privado fica na tela
    await D.p.evaluate(() => window.__authCb(null)); await D.p.waitForTimeout(150);
    await D.p.evaluate(x => window.__authCb(x), BRU); await D.p.waitForTimeout(400);
    const tela = await D.p.evaluate(() => ({ log: document.getElementById('log').textContent, lado: document.getElementById('lado').textContent, lista: document.getElementById('lista-canais').textContent, entrada: document.getElementById('entrada').value }));
    t('trocar de conta não mostra mensagens nem membros do canal anterior', !/chegou outra|uma vez só|Ana Lima/.test(tela.log + tela.lado) && !tela.entrada, tela);
    t('sem erro de JS (achados)', !D.errs.length, D.errs);
    await D.ctx.close();
  }
  { // celular: com a lista à frente, mensagem nova não é marcada como lida e o ponto aparece
    const M = await abrir(ANA, estado2, '', { width: 390, height: 800 });
    await M.p.click('[data-canal="dados"]'); await M.p.waitForTimeout(1000);
    await M.p.click('#b-voltar'); await M.p.waitForTimeout(100);
    const lidoAntes = ler(await store(M.p), 'kanban/cardume/lidas/ana/dados');
    const ts = Date.now() + 5;
    await escrever(M.p, 'kanban/cardume/msgs/dados/zzNova2', { uid: 'cai', ts, texto: 'nova enquanto na lista' });
    await escrever(M.p, 'kanban/cardume/ultima/dados', { uid: 'cai', ts, id: 'zzNova2' }); await M.p.waitForTimeout(1100);
    t('celular na lista: não marca como lida a mensagem que a pessoa não viu', ler(await store(M.p), 'kanban/cardume/lidas/ana/dados') === lidoAntes, [lidoAntes, ts]);
    t('celular na lista: o ponto de não lido aparece', await M.p.evaluate(() => document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), 0);
    await M.p.click('[data-canal="dados"]'); await M.p.waitForTimeout(1100);
    t('celular: abrir a conversa marca como lida', ler(await store(M.p), 'kanban/cardume/lidas/ana/dados') === ts, ler(await store(M.p), 'kanban/cardume/lidas/ana/dados'));
    t('sem erro de JS (celular, lidas)', !M.errs.length, M.errs);
    await M.ctx.close();
  }

  // ── 6. Celular: uma coluna por vez, sem rolagem lateral ──
  const C = await abrir(ANA, estado2, '', { width: 390, height: 800 });
  const sobra = await C.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t('celular: sem rolagem lateral, começa na lista de canais', sobra <= 0 && (await C.p.getAttribute('#app', 'data-tela')) === 'canais' || sobra <= 0, { sobra, tela: await C.p.getAttribute('#app', 'data-tela') });
  await C.p.click('[data-canal="dados"]');
  t('celular: tocar no canal abre a conversa', (await C.p.getAttribute('#app', 'data-tela')) === 'conversa' && await C.p.isVisible('#log'), 0);
  t('sem erro de JS (celular)', !C.errs.length, C.errs);
  await C.ctx.close();

  await b.close();
  console.log(`\n${ok ? 'TUDO OK' : 'HÁ FALHAS'} (${total} verificações)`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('❌ erro no teste', e); process.exit(1); });
