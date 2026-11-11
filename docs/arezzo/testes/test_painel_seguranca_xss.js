'use strict';
/**
 * Suíte de regressão de segurança (XSS / breakout de atributo / CSS / guardas UI)
 * para `painel-dev.html` — auditoria `/auditoriaseguranca` de 11/11/2026.
 *
 * Roda em Node puro (`node --test docs/arezzo/testes/test_painel_seguranca_xss.js`),
 * sem navegador nem rede: carrega o `<script>` principal real de `painel-dev.html`
 * num contexto `vm` isolado e exercita as 8 famílias de sinks (`D1`–`D8`),
 * guardas de UI exclusivas de ADM e preservação da normalização de `painel_viewers`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.resolve(__dirname, '../../../painel-dev.html');

function escAttrSim(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Parser HTML inerte minimalista para exercitar `_sanitizeComunicadoHtml` no Node `vm`
class MiniNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.nodeType = tagName === '#text' ? 3 : 1;
    this.textContent = '';
    this.parentNode = null;
    this.childNodes = [];
    this._attrs = new Map();
  }
  get attributes() {
    return [...this._attrs.entries()].map(([name, value]) => ({ name, value }));
  }
  getAttribute(n) {
    const v = this._attrs.get(String(n).toLowerCase());
    return v === undefined ? null : v;
  }
  setAttribute(n, v) {
    this._attrs.set(String(n).toLowerCase(), String(v));
  }
  removeAttribute(n) {
    this._attrs.delete(String(n).toLowerCase());
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
    this.parentNode = null;
  }
  replaceWith(...nodes) {
    if (!this.parentNode) return;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx < 0) return;
    nodes.forEach((n) => { n.parentNode = this.parentNode; });
    this.parentNode.childNodes.splice(idx, 1, ...nodes);
    this.parentNode = null;
  }
  querySelectorAll(selector) {
    const wanted = new Set(
      String(selector).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    );
    const out = [];
    const walk = (node) => {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 1) {
          if (wanted.has('*') || wanted.has(ch.tagName.toUpperCase())) out.push(ch);
          walk(ch);
        }
      }
    };
    walk(this);
    return out;
  }
  get innerHTML() {
    const voidTags = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK']);
    return this.childNodes.map((ch) => {
      if (ch.nodeType === 3) {
        return ch.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      const t = ch.tagName.toLowerCase();
      const attrs = [...ch._attrs.entries()].map(([k, v]) => ` ${k}="${escAttrSim(v)}"`).join('');
      if (voidTags.has(ch.tagName.toUpperCase())) return `<${t}${attrs}>`;
      return `<${t}${attrs}>${ch.innerHTML}</${t}>`;
    }).join('');
  }
}

class MiniDOMParser {
  parseFromString(raw) {
    const body = new MiniNode('BODY');
    const voidTags = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'BASE']);
    const stack = [body];
    const src = String(raw || '');
    const tokenRe = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9:-]+)\s*>|<([a-zA-Z0-9:-]+)((?:\s+[^\s/>"'=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>|([^<]+)/g;
    let m;
    while ((m = tokenRe.exec(src)) !== null) {
      if (m[1]) {
        const closeTag = m[1].toUpperCase();
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName === closeTag) { stack.length = i; break; }
        }
      } else if (m[2]) {
        const tag = m[2].toUpperCase();
        const el = new MiniNode(tag);
        const attrRaw = m[3] || '';
        const attrRe = /([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
        let am;
        while ((am = attrRe.exec(attrRaw)) !== null) {
          const val = am[2] ?? am[3] ?? am[4] ?? '';
          el.setAttribute(am[1], val);
        }
        stack[stack.length - 1].appendChild(el);
        if (!voidTags.has(tag) && !m[0].endsWith('/>')) stack.push(el);
      } else if (m[4] !== undefined) {
        const txt = new MiniNode('#text');
        txt.textContent = m[4];
        stack[stack.length - 1].appendChild(txt);
      }
    }
    return { body };
  }
}

function buildPainelHarness() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const scriptCode = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .sort((a, b) => b.length - a.length)[0];

  const elements = new Map();
  const fbWrites = [];

  function makeEl(tag = 'div', id = '') {
    let _innerHTML = '';
    let _textContent = '';
    const attrs = new Map();
    const el = {
      id,
      tagName: String(tag).toUpperCase(),
      value: '',
      checked: true,
      dataset: {},
      style: { cssText: '', display: '', setProperty() {}, getPropertyValue() { return ''; } },
      classList: {
        _s: new Set(['on']),
        add(...cs) { cs.forEach((c) => this._s.add(c)); },
        remove(...cs) { cs.forEach((c) => this._s.delete(c)); },
        contains(c) { return this._s.has(c); },
        toggle(c) { if (this._s.has(c)) { this._s.delete(c); return false; } this._s.add(c); return true; },
      },
      children: [],
      appendChild(ch) { this.children.push(ch); return ch; },
      addEventListener() {},
      removeEventListener() {},
      remove() {},
      focus() {},
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) || null; },
      removeAttribute(k) { attrs.delete(k); },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      closest() { return makeEl('div'); },
      get innerHTML() { return _innerHTML; },
      set innerHTML(v) { _innerHTML = String(v == null ? '' : v); },
      get textContent() { return _textContent; },
      set textContent(v) { _textContent = String(v == null ? '' : v); },
    };
    return el;
  }

  function getEl(id) {
    if (!elements.has(id)) elements.set(id, makeEl('div', id));
    return elements.get(id);
  }

  function collectHtml(el) {
    if (!el) return '';
    return (el.innerHTML || '') + (el.children || []).map(collectHtml).join('\n');
  }

  const documentStub = {
    body: makeEl('body', 'body'),
    documentElement: makeEl('html', 'html'),
    getElementById: (id) => getEl(id),
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    createElement: (tag) => makeEl(tag),
    createTextNode: (txt) => { const n = makeEl('#text'); n.textContent = txt; return n; },
    addEventListener: () => {},
    execCommand: () => {},
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: () => 1,
    URL,
    URLSearchParams,
    DOMParser: MiniDOMParser,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Map, Set, Promise, Error,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, parseInt, parseFloat, isNaN, isFinite,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: 'http://localhost/painel-dev.html', search: '', hash: '', hostname: 'localhost', pathname: '/painel-dev.html', reload() {} },
    navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node' },
    Notification: { permission: 'denied' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    confirm: () => true,
    alert: () => {},
    prompt: () => '',
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    MARE_SO_HERING: true,
    MareNotif: { novas() {}, ICONS: {} },
    document: documentStub,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = () => {};
  sandbox._db = {};
  sandbox._ref = (_db, p) => ({ path: p });
  sandbox._get = async () => ({ exists: () => false, val: () => null });
  sandbox._set = async (r, v) => { fbWrites.push({ op: 'set', path: r.path, val: v }); };
  sandbox._update = async (r, v) => { fbWrites.push({ op: 'update', path: r.path, val: v }); };
  sandbox._remove = async (r) => { fbWrites.push({ op: 'remove', path: r.path }); };
  sandbox._onValue = () => () => {};
  sandbox._currentUser = { uid: 'u1', email: 'caio@ciahering.com.br', displayName: 'Caio' };

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox, { filename: 'painel-dev.html' });

  return { sandbox, elements, getEl, collectHtml, fbWrites };
}

const h = buildPainelHarness();

test('D1 — safeUrl e avatares de presença bloqueiam breakout de src/onerror', () => {
  const { sandbox: s, getEl, collectHtml } = h;
  assert.equal(s.safeUrl('https://lh3.googleusercontent.com/a/foto=s96-c'), 'https://lh3.googleusercontent.com/a/foto=s96-c');
  assert.equal(s.safeUrl('https://evil.test/x.png" onerror="alert(1)'), '');
  assert.equal(s.safeUrl('http://insecure.test/x.png'), '');
  assert.equal(s.safeUrl('javascript:alert(1)'), '');

  vm.runInContext(`
    squadOnline = { dev: [{ uid: 'u1', name: 'Eva', foto: 'https://x.com/a" onerror="XSS_D1_SQ' }] };
    okrOnlineMap = { u2: { uid: 'u2', name: 'Eva', foto: 'https://x.com/a" onerror="XSS_D1_OKR', ts: Date.now() } };
    painelOnlineMap = { u3: { uid: 'u3', name: 'Eva', foto: 'https://x.com/a" onerror="XSS_D1_PNL', ts: Date.now() } };
    renderOnline();
    renderOkrOnlineVisao();
    renderPainelOnline();
  `, s);

  for (const id of ['online-strip', 'okr-online-visao-row', 'painel-online-bar']) {
    const out = collectHtml(getEl(id));
    assert.ok(!out.includes('XSS_D1_'), `Atributo malicioso vazou em #${id}: ${out}`);
  }
});

test('D2, D3 e D4 — cards, colunas, tags, OKRs, riscos, modal, filtros e handlers inline escapam HTML, JS e CSS', () => {
  const { sandbox: s, elements, collectHtml } = h;
  const todayStr = new Date().toISOString().slice(0, 10);

  vm.runInContext(`
    _applySquadDados('dev', {
      columns: [{ id: 'col1', name: '<img data-x="XSS_COL">', color: 'red;background:url(x)" onclick="XSS_CSS_COL' }],
      tags: [{ id: 't1', name: '<img data-x="XSS_TAG">', hex: '#000" onclick="XSS_CSS_HEX', bg: 'red" onclick="XSS_CSS_BG' }],
      sprints: [{ id: 'sp1', name: '<img data-x="XSS_SP">', goal: '<img data-x="XSS_GOAL">', start: '2026-01-01', end: '2026-12-31', active: true }],
      capacidades: [{ id: 'cap1', name: '<img data-x="XSS_CAP">' }],
      cards: [{
        id: "c1');XSS_JS_CARDID();//",
        title: '<img data-x="XSS_TITLE">',
        desc: '<img data-x="XSS_DESC">',
        col: 'col1',
        priority: 'high',
        owner: '<img data-x="XSS_OWNER">',
        po: '<img data-x="XSS_PO">',
        tags: ['t1'],
        sprint: 'sp1',
        cap: 'cap1',
        blocker: true,
        blockerDesc: '<img data-x="XSS_BLK">',
        due: ${JSON.stringify(todayStr)},
        startDate: ${JSON.stringify(todayStr)},
        riscos: [{ id: 'r1', text: '<img data-x="XSS_RISCO">', owner: '<img data-x="XSS_ROWNER">' }],
        checklist: [{ text: '<img data-x="XSS_CHK">', done: false }]
      }]
    });
    okrItems = [{ id: 'ok1', obj: '<img data-x="XSS_OKROBJ">', kr: '<img data-x="XSS_OKRKR">', owner: '<img data-x="XSS_OKROWN">', current: 5, target: 10, unit: '<img data-x="XSS_OKRUNIT">' }];
    _painelNotifs = [{ id: 'n1', _kind: 'notif', type: 'mention', squad: "dev','_blank');XSS_JS_NOTIF();//", cardId: "cid');XSS_JS_NOTIFCID();//", title: 't', ts: Date.now() }];
    renderAll();
    renderOKR();
    renderRiscos();
    renderPainelInsights();
    renderPainelTimeline();
    renderPainelNotifs();
    openPcModal('dev', "c1');XSS_JS_CARDID();//");
  `, s);

  const fullHtml = [...elements.values()].map(collectHtml).join('\n');
  assert.ok(!/<img data-x="XSS_[A-Z]+">/.test(fullHtml), 'Tag HTML não escapada encontrada no DOM renderizado');
  assert.ok(!fullHtml.includes('onclick="XSS_CSS_'), 'Breakout de atributo style="" encontrado');
  assert.ok(!fullHtml.includes("openPcModal('dev','c1&#39;);XSS_JS_CARDID"), 'Breakout JS em onclick de cardId encontrado');
  assert.ok(!fullHtml.includes("window.open('kanban-dev.html?squad=dev&#39;"), 'Breakout JS em onclick de notificação encontrado');
});

test('D5 e D6 — calendário (makePcalDay/legenda) e monitor de erros (renderErrors) neutralizam HTML e breakouts', () => {
  const { sandbox: s, getEl, collectHtml } = h;
  const todayStr = new Date().toISOString().slice(0, 10);

  const dayHtml = vm.runInContext(`
    pcalEvents = [{ id: 'ev1', title: '<img data-x="XSS_PCAL">', start: ${JSON.stringify(todayStr)}, end: ${JSON.stringify(todayStr)}, squad: '"><img data-x="XSS_PCALSQ">' }];
    renderPcalLegend('pcal-legend', pcalEvents);
    makePcalDay(new Date(${JSON.stringify(todayStr + 'T12:00:00Z')}), false, pcalEvents).innerHTML;
  `, s);

  assert.ok(!dayHtml.includes('<img data-x="XSS_PCAL">'), 'makePcalDay interpolou ev.title sem esc()');
  assert.ok(!collectHtml(getEl('pcal-legend')).includes('<img data-x="XSS_PCALSQ">'), 'renderPcalLegend interpolou squad sem esc()');

  vm.runInContext(`
    _errorsList = [{
      id: 'id" onclick="XSS_ERR_ID',
      squad: 'dev',
      category: 'cat" onclick="XSS_ERR_CAT',
      status: 'open" onclick="XSS_ERR_ST',
      message: '<img data-x="XSS_ERR_MSG">',
      stack: '<img data-x="XSS_ERR_STK">',
      userName: '<img data-x="XSS_ERR_USR">',
      userEmail: '<img data-x="XSS_ERR_EML">',
      ts: new Date().toISOString()
    }];
    renderErrors();
  `, s);

  const errHtml = collectHtml(getEl('err-list'));
  assert.ok(!errHtml.includes('onclick="XSS_ERR_'), 'Breakout de atributo em renderErrors');
  assert.ok(!/<img data-x="XSS_ERR_[A-Z]+">/.test(errHtml), 'Tag HTML crua em renderErrors');
});

test('D7 e D8 — campanhas (_pSafeUrl / classes) e comunicados (_sanitizeComunicadoHtml / rascunhos / compose) bloqueiam XSS', () => {
  const { sandbox: s, getEl, collectHtml } = h;

  assert.equal(s._pSafeUrl('javascript:alert(1)'), '#');
  assert.equal(s._pSafeUrl('mailto:x@y.com" onclick="XSS_MAILTO'), '#');
  assert.equal(s._pSafeUrl('https://hering.com.br/kv'), 'https://hering.com.br/kv');
  assert.equal(s._pSafeUrl('mailto:time@ciahering.com.br'), 'mailto:time@ciahering.com.br');

  const cleanHtml = s._sanitizeComunicadoHtml(
    '<p onclick="XSS_EVT"><b>Aviso</b> <img src="x" onerror="XSS_IMG"><svg><a xlink:href="javascript:XSS_SVG">x</a></svg><a href="javascript:XSS_JS">ruim</a> <a href="https://hering.com.br">ok</a></p>'
  );
  assert.ok(!cleanHtml.includes('onerror'), '_sanitizeComunicadoHtml manteve onerror');
  assert.ok(!cleanHtml.includes('<svg'), '_sanitizeComunicadoHtml manteve <svg>');
  assert.ok(!cleanHtml.includes('javascript:'), '_sanitizeComunicadoHtml manteve javascript:');
  assert.ok(!cleanHtml.includes('onclick'), '_sanitizeComunicadoHtml manteve onclick');
  assert.ok(cleanHtml.includes('<b>Aviso</b>'), '_sanitizeComunicadoHtml perdeu formatação segura <b>');
  assert.ok(cleanHtml.includes('href="https://hering.com.br"'), '_sanitizeComunicadoHtml perdeu link HTTPS legítimo');

  vm.runInContext(`
    _comunicadosCache = {
      c1: { id: 'c1', titulo: 'T', corpo: '<img src="x" onerror="XSS_COMPOSE"><b>Seguro</b>', rascunho: true },
      c2: { id: 'c2', titulo: 'R', corpo: '<img src=x onerror="XSS_UNCLOSED"', rascunho: true }
    };
    renderRascunhosComunicado([_comunicadosCache.c2]);
    openComunicadoCompose('c1');
  `, s);

  assert.ok(!collectHtml(getEl('comunicados-rascunhos')).includes('<img src=x'), 'Tag não fechada vazou em renderRascunhosComunicado');
  assert.ok(!collectHtml(getEl('cc-corpo')).includes('XSS_COMPOSE'), 'openComunicadoCompose injetou HTML não sanitizado em #cc-corpo');
});

test('Guardas ADM no cliente e preservação intacta do acesso de externos / painel_viewers', async () => {
  const { sandbox: s, fbWrites } = h;

  // Simula usuário autenticado comum (não-ADM)
  s._currentUser = { uid: 'u_membro', email: 'membro@ciahering.com.br', displayName: 'Membro' };
  fbWrites.length = 0;

  s.addAdmEmail('invasor@ciahering.com.br');
  s.removeAdmEmail('caio@ciahering.com.br');
  s._fbSetStatus('f1', 'resolvido');
  await s._fbDelete('f1');
  s.toggleGestorOkr('u_membro', true);

  assert.equal(fbWrites.length, 0, `Usuário não-ADM disparou escrita administrativa: ${JSON.stringify(fbWrites)}`);

  // Preservação da chave de painel_viewers e domínio confiável (garantia de não bloquear externos)
  assert.equal(s._painelViewerKey('Parceiro.Externo@Agencia.com.br'), 'parceiro,externo@agencia,com,br');
  assert.equal(s._isTrustedDomainEmail('alguem@ciahering.com.br'), true);
  assert.equal(s._isTrustedDomainEmail('parceiro@agencia.com.br'), false);
});
