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

   Rodapé do sino (🔊 som · permissão deste aparelho · 🔕 Não Perturbe): MareNotif.rodapeHtml(esq) + rodapeRender(); MareNotif.novas(idsNãoLidos) toca o som.
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
    okr_editado:'🎯', okr_prazo:'⏰', okr_reuniao:'🎥', okr_agente:'🤖', okr_mencao:'💬', okr_evento:'🗓️',
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
        objId:f.objId||'', muralId:f.muralId||'', eventoId:f.eventoId||'', evData:f.evData||'', unread: st.seenReady && !lido(f)});
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
  function urlOkrEvento(id, data){ return PAGES.okr + '?evento=' + encodeURIComponent(id) + (data ? '&data=' + encodeURIComponent(data) : ''); }
  // Item do feed → URL.
  function urlFeed(it){
    if(!it) return null;
    if(it.eventoId) return urlOkrEvento(it.eventoId, it.evData);
    if(it.muralId) return urlOkr('mural', it.muralId);
    if(it.objId) return urlOkr('okr', it.objId);
    return urlOkr();
  }
  // Notificação pessoal (kanban/usuarios/{uid}/notificacoes) → {url, externo} pra quando a página atual não sabe tratar o tipo sozinha.
  function urlPessoal(n){
    if(!n) return null;
    const t = String(n.type||'');
    if(n.okrEventoId) return {url:urlOkrEvento(n.okrEventoId, n.okrEventoData)};   // reunião/evento do calendário do OKR
    if(t==='okr_agente') return {url:urlOkr('okr','chat')};
    if(t==='okr_mencao') return {url:urlOkr('okr','notas')};
    if(t.startsWith('okr_')) return {url:urlOkr('okr', n.okrObjId||'')};
    if(t==='feedback') return {url:PAGES.painel+'?tab=monitor'};
    if(t==='reuniao') return /^https?:\/\//i.test(String(n.meetingLink||'')) ? {url:n.meetingLink, externo:true} : null;   // só http(s): um javascript: gravado na notificação viraria XSS no window.open
    if(t==='painel_broadcast') return {url:PAGES.kanban+(n.squad?'?squad='+encodeURIComponent(n.squad):'')};
    if(n.cardId) return {url:PAGES.kanban+'?squad='+encodeURIComponent(n.squad||'')+'&card='+encodeURIComponent(n.cardId)};
    return {url:PAGES.kanban+(n.squad?'?squad='+encodeURIComponent(n.squad):'')};
  }
  // Abre outra página do Maré Digital (OKR ↔ painel ↔ kanban) numa ABA NOVA — a que a pessoa está usando fica como está.
  // Se o navegador bloquear a aba nova (popup), cai pra navegação normal em vez de não fazer nada.
  function abrirPagina(u){
    if(!u) return false;
    let w = null; try{ w = window.open(u, '_blank'); }catch(e){}
    if(w){ try{ w.opener = null; }catch(e){} return true; }
    location.href = u; return false;
  }
  // Abre um item do feed: a página pode tratar por dentro (opts.abrirFeed(it) devolve true) — senão navega pela URL.
  function abrirFeed(id){
    const it = items().find(x=>x.id===id) || (st.feed[id] ? {id, muralId:st.feed[id].muralId, objId:st.feed[id].objId, eventoId:st.feed[id].eventoId, evData:st.feed[id].evData} : null);
    if(!it) return false;
    const w = markOne(id);
    try{ if(st.opts && st.opts.abrirFeed && st.opts.abrirFeed(it)) return true; }catch(e){ console.warn('[MareNotif] abrirFeed:', e); }
    const u = urlFeed(it);
    if(u) abrirPagina(u);   // aba nova: a página atual continua viva, então o "lido" termina de gravar sozinho (e o clique conta como gesto do usuário — sem bloqueio de popup)
    return true;
  }


  // ══ RODAPÉ DO SINO ══ (igual ao do kanban: 🔊 som · permissão deste aparelho · 🔕 Não Perturbe). Preferências compartilhadas com o kanban:
  // som mudo = localStorage 'notif_sound_muted'; Não Perturbe = kanban/usuarios/{uid}/notif_prefs/dnd; token de push = kanban/usuarios/{uid}/fcm_tokens/{push_device_id}.
  const VAPID = 'BJEbQRe9lG-PkwtABA5v8KhQlAWG4sJmxZmKwEbCjCc7vUXbNgjiz1gWnKjPUJDyU64OibIddERAQRUiavdwvMI';
  const dnd = {on:false, until:null, label:''};
  let prefsOn = false, tokenConfirmado = false, fcmHookOn = false;

  function toast(m){ try{ if(st.opts && st.opts.toast) st.opts.toast(m); else if(typeof window.showToast==='function') window.showToast(m); }catch(e){} }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  function dndExpira(){ if(dnd.on && dnd.until && new Date(dnd.until).getTime() <= Date.now()){ dnd.on = false; dnd.until = null; dnd.label = ''; } }
  function dndAtivo(){ dndExpira(); return !!dnd.on; }
  function prefsPath(){ return 'kanban/usuarios/'+st.uid+'/notif_prefs/dnd'; }
  function dndSalvar(val){
    Object.assign(dnd, val); rodapeRender();
    if(!st.uid || st.viewer) return;
    window._set(window._ref(window._db, prefsPath()), val).catch(()=>toast('⚠ Não consegui salvar o Não Perturbe.'));
  }
  function dndSet(on, minutos, label){
    dndSalvar({on:!!on, until:(on && minutos) ? new Date(Date.now()+minutos*60000).toISOString() : null, label:on ? (label||'') : ''});
    menusFechar();
  }
  function dndAmanha(){
    const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0);
    dndSalvar({on:true, until:d.toISOString(), label:'até amanhã 9h'}); menusFechar();
  }
  function prefsStart(){
    if(prefsOn || !st.uid || st.viewer) return; prefsOn = true;
    window._onValue(window._ref(window._db, 'kanban/usuarios/'+st.uid+'/notif_prefs'), snap=>{
      const v = snap.val() || {}; const d = v.dnd || {on:false, until:null, label:''};
      dnd.on = !!d.on; dnd.until = d.until || null; dnd.label = d.label || ''; rodapeRender();
    }, ()=>{});
  }

  // Som: "ding" de 2 tons sintetizado (Web Audio, sem arquivo). Respeita o mudo pessoal e o Não Perturbe.
  function somMudo(){ return lsGet('notif_sound_muted')==='1'; }
  let audioCtx = null;
  function tocar(){
    try{
      if(somMudo() || dndAtivo()) return;
      const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
      if(!audioCtx) audioCtx = new AC();
      if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
      const t0 = audioCtx.currentTime;
      [[880,0],[1108,0.09]].forEach(([freq,d])=>{
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t0+d); g.gain.linearRampToValueAtTime(0.15, t0+d+0.01); g.gain.exponentialRampToValueAtTime(0.001, t0+d+0.25);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0+d); o.stop(t0+d+0.26);
      });
    }catch(e){}
  }
  function somToggle(){
    const mudo = !somMudo(); lsSet('notif_sound_muted', mudo ? '1' : '0'); rodapeRender();
    if(!mudo) tocar();   // toquinha de confirmação ao reativar
  }
  // O sino chama isto a cada desenho com os ids das NÃO lidas: toca o som quando aparece um id que ainda não tinha sido visto.
  // O que chega nos primeiros 3 s da página (carga inicial) só entra na lista, sem som.
  const idsVistos = new Set(); let t0Novas = 0;
  function novas(ids){
    prefsStart();   // o Não Perturbe precisa estar carregado ANTES do 1º ding — não pode depender de o sino ter sido aberto
    if(!t0Novas) t0Novas = Date.now();
    const quente = Date.now() - t0Novas > 3000; let achou = false;
    (ids||[]).forEach(id=>{ if(!idsVistos.has(id)){ idsVistos.add(id); if(quente) achou = true; } });
    if(achou) tocar();
    return achou;
  }

  // Permissão do navegador + token de push (FCM) deste aparelho. Os hooks window._fcm* vêm da própria página (SDK de messaging); sem eles só a permissão é pedida.
  function permEstado(){ return window.Notification ? Notification.permission : 'unsupported'; }
  function deviceId(){
    let id = lsGet('push_device_id');
    if(!id){ id = 'dev_'+Date.now().toString(36)+Math.random().toString(36).slice(2,10); lsSet('push_device_id', id); }
    return id;
  }
  async function tokenRegistrar(){
    if(!window._fcmReady || !st.uid || st.viewer || !('serviceWorker' in navigator)) return null;
    try{
      const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); await navigator.serviceWorker.ready;
      const token = await window._fcmGetToken(VAPID, reg); if(!token) return null;
      await window._set(window._ref(window._db, 'kanban/usuarios/'+st.uid+'/fcm_tokens/'+deviceId()), {token, ua:navigator.userAgent, squad:'', ts:new Date().toISOString()});
      return token;
    }catch(e){ console.warn('[MareNotif] falha ao registrar o push:', e); return null; }
  }
  async function tokenRemover(){
    try{
      if(window._fcmReady) await window._fcmDeleteToken();
      if(st.uid) await window._set(window._ref(window._db, 'kanban/usuarios/'+st.uid+'/fcm_tokens/'+deviceId()), null).catch(()=>{});
    }catch(e){ console.warn('[MareNotif] falha ao remover o push:', e); }
  }
  function permClick(){
    const s = permEstado();
    if(s==='default'){
      Notification.requestPermission().then(async perm=>{
        rodapeRender();
        if(perm==='granted'){
          toast('🔔 Notificações permitidas neste aparelho.');
          if(!(await tokenRegistrar())) toast('⚠ Permissão OK, mas o push ainda não está disponível nesta página — ative também pelo Kanban.');
        } else if(perm==='denied') toast('🔕 Notificações bloqueadas — ative manualmente nas configurações do navegador se mudar de ideia.');
      }).catch(()=>{});
    } else if(s==='granted'){
      if(confirm('Desativar notificações push neste aparelho?\n\n(A permissão do navegador continua concedida — é só o registro deste aparelho pra receber avisos que é removido.)'))
        tokenRemover().then(()=>toast('🔕 Push desativado neste aparelho.'));
    }
  }

  // HTML do rodapé; `esq` = botões da página à esquerda (ex.: "Limpar antigas"). Depois de inserir no DOM, chame rodapeRender().
  function rodapeHtml(esq){
    const v = st.viewer;
    return '<div class="mn-ft">'
      + '<div class="mn-row"><span class="mn-esq">'+(esq||'')+'</span><span class="mn-dir">'
      + '<button type="button" class="mn-som" onclick="MareNotif.somToggle()"></button>'
      + (v ? '' : '<span class="mn-perm" onclick="MareNotif.permClick()"></span>')
      + '</span></div>'
      + (v ? '' : '<div class="mn-dndw"><button type="button" class="mn-dnd-btn" onclick="MareNotif.dndMenu(event)"><span class="mn-dnd-lbl"></span></button>'
        + '<div class="mn-dnd-menu"><div class="mn-dnd-hint">Silenciar avisos que interrompem (o sino continua registrando tudo)</div>'
        + '<button type="button" class="mn-dnd-it" onclick="MareNotif.dndSet(true,60,\'1 hora\')">🔕 Por 1 hora</button>'
        + '<button type="button" class="mn-dnd-it" onclick="MareNotif.dndSet(true,480,\'8 horas\')">🔕 Por 8 horas</button>'
        + '<button type="button" class="mn-dnd-it" onclick="MareNotif.dndAmanha()">🔕 Até amanhã de manhã</button>'
        + '<button type="button" class="mn-dnd-it" onclick="MareNotif.dndSet(true,null,\'\')">🔕 Até eu desativar</button>'
        + '<button type="button" class="mn-dnd-it mn-dnd-re" onclick="MareNotif.dndSet(false)">🔔 Reativar notificações</button></div></div>')
      + '</div>';
  }
  function rodapeRender(){
    prefsStart();
    const mudo = somMudo(), s = permEstado(), ativo = dndAtivo();
    const labels = {granted:'✅ Permitidas neste aparelho', denied:'🚫 Bloqueadas (ajuste nas config. do navegador)', default:'🔔 Ativar notificações neste aparelho', unsupported:'⚠ Não suportado neste navegador'};
    document.querySelectorAll('.mn-som').forEach(b=>{ b.textContent = mudo ? '🔇' : '🔊'; b.title = mudo ? 'Som desligado — clique para ligar' : 'Som ligado — clique para desligar'; });
    document.querySelectorAll('.mn-perm').forEach(el=>{ el.textContent = labels[s] || labels['default']; el.style.cursor = (s==='default'||s==='granted') ? 'pointer' : 'default'; el.style.opacity = s==='denied' ? '.6' : '1'; });
    document.querySelectorAll('.mn-dnd-btn').forEach(b=>{ b.classList.toggle('mn-dnd-ativo', ativo); });
    document.querySelectorAll('.mn-dnd-lbl').forEach(el=>{ el.textContent = ativo ? ('🔕 Não Perturbe ativo'+(dnd.label ? ' ('+dnd.label+')' : ' (até você desativar)')) : '🔔 Notificações ativas'; });
    // Permissão já concedida em outra sessão/página: garante o token deste aparelho (1x por carga), como o kanban faz.
    if(s==='granted' && !tokenConfirmado && st.uid && !st.viewer && window._fcmReady){ tokenConfirmado = true; tokenRegistrar(); }
    if(!fcmHookOn && window._fcmOnMessage){ fcmHookOn = true; try{ window._fcmOnMessage(p=>toast('🔔 '+((p && p.data && p.data.title) || (p && p.notification && p.notification.title) || 'Nova notificação'))); }catch(e){} }
  }
  // Menu do Não Perturbe: fixo na tela (o painel do sino corta o que passa da própria caixa), abre pra cima quando não cabe embaixo.
  function dndMenu(e){
    if(e) e.stopPropagation();
    const btn = e && e.currentTarget, m = btn && btn.parentElement.querySelector('.mn-dnd-menu'); if(!m) return;
    if(m.style.display==='block'){ m.style.display = 'none'; return; }
    menusFechar();
    const r = btn.getBoundingClientRect(); m.style.display = 'block'; const h = m.offsetHeight;
    m.style.left = r.left+'px'; m.style.width = r.width+'px';
    if(window.innerHeight - r.bottom - 8 >= h) { m.style.top = (r.bottom+6)+'px'; m.style.bottom = 'auto'; }
    else { m.style.top = 'auto'; m.style.bottom = (window.innerHeight - r.top + 6)+'px'; }
  }
  function menusFechar(){
    let fechou = false;
    document.querySelectorAll('.mn-dnd-menu').forEach(m=>{ if(m.style.display==='block'){ m.style.display = 'none'; fechou = true; } });
    return fechou;
  }
  document.addEventListener('click', e=>{ if(!e.target.closest || (!e.target.closest('.mn-dnd-menu') && !e.target.closest('.mn-dnd-btn'))) menusFechar(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && menusFechar()){ e.preventDefault(); e.stopImmediatePropagation(); } }, true);   // Esc fecha o menu antes de fechar o painel do sino

  (function css(){
    if(document.getElementById('mn-css')) return;
    const el = document.createElement('style'); el.id = 'mn-css';
    el.textContent = '.mn-ft{flex-shrink:0;display:flex;flex-direction:column;gap:6px;padding:8px 14px;border-top:1px solid var(--glass-b,rgba(255,255,255,.15));}'
      + '.mn-row{display:flex;justify-content:space-between;align-items:center;gap:8px;}.mn-dir{display:flex;align-items:center;gap:10px;}'
      + '.mn-som{background:none;border:none;cursor:pointer;font-size:13px;color:var(--txt3,#8fa);padding:0;line-height:1;}'
      + '.mn-perm{font-size:10px;color:var(--txt3,#8fa);white-space:nowrap;}'
      + '.mn-link{font-size:10px;color:var(--txt3,#8fa);background:none;border:none;cursor:pointer;padding:0;}.mn-link:hover{text-decoration:underline;}'
      + '.mn-dndw{border-top:1px solid var(--glass-b,rgba(255,255,255,.15));padding-top:6px;}'
      + '.mn-dnd-btn{box-sizing:border-box;width:100%;text-align:left;background:none;border:1px solid var(--glass-b,rgba(255,255,255,.15));border-radius:8px;padding:7px 10px;cursor:pointer;color:var(--txt2,#bcd);font-size:11px;white-space:normal;word-break:break-word;}'
      + '.mn-dnd-btn.mn-dnd-ativo{border-color:rgba(255,209,102,.4);color:var(--warn,#ffd166);background:rgba(255,209,102,.08);}'
      + '.mn-dnd-menu{display:none;box-sizing:border-box;position:fixed;background:rgba(var(--deep-rgb,3,13,26),.99);border:1px solid var(--glass-b,rgba(255,255,255,.15));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);padding:6px;z-index:9999;max-height:70vh;overflow-y:auto;}'
      + '.mn-dnd-hint{font-size:10px;color:var(--txt3,#8fa);padding:4px 8px 6px;white-space:normal;}'
      + '.mn-dnd-it{box-sizing:border-box;display:block;width:100%;text-align:left;background:none;border:none;color:var(--txt2,#bcd);font-size:12px;padding:8px;border-radius:6px;cursor:pointer;white-space:normal;line-height:1.4;}'
      + '.mn-dnd-it:hover{background:rgba(56,182,255,.1);}.mn-dnd-re{color:var(--accent,#38b6ff);border-top:1px solid var(--glass-b,rgba(255,255,255,.15));margin-top:4px;padding-top:10px;}';
    (document.head || document.documentElement).appendChild(el);
  })();

  window.MareNotif = {start, items, unread, markOne, markAll, pushFeed, abrirFeed, abrirPagina, urlFeed, urlPessoal, ICONS, SO_PAINEL, PAGES, esc, viva, FEED, SEEN,
    rodapeHtml, rodapeRender, dndSet, dndAmanha, dndMenu, dndAtivo, menusFechar, somToggle, somMudo, tocar, novas, permEstado, permClick,
    // para os testes
    _estado: ()=>st};
})();
