/* ══════════════════════════════════════════════════════════════════════════
   mare-notif.js — SINO ÚNICO do Maré Digital (módulo compartilhado, PRODUÇÃO)
   Carregado por painel / okr (e kanban, quando promovido). Cópia de mare-notif-dev.js (que as páginas -dev carregam) — o código é o mesmo (o ambiente dev/prod é decidido pelo pathname); mudou um, mude o outro e suba o ?v= nas páginas.
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
    ? {okr:'okr-dev.html', kanban:'kanban-dev.html', painel:'painel-dev.html', oceano:'oceano-dev.html'}
    : {okr:'okr.html', kanban:'kanban.html', painel:'painel.html', oceano:'oceano.html'};

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
  // MODO "SÓ HERING" (window.MARE_SO_HERING, definido no 1º <script> de cada página; sem a variável vale `true`, igual aos HTML): o feed só mostra o que é da
  // torre Digital ou de todas ('*') — evento dirigido SÓ a outra torre não aparece pra ninguém, nem pra ADM/Geral/visualizador. Desligado = regra de sempre.
  const SO_HERING = (typeof window !== 'undefined' && typeof window.MARE_SO_HERING !== 'undefined') ? !!window.MARE_SO_HERING : true;
  function paraMim(torres){
    if(SO_HERING) return torres.includes('*') || torres.includes('digital');
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

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 🔲 MENU DE PRODUTOS DO OCEANO (estilo "apps do Google") — um botão de 9 pontinhos no cabeçalho de cada página que abre a grade dos
  // produtos da família, cada um com a sua logo; clicar abre o produto em ABA NOVA. Só aparece o que a pessoa usa:
  //   Maré Digital (kanban) e A Bordo → qualquer pessoa da Hering · Radar (OKR) → todo mundo, inclusive visualizador externo
  //   Painel → ADM, visualizador externo e quem JÁ USA o painel (abriu o painel alguma vez ou é PO/Organizador num squad).
  // "Já usa o painel" fica em kanban/usuarios/{uid}/apps/painel (o próprio dono grava — as regras já deixam; não é segurança, só vitrine:
  // esconder o botão não impede quem sabe a URL). Uso (depois do login):  MareNotif.appsMontar({user, aqui:'okr', isViewer, isAdm, slot:'#id', btnClass:'btn'})
  //   e, onde a página SABE que a pessoa usa um produto:  MareNotif.appsUso('painel', user).
  // Logos: Maré Digital = favicon.png de produção, Radar = favicon-radar.png; os demais, SVG provisórios (gradiente + glifo) até ganharem logo de verdade. Nas páginas -dev abre as páginas -dev (e mostra o aviso 🧪).
  const APPS = [
    {id:'oceano', nome:'Oceano', sub:'Lobby e boas-vindas', href:PAGES.oceano, img:'favicon-oceano.png'},   // o lobby da família: NÃO é tile da grade — é o título do popover (link, só pra quem é da Hering)
    {id:'kanban', nome:'Maré Digital', sub:'Kanban dos squads',   href:PAGES.kanban, img:'favicon.png'},   // a logo do Maré Digital já existe (favicon.png de PRODUÇÃO, também nas páginas -dev)
    {id:'painel', nome:'Painel', sub:'Gestão e pessoas',        href:PAGES.painel, g:['#8b8cff','#4a4fc4'],
      glifo:'<circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2.6"/><path d="M24 8v7M24 33v7M8 24h7M33 24h7M12.7 12.7l5 5M30.3 30.3l5 5M35.3 12.7l-5 5M17.7 30.3l-5 5"/>'},
    {id:'okr',    nome:'Radar',        sub:'Objetivos e OKRs',    href:PAGES.okr, img:'favicon-radar.png'},   // logo do Radar (peixinhos no radar) — a mesma da aba do navegador
    {id:'onboarding', nome:'A Bordo', sub:'Boas-vindas',         href:'onboarding.html', g:['#ffb347','#d9731a'],
      glifo:'<circle cx="24" cy="12" r="3.4"/><path d="M24 15.5V37M16.5 21h15M11 29c0 7 5.5 9 13 9s13-2 13-9"/>'},
  ];
  const APP_OCEANO = APPS.find(a=>a.id==='oceano');
  const appsSt = {opts:null, uso:{}, aberto:false, tab:'produtos', links:{hering:null, meus:null}};
  // ── LINKS: abas "Hering" (links importantes, cadastrados por ADM no Painel → ⚙ Configurações → 🔗 Links: kanban/config/links_hering) e
  //    "Meus links" (da própria pessoa, em Oceano → ⚙ Meu perfil: kanban/usuarios/{uid}/links). Cache em localStorage (compartilhado entre as páginas
  //    do domínio: quem edita atualiza o cache e as outras páginas já enxergam na hora). Só http(s); imagem só https; texto sempre escapado.
  const LINKS_HERING = 'kanban/config/links_hering', LINKS_TTL = 600000;
  const linksChave = (tipo, uid)=> tipo==='hering' ? 'mare_links_hering' : 'mare_links_user_'+uid;
  const linkUrlOk = u => { u = String(u||'').trim(); return u.length>0 && u.length<=600 && /^https?:\/\/[^\s"'<>]+$/i.test(u); };
  const linkImgOk = u => { u = String(u||'').trim(); return u.length>0 && u.length<=600 && /^https:\/\/[^\s"'<>]+$/i.test(u); };
  function linksLista(obj){
    return Object.entries(obj && typeof obj==='object' ? obj : {}).map(([id,v])=>Object.assign({id}, v||{}))
      .filter(l=>l.titulo && linkUrlOk(l.url) && l.ativo!==false)
      .sort((a,b)=>(Number(a.ordem)||0)-(Number(b.ordem)||0) || String(a.titulo).localeCompare(String(b.titulo),'pt-BR'));
  }
  function linksCacheLer(tipo, uid){ try{ const o = JSON.parse(localStorage.getItem(linksChave(tipo,uid))||'null'); return (o && typeof o==='object' && 'v' in o) ? o : null; }catch(e){ return null; } }
  function linksCacheSet(tipo, uid, v){ try{ localStorage.setItem(linksChave(tipo,uid), JSON.stringify({t:Date.now(), v:v||{}})); }catch(e){} if(tipo==='hering') appsSt.links.hering = v||{}; else appsSt.links.meus = v||{}; if(appsSt.aberto) appsPopRender(); }
  function linksCarregar(tipo){
    const u = appsSt.opts && appsSt.opts.user; if(!u || !u.uid || appsSt.opts.isViewer) return;
    const c = linksCacheLer(tipo, u.uid); if(c) appsSt.links[tipo==='hering'?'hering':'meus'] = c.v;
    if(c && (Date.now() - (c.t||0)) < LINKS_TTL) return;
    const path = tipo==='hering' ? LINKS_HERING : 'kanban/usuarios/'+u.uid+'/links';
    try{ window._get(window._ref(window._db, path)).then(sn=>{ linksCacheSet(tipo, u.uid, (sn && sn.exists() && typeof sn.val()==='object') ? sn.val() : {}); }).catch(()=>{ if(!c){ appsSt.links[tipo==='hering'?'hering':'meus'] = {}; if(appsSt.aberto) appsPopRender(); } }); }catch(e){}
  }
  const linkFavicon = url => { try{ return 'https://www.google.com/s2/favicons?domain='+encodeURIComponent(new URL(url).hostname)+'&sz=64'; }catch(e){ return ''; } };
  function linkLogo(l){
    const ini = esc((String(l.titulo||'?').trim()[0]||'?').toUpperCase()), fav = linkFavicon(l.url);
    const src = linkImgOk(l.img) ? l.img : fav;
    return '<span class="mn-lk-logo" data-ini="'+ini+'">'+(src ? '<img class="mn-lk-img" src="'+esc(src)+'" data-fav="'+esc(fav)+'" data-t="'+(linkImgOk(l.img)?'0':'1')+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '<b>'+ini+'</b>')+'</span>';
  }
  function linksHtml(lista, vazio){
    if(!lista.length) return '<div class="mn-lk-vazio">'+vazio+'</div>';
    // "inteligente": quantidade múltipla de 3 vira grade de quadrados (3 por fila, como a aba Produtos); qualquer outra fica em lista
    return '<div class="mn-lk-lista'+(lista.length%3===0 ? ' mn-lk-grade' : '')+'">'+lista.map(l=>'<a class="mn-lk" role="menuitem" href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(l.url)+'">'+linkLogo(l)+'<span class="mn-lk-tx"><span class="mn-lk-t">'+esc(l.titulo)+'</span>'+(l.desc ? '<span class="mn-lk-d">'+esc(l.desc)+'</span>' : '')+'</span></a>').join('')+'</div>';
  }
  function appsLsKey(uid){ return 'mare_apps_'+uid; }
  function appsLsLer(uid){ try{ const o = JSON.parse(localStorage.getItem(appsLsKey(uid))||'null'); return (o && o.v && typeof o.v==='object') ? o : null; }catch(e){ return null; } }
  function appsLsSalvar(uid, v){ try{ localStorage.setItem(appsLsKey(uid), JSON.stringify({t:Date.now(), v})); }catch(e){} }
  function appsVisivel(a, c){
    if(a.id==='painel') return !!(c.viewer || c.adm || c.uso.painel);
    if(a.id==='okr') return true;
    if(a.id==='oceano') return !c.viewer;   // o lobby é só pra conta Google @ciahering
    return !c.viewer;   // Maré Digital e A Bordo: só gente da empresa
  }
  function appsCtx(){
    const o = appsSt.opts || {};
    return {viewer:!!o.isViewer, adm:(typeof o.isAdm==='function' ? !!o.isAdm() : !!o.isAdm), uso:appsSt.uso||{}};
  }
  function appsLogo(a){
    if(a.img) return '<img src="'+esc(a.img)+'" width="42" height="42" alt="" loading="lazy" decoding="async" style="border-radius:12px;display:block;object-fit:cover;">';
    const id = 'mn-g-'+a.id;
    return '<svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+a.g[0]+'"/><stop offset="1" stop-color="'+a.g[1]+'"/></linearGradient></defs>'
      + '<rect width="48" height="48" rx="12" fill="url(#'+id+')"/><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".96">'+a.glifo+'</g></svg>';
  }
  function appsPopRender(){
    const pop = document.getElementById('mn-apps-pop'); if(!pop) return;
    const c = appsCtx(), aqui = (appsSt.opts && appsSt.opts.aqui) || '';
    const lista = APPS.filter(a=>a.id!=='oceano' && appsVisivel(a, c));   // a grade é só de PRODUTOS; o Oceano em si é o título (link pro lobby)
    const oc = APP_OCEANO && appsVisivel(APP_OCEANO, c) && aqui!=='oceano';
    const comAbas = !c.viewer, tab = comAbas ? appsSt.tab : 'produtos';
    let corpo;
    if(tab==='hering'){
      corpo = linksHtml(linksLista(appsSt.links.hering), appsSt.links.hering===null ? 'Carregando…' : 'Nenhum link cadastrado ainda.'+(c.adm ? '<br><small>Cadastre em <b>Painel → ⚙ Configurações → 🔗 Links</b>.</small>' : ''));
    } else if(tab==='meus'){
      corpo = linksHtml(linksLista(appsSt.links.meus), appsSt.links.meus===null ? 'Carregando…' : 'Você ainda não tem atalhos. Adicione os sites que você mais usa.')
        + '<a class="mn-lk-gerir" role="menuitem" data-app="oceano" data-secao="links" href="'+esc(APP_OCEANO.href)+'#meus-links" target="_blank" rel="noopener">＋ Adicionar ou editar meus links</a>';
    } else {
      corpo = '<div class="mn-apps-grid">' + lista.map(a=>{
          const eh = a.id===aqui;
          return (eh ? '<div class="mn-app mn-app-aqui" role="menuitem" aria-current="page" tabindex="0">' : '<a class="mn-app" role="menuitem" data-app="'+esc(a.id)+'" href="'+esc(a.href)+'" target="_blank" rel="noopener">')
            + appsLogo(a) + '<span class="mn-app-n">'+esc(a.nome)+'</span><span class="mn-app-s">'+(eh ? 'você está aqui' : esc(a.sub))+'</span>'
            + (eh ? '</div>' : '</a>');
        }).join('') + '</div>';
    }
    pop.innerHTML = (oc ? '<a class="mn-apps-hd mn-oceano" role="menuitem" data-app="oceano" href="'+esc(APP_OCEANO.href)+'" target="_blank" rel="noopener" title="Ir pro início do Oceano"><span>🌊 Oceano</span><span class="mn-oc-go">início ↗</span></a>' : '<div class="mn-apps-hd">🌊 Oceano</div>')
      + (IS_DEV ? '<div class="mn-apps-dev">🧪 páginas de teste (dev)</div>' : '')
      + (comAbas ? '<div class="mn-tabs" role="tablist">'+[['produtos','Produtos'],['hering','Hering'],['meus','Meus links']].map(t=>'<button type="button" role="tab" data-mntab="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+'</button>').join('')+'</div>' : '')
      + corpo;
  }
  function appsPosicionar(){
    const btn = document.getElementById('mn-apps-btn'), pop = document.getElementById('mn-apps-pop'); if(!btn || !pop) return;
    const r = btn.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 16);
    pop.style.width = w+'px';
    pop.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))+'px';
    pop.style.top = (r.bottom + 8)+'px';
  }
  function appsFechar(volta){
    const pop = document.getElementById('mn-apps-pop'), btn = document.getElementById('mn-apps-btn'); if(!pop || !appsSt.aberto) return false;
    appsSt.aberto = false; pop.style.display = 'none'; if(btn){ btn.setAttribute('aria-expanded','false'); if(volta) btn.focus(); }
    return true;
  }
  function appsToggle(e){
    if(e) e.stopPropagation();
    const pop = document.getElementById('mn-apps-pop'), btn = document.getElementById('mn-apps-btn'); if(!pop || !btn) return;
    if(appsSt.aberto){ appsFechar(true); return; }
    menusFechar(); if(appsSt.tab!=='produtos' && !appsSt.opts.isViewer) linksCarregar(appsSt.tab==='hering'?'hering':'meus'); appsPopRender(); appsSt.aberto = true; pop.style.display = 'block'; appsPosicionar(); btn.setAttribute('aria-expanded','true');
    const p = pop.querySelector('a.mn-app'); if(p) p.focus({preventScroll:true});
  }
  document.addEventListener('click', e=>{ if(appsSt.aberto && e.target.closest && !e.target.closest('#mn-apps-pop') && !e.target.closest('#mn-apps-btn')) appsFechar(false); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && appsFechar(true)){ e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('resize', ()=>{ if(appsSt.aberto) appsPosicionar(); });
  // Monta (ou remonta) o botão no `slot` da página e carrega "quem usa o quê" (cache de 1h no aparelho; 1 leitura pequena do próprio registro).
  function appsMontar(opts){
    appsSt.opts = opts || {};
    const u = appsSt.opts.user, slot = typeof appsSt.opts.slot==='string' ? document.querySelector(appsSt.opts.slot) : appsSt.opts.slot;
    if(!slot) return;
    // outra pessoa entrou na mesma página (sair/entrar sem recarregar): os "Meus links" e a aba da anterior não podem aparecer pra ela
    const uidNovo = (u && u.uid) || ''; if(appsSt.uid && appsSt.uid!==uidNovo){ appsSt.links = {hering:null, meus:null}; appsSt.tab = 'produtos'; } appsSt.uid = uidNovo;
    let btn = document.getElementById('mn-apps-btn');
    if(!btn){
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'mn-apps-btn';
      btn.setAttribute('aria-haspopup','menu'); btn.setAttribute('aria-expanded','false'); btn.title = 'Produtos do Oceano'; btn.setAttribute('aria-label','Produtos do Oceano');
      btn.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">'
        + [3,10,17].map(y=>[3,10,17].map(x=>'<circle cx="'+x+'" cy="'+y+'" r="1.9"/>').join('')).join('') + '</svg>';
      btn.addEventListener('click', appsToggle);
    }
    btn.className = 'mn-apps-btn ' + (appsSt.opts.btnClass || '');
    if(btn.parentNode !== slot) slot.appendChild(btn);
    if(!document.getElementById('mn-apps-pop')){
      const pop = document.createElement('div'); pop.id = 'mn-apps-pop'; pop.setAttribute('role','menu'); pop.setAttribute('aria-label','Produtos do Oceano'); pop.style.display = 'none';
      // Dentro do Oceano (a página-lobby hospeda os produtos num iframe de nome 'oceano-frame'): em vez de abrir aba nova, pede pro lobby trocar de produto.
      pop.addEventListener('click', e=>{
        const tb = e.target.closest && e.target.closest('button[data-mntab]');
        if(tb){ e.stopPropagation(); appsSt.tab = tb.dataset.mntab; if(appsSt.tab!=='produtos') linksCarregar(appsSt.tab==='hering'?'hering':'meus'); appsPopRender(); appsPosicionar(); const t2 = pop.querySelector('button[data-mntab="'+appsSt.tab+'"]'); if(t2) t2.focus({preventScroll:true}); return; }
        const a = e.target.closest && e.target.closest('a[data-app]'); if(!a || !(window.parent && window.parent!==window && window.name==='oceano-frame')) return;
        e.preventDefault(); appsFechar(false);
        try{ window.parent.postMessage(a.dataset.secao ? {oceano:'prefs', secao:a.dataset.secao} : {oceano: a.dataset.app==='oceano' ? 'lobby' : 'abrir', app:a.dataset.app}, location.origin); }catch(x){}
      });
      // imagem do link que não carrega: tenta o ícone do site; se também falhar, vira a inicial do título
      pop.addEventListener('error', e=>{
        const im = e.target; if(!im || !im.classList || !im.classList.contains('mn-lk-img')) return;
        if(im.dataset.t==='0' && im.dataset.fav){ im.dataset.t = '1'; im.src = im.dataset.fav; return; }
        const w = im.parentNode; if(w){ w.innerHTML = '<b>'+(w.dataset.ini||'?')+'</b>'; }
      }, true);
      document.body.appendChild(pop);
    }
    // quem usa o quê: cache primeiro (render imediato), depois confere no banco se o cache tem mais de 1h
    appsSt.uso = {};
    if(u && u.uid && !appsSt.opts.isViewer){
      const c = appsLsLer(u.uid); if(c) appsSt.uso = c.v;
      if(!c || (Date.now() - (c.t||0)) > 3600000){
        try{
          window._get(window._ref(window._db, 'kanban/usuarios/'+u.uid+'/apps')).then(sn=>{
            appsSt.uso = Object.assign({}, (sn && sn.exists() && sn.val() && typeof sn.val()==='object') ? sn.val() : {}, appsSt.uso); appsLsSalvar(u.uid, appsSt.uso);   // junta com o que a página acabou de marcar (a gravação pode ainda não ter chegado)
            if(appsSt.aberto) appsPopRender();
          }).catch(()=>{});
        }catch(e){}
      }
    }
    if(appsSt.aberto) appsPopRender();
  }
  // A página sabe que a pessoa USA um produto (ex.: abriu o painel, ou é PO/Organizador): grava 1 vez, no próprio registro, e atualiza o cache.
  function appsUso(app, user){
    const u = user || (appsSt.opts && appsSt.opts.user); if(!u || !u.uid || (appsSt.opts && appsSt.opts.isViewer) || window._isPainelViewer) return;
    const c = appsLsLer(u.uid), v = (c && c.v) || appsSt.uso || {};
    if(v[app]===true){ appsSt.uso = v; return; }
    v[app] = true; appsSt.uso = v; appsLsSalvar(u.uid, v);
    try{ window._update(window._ref(window._db, 'kanban/usuarios/'+u.uid+'/apps'), {[app]:true}).catch(()=>{}); }catch(e){}
    if(appsSt.aberto) appsPopRender();
  }
  (function cssApps(){
    if(document.getElementById('mn-apps-css')) return;
    const el = document.createElement('style'); el.id = 'mn-apps-css';
    el.textContent = '.mn-apps-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;}'
      + '.mn-apps-btn:not(.btn):not(.notif-btn){background:none;border:1px solid var(--glass-b,rgba(255,255,255,.15));border-radius:8px;color:var(--txt2,#bcd);padding:6px 8px;}'
      + '#mn-apps-pop{position:fixed;z-index:10050;box-sizing:border-box;background:rgba(var(--deep-rgb,3,13,26),.99);border:1px solid var(--glass-b,rgba(255,255,255,.15));border-radius:14px;box-shadow:0 16px 44px rgba(0,0,0,.55);padding:12px;max-height:80vh;overflow-y:auto;}'
      + '.mn-apps-hd{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3,#8fa);padding:0 4px 8px;}'
      + 'a.mn-oceano{display:flex;justify-content:space-between;align-items:center;text-decoration:none;border-radius:8px;margin:0 0 4px;padding:4px;}'
      + 'a.mn-oceano:hover{background:rgba(56,182,255,.1);color:var(--accent,#38b6ff);}.mn-oc-go{font-weight:600;letter-spacing:0;text-transform:none;font-size:11px;}'
      + '.mn-tabs{display:flex;gap:2px;border-bottom:1px solid var(--glass-b,rgba(255,255,255,.15));margin:0 0 10px;}'
      + '.mn-tabs button{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:var(--txt2,#bcd);font-size:12px;font-weight:600;padding:7px 4px;cursor:pointer;margin-bottom:-1px;}'
      + '.mn-tabs button:hover{color:var(--txt,#e8f4ff);}.mn-tabs button[aria-selected="true"]{color:var(--accent,#38b6ff);border-bottom-color:var(--accent,#38b6ff);}'
      + '.mn-lk-lista{display:flex;flex-direction:column;gap:2px;}'
      + 'a.mn-lk{box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;text-decoration:none;color:var(--txt,#e8f4ff);border:1px solid transparent;min-width:0;}'
      + 'a.mn-lk:hover,a.mn-lk:focus-visible{background:rgba(56,182,255,.12);border-color:rgba(56,182,255,.35);outline:none;}'
      + '.mn-lk-logo{width:34px;height:34px;border-radius:9px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(56,182,255,.14);border:1px solid var(--glass-b,rgba(255,255,255,.15));}'
      + '.mn-lk-logo img{width:100%;height:100%;object-fit:cover;display:block;}.mn-lk-logo b{font-size:14px;color:var(--accent,#38b6ff);}'
      + '.mn-lk-tx{display:flex;flex-direction:column;min-width:0;}.mn-lk-t{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.mn-lk-d{font-size:10.5px;color:var(--txt3,#8fa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.mn-lk-grade{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}'
      + '.mn-lk-grade a.mn-lk{flex-direction:column;text-align:center;gap:6px;padding:12px 4px 10px;border-radius:12px;}'
      + '.mn-lk-grade .mn-lk-logo{width:42px;height:42px;border-radius:12px;}'
      + '.mn-lk-grade .mn-lk-tx{align-items:center;gap:2px;width:100%;}'
      + '.mn-lk-grade .mn-lk-t{font-size:12px;line-height:1.25;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;}'
      + '.mn-lk-grade .mn-lk-d{font-size:10px;line-height:1.3;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;}'
      + '.mn-lk-vazio{font-size:12px;color:var(--txt3,#8fa);text-align:center;padding:18px 8px;line-height:1.5;}'
      + 'a.mn-lk-gerir{display:block;margin-top:8px;padding:8px;text-align:center;font-size:12px;font-weight:600;color:var(--accent,#38b6ff);text-decoration:none;border:1px dashed var(--glass-b,rgba(255,255,255,.2));border-radius:10px;}'
      + 'a.mn-lk-gerir:hover{background:rgba(56,182,255,.1);}'
      + '.mn-apps-dev{font-size:10px;color:var(--warn,#ffd166);padding:0 4px 8px;}'
      + '.mn-apps-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}'
      + '.mn-app{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:12px 6px 10px;border-radius:12px;text-decoration:none;color:var(--txt,#e8f4ff);border:1px solid transparent;cursor:pointer;}'
      + 'a.mn-app:hover,a.mn-app:focus-visible{background:rgba(56,182,255,.12);border-color:rgba(56,182,255,.35);outline:none;}'
      + '.mn-app-aqui{background:rgba(255,255,255,.05);border-color:var(--glass-b,rgba(255,255,255,.15));cursor:default;}'
      + '.mn-app-n{font-size:12.5px;font-weight:600;color:var(--txt,#e8f4ff);}'
      + '.mn-app-s{font-size:10px;color:var(--txt3,#8fa);}';
    (document.head || document.documentElement).appendChild(el);
  })();

  window.MareNotif = {start, items, unread, markOne, markAll, pushFeed, abrirFeed, abrirPagina, urlFeed, urlPessoal, ICONS, SO_PAINEL, PAGES, esc, viva, FEED, SEEN,
    appsMontar, appsUso, APPS, linksCacheSet, linksLista, linkUrlOk, linkImgOk, linkFavicon, rodapeHtml, rodapeRender, dndSet, dndAmanha, dndMenu, dndAtivo, menusFechar, somToggle, somMudo, tocar, novas, permEstado, permClick,
    // para os testes
    _estado: ()=>st};
})();
