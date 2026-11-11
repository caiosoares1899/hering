// guia-mare-telas.js — captura as telas REAIS do Maré (kanban-dev.html) para o guia-mare.html.
// Abre o board com o Firebase falso (docs/arezzo/testes/fakefb.js) e dados de exemplo, monta cada estado
// (board, card aberto, sino, Meu Dia, Sonar…), guarda o HTML visível (sem script, sem on*, sem link externo)
// e só o CSS que essas telas usam. O resultado vai entre os marcadores TELAS-GERADAS do guia-mare.html.
//
// uso (na raiz, com um servidor estático):  python3 -m http.server 8991 &   node scripts/guia-mare-telas.js
//   BASE_URL=http://127.0.0.1:8991 (padrão) · precisa de ~/hering-tools (Playwright + Chrome), como as suítes do Mac.
// Rode de novo sempre que o visual do board mudar muito (o guia mostra a tela da data da captura).
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('../docs/arezzo/testes/fakefb.js');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8991';
// PAGINA=kanban.html captura a produção (o guia serve quem usa o prod; use o -dev só para ver antes uma mudança ainda não promovida)
const PAGINA = /^kanban(-dev)?\.html$/.test(process.env.PAGINA || '') ? process.env.PAGINA : 'kanban-dev.html';
const GUIA = path.join(__dirname, '..', 'guia-mare.html');
const W = 1280, H = 760;

// ── dados de exemplo (fictícios) ──
const hoje = new Date(); const dia = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const iso = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d.toISOString(); };
const U = { uid: 'ana', email: 'ana.souza@ciahering.com.br', displayName: 'Ana Souza', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pessoas = { ana: ['Ana Souza', 'AS', 'po'], bruno: ['Bruno Lima', 'BL', 'membro'], carla: ['Carla Dias', 'CD', 'membro'], davi: ['Davi Rocha', 'DR', 'membro'], eva: ['Eva Martins', 'EM', 'membro'] };
const usuarios = {}, publicos = {};
for (const [uid, [nome, init, role]] of Object.entries(pessoas)) {
  usuarios[uid] = { uid, nome, email: uid + '@ciahering.com.br', init, role, inscrito: true, torre: 'digital', squads: { dados: true } };
  publicos[uid] = { uid, nome, init, role, squads: { dados: true } };
}
const card = (id, col, title, o = {}) => ({ id, col, title, tags: [], desc: '', checklist: [], participants: [], created: 'AS', createdAt: dia(-12), priority: 'medium', history: [], flow: { enteredAt: { [col]: iso(-3) }, log: [] }, ...o });
const cards = [
  card('c1', 'backlog', 'Mapear indicadores da campanha de Natal', { owner: 'CD', tags: ['t2'], due: dia(9), priority: 'low' }),
  card('c2', 'backlog', 'Pesquisa de satisfação do app', { owner: 'DR', tags: ['t3'] }),
  card('c3', 'todo', 'Briefing do lançamento da coleção Verão', { owner: 'BL', tags: ['t1'], due: dia(3), priority: 'high', participants: ['AS'] }),
  card('c4', 'todo', 'Ajustar regras de frete grátis', { owner: 'EM', tags: ['t4'], due: dia(1) }),
  card('c5', 'doing', 'Revisar o dashboard de vendas da Black Friday', { owner: 'AS', tags: ['t1', 't2'], due: dia(0), priority: 'high', participants: ['BL', 'CD'],
    desc: 'Conferir se os números do dashboard batem com o fechamento do dia anterior antes da reunião de quinta.',
    checklist: [{ t: 'Conferir vendas por canal', done: true }, { t: 'Validar metas por submarca', done: true }, { t: 'Revisar gráfico de conversão', done: false }, { t: 'Enviar resumo para a gerência', done: false }] }),
  card('c6', 'doing', 'Automatizar o relatório semanal de mídia', { owner: 'BL', tags: ['t3'], due: dia(2), checklist: [{ t: 'Extrair dados', done: true }, { t: 'Montar planilha', done: false }] }),
  card('c7', 'review', 'Teste A/B da vitrine da home', { owner: 'CD', tags: ['t4'], due: dia(-1), priority: 'high' }),
  card('c8', 'done', 'Atualizar banners da página de ofertas', { owner: 'EM', tags: ['t1'], due: dia(-4) }),
  card('c9', 'done', 'Planejamento do sprint 46', { owner: 'AS', tags: ['t3'], due: dia(-6) }),
];
const cm = (id, uid, text, n) => ({ id, uid, author: pessoas[uid][0], init: pessoas[uid][1], foto: '', text, ts: iso(n) });
const seed = () => ({ '.info': { connected: true }, kanban: {
  usuarios, usuarios_publicos: publicos, config: { adm_emails: [] },
  squads_meta: { dados: { label: 'Squad Dados e IA', subtitle: 'Time de Dados' } },
  squads: { dados: { dados: {
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'todo', name: 'A fazer' }, { id: 'doing', name: 'Em progresso' }, { id: 'review', name: 'Em revisão' }, { id: 'done', name: 'Concluído', isDone: true }],
    tags: [{ id: 't1', label: 'Campanha', pi: 0 }, { id: 't2', label: 'Dados', pi: 2 }, { id: 't3', label: 'Rotina', pi: 4 }, { id: 't4', label: 'Site', pi: 1 }],
    cards: Object.fromEntries(cards.map((c, i) => ['k' + i, c])), cards_index: Object.fromEntries(cards.map((c, i) => [c.id, 'k' + i])),
    card_comments: { c5: { a: cm('a', 'bruno', 'Os números de ontem já entraram. @Ana Souza pode conferir a aba de submarcas?', -1), b: cm('b', 'ana', 'Conferi: só falta o gráfico de conversão. Fecho hoje à tarde.', 0) } },
  } } },
  notifs: { ana: {
    n1: { tipo: 'mention', titulo: 'Bruno Lima mencionou você', texto: 'Revisar o dashboard de vendas da Black Friday', ts: Date.now() - 3600e3, lida: false, squad: 'dados', cardId: 'c5' },
    n2: { tipo: 'assign', titulo: 'Você recebeu um card', texto: 'Planejamento do sprint 47', ts: Date.now() - 7200e3, lida: false, squad: 'dados' },
    n3: { tipo: 'due_today', titulo: 'Prazo hoje', texto: 'Revisar o dashboard de vendas da Black Friday', ts: Date.now() - 86400e3, lida: true, squad: 'dados', cardId: 'c5' },
  } },
} });

