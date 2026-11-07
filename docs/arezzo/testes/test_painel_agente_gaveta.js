// 🤖 Painel (painel-dev) › gaveta do Agente Ágil (docs/AGENTE_AGIL_PAINEL.md): visibilidade por interruptor/papel, contexto, envio, espera, resposta (texto/atalhos/fonte/aviso de número),
// XSS e acessibilidade. Playwright + Firebase falso. PW_MODULE=… CHROME_PATH=… node test_painel_agente_gaveta.js   (python3 -m http.server 8941 na raiz do repo)
// A mensagem que o navegador GRAVA é validada contra o database.rules.json REAL (functions/rules/rulesSim.js) — o par cliente×regra não pode divergir.
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const fs = require('fs'), path = require('path'); const { check, validate } = require('../../../functions/rules/rulesSim');
// RULES_FILE permite testar contra as regras de outra branch enquanto o PR das regras não foi mergeado (a gaveta DEPENDE delas: sem os nós novos toda escrita é negada).
const RULES = JSON.parse(fs.readFileSync(process.env.RULES_FILE || path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const PAGE = process.env.PAGE || 'painel-dev.html', OUT = process.env.CAPTURAS || '/tmp';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const authRegras = { uid: 'ana', token: { email: 'ana@ciahering.com.br', firebase: { sign_in_provider: 'google.com' } } };
const seed = ({ role = 'adm', cfg } = {}) => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role, squads: { dados: true, midiacriativa: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role, squads: { dados: true, midiacriativa: true } } }, config: Object.assign({ adm_emails: role === 'adm' ? ['ana@ciahering.com.br'] : [], agente_agil_orquestrador: Object.assign({ enabled: true, painel_enabled: true }, cfg || {}) }),
  squads: { dados: { dados: {} }, midiacriativa: { dados: {} } } } });
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + String(JSON.stringify(d)).slice(0, 300))); };
  const abre = async (opts, vp, viewer) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, seed(opts)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2800);
    await p.evaluate(() => { SQUADS.splice(0, SQUADS.length, { id: 'dados', label: 'Dados', icon: '📊', color: '#38b6ff', wipLimit: 2 }, { id: 'midiacriativa', label: 'Mídia', icon: '🎨', color: '#1de9b6', wipLimit: 3 }); window._pollSquadDados = () => { }; window._pollSquadSnapshots = () => { }; swPtab('visao'); }); await p.waitForTimeout(600); return { ctx, p, errs }; };
  const visivel = (p) => p.evaluate(() => !document.getElementById('ag-fab').hidden);
  const responde = (p, id, corpo) => p.evaluate(([id, corpo]) => { const base = 'kanban/agente_painel_dev/ana'; const n = base.split('/').reduce((o, k) => o[k] = o[k] || {}, window.__store); n[id + '_r'] = Object.assign({ role: 'agente', ts: new Date().toISOString(), em: id }, corpo);
    (window.__lis || []).filter(l => l.p === base).forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(window.__store.kanban.agente_painel_dev.ana)), key: 'ana', exists: () => true })); }, [id, corpo]);

  // ── visibilidade ──
  for (const [cfg, role, esperado, nome] of [[{}, 'adm', true, 'ligado + ADM'], [{ painel_enabled: false }, 'adm', false, 'painel_enabled desligado'], [{ enabled: false }, 'adm', false, 'kill switch geral desligado'], [{}, 'membro', false, 'padrão "adm": membro não vê'], [{}, 'po', false, 'padrão "adm": PO não vê'],
    [{ painel_acesso: 'gestores' }, 'po', true, '"gestores": PO vê'], [{ painel_acesso: 'gestores' }, 'membro', false, '"gestores": membro não vê'], [{ painel_acesso: 'todos' }, 'membro', true, '"todos": membro vê'], [{ painel_enabled: 'true' }, 'adm', false, 'valor "true" (string) não liga']]) {
    const { ctx, p } = await abre({ role, cfg }); t('botão 🤖: ' + nome, (await visivel(p)) === esperado, await visivel(p)); await ctx.close(); }
  { const { ctx, p } = await abre({}); await p.evaluate(() => { window._isPainelViewer = true; agEncerrar(); }); await p.evaluate(() => agIniciar(window._currentUser)); await p.waitForTimeout(400); t('visualizador externo nunca vê o botão', !(await visivel(p))); await ctx.close(); }

  // ── uso (ADM, 1280) ──
  const { ctx, p, errs } = await abre({}); t('botão visível para o ADM com o agente ligado', await visivel(p));
  const antes = await p.evaluate(() => window.__log.filter(l => l[1] && /agente_painel/.test(l[1])).length); t('zero leitura/escuta da conversa antes de abrir a gaveta (só a config)', antes === 0, antes);
  await p.click('#ag-fab'); await p.waitForTimeout(400);
  t('gaveta abre, foco no campo, botão marca aria-expanded', await p.evaluate(() => !document.getElementById('ag-drawer').hidden && document.activeElement.id === 'ag-ta' && document.getElementById('ag-fab').getAttribute('aria-expanded') === 'true'));
  t('estado vazio explica o que ele faz (só lê)', /só leio|Só leio|só leio e analiso/i.test(await p.evaluate(() => document.getElementById('ag-msgs').innerText)));
  t('chips de contexto: aba Visão e "todos os squads"; sugestões da Visão', await p.evaluate(() => /Visão/.test(document.getElementById('ag-ctx').innerText) && /todos os squads/.test(document.getElementById('ag-ctx').innerText) && /merece atenção/.test(document.getElementById('ag-chips').innerText)));
  await p.evaluate(() => { swPtab('fluxo'); }); await p.waitForTimeout(300);
  t('trocar de aba atualiza o contexto (Fluxo · últimos 14 dias) e as sugestões', await p.evaluate(() => /Fluxo/.test(document.getElementById('ag-ctx').innerText) && /últimos 14 dias/.test(document.getElementById('ag-ctx').innerText) && /gargalo/.test(document.getElementById('ag-chips').innerText)));
  await p.fill('#ag-ta', 'onde está o gargalo?'); await p.click('#ag-send'); await p.waitForTimeout(500);
  const msg = await p.evaluate(() => { const n = (window.__store.kanban.agente_painel_dev || {}).ana || {}; const k = Object.keys(n); return { k, m: n[k[0]] }; });
  t('grava UMA mensagem em kanban/agente_painel_dev/{uid}/{id} (role user, texto, ctx da aba)', msg.k.length === 1 && msg.m.role === 'user' && msg.m.text === 'onde está o gargalo?' && msg.m.ctx.aba === 'fluxo' && msg.m.ctx.periodo === 14, msg);
  const id = msg.k[0], caminho = 'kanban/agente_painel_dev/ana/' + id;
  t('a mensagem gravada PASSA nas regras reais do banco (escrever + validar) para o dono', check(RULES, { kanban: { usuarios: { ana: { role: 'adm' } } } }, 'write', caminho, authRegras, msg.m) && validate(RULES, { kanban: { usuarios: { ana: { role: 'adm' } } } }, caminho, authRegras, msg.m));
  t('enquanto espera: "Lendo os dados do Painel…" e o botão Enviar desabilitado (uma pergunta em voo)', await p.evaluate(() => /Lendo os dados/.test(document.getElementById('ag-msgs').innerText) && document.getElementById('ag-send').disabled));
  await p.fill('#ag-ta', 'outra'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  t('segunda pergunta enquanto espera é ignorada (não grava)', await p.evaluate(() => Object.keys(window.__store.kanban.agente_painel_dev.ana).length === 1));
  await responde(p, id, { text: 'Em Revisão há 11 cards (limite 7).', atalhos: [{ rotulo: 'Ver no Fluxo · Mídia', aba: 'fluxo', filtro: 'midiacriativa' }, { rotulo: 'aba falsa', aba: 'hackeada' }], fonte: 'Fluxo · Digital · 14 dias', lidoEm: new Date().toISOString(), conferido: true }); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({ txt: document.getElementById('ag-msgs').innerText, botoes: [...document.querySelectorAll('#ag-msgs .ag-go')].map(b => b.innerText), espera: /Lendo os dados/.test(document.getElementById('ag-msgs').innerText), send: document.getElementById('ag-send').disabled }));
  t('a resposta aparece (texto, fonte, hora), a espera some e o Enviar volta', /11 cards/.test(r.txt) && /Fonte: Fluxo · Digital · 14 dias · lido às/.test(r.txt) && !r.espera && !r.send, r);
  t('só o atalho de aba válida vira botão (a aba "hackeada" é descartada)', r.botoes.length === 1 && /Ver no Fluxo · Mídia/.test(r.botoes[0]), r.botoes);
  await p.evaluate(() => swPtab('visao')); await p.click('#ag-msgs .ag-go'); await p.waitForTimeout(400);
  t('clicar no atalho leva à aba Fluxo e aplica o filtro do squad', await p.evaluate(() => document.getElementById('ptab-fluxo').classList.contains('on')), await p.evaluate(() => document.querySelector('.ptab.on').id));
  t('a faixa "PAINEL DEV" não cobre o cabeçalho da gaveta (botão fechar clicável)', await p.evaluate(() => { const x = document.querySelector('.ag-x').getBoundingClientRect(); const top = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return !!top && (top.classList.contains('ag-x') || !!top.closest('.ag-drawer')); }));
  await p.screenshot({ path: OUT + '/agente_gaveta_1280.png' });
  // aviso de número não conferido + XSS
  await p.evaluate(() => { document.getElementById('ag-send').disabled = false; }); await p.fill('#ag-ta', 'x'); await p.click('#ag-send'); await p.waitForTimeout(300);
  const id2 = await p.evaluate(() => Object.keys(window.__store.kanban.agente_painel_dev.ana).filter(k => !k.endsWith('_r')).sort().pop());
  await responde(p, id2, { text: 'Há 12 bloqueados <img src=x onerror="window.__xss=1"> <b>negrito</b>', atalhos: [{ rotulo: '<img src=x onerror="window.__xss=2">', aba: 'status', filtro: 'x" onmouseover="window.__xss=3' }], fonte: '<script>window.__xss=4</script>', conferido: false, naoConferidos: ['12'] }); await p.waitForTimeout(400);
  const x = await p.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('#ag-msgs img').length, bold: document.querySelectorAll('#ag-msgs b').length, aviso: /não bateram/.test(document.getElementById('ag-msgs').innerText) && /12/.test(document.querySelector('#ag-msgs .ag-warn')?.innerText || ''), btnFiltro: [...document.querySelectorAll('#ag-msgs .ag-go')].pop()?.dataset.filtro }));
  t('HTML na resposta/atalho/fonte aparece como texto (nada executa, nenhum <img>/<b> injetado)', x.xss === 0 && x.imgs === 0 && x.bold === 0, x);
  t('número não conferido mostra o aviso amarelo com o valor', x.aviso, x);
  t('filtro malicioso no atalho vira vazio (não chega ao atributo)', x.btnFiltro === '', x);
  // markdown leve (como o Radar): **negrito**, *itálico*, `código`, "- " vira "•"; HTML dentro do negrito segue texto
  await p.evaluate(() => { document.getElementById('ag-send').disabled = false; }); await p.fill('#ag-ta', 'md'); await p.click('#ag-send'); await p.waitForTimeout(300);
  const id3 = await p.evaluate(() => Object.keys(window.__store.kanban.agente_painel_dev.ana).filter(k => !k.endsWith('_r')).sort().pop());
  await responde(p, id3, { text: 'Pelo Painel:\n- **WIP estourado:** 16 em *Em Progresso* (P85 `5,3 d`)\n* **<img src=x onerror="window.__xss=5">**', conferido: true }); await p.waitForTimeout(400);
  const md = await p.evaluate(() => { const el = [...document.querySelectorAll('#ag-msgs .ag-tx')].pop(); return { txt: el.innerText, strong: el.querySelectorAll('strong').length, em: el.querySelectorAll('em').length, code: el.querySelectorAll('code').length, imgs: el.querySelectorAll('img').length, xss: window.__xss || 0 }; });
  t('markdown da resposta vira formatação (sem ** nem * à mostra, lista com •) e HTML no negrito segue texto', md.strong === 2 && md.em === 1 && md.code === 1 && !/\*/.test(md.txt) && (md.txt.match(/•/g) || []).length === 2 && md.imgs === 0 && md.xss === 0, md);
  // teclado / foco / fechar
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  t('Esc fecha a gaveta e devolve o foco ao botão 🤖', await p.evaluate(() => document.getElementById('ag-drawer').hidden && document.activeElement.id === 'ag-fab'));
  await p.click('#ag-fab'); await p.waitForTimeout(300); const antesLis = await p.evaluate(() => window.__lis.filter(l => /agente_painel_dev/.test(l.p)).length); await p.click('.ag-x'); await p.click('#ag-fab'); await p.waitForTimeout(300);
  t('reabrir não duplica o listener da conversa', (await p.evaluate(() => window.__lis.filter(l => /agente_painel_dev/.test(l.p)).length)) === antesLis, antesLis);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('auth-change', { detail: null }))); await p.waitForTimeout(400);
  t('sair da conta fecha a gaveta, esconde o botão e solta a conversa', await p.evaluate(() => document.getElementById('ag-drawer').hidden && document.getElementById('ag-fab').hidden));
  t('sem erro de JS nem diálogo inesperado', !errs.length, errs); await ctx.close();

  // ── celular 390 ──
  { const { ctx, p, errs } = await abre({}, { width: 390, height: 800 }); await p.click('#ag-fab'); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const d = document.getElementById('ag-drawer').getBoundingClientRect(); const ta = document.getElementById('ag-ta'); return { w: Math.round(d.width), lateral: document.documentElement.scrollWidth - document.documentElement.clientWidth, fonte: parseFloat(getComputedStyle(ta).fontSize), chips: [...document.querySelectorAll('#ag-chips button')].map(b => Math.round(b.getBoundingClientRect().height)) }; });
    t('celular 390: gaveta em tela cheia, sem rolagem lateral, campo ≥16px (sem zoom do iOS)', m.w === 390 && m.lateral <= 0 && m.fonte >= 16, m);
    await p.screenshot({ path: OUT + '/agente_gaveta_390.png' }); t('celular: sem erro de JS', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1); })();
