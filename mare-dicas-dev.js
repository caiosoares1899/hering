/* ══════════════════════════════════════════════════════════════════════════
   mare-dicas-dev.js — MINI POPUPS DE DICAS (módulo compartilhado)
   Carregado por kanban-dev (Maré), okr-dev (Radar) e oceano-dev (Oceano); a versão de produção, mare-dicas.js, nasce na promoção.
   Fica na raiz do domínio, como mare-notif(-dev).js: exceção à regra "sem import entre páginas", mesmo ciclo dev→prod (?v=N nas páginas).

   O que faz: mostra UMA dica curta por vez, no canto da tela, quando a pessoa chega num lugar do app (gatilho). Cada dica aparece uma vez só.
   Cada app tem o PRÓPRIO catálogo (a página passa em init); Painel e A Bordo não usam.
   Controles da pessoa: "Entendi", "Saiba mais" (abre o tópico certo da ajuda do app), "Não mostrar dicas do <app>", e na ajuda de cada app
   (MareDicas.controle) o interruptor + "Rever dicas". Desligar vale por app: desligar no Radar não desliga no Maré.

   Dados: kanban/usuarios/{uid}/dicas = {off:{radar:true}, vistas:{radar:{idDaDica:true}}} (cada pessoa lê/escreve o próprio nó — sem mudar regra)
   + cópia em localStorage (chave por uid), que também é o único armazenamento do visualizador externo (não escreve no Firebase).

   Uso (cada página, depois do login):
     MareDicas.init({app:'radar', nome:'Radar', user, isViewer, abrirAjuda:topico=>…, dicas:[{id, gatilho, texto, saiba:'topico', quando:()=>true}]});
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
    S.app = String(o.app||''); S.nome = String(o.nome||''); S.user = o.user||null; S.viewer = !!o.isViewer;
    S.dicas = Array.isArray(o.dicas) ? o.dicas.filter(d=>d && d.id && d.gatilho && d.texto) : [];
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

  window.MareDicas = {init, gatilho, controle, definir, reiniciar, ativas:()=>ativas(), fechar:fecha,
    _estado:()=>({app:S.app, ativas:ativas(), atual:S.atual, mostradas:S.mostradas, vistas:Object.assign({}, S.prefs.vistas[S.app]||{}), prefs:S.prefs})};
})();