// ── estados a capturar: id → { prep (na página), alvo (seletor do destaque) } ──
// A base (board) é capturada uma vez; os demais são overlays capturados por cima da mesma base.
// overlay:true → a tela guarda só o que está por cima; o board (#app-root) entra do 'board' na hora de mostrar (economiza ~30 KB por tela).
const TB = id => ({ base: 'board', alvo: '[data-tb-id="' + id + '"]' });
const ESTADOS = {
  board:        { alvo: '#board' },
  'card-criar': { base: 'board', alvo: '#board .add-btn' },
  'card-mover': { base: 'board', alvo: '[data-guia="card-c5"]' },
  'card-funcoes': { prep: "openCard('c5')", overlay: true, alvo: '#card-ov .modal-grid' },
  comentar:     { prep: "openCard('c5'); setTimeout(()=>{const l=document.getElementById('m-comment-list'); l&&l.scrollIntoView({block:'center'});},60)", overlay: true, alvo: '#m-comment-list' },
  notificacoes: { prep: "document.getElementById('notif-btn').click()", alvo: '#notif-panel' },
  'meu-dia':    { prep: 'openMeuDia()', overlay: true, alvo: '#meudia-ov .panel' },
  sonar:        { prep: 'openSearch()', digita: ['#msn-in', 'dashboard'], overlay: true, alvo: '#msn-ov .msn-box' },
  agente:       { base: 'board', alvo: '#fab-agente-hotline-btn' },
  raia: TB('raia'), filtros: TB('filtros'), selecionar: TB('selecionar'), campanhas: TB('campanhas'), intake: TB('intake'),
  timeline: TB('timeline'), dashboard: TB('dashboard'), criativos: { base: 'board', alvo: '' }, dependencias: TB('dependencias'), links: TB('links'),
  calendarios: TB('calendarios'),
  automacoes:   { base: 'board', alvo: '#fab-cfg-btn' }, config: { base: 'board', alvo: '#user-name' }, tema: { base: 'board', alvo: '#theme-toggle-btn' },
  comunicacao:  { base: 'board', alvo: '#mural-btn' }, kudos: { base: 'board', alvo: '#kudos-hdr-btn' },
  metas:        { base: 'board', alvo: '#dados-tab' }, ilha: { base: 'board', alvo: '#user-name' }, agil: { base: 'board', alvo: '.col-hd' },
  dicas:        { base: 'board', alvo: '[data-tb-id="ajuda"]' }, spotify: { base: 'board', alvo: '' },
  'pausar-continuo': { base: 'card-funcoes', alvo: '#card-ov .modal-ft-row' }, 'arquivar-excluir': { base: 'card-funcoes', alvo: '#card-ov .modal-ft-row' },
  'duplicar-modelo': { base: 'card-funcoes', alvo: '#card-ov .modal-ft-row' },
};

