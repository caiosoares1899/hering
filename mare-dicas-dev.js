/* ══════════════════════════════════════════════════════════════════════════
   mare-dicas-dev.js — MINI POPUPS DE DICAS (módulo compartilhado)
   Carregado por kanban-dev (Maré), okr-dev (Radar) e oceano-dev (Oceano); a versão de produção, mare-dicas.js, nasce na promoção.
   Fica na raiz do domínio, como mare-notif(-dev).js: exceção à regra "sem import entre páginas", mesmo ciclo dev→prod (?v=N nas páginas).

   O que faz: mostra UMA dica curta por vez, no canto da tela, quando a pessoa chega num lugar do app (gatilho). Cada dica aparece uma vez só.
   Cada app tem o PRÓPRIO catálogo, que vive AQUI no módulo (CATALOGO: dados puros — id, gatilho, texto, saiba, ajuda) pra o Painel poder listar tudo
   (⚙ Configurações → 💡 Dicas). A página só informa o que depende do estado dela: `quando` (id → função) e `abrirAjuda`. Painel e A Bordo não mostram dicas.
   Controles da pessoa: "Entendi", "Saiba mais" (abre o tópico certo da ajuda do app), "Não mostrar dicas do <app>", e na ajuda de cada app
   (MareDicas.controle) o interruptor + "Rever dicas". Desligar vale por app: desligar no Radar não desliga no Maré.

   Dados: kanban/usuarios/{uid}/dicas = {off:{radar:true}, vistas:{radar:{idDaDica:true}}} (cada pessoa lê/escreve o próprio nó — sem mudar regra)
   + cópia em localStorage (chave por uid), que também é o único armazenamento do visualizador externo (não escreve no Firebase).

   Dica nova = 1 linha no CATALOGO do app aqui + (se depender de estado da tela) 1 entrada em `quando` na página + o gatilho, se for lugar novo.
   Uso (cada página, depois do login):
     MareDicas.init({app:'radar', user, isViewer, abrirAjuda:topico=>…, quando:{idDaDica:()=>true}});
     MareDicas.gatilho('view:dashboard');          // onde a pessoa chegou; a dica só abre se houver uma não vista pra esse gatilho
     MareDicas.controle(elemento);                 // interruptor "💡 Dicas" + "Rever dicas" dentro da ajuda
   Depende só dos helpers que as páginas já expõem em window: _db _ref _get _set.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareDicas) return;

  const ATRASO_MS = 1400;        // espera depois do gatilho (a tela termina de montar, a pessoa vê onde chegou)
  const ESPERA_ENTRE_MS = 50000; // intervalo mínimo entre duas dicas
  const MAX_SESSAO = 4;          // no máximo por abertura da página
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ── CATÁLOGO: dados puros por app. `saiba` = o que a página entrega ao abrirAjuda (string ou {tab,q}); `ajuda` = nome do tópico, só pra listar (Painel).
  //    `gatilhos` = rótulo legível de cada lugar. Textos curtos e simples; cada dica aparece uma vez só.
  const CATALOGO = {
    radar:{nome:'Radar', icone:'🛰️', gatilhos:{boot:'Ao entrar', 'view:historico':'Ao abrir o Dashboard', 'view:calendario':'Ao abrir o Calendário', 'view:cards':'Ao abrir a aba Cards', 'obj-modal':'Ao abrir um Objetivo'}, dicas:[
      {id:'semaforo',    gatilho:'boot',            texto:'O status do Objetivo é automático: vem do pior Marco. Atualize os Marcos e o semáforo muda sozinho.', saiba:'marcos', ajuda:'Marcos e status'},
      {id:'atingimento', gatilho:'boot',            texto:'Dá pra medir cada Objetivo por uma meta (R$, %, número…). Abra o Objetivo e use 📈 Atingimento.', saiba:'atingimento', ajuda:'Atingimento — a meta do Objetivo'},
      {id:'agente',      gatilho:'boot',            texto:'Precisa registrar algo rápido? Converse com o 🤖 Agente Ágil, no canto da tela.', saiba:'agente', ajuda:'Central Agente Ágil'},
      {id:'menu',        gatilho:'boot',            texto:'Clique com o botão direito num Objetivo ou Marco pra ver ações rápidas.', saiba:'menu', ajuda:'Menu de ações (clique direito)'},
      {id:'apresentacao',gatilho:'boot',            texto:'Hora da reunião? Use 🎥 Apresentação (tela cheia). As setas ← → passam os slides.', saiba:'apresentacao', ajuda:'Apresentação em slides'},
      {id:'modal-atalhos',gatilho:'obj-modal',      texto:'Os atalhos no topo levam direto a cada seção do Objetivo.', saiba:'modal', ajuda:'O modal do Objetivo'},
      {id:'trava',       gatilho:'obj-modal',       texto:'Duas pessoas no mesmo Objetivo? Quem abriu primeiro edita; a outra vê em modo leitura.', saiba:'trava', ajuda:'Edição simultânea do mesmo Objetivo'},
      {id:'dash-filtro', gatilho:'view:historico',  texto:'Clique numa situação (Atrasado, No prazo…) pra filtrar a tabela logo abaixo.', saiba:'dashboard', ajuda:'Dashboard (histórico semanal)'},
      {id:'dash-contrib',gatilho:'view:historico',  texto:'Quer saber quem puxa a média pra baixo? Use 🧮 Como cada Objetivo contribui.', saiba:'dashboard', ajuda:'Dashboard (histórico semanal)'},
      {id:'cal-dia',     gatilho:'view:calendario', texto:'Clique num dia pra ver ou criar reuniões e eventos.', saiba:'calendario', ajuda:'Calendário'},
      {id:'cards-carregar',gatilho:'view:cards',    texto:'Os cards só são baixados quando você clica em Carregar cards. Assim a tela abre leve.'}]},
    mare:{nome:'Maré', icone:'🌊', gatilhos:{boot:'Ao entrar', 'card-open':'Ao abrir um card', 'cfg-open':'Ao abrir as Configurações'}, dicas:[
      {id:'busca',    gatilho:'boot',      texto:'Aperte Ctrl+K pra buscar qualquer card, de qualquer squad.', saiba:{tab:'board', q:'Busca global'}, ajuda:'Busca global (Ctrl+K)'},
      {id:'meudia',   gatilho:'boot',      texto:'Ctrl+D abre o Meu Dia: o que é seu hoje, num lugar só.', saiba:{tab:'board', q:'Meu Dia'}, ajuda:'Meu Dia (Ctrl+D)'},
      {id:'menu-card',gatilho:'boot',      texto:'Clique com o botão direito num card pra ações rápidas: mover, impedir, duplicar…', saiba:{tab:'cards', q:'Funções de card'}, ajuda:'Funções de card'},
      {id:'desfazer', gatilho:'boot',      texto:'Mexeu sem querer? Ctrl+Z desfaz a última mudança no board.', saiba:{tab:'board', q:'Desfazer'}, ajuda:'Desfazer (Ctrl+Z)'},
      {id:'meus',     gatilho:'boot',      texto:'Quer ver só o que é seu? Use o filtro Meus cards.', saiba:{tab:'board', q:'Meus cards'}, ajuda:'Meus cards'},
      {id:'oceano',   gatilho:'boot',      texto:'O botão ⋮⋮⋮ do topo leva ao Radar, ao Painel e à página Oceano.', saiba:{tab:'board', q:'Menu de produtos'}, ajuda:'Menu de produtos (⋮⋮⋮) e a página Oceano'},
      {id:'mencao',   gatilho:'card-open', texto:'Digite @ na descrição ou num comentário pra chamar alguém. A pessoa recebe um aviso.', saiba:{tab:'cards', q:'Menções'}, ajuda:'Menções'},
      {id:'checklist',gatilho:'card-open', texto:'No checklist, cole uma lista: cada linha vira um item.', saiba:{tab:'cards', q:'Checklist'}, ajuda:'Checklist'},
      {id:'travado',  gatilho:'card-open', texto:'Duas pessoas no mesmo card? Quem abre primeiro edita; a outra vê em modo leitura.', saiba:{tab:'cards', q:'Card travado'}, ajuda:'Card travado (duas pessoas no mesmo card)'},
      {id:'automacao',gatilho:'cfg-open',  texto:'Em Automações, regras do tipo "quando acontecer X, faça Y" trabalham por você.', saiba:{tab:'automacoes', q:'O que é uma automação'}, ajuda:'O que é uma automação'}]},
    oceano:{nome:'Oceano', icone:'🌐', gatilhos:{boot:'Ao entrar', sino:'Ao abrir o 🔔', perfil:'Ao abrir ⚙ Meu perfil'}, dicas:[
      {id:'instalar', gatilho:'boot',   texto:'Instale o Oceano como aplicativo: Maré, Radar e Painel abrem como abas dentro dele.', saiba:'instalar', ajuda:'Como instalo o Oceano como aplicativo?'},
      {id:'menu',     gatilho:'boot',   texto:'O botão ⋮⋮⋮ do topo leva a qualquer produto. Lá também ficam os links da Hering e os seus.', saiba:'links', ajuda:'Meus links e links da Hering'},
      {id:'aqui',     gatilho:'boot',   texto:'Prefere cada produto numa aba do navegador? Troque em ⚙ Meu perfil → Como abrir os produtos.', saiba:'aqui', ajuda:'Abrir aqui dentro x aba nova'},
      {id:'sino',     gatilho:'sino',   texto:'Este 🔔 é o mesmo do Maré e do Radar. Ative as notificações neste aparelho pra receber no celular.', saiba:'sino', ajuda:'O sininho 🔔 do topo'},
      {id:'peixes',   gatilho:'perfil', texto:'O fundo pesa no seu aparelho? Dá pra reduzir ou desligar os peixinhos aqui.', saiba:'peixes', ajuda:'Os peixinhos pesam? Como desligo?'},
      {id:'tema',     gatilho:'perfil', texto:'Abrolhos (escuro) ou Lençóis (claro): escolha o tema que cansa menos a vista.', saiba:'tema', ajuda:'Dá pra mudar as cores?'}]},
  };

  const S = {app:'', nome:'', user:null, viewer:false, dicas:[], abrirAjuda:null, prefs:{off:{}, vistas:{}}, pronto:false,
             atual:null, ultima:0, mostradas:0, timer:0, pendente:null, ouvintes:[]};

  // ── preferências: localStorage na hora, Firebase por cima (se a pessoa escreve lá) ──
  const lsKey = () => 'mare_dicas_'+((S.user&&S.user.uid)||'anon');
  function lsLer(){ try{ const o = JSON.parse(localStorage.getItem(lsKey())||'null'); return o && typeof o==='object' ? o : null; }catch(e){ return null; } }
  function lsGravar(){ try{ localStorage.setItem(lsKey(), JSON.stringify(S.prefs)); }catch(e){} }
  function norm(o){ o = (o && typeof o==='object') ? o : {}; return {off: (o.off&&typeof o.off==='object')?o.off:{}, vistas: (o.vistas&&typeof o.vistas==='object')?o.vistas:{}}; }
  function remoto(){ return !S.viewer && S.user && window._db && window._ref && window._set; }
  function gravar(caminho, valor){   // caminho relativo a .../dicas ; valor null apaga
    lsGravar();
    if(!remoto()) return;
    try{ Promise.resolve(window._set(window._ref(window._db,'kanban/usuarios/'+S.user.uid+'/dicas/'+caminho), valor)).catch(()=>{}); }catch(e){}
  }
  function avisa(){ S.ouvintes.forEach(f=>{ try{ f(); }catch(e){} }); }

  function ativas(){ return !S.prefs.off[S.app]; }
  function vista(id){ return !!(S.prefs.vistas[S.app] && S.prefs.vistas[S.app][id]); }

  // ── interface ──
  function css(){
    if(document.getElementById('mare-dicas-css')) return;
    const st = document.createElement('style'); st.id = 'mare-dicas-css';
    st.textContent = `
.mdica{position:fixed;left:16px;bottom:16px;z-index:9400;width:min(330px,calc(100vw - 32px));box-sizing:border-box;padding:12px 14px 10px;border-radius:14px;
  background:rgba(var(--deep-rgb,3,13,26),.98);border:1px solid var(--glass-b,rgba(56,182,255,.25));border-left:3px solid var(--teal,#1de9b6);
  box-shadow:0 12px 34px rgba(0,0,0,.4);color:var(--txt,#e8f4fd);font:13px/1.5 'DM Sans',system-ui,sans-serif;animation:mdicaIn .28s ease-out both;}
.mdica *{box-sizing:border-box;}
.mdica-h{display:flex;align-items:center;gap:7px;margin-bottom:4px;}
.mdica-h b{font-size:11.5px;letter-spacing:.02em;color:var(--teal,#1de9b6);font-weight:700;flex:1;}
.mdica-x{background:none;border:0;color:var(--txt2,rgba(200,230,255,.65));cursor:pointer;font-size:14px;line-height:1;padding:4px 6px;margin:-4px -6px -4px 0;border-radius:6px;}
.mdica-x:hover,.mdica-x:focus-visible{color:var(--txt,#fff);background:rgba(255,255,255,.08);outline:none;}
.mdica-t{margin:0 0 9px;font-size:13px;color:var(--txt,#e8f4fd);}
.mdica-f{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.mdica-b{font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--glass-b,rgba(56,182,255,.3));background:rgba(56,182,255,.14);color:var(--txt,#e8f4fd);}
.mdica-b:hover,.mdica-b:focus-visible{background:rgba(56,182,255,.28);outline:none;}
.mdica-b.pri{background:var(--teal,#1de9b6);border-color:transparent;color:#032;}
.mdica-b.pri:hover,.mdica-b.pri:focus-visible{filter:brightness(1.08);background:var(--teal,#1de9b6);}
.mdica-off{margin-left:auto;background:none;border:0;font:inherit;font-size:11px;color:var(--txt2,rgba(200,230,255,.65));cursor:pointer;text-decoration:underline;padding:4px 0;}
.mdica-off:hover,.mdica-off:focus-visible{color:var(--txt,#fff);outline:none;}
:root[data-theme="light"] .mdica{background:#fff;border-color:rgba(0,124,168,.3);border-left-color:#0aa7a0;box-shadow:0 12px 30px rgba(11,36,54,.22);}
:root[data-theme="light"] .mdica-h b{color:#007c78;}
:root[data-theme="light"] .mdica-b{background:rgba(0,119,173,.1);border-color:rgba(0,124,168,.35);}
:root[data-theme="light"] .mdica-ctl{background:rgba(255,255,255,.6);}
@keyframes mdicaIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.mdica{animation:none;}}
@media(max-width:700px){.mdica{left:12px;right:12px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom));}}
.mdica-ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;border:1px solid var(--glass-b,rgba(56,182,255,.25));background:rgba(var(--deep-rgb,3,13,26),.35);margin:10px 0;font-size:12.5px;color:var(--txt2,rgba(200,230,255,.8));}
.mdica-ctl b{color:var(--txt,#e8f4fd);}
.mdica-ctl .mdica-sw{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--txt,#e8f4fd);}
.mdica-ctl .mdica-sw input{width:34px;height:20px;appearance:none;-webkit-appearance:none;border-radius:999px;background:rgba(150,200,240,.3);position:relative;cursor:pointer;margin:0;transition:background .15s;flex:none;}
.mdica-ctl .mdica-sw input::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;}
.mdica-ctl .mdica-sw input:checked{background:var(--teal,#1de9b6);}
.mdica-ctl .mdica-sw input:checked::after{transform:translateX(14px);}
.mdica-ctl .mdica-sw input:focus-visible{outline:2px solid var(--accent,#38b6ff);outline-offset:2px;}
.mdica-ctl .mdica-re{margin-left:auto;}`;
    document.head.appendChild(st);
  }
  function fecha(){
    clearTimeout(S.timer); S.timer = 0; S.pendente = null;
    const el = document.getElementById('mare-dica'); if(el) el.remove();
    S.atual = null;
  }
  function mostra(d){
    css(); fecha();
    const el = document.createElement('div'); el.id = 'mare-dica'; el.className = 'mdica'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
    el.innerHTML = `<div class="mdica-h"><span aria-hidden="true">💡</span><b>Dica${S.nome?' do '+esc(S.nome):''}</b><button type="button" class="mdica-x" aria-label="Fechar dica">✕</button></div>
      <p class="mdica-t"></p>
      <div class="mdica-f">${d.saiba && S.abrirAjuda ? '<button type="button" class="mdica-b" data-a="mais">Saiba mais</button>' : ''}<button type="button" class="mdica-b pri" data-a="ok">Entendi</button>
        <button type="button" class="mdica-off" data-a="off">Não mostrar dicas${S.nome?' do '+esc(S.nome):''}</button></div>`;
    el.querySelector('.mdica-t').textContent = d.texto;   // texto puro: nunca HTML
    el.addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      if(b.classList.contains('mdica-x') || b.dataset.a==='ok') fecha();
      else if(b.dataset.a==='mais'){ fecha(); try{ S.abrirAjuda(d.saiba); }catch(err){ console.error('[MareDicas] saiba mais:', err); } }
      else if(b.dataset.a==='off'){ definir(false); const t = document.createElement('div'); t.className = 'mdica'; t.id = 'mare-dica'; t.setAttribute('role','status');
        t.innerHTML = '<p class="mdica-t" style="margin:0;">Pronto, dicas desligadas. Pra voltar: <b>Ajuda → 💡 Dicas</b>.</p>'; document.body.appendChild(t); setTimeout(()=>{ if(t.parentNode) t.remove(); }, 5000); }
    });
    document.body.appendChild(el);
    S.atual = d.id; S.ultima = Date.now(); S.mostradas++;
    // vista ao APARECER: ignorada ou fechada, não volta (dica não é cobrança)
    S.prefs.vistas[S.app] = S.prefs.vistas[S.app] || {}; S.prefs.vistas[S.app][d.id] = true; gravar('vistas/'+S.app+'/'+d.id, true);
  }

  // ── gatilhos ──
  // `quando` só vale na hora de MOSTRAR (a página costuma chamar o gatilho antes de a tela terminar de trocar)
  function proxima(g, checaQuando){
    return S.dicas.find(d=>d.gatilho===g && !vista(d.id) && (!checaQuando || typeof d.quando!=='function' || d.quando()!==false));
  }
  function gatilho(g){
    if(!S.app || !S.pronto || !ativas() || S.atual || S.mostradas>=MAX_SESSAO) return;
    if(S.ultima && Date.now()-S.ultima < ESPERA_ENTRE_MS) return;
    if(!proxima(g) || S.timer) return;
    S.pendente = g;
    S.timer = setTimeout(function tenta(){
      S.timer = 0; const gg = S.pendente; S.pendente = null;
      if(!gg || !ativas() || S.atual) return;
      if(document.hidden){ S.pendente = gg; S.timer = setTimeout(tenta, 4000); return; }   // aba em segundo plano: espera voltar
      const d = proxima(gg, true); if(d) mostra(d);   // confere "quando" agora: a pessoa pode ter saído do lugar
    }, ATRASO_MS);
  }

  // ── ligar/desligar por app ──
  function definir(ligado){
    if(ligado) delete S.prefs.off[S.app]; else S.prefs.off[S.app] = true;
    gravar('off/'+S.app, ligado ? null : true);
    if(!ligado) fecha();
    avisa();
  }
  function reiniciar(){
    S.prefs.vistas[S.app] = {}; gravar('vistas/'+S.app, null); S.mostradas = 0; S.ultima = 0; avisa();
  }
  function controle(el){
    if(!el) return;
    css();
    const desenha = ()=>{
      el.className = (el.className||'').replace(/\bmdica-ctl\b/,'').trim()+' mdica-ctl';
      el.innerHTML = `<label class="mdica-sw"><input type="checkbox" role="switch" ${ativas()?'checked':''} aria-label="Mostrar dicas${S.nome?' do '+esc(S.nome):''}"><span>💡 Dicas${S.nome?' do '+esc(S.nome):''}</span></label>
        <span>Mini avisos com um truque ou um lugar útil, um de cada vez.</span><button type="button" class="mdica-b mdica-re">Rever dicas</button>`;
      el.querySelector('input').addEventListener('change', e=>{ definir(e.target.checked); });
      el.querySelector('.mdica-re').addEventListener('click', ()=>{ reiniciar(); if(!ativas()) definir(true); });
    };
    desenha(); S.ouvintes.push(()=>{ if(el.isConnected) desenha(); });
  }

  // ── início ──
  function init(o){
    o = o||{};
    S.app = String(o.app||''); S.user = o.user||null; S.viewer = !!o.isViewer;
    const cat = CATALOGO[S.app]; S.nome = String(o.nome || (cat && cat.nome) || '');
    const quando = (o.quando && typeof o.quando==='object') ? o.quando : {};
    const base = Array.isArray(o.dicas) ? o.dicas : (cat ? cat.dicas : []);   // `dicas` na chamada = só pra teste
    S.dicas = base.filter(d=>d && d.id && d.gatilho && d.texto).map(d=>Object.assign({}, d, typeof quando[d.id]==='function' ? {quando:quando[d.id]} : {}));
    S.abrirAjuda = typeof o.abrirAjuda==='function' ? o.abrirAjuda : null;
    S.prefs = norm(lsLer()); S.pronto = true; avisa();   // já dá pra mostrar com o que está no aparelho
    if(remoto()){
      Promise.resolve(window._get(window._ref(window._db,'kanban/usuarios/'+S.user.uid+'/dicas'))).then(sn=>{
        const r = norm(sn && sn.exists && sn.exists() ? sn.val() : null), l = S.prefs;
        // junta: o que foi visto em qualquer aparelho conta; "desligado" no Firebase vale (quem religou apagou o nó)
        const vistas = {}; [r.vistas, l.vistas].forEach(v=>Object.keys(v).forEach(a=>{ vistas[a] = Object.assign(vistas[a]||{}, v[a]); }));
        S.prefs = {off:r.off, vistas}; lsGravar(); avisa();
        if(!ativas()) fecha();
      }).catch(()=>{});
    }
  }

  // Painel: lista tudo e mostra o que ESTA pessoa já viu (lê só o próprio nó)
  const catalogo = () => JSON.parse(JSON.stringify(CATALOGO));
  async function minhasPrefs(user){
    let p = norm(null);
    try{ const o = JSON.parse(localStorage.getItem('mare_dicas_'+((user&&user.uid)||'anon'))||'null'); if(o) p = norm(o); }catch(e){}
    try{ if(user && window._db && window._get){ const sn = await window._get(window._ref(window._db,'kanban/usuarios/'+user.uid+'/dicas')); if(sn && sn.exists()) p = norm(sn.val()); } }catch(e){}
    return p;
  }

  window.MareDicas = {init, gatilho, controle, catalogo, minhasPrefs, definir, reiniciar, ativas:()=>ativas(), fechar:fecha,
    _estado:()=>({app:S.app, ativas:ativas(), atual:S.atual, mostradas:S.mostradas, vistas:Object.assign({}, S.prefs.vistas[S.app]||{}), prefs:S.prefs})};
})();
