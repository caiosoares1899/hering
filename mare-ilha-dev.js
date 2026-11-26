/* ══════════════════════════════════════════════════════════════════════════
   mare-ilha-dev.js — 🏝️ ILHA DINÂMICA compartilhada (módulo, 26/11/2026). A versão de produção, mare-ilha.js, nasce na promoção.
   Pedido do Caio: "quem tiver a ilha deveria ter em todos os apps", começando pela Concha. Uma chave só, na conta:
   kanban/usuarios/{uid}/oceano/ilha = true (a própria pessoa grava; ligar/desligar vale ao recarregar a página).
   O Maré continua com a Ilha dele (kanban-dev.html, ligada por aparelho) até migrar para este módulo — a última etapa.
   Plano e decisões: docs/ideias/ilha-dinamica.md.

   O que mostra (1ª versão):
     - ⏲ timers ativos da pessoa (kanban/timers_ativos/{uid}, a mesma lista que o ⏲ Timers do Maré escuta) — escutada SÓ com a ilha ligada;
       ▶/⏸ pelo mare-timer (o mesmo contrato do Maré). "Encerrar" e "Abrir o card" vão para o Maré, onde mora o aviso a quem passou a atividade
       (encerrar daqui sem esse aviso seria um caminho paralelo diferente do Maré).
     - 🔔 o sino (mare-notif) mora DENTRO da ilha: a página passa MareIlha.botaoSino() ao MareNotif.sino() e o 🔔 do topo some. Notificação
       nova (inclusive 🐚 menção da Concha, que já é item do sino) alarga a pílula por ~6 s com quem/o quê — via aoMudar(itens), sem reler nada.
   Fronteira: texto de notificação e nome de atividade só por textContent; links montados aqui (kanban(-dev).html?squad=&card=, ids conferidos).

   Uso (cada página, depois do login):
     MareIlha.iniciar({ el, user:()=>user, dev, escutar:(caminho, cb)=>parar, nome:()=>'Fulano', abrirUrl?:url=>{} , silenciar?:item=>bool });
     MareIlha.botaoSino() → o botão 🔔 da ilha (âncora do sino)   ·   MareIlha.notifs(itens) → do aoMudar do sino
     MareIlha.parar()   (logout)
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareIlha) return;
  const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
  let cfg = null, raiz = null, pil = null, painel = null, bSino = null, pararTimers = null, relogio = 0, avisoT = 0;
  let timers = [], aviso = null, vistos = null, aberta = false;

  function el(tag, cls, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = () => window.MareTimer;

  function estilo(){
    if(document.getElementById('mare-ilha-css')) return;
    const s = document.createElement('style'); s.id = 'mare-ilha-css';
    s.textContent = [
      '.mi-ilha{position:relative;display:flex;justify-content:center;min-width:0;flex:1 1 auto;--mi-vivo:var(--teal,var(--cyan,#1de9b6));}',
      '.mi-pil{display:inline-flex;align-items:center;gap:8px;height:34px;min-width:140px;max-width:min(520px,100%);padding:0 6px 0 14px;border-radius:999px;border:1px solid var(--glass-b,rgba(126,200,227,.25));background:rgba(4,12,24,.72);color:var(--txt,#e8f1fb);box-shadow:0 4px 18px rgba(0,0,0,.25);transition:max-width .2s ease,border-color .2s ease;}',
      '[data-theme="light"] .mi-pil{background:rgba(255,255,255,.85);}',
      '.mi-pil.mi-aviso{border-color:var(--accent,#38b6ff);}',
      '.mi-main{display:inline-flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;background:none;border:0;color:inherit;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:0;height:100%;}',
      '.mi-main:focus-visible,.mi-sino:focus-visible{outline:2px solid var(--accent,#38b6ff);outline-offset:2px;border-radius:999px;}',
      '.mi-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}',
      '.mi-rep{color:var(--txt3,#7d97b2);font-weight:500;}',
      '.mi-tempo{font-variant-numeric:tabular-nums;color:var(--mi-vivo);font-weight:700;flex:none;}',
      '.mi-pausa .mi-tempo{color:var(--txt2,#a9c1d9);} .mi-esg .mi-tempo{color:var(--danger,#ff6b6b);}',
      '.mi-mais{font-size:10.5px;color:var(--txt2,#a9c1d9);flex:none;}',
      '.mi-av-s{color:var(--txt3,#7d97b2);font-weight:500;}',
      '.mi-sino{position:relative;flex:none;width:28px;height:28px;border-radius:50%;border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;display:grid;place-items:center;border-left:1px solid var(--glass-b,rgba(126,200,227,.25));border-radius:0 999px 999px 0;}',
      '.mi-painel{position:absolute;top:42px;left:50%;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));z-index:60;padding:14px;border-radius:18px;background:rgba(6,18,34,.96);color:var(--txt,#e8f1fb);border:1px solid var(--glass-b,rgba(126,200,227,.25));box-shadow:0 18px 50px rgba(0,0,0,.45);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}',
      '[data-theme="light"] .mi-painel{background:rgba(255,255,255,.97);}',
      '.mi-painel[hidden]{display:none;}',
      '.mi-h{font-size:11px;font-weight:700;color:var(--txt3,#7d97b2);text-transform:uppercase;letter-spacing:.05em;margin:0 2px 8px;}',
      '.mi-tm{display:flex;flex-direction:column;gap:6px;padding:10px 12px;margin-bottom:8px;border-radius:14px;background:var(--glass,rgba(126,200,227,.08));border:1px solid var(--glass-b,rgba(126,200,227,.2));}',
      '.mi-tm b{font-size:13px;} .mi-tm small{color:var(--txt3,#7d97b2);font-size:11.5px;}',
      '.mi-tm .mi-linha{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.mi-tm button,.mi-tm a{font:inherit;font-size:12px;min-height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--glass-b,rgba(126,200,227,.3));background:transparent;color:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;}',
      '.mi-tm .mi-pri{background:var(--accent,#38b6ff);border-color:transparent;color:#fff;font-weight:600;}',
      '.mi-vazio{color:var(--txt2,#a9c1d9);font-size:13px;margin:4px 2px 2px;}',
      '@media (prefers-reduced-motion: reduce){.mi-pil{transition:none;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  const urlCard = t => (ID_RE.test(String(t.sq||'')) && ID_RE.test(String(t.cardId||''))) ? (cfg.dev ? 'kanban-dev.html' : 'kanban.html') + '?squad=' + encodeURIComponent(t.sq) + '&card=' + encodeURIComponent(t.cardId) : '';
  function abrir(url){ if(!url) return; if(cfg.abrirUrl) cfg.abrirUrl(url); else window.open(url, '_blank', 'noopener'); }
  const principal = () => { const ord = {rodando:0, novo:1, pausado:2}; return timers.slice().sort((a, b) => (ord[a.status] ?? 9) - (ord[b.status] ?? 9) || (b.startedAt||0) - (a.startedAt||0)); };

  function renderPilula(){
    if(!pil) return;
    const main = pil.querySelector('.mi-main'); main.replaceChildren();
    pil.classList.remove('mi-pausa', 'mi-esg', 'mi-aviso');
    const agora = Date.now();
    if(aviso){
      pil.classList.add('mi-aviso');
      main.append(el('span', '', aviso.ic || '🔔'), el('span', 'mi-t', aviso.t), el('span', 'mi-t mi-av-s', aviso.s || ''));
      main.setAttribute('aria-label', 'Aviso: ' + aviso.t + (aviso.s ? ' — ' + aviso.s : '') + '. Abrir a ilha');
    } else if(timers.length && T()){
      const [t] = principal(), m = T().mostra(t, agora);
      if(t.status !== 'rodando') pil.classList.add('mi-pausa'); if(m.esg) pil.classList.add('mi-esg');
      main.append(el('span', '', t.status === 'rodando' ? '⏲' : '⏸'), el('span', 'mi-t', t.atividade || 'Atividade'), el('span', 'mi-tempo', m.txt));
      if(timers.length > 1) main.append(el('span', 'mi-mais', '+' + (timers.length - 1)));
      main.setAttribute('aria-label', 'Timer: ' + (t.atividade || 'Atividade') + ', ' + T().estadoTxt(t) + ', ' + m.txt + (timers.length > 1 ? ', e mais ' + (timers.length - 1) : '') + '. Abrir a ilha');
    } else {
      main.append(el('span', '', '🌊'), el('span', 'mi-t mi-rep', 'Tudo tranquilo'));
      main.setAttribute('aria-label', 'Ilha Dinâmica: nada acontecendo agora. Abrir');
    }
    main.setAttribute('aria-expanded', String(aberta));
    ligarRelogio();
  }

  function renderPainel(){
    if(!painel || !aberta) return;
    const f = document.activeElement && painel.contains(document.activeElement) ? document.activeElement.dataset.mi || '' : '';   // o foco volta ao mesmo botão depois de redesenhar
    desenharPainel();
    if(f){ const x = painel.querySelector('[data-mi="' + f + '"]'); if(x) x.focus(); }
  }
  function desenharPainel(){
    painel.replaceChildren(el('p', 'mi-h', '⏲ Timers'));
    if(!timers.length){ painel.append(el('p', 'mi-vazio', 'Nenhum timer ativo. Para começar um, abra o card no Maré e use ⏲.')); return; }
    const agora = Date.now();
    principal().forEach(t => {
      const box = el('div', 'mi-tm'), m = T().mostra(t, agora);
      box.append(el('b', '', t.atividade || 'Atividade'), el('small', '', (t.cardTitle ? t.cardTitle + ' · ' : '') + T().estadoTxt(t) + ' · ' + m.txt));
      const l = el('div', 'mi-linha');
      const b = t.status === 'rodando' ? el('button', '', '⏸ Pausar') : el('button', 'mi-pri', t.status === 'novo' ? '▶ Começar' : '▶ Continuar');
      b.type = 'button'; b.dataset.mi = 'ac-' + t.id; b.onclick = () => agir(t, t.status === 'rodando' ? 'pause' : 'play', b); l.append(b);
      const u = urlCard(t);
      if(u){ const a = el('a', '', 'Abrir o card / encerrar no Maré ↗'); a.href = u; a.dataset.mi = 'card-' + t.id; a.onclick = e => { e.preventDefault(); fechar(false); abrir(u); }; l.append(a); }
      box.append(l); painel.append(box);
    });
  }
  async function agir(t, ac, b){
    const u = cfg.user && cfg.user(); if(!u || !T()) return;
    b.disabled = true;
    const r = await T().acao(t, ac, { uid: u.uid, nome: cfg.nome ? cfg.nome() : '' });   // play/pausa não avisam ninguém (igual ao Maré)
    b.disabled = false;
    if(!r.ok && r.msg && cfg.toast) cfg.toast(r.msg);
  }

  function ligarRelogio(){
    const precisa = !!(T() && timers.some(t => t.status === 'rodando') && !document.hidden && raiz && raiz.isConnected);
    if(precisa && !relogio) relogio = setInterval(() => { renderPilula(); if(aberta) renderPainel(); }, 1000);
    else if(!precisa && relogio){ clearInterval(relogio); relogio = 0; }
  }

  function abrirPainel(){ aberta = true; painel.hidden = false; renderPainel(); renderPilula(); const f = painel.querySelector('button, a'); if(f) f.focus(); }
  function fechar(foco){ if(!aberta) return; aberta = false; painel.hidden = true; renderPilula(); if(foco !== false) pil.querySelector('.mi-main').focus(); }

  // Notificação nova → a pílula alarga por ~6 s (nunca abre o painel). A 1ª leitura é só a base (não avisa o que já estava lá).
  function notifs(itens){
    const lista = Array.isArray(itens) ? itens : [];
    const chave = n => (n.k || '') + ':' + n.id;   // itens do sino: {k, id, tipo, icon, title, sub, unread}
    const ids = new Set(lista.filter(n => n && n.id).map(chave));
    if(vistos === null){ vistos = ids; return; }
    const novo = lista.find(n => n && n.id && !vistos.has(chave(n)) && n.unread && !(cfg.silenciar && cfg.silenciar(n)));
    vistos = ids;
    if(!novo) return;
    const t = String(novo.title || 'Notificação nova').slice(0, 80), s = String(novo.sub || '').slice(0, 80);
    aviso = { ic: typeof novo.icon === 'string' && novo.icon.length <= 4 ? novo.icon : '🔔', t, s };
    clearTimeout(avisoT); avisoT = setTimeout(() => { aviso = null; renderPilula(); }, reduz() ? 8000 : 6000);
    renderPilula();
  }

  function iniciar(o){
    parar();
    cfg = Object.assign({}, o || {}); if(!cfg.el) return;
    estilo();
    raiz = el('div', 'mi-ilha'); raiz.setAttribute('role', 'region'); raiz.setAttribute('aria-label', 'Ilha Dinâmica');
    pil = el('div', 'mi-pil');
    const main = el('button', 'mi-main'); main.type = 'button'; main.setAttribute('aria-haspopup', 'dialog');
    main.onclick = () => aberta ? fechar() : abrirPainel();
    bSino = el('button', 'mi-sino', '🔔'); bSino.type = 'button'; bSino.setAttribute('aria-label', 'Notificações'); bSino.title = 'Notificações';
    pil.append(main, bSino);
    painel = el('div', 'mi-painel'); painel.hidden = true; painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-label', 'Ilha Dinâmica');
    raiz.append(pil, painel);
    cfg.el.replaceChildren(raiz); cfg.el.hidden = false;
    document.addEventListener('keydown', escFecha, true);   // Esc fecha só a ilha (mesmo com o foco perdido depois de redesenhar), sem fechar janelas da página
    document.addEventListener('click', foraFecha, true);
    document.addEventListener('visibilitychange', ligarRelogio);
    const u = cfg.user && cfg.user();
    if(u && ID_RE.test(u.uid || '') && cfg.escutar){
      pararTimers = cfg.escutar('kanban/timers_ativos/' + u.uid, v => {
        timers = Object.keys(v || {}).filter(k => ID_RE.test(k) && v[k] && typeof v[k] === 'object' && v[k].status !== 'encerrado').map(k => T() ? T().doIndice(u.uid, k, v[k]) : Object.assign({ id: k, uid: u.uid }, v[k]));
        renderPilula(); renderPainel();
      });
    }
    renderPilula();
  }
  function escFecha(e){ if(e.key === 'Escape' && aberta){ e.preventDefault(); e.stopImmediatePropagation(); fechar(); } }
  function foraFecha(e){ if(aberta && raiz && !raiz.contains(e.target)) fechar(false); }
  function parar(){
    if(pararTimers){ try { pararTimers(); } catch(e) {} pararTimers = null; }
    clearInterval(relogio); relogio = 0; clearTimeout(avisoT);
    document.removeEventListener('click', foraFecha, true); document.removeEventListener('keydown', escFecha, true); document.removeEventListener('visibilitychange', ligarRelogio);
    timers = []; aviso = null; vistos = null; aberta = false;
    if(raiz) raiz.remove(); raiz = pil = painel = bSino = null;
  }

  window.MareIlha = { iniciar, parar, notifs, botaoSino: () => bSino, aberta: () => aberta, _estado: () => ({ timers: timers.length, aviso: !!aviso, aberta }) };
})();