// ── dentro da página: marca alvos, clona o que está visível, limpa ──
function snapshotNaPagina({ alvoSel, overlay }) {
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; return true; };
  document.querySelectorAll('[data-guia-alvo]').forEach(e => e.removeAttribute('data-guia-alvo'));
  if (alvoSel) { const a = document.querySelector(alvoSel); if (a) a.setAttribute('data-guia-alvo', '1'); }
  const DROP = new Set(['SCRIPT', 'STYLE', 'LINK', 'IFRAME', 'NOSCRIPT', 'TEMPLATE', 'AUDIO', 'VIDEO', 'OBJECT', 'EMBED', 'META']);
  const usados = new Set();
  function clone(n) {
    if (n.nodeType === 3) return document.createTextNode(n.nodeValue);
    if (n.nodeType !== 1 || DROP.has(n.tagName)) return null;
    if (!vis(n)) return null;
    if (overlay && n.id === 'app-root') { const ph = document.createElement('div'); ph.setAttribute('data-mg-base', '1'); return ph; }
    const r = n.getBoundingClientRect();
    // fora da tela e sem nada dentro dela: corta (listas longas, overlays fechados)
    if (r.width === 0 && r.height === 0 && getComputedStyle(n).position !== 'fixed' && !n.children.length && !n.textContent.trim()) return null;
    const c = document.createElement(n.tagName === 'BODY' ? 'div' : n.tagName.toLowerCase() === 'html' ? 'div' : n.tagName);
    for (const at of n.attributes) {
      const k = at.name;
      if (/^on/i.test(k) || k === 'href' || k === 'src' && !/^(data:image\/(png|gif|jpeg|webp|svg\+xml)|[a-z0-9_.-]+\.(png|svg|webp|jpg)(\?v=\d+)?$)/i.test(at.value) || k === 'srcset' || k === 'action' || k === 'formaction' || k === 'contenteditable' || k === 'autofocus' || k === 'tabindex') continue;
      c.setAttribute(k, at.value);
    }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') { c.setAttribute('value', n.value || ''); if (n.tagName === 'TEXTAREA') c.textContent = n.value || ''; c.setAttribute('readonly', ''); }
    if (n.tagName === 'INPUT' && (n.type === 'checkbox' || n.type === 'radio') && n.checked) c.setAttribute('checked', '');
    if (n.tagName === 'SELECT') { c.setAttribute('disabled', ''); }
    if (n.tagName === 'OPTION') { if (n.selected) c.setAttribute('selected', ''); else c.removeAttribute('selected'); }
    if (n.scrollTop > 0) c.setAttribute('data-mg-scroll', String(Math.round(n.scrollTop)));
    if (n.scrollLeft > 0) c.setAttribute('data-mg-scroll-x', String(Math.round(n.scrollLeft)));
    if (n.tagName === 'CANVAS') { try { const img = document.createElement('img'); img.src = n.toDataURL('image/webp', .6); img.setAttribute('style', n.getAttribute('style') || ''); img.width = n.width; img.height = n.height; img.className = n.className; return img; } catch (e) { return null; } }
    if (n.tagName === 'BUTTON' || n.tagName === 'A') { c.setAttribute('aria-hidden', 'true'); }
    usados.add(n);
    for (const ch of n.childNodes) { if (n.tagName === 'TEXTAREA') break; const x = clone(ch); if (x) c.appendChild(x); }
    return c;
  }
  const root = clone(document.body);
  root.className = 'mg-body ' + (document.body.className || '');
  root.removeAttribute('id');
  // CSS que casa com algum elemento capturado (sem pseudo-classes de interação)
  const els = [...usados];
  const casa = sel => {
    const limpo = sel.replace(/::?(before|after|placeholder|marker|selection|-webkit-[a-z-]+|-moz-[a-z-]+|first-letter|first-line)/g, '')
      .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|enabled|empty|placeholder-shown|first-child|last-child|nth-child\([^)]*\)|nth-of-type\([^)]*\)|last-of-type|first-of-type|not\([^)]*\)|is\([^)]*\)|where\([^)]*\)|has\([^)]*\))/g, '').trim();
    if (!limpo || /^(html|body|:root|\*)$/.test(limpo)) return true;
    try { return els.some(e => e.matches(limpo)); } catch (e) { return false; }
  };
  return { html: root.outerHTML, casaTexto: null, _els: els.length, seletores: (function () {
    const out = new Set();
    // casa nos 3 temas do Maré: as regras do claro/Vice só batem com data-theme no <html>
    const temaOrig = document.documentElement.getAttribute('data-theme');
    const walk = (rules) => { for (const r of rules) {
      if (r.selectorText) { r.selectorText.split(',').forEach(s => { if (casa(s)) out.add(s.trim()); }); }
      else if (r.cssRules) walk(r.cssRules);
    } };
    for (const t of [temaOrig, 'light', 'vice']) {
      if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
      for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { } }
    }
    if (temaOrig) document.documentElement.setAttribute('data-theme', temaOrig); else document.documentElement.removeAttribute('data-theme');
    return [...out];
  })() };
}

