/* ══════════════════════════════════════════════════════════════════════════
   mare-notif-dev.js — SINO ÚNICO do Maré Digital (módulo compartilhado)
   Carregado por kanban-dev / painel-dev / okr-dev (a versão de produção, mare-notif.js, nasce na promoção).
   Fica na raiz do domínio, como firebase-messaging-sw.js e favicon.png: é a única exceção à regra "sem import entre páginas".

   O que é "um só":
   • Notificações PESSOAIS: já eram um nó só (kanban/usuarios/{uid}/notificacoes); cada página lê o mesmo nó e agora mostra TODOS os tipos.
   • FEED da torre (aviso novo no Mural, 🆕 Objetivo criado, ✅ Marco concluído…): kanban/notif_feed/{id}, 1 escrita por evento
     (sem fan-out por pessoa), lido por qualquer página e filtrado pela torre da pessoa. "Lido": kanban/notif_feed_seen/{uid}
     = {ts (marcar tudo), lidos:{id:true}}; o visualizador externo (não escreve no Firebase) guarda igual no localStorage.
   • ROTEADOR de tipos: ícone e destino (URL entre páginas) de cada tipo de notificação ficam aqui, não repetidos em cada página.

   Uso (cada página, depois do login):  MareNotif.start({user, isViewer, isAdm, onChange});  MareNotif.items()/unread()/markOne()/markAll()/open().
   Depende só dos helpers que as 3 páginas já expõem em window: _db _ref _onValue _query _limitToLast _set _update.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareNotif) return;

  const FEED = 'kanban/notif_feed', SEEN = 'kanban/notif_feed_seen', FEED_LIMIT = 60;
  const IS_DEV = /-dev\.html/.test(location.pathname);
  const PAGES = IS_DEV
    ? {okr:'okr-dev.html', kanban:'kanban-dev.html', painel:'painel-dev.html'}
    : {okr:'okr.html', kanban:'kanban.html', painel:'painel.html'};

  // Ícone de cada tipo (pessoais + feed). As páginas podem ter o próprio mapa; este é o de referência.
  const ICONS = {
    assigned:'👤', mention:'💬', unblocked:'✅', risk:'⚠️', due_today:'📅', due_overdue:'🔴', done:'🏁', checklist:'☑️', moved:'➡️',
    intake:'📥', recorrente:'🔁', reuniao:'🎥', gcal_pending:'📅', gcal_approved:'✅', kudos:'⭐', kudos_monitor:'⭐', reacao:'👍',
    feedback:'🐛', painel_broadcast:'📢', rascunho:'📝',
    okr_editado:'🎯', okr_prazo:'⏰', okr_reuniao:'🎥', okr_agente:'🤖', okr_mencao:'💬',
    mural:'📢', obj_criado:'🆕', marco_concluido:'✅',
  };
  // Só aparecem no painel (o sino do board já os filtrava).
  const SO_PAINEL = new Set(['rascunho']);
  // Quanto tempo uma notificação PESSOAL continua na lista — o MESMO critério do sino do kanban (NOTIF_TTL_DAYS/NOTIF_TTL_UNREAD_DAYS em
  // kanban-dev.html; mantenha os dois em sincronia): lida some em 3 dias, não lida em 30. Sem isto, OKR/painel mostravam (e contavam no selo)
  // notificações que o kanban já escondia — o "sino único" mostrava listas diferentes.
  const TTL_LIDA_MS = 3*86400000, TTL_NAO_LIDA_MS = 30*86400000;
  function viva(n){ const t = new Date(n && n.ts).getTime(); return !isNaN(t) && (Date.now()-t) < (n.read ? TTL_LIDA_MS : TTL_NAO_LIDA_MS); }
  // O ícone do evento vem do banco (qualquer pessoa da empresa grava no feed): só texto curto, sem nada que vire HTML.
  function iconeSeguro(x){ return String(x||'').replace(/[<>&"'`\\]/g,'').slice(0,16); }

  const st = {uid:null, viewer:false, opts:null, feed:{}, seen:{ts:'', lidos:{}}, seenReady:false, torre:'digital', started:false};

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function emitir(){ try{ if(st.opts && st.opts.onChange) st.opts.onChange(); }catch(e){ console.warn('[MareNotif] onChange:', e); } }
  function emailKey(email){ return String(email||'').trim().toLowerCase().replace(/\./g, ','); }
  function seenLocalKey(){ return 'mare_feed_seen_'+emailKey(st.opts && st.opts.user && st.opts.user.email); }
  function seenLocalSalvar(){ try{ localStorage.setItem(seenLocalKey(), JSON.stringify(st.seen)); }catch(e){} }

  // torres de um evento → ids, ou ['*'] (todas)
  function alvoTorres(x){
    const t = x && x.torres, arr = Array.isArray(t) ? t : (t && typeof t==='object' ? Object.values(t) : []);
    if(!arr.length || arr.includes('*')) return ['*'];
    return arr;
  }
  // Quem vê: ADM, torre ⭐ Geral e visualizador externo veem tudo; os demais, o das suas torres (+ o dirigido a todas).
  function paraMim(torres){
    if(st.viewer || st.torre==='geral') return true;
    try{ if(st.opts && st.opts.isAdm && st.opts.isAdm()) return true; }catch(e){}
    return torres.includes('*') || torres.includes(st.torre);
  }
  function lido(f){ return (!!f.ts && f.ts <= (st.seen.ts||'')) || !!(st.seen.lidos||{})[f.id]; }

  function start(opts){
    const user = opts && opts.user; if(!user || !user.uid) return;
    if(st.started && st.uid===user.uid){ st.opts = opts; return; }   // 1x por usuário (trocar de conta recarrega a página)
    st.started = true; st.uid = user.uid; st.opts = opts; st.viewer = !!opts.isViewer;
    const W = window;
    W._onValue(W._query(W._ref(W._db, FEED), W._limitToLast(FEED_LIMIT)), snap=>{ st.feed = snap.val() || {}; emitir(); },
      err=>console.warn('[MareNotif] feed indisponível (sem permissão?):', err && err.message));
    if(st.viewer){
      let v = null; try{ v = JSON.parse(localStorage.getItem(seenLocalKey())||'null'); }catch(e){}
      st.seen = (v && v.ts) ? {ts:v.ts, lidos:v.lidos||{}} : {ts:new Date().toISOString(), lidos:{}};   // 1ª visita: só o que vier depois conta como novo
      seenLocalSalvar(); st.seenReady = true; emitir();
      return;
    }
    W._onValue(W._ref(W._db, 'kanban/usuarios/'+user.uid+'/torre'), snap=>{ st.torre = snap.val() || 'digital'; emitir(); }, ()=>{});
    W._onValue(W._ref(W._db, SEEN+'/'+user.uid), snap=>{
      const v = snap.val();
      if(!v || !v.ts){ const ts = new Date().toISOString(); W._update(W._ref(W._db, SEEN+'/'+user.uid), {ts}).catch(()=>{}); st.seen = {ts, lidos:(v&&v.lidos)||{}}; }
      else st.seen = {ts:v.ts, lidos:v.lidos||{}};
      st.seenReady = true; emitir();
    }, ()=>{ st.seenReady = true; emitir(); });
  }

  // Eventos do feed visíveis pra mim (sem os que eu mesmo fiz), do mais novo pro mais antigo.
  function items(){
    const eu = st.uid, out = [];
    Object.entries(st.feed).forEach(([id,f0])=>{
      if(!f0) return; const f = {...f0, id};
      if(f.autorUid===eu || !paraMim(alvoTorres(f))) return;
      out.push({k:'feed', id, tipo:f.tipo||'', ts:f.ts||'', icon:iconeSeguro(f.icone) || ICONS[f.tipo] || '🔔', title:f.titulo||'', sub:f.sub||'', autor:f.autor||'',
        objId:f.objId||'', muralId:f.muralId||'', unread: st.seenReady && !lido(f)});
    });
    return out.sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  }
  function unread(){ return items().filter(i=>i.unread).length; }

  function markOne(id){
    st.seen = {ts:st.seen.ts, lidos:{...(st.seen.lidos||{}), [id]:true}};
    let w = Promise.resolve();
    if(st.viewer) seenLocalSalvar();
    else w = window._update(window._ref(window._db, SEEN+'/'+st.uid), {['lidos/'+id]:true}).catch(()=>{});
    emitir();
    return w;   // quem navega logo em seguida espera isto (com teto) pra a escrita não ser cortada pela troca de página
  }
  // "Marcar tudo": marca como lido CADA evento carregado (por id), NÃO avança o watermark pra "agora". Comparar o ts do evento (relógio de quem
  // publicou) com o "agora" de quem clicou escondia pra sempre um evento publicado segundos ANTES do clique mas entregue DEPOIS (latência) ou vindo
  // de um relógio atrasado — marcado como lido sem nunca ter sido visto. A lista de ids fica limitada à janela de 60 eventos lida do banco.
  function markAll(){
    const lidos = {}; Object.keys(st.feed).forEach(id=>{ lidos[id] = true; });
    const ts = st.seen.ts || new Date().toISOString();
    st.seen = {ts, lidos};
    if(st.viewer) seenLocalSalvar();
    else window._set(window._ref(window._db, SEEN+'/'+st.uid), {ts, lidos}).catch(()=>{});
    emitir();
  }

  // Grava 1 evento no feed (qualquer página pode publicar). `torres` = ['digital',…] ou ['*'].
  function pushFeed(ev){
    const u = st.opts && st.opts.user; if(!u || st.viewer) return Promise.resolve();
    const id = 'f'+Date.now()+Math.random().toString(36).slice(2,6);
    const dado = Object.assign({id, tipo:'', torres:['*'], titulo:'', sub:'', autorUid:u.uid, autor:u.displayName||u.email||'?', ts:new Date().toISOString()}, ev||{});
    Object.keys(dado).forEach(k=>{ if(dado[k]===undefined) delete dado[k]; });   // o RTDB recusa a gravação inteira com um undefined
    dado.titulo = String(dado.titulo||''); dado.sub = String(dado.sub||'');
    return window._set(window._ref(window._db, FEED+'/'+id), dado).catch(err=>console.error('[MareNotif] falha ao gravar o evento:', err));
  }

  // ── Roteador: pra onde cada coisa leva, de QUALQUER página (relativo à raiz, já com -dev quando for o caso) ──
  function urlOkr(param, valor){ return PAGES.okr + (param ? '?'+param+'='+encodeURIComponent(valor) : ''); }
  // Item do feed → URL.
  function urlFeed(it){
    if(!it) return null;
    if(it.muralId) return urlOkr('mural', it.muralId);
    if(it.objId) return urlOkr('okr', it.objId);
    return urlOkr();
  }
  // Notificação pessoal (kanban/usuarios/{uid}/notificacoes) → {url, externo} pra quando a página atual não sabe tratar o tipo sozinha.
  function urlPessoal(n){
    if(!n) return null;
    const t = String(n.type||'');
    if(t==='okr_agente') return {url:urlOkr('okr','chat')};
    if(t==='okr_mencao') return {url:urlOkr('okr','notas')};
    if(t.startsWith('okr_')) return {url:urlOkr('okr', n.okrObjId||'')};
    if(t==='feedback') return {url:PAGES.painel+'?tab=monitor'};
    if(t==='reuniao') return /^https?:\/\//i.test(String(n.meetingLink||'')) ? {url:n.meetingLink, externo:true} : null;   // só http(s): um javascript: gravado na notificação viraria XSS no window.open
    if(t==='painel_broadcast') return {url:PAGES.kanban+(n.squad?'?squad='+encodeURIComponent(n.squad):'')};
    if(n.cardId) return {url:PAGES.kanban+'?squad='+encodeURIComponent(n.squad||'')+'&card='+encodeURIComponent(n.cardId)};
    return {url:PAGES.kanban+(n.squad?'?squad='+encodeURIComponent(n.squad):'')};
  }
  // Abre um item do feed: a página pode tratar por dentro (opts.abrirFeed(it) devolve true) — senão navega pela URL.
  function abrirFeed(id){
    const it = items().find(x=>x.id===id) || (st.feed[id] ? {id, muralId:st.feed[id].muralId, objId:st.feed[id].objId} : null);
    if(!it) return false;
    const w = markOne(id);
    try{ if(st.opts && st.opts.abrirFeed && st.opts.abrirFeed(it)) return true; }catch(e){ console.warn('[MareNotif] abrirFeed:', e); }
    const u = urlFeed(it);
    if(u) Promise.race([w, new Promise(r=>setTimeout(r,800))]).then(()=>{ location.href = u; });   // deixa o "lido" sair antes de trocar de página (no máx. 0,8 s)
    return true;
  }

  window.MareNotif = {start, items, unread, markOne, markAll, pushFeed, abrirFeed, urlFeed, urlPessoal, ICONS, SO_PAINEL, PAGES, esc, viva, FEED, SEEN,
    // para os testes
    _estado: ()=>st};
})();