// ── CSS final: só as regras cujos seletores apareceram em alguma captura; html/body/:root viram as classes da moldura ──
function cssFinal(sel) {
  const out = [];
  const reescreve = s => s.replace(/:root/g, '.mg-html').replace(/(^|[\s,>+~(])html(?=[\s\[.:,>#]|$)/g, '$1.mg-html').replace(/(^|[\s,>+~(])body(?=[\s\[.:,>#]|$)/g, '$1.mg-body');
  const vhvw = t => t.replace(/(-?\d*\.?\d+)vh\b/g, (m, n) => (+n * H / 100).toFixed(1) + 'px').replace(/(-?\d*\.?\d+)vw\b/g, (m, n) => (+n * W / 100).toFixed(1) + 'px').replace(/(-?\d*\.?\d+)dvh\b/g, (m, n) => (+n * H / 100).toFixed(1) + 'px');
  const keyframesUsados = new Set();
  const walk = (rules, dentro) => { for (const r of rules) {
    if (r.type === 1) { // style
      const partes = r.selectorText.split(',').map(s => s.trim()).filter(s => sel.has(s) || /:root|^html|^body|data-theme/.test(s) && /--|background|color|font/.test(r.style.cssText));
      if (!partes.length) continue;
      const txt = vhvw(r.style.cssText); if (!txt) continue;
      const an = r.style.animationName || (r.style.animation || '').split(' ')[0]; if (an) keyframesUsados.add(an);
      dentro.push(reescreve(partes.join(',')) + '{' + txt + '}');
    } else if (r.type === 4) { // media
      // resolve o @media no tamanho da CAPTURA (1280×760, mouse): no guia ele seria avaliado pela largura do guia
      // e o layout de celular do Maré entraria dentro da moldura de desktop. Movimento reduzido segue valendo no guia.
      if (/prefers-reduced-motion/.test(r.conditionText)) { const sub = []; walk(r.cssRules, sub); if (sub.length) dentro.push('@media ' + r.conditionText + '{' + sub.join('') + '}'); continue; }
      if (/prefers-color-scheme/.test(r.conditionText)) continue;
      if (!matchMedia(r.conditionText).matches) continue;
      walk(r.cssRules, dentro);
    } else if (r.type === 12) { const sub = []; walk(r.cssRules, sub); if (sub.length) dentro.push('@supports ' + r.conditionText + '{' + sub.join('') + '}'); }
    else if (r.type === 7) { dentro.push('@keyframes ' + r.name + '{' + [...r.cssRules].map(k => k.cssText).join('') + '}'); }
  } };
  for (const sh of document.styleSheets) { try { if (sh.href && !/kanban/.test(sh.href)) continue; walk(sh.cssRules, out); } catch (e) { } }
  return out.join('\n');
}

module.exports = { seed, U, W, H };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await fake.install(ctx, seed());
  await ctx.addInitScript(() => { try { localStorage.setItem('bvmd_ana', '1'); localStorage.setItem('mare_dicas_off', '1'); } catch (e) { } });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(base + '/' + PAGINA + '?squad=dados');
  await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), U);
  await p.waitForFunction(() => document.querySelectorAll('#board .card-title').length >= 5, null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  const limpa = async () => p.evaluate(() => {
    document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'));
    try { closeSearch(); } catch (e) { } try { MareSonar.fechar(); } catch (e) { }
    document.querySelectorAll('#mare-dica, #toast, .version, #devbar').forEach(e => e.remove());
    try { if (notifOpen) toggleNotifPanel(); } catch (e) { }
    const cb = document.getElementById('conn-badge'); if (cb) cb.style.display = 'none';
    const c5 = [...document.querySelectorAll('#board .card-title')].find(t => /dashboard de vendas/.test(t.textContent));
    const el = c5 && (c5.closest('[draggable="true"]') || c5.parentElement); if (el) el.setAttribute('data-guia', 'card-c5');
    document.getElementById('fab-agente-hotline-btn')?.style.removeProperty('display');
    window.scrollTo(0, 0);
  });
  const telas = {}, seletores = new Set();
  for (const [id, e] of Object.entries(ESTADOS)) {
    if (e.base) continue;
    await limpa(); if (e.prep) { await p.evaluate(e.prep); await p.waitForTimeout(900); }
    if (e.digita) { await p.fill(e.digita[0], e.digita[1]); await p.waitForTimeout(900); }
    await p.evaluate(() => document.querySelectorAll('#mare-dica').forEach(x => x.remove()));
    const snap = await p.evaluate(snapshotNaPagina, { alvoSel: e.alvo, overlay: !!e.overlay });
    snap.seletores.forEach(s => seletores.add(s));
    telas[id] = { html: snap.html, overlay: !!e.overlay };
    console.log('capturado', id, (snap.html.length / 1024).toFixed(0) + ' KB', snap._els + ' elementos');
  }
  // alvos que reaproveitam a base do board: só o seletor do destaque muda
  const alvos = Object.fromEntries(Object.entries(ESTADOS).map(([id, e]) => [id, { tela: e.base || id, alvo: e.alvo }]));
  const final = await p.evaluate(({ fn, lista, H, W }) => { const f = new Function('H', 'W', 'return ' + fn)(H, W); return f(new Set(lista)); }, { fn: cssFinal.toString(), lista: [...seletores], H, W });
  if (erros.length) console.warn('⚠️ erros de JS durante a captura:', erros.slice(0, 5));
  const bloco = '<script id="telas-mare" type="application/json">' + JSON.stringify({ capturadoEm: new Date().toISOString().slice(0, 10), w: W, h: H, css: final, telas, alvos }).replace(/</g, '\\u003c') + '</script>';
  let g = fs.readFileSync(GUIA, 'utf8');
  const A = '<!-- TELAS-GERADAS:INICIO (scripts/guia-mare-telas.js — não edite à mão) -->', B = '<!-- TELAS-GERADAS:FIM -->';
  if (g.includes(A)) g = g.slice(0, g.indexOf(A)) + A + '\n' + bloco + '\n' + B + g.slice(g.indexOf(B) + B.length);
  else g = g.replace('<script>', A + '\n' + bloco + '\n' + B + '\n<script>');
  fs.writeFileSync(GUIA, g);
  console.log('CSS', (final.length / 1024).toFixed(0) + ' KB · total do guia', (g.length / 1024).toFixed(0) + ' KB');
  await browser.close();
})();
