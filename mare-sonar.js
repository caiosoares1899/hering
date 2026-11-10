/* ══════════════════════════════════════════════════════════════════════════
   mare-sonar.js — 🔍 SONAR, a busca do Oceano (módulo compartilhado, 10/11/2026)
   Carregado por oceano-dev (lobby) e kanban-dev (Maré); a versão de produção, mare-sonar.js, nasce na promoção.
   Fica na raiz do domínio, como mare-notif(-dev).js: mesmo ciclo dev→prod (?v=N nas páginas; bump em todas ao mudar o módulo).

   Um layout e um comportamento para todas as páginas; o que muda é o FOCO: cada página entrega as próprias fontes
   (o Maré põe os cards do board em primeiro; o lobby, os produtos). O módulo traz pronto:
     - a janela (título "Sonar" com o disco que varre só enquanto procura), abas de escopo, teclado, recentes;
     - a busca sem acento, com 1 erro de digitação, todas as palavras precisando casar;
     - a fonte do Radar (Objetivos e Marcos): 1 leitura de kanban/okr/objetivos + marcos (~393 KB em prod) só quando a busca pede o Radar,
       guardando a versão enxuta (id, título, período, responsáveis) no aparelho por 3 h em oceano_sonar_radar[_dev] (compartilhada entre as páginas).
   Texto vindo do banco sempre por esc(); URL de link só http(s) (linkOk); endereço de página só da família (paginaOk).

   Uso (cada página, depois do login):
     MareSonar.iniciar({
       dev, pagina:'oceano'|'mare', user:()=>user,
       escopos:[{id:'tudo',l:'Tudo'},{id:'mare',l:'Maré'},…],   // o 1º é "Tudo"; as teclas 1..n trocam com a caixa vazia
       prefixos:{m:'mare', r:'radar'},                          // "m: banner"
       fontes:(q, toks, ctx)=>[{g:'Grupo', esc:'mare', itens:[{k, ic, t, sub, tipo, busca, go, url, app, sempre, toks}]}],   // da página, ANTES do Radar
       depois:(q, toks, ctx)=>[…],                              // da página, DEPOIS do Radar
       radar:{esc:'radar', url:id=>'okr-dev.html?okr='+id, abrir:(url)=>…},   // ou false
       vazio:'…' (HTML fixo da página, nunca dado), inicio:'…' (caixa vazia sem nada para mostrar), placeholder:'…', recentesChave:'…', deRecente:r=>item|null, aoAbrir:()=>{}, atalho:true (Ctrl/⌘+K global)
     });
     MareSonar.abrir({esc, q}) · MareSonar.fechar() · MareSonar.aberto()
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareSonar) return;

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const linkOk = u => { u = String(u||'').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) && u.length<=600 ? u : ''; };
  const paginaOk = u => /^(kanban|okr|painel|oceano)(-dev)?\.html(\?[^#\s"'<>]*)?$|^onboarding\.html$/.test(String(u||''));
  const norm = x => String(x==null?'':x).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const MAC = /Mac|iPhone|iPad/i.test(navigator.platform||navigator.userAgent||'');
  const TTL_RADAR = 3*3600*1000, MAX_REC = 5, LIMITE = 30, CACHE_RADAR_V = 2;   // v2 (10/11/2026): Marco guarda o responsável (r), para "meus" valer como no Radar
  // "meus/minhas …": ativa o filtro de responsável e sai dos termos (as quatro formas, sempre juntas)
  const MEUS = new Set(['meu','meus','minha','minhas']);
  const separaMeus = toks => ({meus: toks.some(k=>MEUS.has(k)), toks: toks.filter(k=>!MEUS.has(k))});

  function umaLetra(a,b){   // distância de edição ≤ 1
    if(Math.abs(a.length-b.length)>1) return false;
    let i=0, j=0, d=0;
    while(i<a.length && j<b.length){ if(a[i]===b[j]){ i++; j++; continue; } if(++d>1) return false; if(a.length>b.length) i++; else if(b.length>a.length) j++; else { i++; j++; } }
    return d + (a.length-i) + (b.length-j) <= 1;
  }
  // Todas as palavras precisam casar; 0 = fora.
  function pontua(texto, toks){
    if(!toks.length) return 1;
    toks = toks.flatMap(k=>norm(k).split(/[^a-z0-9]+/)).filter(Boolean);   // termo com pontuação ("conversão?", "a/b") vira as mesmas palavras do texto
    if(!toks.length) return 0;                                              // busca só de símbolos ("???") não acha nada
    const t = norm(texto), pal = t.split(/[^a-z0-9]+/).filter(Boolean); let p = 0;
    for(const k of toks){
      if(pal.includes(k)) p += 4;
      else if(pal.some(w=>w.startsWith(k))) p += 3;
      else if(t.includes(k)) p += 2;
      else if(k.length>=4 && !/\d/.test(k) && pal.some(w=>umaLetra(w,k) || umaLetra(w.slice(0,k.length),k))) p += 1;   // código com número (T426, S127) não aceita erro: T426 ≠ T126
      else return 0;
    }
    return p + (t.startsWith(toks.join(' ')) ? 2 : 0);
  }

  const st = {opts:null, esc:'tudo', sel:0, selK:null, limite:30, total:0, mostrados:0, itens:[], gatilho:null, montado:false, radarT:0,
              radar:null, carregando:false, erro:false, tScan:null, tStatus:null};
  const $ = id => document.getElementById(id);

  // ── Radar (fonte própria do módulo) ──
  const radarChave = () => 'oceano_sonar_radar'+(st.opts && st.opts.dev ? '_dev' : '');
  function radarDoCache(){
    try{ const c = JSON.parse(localStorage.getItem(radarChave())||'null');
      if(!c || c.s!==CACHE_RADAR_V || typeof c.t!=='number' || Date.now()-c.t > TTL_RADAR || !c.v || typeof c.v.objs!=='object' || !Array.isArray(c.v.marcos)) return null;   // versão antiga (sem o responsável do Marco) é descartada
      const objs = {};
      Object.values(c.v.objs).forEach(o=>{ if(o && typeof o.id==='string' && typeof o.t==='string') objs[o.id] = {id:o.id, t:o.t.slice(0,200), per:(Array.isArray(o.per)?o.per:[]).map(x=>String(x).slice(0,20)).slice(0,6), resp:(Array.isArray(o.resp)?o.resp:[]).map(String).slice(0,30)}; });
      return {t:c.t, v:{objs, marcos:c.v.marcos.filter(m=>m && typeof m.id==='string' && typeof m.t==='string' && objs[m.obj]).map(m=>({id:m.id, t:m.t.slice(0,200), obj:m.obj, r:typeof m.r==='string' ? m.r.slice(0,64) : ''}))}};
    }catch(e){ return null; }
  }
  // A cópia em memória também vence em 3 h (a aba pode ficar aberta o dia todo): vencida, some e é lida de novo na próxima busca que pedir o Radar.
  function radarValido(){ if(st.radar && Date.now()-st.radarT > TTL_RADAR){ st.radar = null; } return !!st.radar; }
  // "Atualizar o Radar": descarta a cópia (memória e aparelho) e lê agora. Só por pedido explícito — nada de leitura periódica.
  function radarAtualizar(){ st.radar = null; st.erro = false; try{ localStorage.removeItem(radarChave()); }catch(e){} radarCarregar(); render(); }
  async function radarCarregar(){
    const u = st.opts && st.opts.user && st.opts.user();
    if((st.opts.radar && st.opts.radar.dados) || radarValido() || st.carregando || st.erro || !u || !window._get || !window._ref || !window._db) return;   // dados já na página (Radar): nunca lê
    const c = radarDoCache(); if(c){ st.radar = c.v; st.radarT = c.t; return; }
    st.carregando = true; scan(true);
    try{
      const [so, sm] = await Promise.all(['objetivos','marcos'].map(n=>window._get(window._ref(window._db,'kanban/okr/'+n))));
      const soH = window.MARE_SO_HERING !== false;
      const vis = o => o && !o.arquivado && (!soH || !o.torre || o.torre==='digital' || !['digital','comercial','corporativa'].includes(o.torre));   // mesma régua do _okrSoAtivo() do Radar
      const objs = {};
      Object.entries((so && so.val()) || {}).forEach(([id,o])=>{ if(!vis(o)) return;
        const per = Array.isArray(o.trimestres) && o.trimestres.length ? o.trimestres : (o.trimestre ? [o.trimestre] : []);
        objs[id] = {id, t:String(o.titulo||'Objetivo sem título').slice(0,200), per:per.slice(0,6).map(x=>String(x).slice(0,20)), resp:Array.isArray(o.responsaveis) ? o.responsaveis.slice(0,30).map(String) : []}; });
      const marcos = [];
      Object.entries((sm && sm.val()) || {}).forEach(([id,m])=>{ if(m && !m.arquivado && objs[m.objetivoId]) marcos.push({id, t:String(m.nome||'Marco').slice(0,200), obj:m.objetivoId, r:typeof m.responsavel==='string' ? m.responsavel.slice(0,64) : ''}); });
      st.radar = {objs, marcos}; st.radarT = Date.now();
      try{ localStorage.setItem(radarChave(), JSON.stringify({s:CACHE_RADAR_V, t:st.radarT, v:st.radar})); }catch(e){}
    }catch(e){ st.erro = true; console.warn('[sonar] Radar', e); }
    st.carregando = false;
    if(aberto()) render();
    scan(false);   // o disco para quando a leitura termina (antes ficava girando se o Radar demorava mais que ~0,5 s — achado do Antigravity)
  }
  function fonteRadar(q, toks){
    const r = st.opts.radar; if(!r) return [];
    const okr = r.icone || '🎯';
    const at = (r.atalhos || []).map(a=>Object.assign({tipo:'atalho', ic:okr}, a));
    const g = [{g:'Radar', esc:r.esc||'radar', itens:at, noVazio:true}];
    // radar.dados(): a página já tem Objetivos e Marcos em memória (o próprio Radar) — usa direto, sem cópia nem leitura
    if(r.dados){ const d = r.dados(); st.radar = (d && d.objs && Array.isArray(d.marcos)) ? d : {objs:{}, marcos:[]}; st.radarT = Date.now(); }
    else if(!radarValido()) return g;
    const min = Math.max(0, Math.round((Date.now()-st.radarT)/60000));
    if(!r.dados) g.push({g:'Dados do Radar', esc:r.esc||'radar', itens:[{k:'acao:radar-atualizar', ic:'↻', t:'Atualizar o Radar', sub:'Cópia de '+(min<1 ? 'agora há pouco' : 'há '+min+' min')+' neste aparelho · busca de novo no banco', tipo:'acao', busca:'atualizar recarregar dados radar objetivos marcos', manter:true, go:radarAtualizar}]});
    const u = st.opts.user && st.opts.user(), uid = u && u.uid;
    const {meus, toks:tk} = separaMeus(toks);
    // "meus" = a mesma régua do filtro de pessoa do Radar (_okrObjTemPessoa): responsável pelo Objetivo OU por algum Marco dele
    const meuMarco = new Set(st.radar.marcos.filter(m=>uid && m.r===uid).map(m=>m.obj));
    const objs = Object.values(st.radar.objs).filter(o=>!meus || o.resp.includes(uid) || meuMarco.has(o.id));
    const abre = id => { const url = r.url(id); return {url, go: r.ir ? ()=>r.ir(id) : ()=>r.abrir(url)}; };
    g.push({g:'Objetivos', esc:r.esc||'radar', itens:objs.map(o=>Object.assign({k:'obj:'+o.id, ic:'🎯', t:o.t, sub:'Objetivo'+(o.per.length?' · '+o.per.join(', '):''), tipo:'objetivo', busca:o.t+' '+o.per.join(' '), toks:tk, app:'okr'}, abre(o.id)))});
    const ids = new Set(objs.map(o=>o.id));
    g.push({g:'Marcos', esc:r.escMarcos||r.esc||'radar', itens:st.radar.marcos.filter(m=>ids.has(m.obj) && (!meus || m.r===uid || st.radar.objs[m.obj].resp.includes(uid))).map(m=>Object.assign({k:'marco:'+m.id, ic:'🏁', t:m.t, sub:'Marco de “'+st.radar.objs[m.obj].t+'”', tipo:'marco', busca:m.t, toks:tk, app:'okr'}, abre(m.obj)))});
    return g;
  }

  // ── Recentes (por página) ──
  const recChave = () => (st.opts.recentesChave || ('mare_sonar_recentes_'+st.opts.pagina)) + (st.opts.dev ? '_dev' : '');
  function recentes(){ try{ const r = JSON.parse(localStorage.getItem(recChave())||'[]'); return Array.isArray(r) ? r.slice(0,MAX_REC) : []; }catch(e){ return []; } }
  function lembrar(it){
    const r = it.rec ? Object.assign({k:it.k, t:it.t, sub:it.sub, tipo:it.tipo}, it.rec) : (it.url ? {k:it.k, t:it.t, sub:it.sub, tipo:it.tipo, app:it.app||'', url:it.url, link:!!it.link} : null);
    if(!r || !r.k) return;
    try{ localStorage.setItem(recChave(), JSON.stringify([r, ...recentes().filter(x=>x.k!==r.k)].slice(0,MAX_REC))); }catch(e){}
  }
  function doRecente(r){
    if(!r || typeof r!=='object' || !r.k || !r.t) return null;
    const base = {k:String(r.k), t:String(r.t).slice(0,200), sub:String(r.sub||'').slice(0,200), tipo:String(r.tipo||''), ic:'🕘'};
    if(st.opts.deRecente){ const it = st.opts.deRecente(r, base); if(it) return it; }
    if(r.link && linkOk(r.url)) return Object.assign(base, {ic:'🔗', link:true, url:linkOk(r.url), go:()=>window.open(linkOk(r.url), '_blank', 'noopener,noreferrer')});
    if(r.app && paginaOk(r.url) && st.opts.abrirApp) return Object.assign(base, {app:r.app, url:r.url, go:()=>st.opts.abrirApp(r.app, r.url)});
    return null;
  }

  // ── Janela ──
  const CSS = `
#msn-ov{position:fixed;inset:0;z-index:9600;background:rgba(1,8,16,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:flex-start;justify-content:center;padding:6vh 14px;}
#msn-ov.open{display:flex;}
.msn-box{width:min(640px,100%);display:flex;flex-direction:column;max-height:88vh;border-radius:16px;overflow:hidden;border:1px solid var(--glass-b,rgba(56,182,255,.22));background:rgba(var(--deep-rgb,3,13,26),.96);box-shadow:0 18px 60px rgba(0,0,0,.45);color:var(--txt,#e8f4fd);font-family:'DM Sans',system-ui,sans-serif;}
[data-theme="light"] .msn-box{background:rgba(248,253,255,.98);}
.msn-hd{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--glass-b,rgba(56,182,255,.22));}
.msn-disc{width:36px;height:36px;flex:none;border-radius:50%;position:relative;overflow:hidden;border:1.5px solid rgba(56,182,255,.6);background:radial-gradient(circle,transparent 0 29%,rgba(56,182,255,.28) 30% 33%,transparent 34% 61%,rgba(56,182,255,.28) 62% 65%,transparent 66%);}
[data-theme="light"] .msn-disc{border-color:rgba(0,119,173,.6);background:radial-gradient(circle,transparent 0 29%,rgba(0,119,173,.25) 30% 33%,transparent 34% 61%,rgba(0,119,173,.25) 62% 65%,transparent 66%);}
.msn-disc i{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(56,182,255,0) 0deg,rgba(56,182,255,0) 285deg,rgba(56,182,255,.6) 360deg);opacity:.35;}
.msn-disc b{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;background:var(--accent,#38b6ff);}
.msn-box.scan .msn-disc i{opacity:1;animation:msn-sweep 1.1s linear infinite;}
@keyframes msn-sweep{to{transform:rotate(360deg);}}
html[data-anim-paused] .msn-box.scan .msn-disc i{animation-play-state:paused;}
.msn-col{flex:1;min-width:0;display:flex;flex-direction:column;}
.msn-ttl{display:flex;align-items:baseline;gap:8px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--teal,#1de9b6);font-weight:700;}
[data-theme="light"] .msn-ttl{color:#0a7f78;}
.msn-ttl b{font-family:'Syne','DM Sans',sans-serif;font-weight:800;letter-spacing:.14em;}
.msn-st{letter-spacing:.02em;text-transform:none;font-weight:500;color:var(--txt3,rgba(150,200,240,.6));}
.msn-in{width:100%;font:inherit;font-size:16px;background:transparent;border:none;outline:none;color:var(--txt,#e8f4fd);padding:3px 0 1px;}
.msn-in::placeholder{color:var(--txt3,rgba(150,200,240,.6));}
.msn-x{background:none;border:none;color:var(--txt3,rgba(150,200,240,.6));width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:16px;flex:none;}
.msn-x:hover{background:rgba(255,255,255,.08);color:var(--txt,#e8f4fd);}
.msn-esc{display:flex;gap:6px;padding:8px 14px;border-bottom:1px solid var(--glass-b,rgba(56,182,255,.22));overflow-x:auto;scrollbar-width:none;}
.msn-esc button{font:inherit;font-size:12px;font-weight:600;padding:5px 11px;min-height:32px;border-radius:999px;border:1px solid var(--glass-b,rgba(56,182,255,.22));background:var(--glass,rgba(10,37,64,.45));color:var(--txt2,rgba(200,230,255,.75));cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;}
.msn-esc button[aria-selected="true"]{border-color:var(--accent,#38b6ff);color:var(--txt,#e8f4fd);background:rgba(56,182,255,.16);}
[data-theme="light"] .msn-esc button[aria-selected="true"]{background:rgba(0,119,173,.12);}
.msn-k{display:inline-block;border:1px solid var(--glass-b,rgba(56,182,255,.22));border-radius:5px;padding:0 5px;font-size:10.5px;font-weight:600;color:var(--txt2,rgba(200,230,255,.75));}
.msn-lista{overflow:auto;padding:6px;flex:1;min-height:0;}
/* cabeçalho, abas e rodapé nunca encolhem (a faixa das abas tem overflow, então o flex podia espremê-la e cortar os botões em janela baixa): só a lista rola */
.msn-hd,.msn-esc,.msn-pe{flex:none;}
.msn-g{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3,rgba(150,200,240,.6));padding:10px 10px 4px;}
.msn-it{display:flex;align-items:center;gap:12px;padding:7px 10px;border-radius:12px;cursor:pointer;min-height:48px;}
.msn-it[aria-selected="true"]{background:rgba(56,182,255,.14);box-shadow:inset 0 0 0 1px rgba(56,182,255,.45);}
[data-theme="light"] .msn-it[aria-selected="true"]{background:rgba(0,119,173,.10);box-shadow:inset 0 0 0 1px rgba(0,119,173,.45);}
.msn-ic{width:32px;height:32px;flex:none;display:grid;place-items:center;font-size:16px;line-height:1;border-radius:9px;overflow:hidden;background:rgba(56,182,255,.08);border:1px solid var(--glass-b,rgba(56,182,255,.22));}
[data-theme="light"] .msn-ic{background:rgba(0,119,173,.06);}
/* logo de produto (a página manda o "quadradinho" dela, que tem outro tamanho): ocupa a caixa inteira, sem sombra */
.msn-ic.dotc{background:none;border:none;}
/* a logo fica com respiro dentro da moldura (26 px em 32): os emblemas redondos encostam na borda da imagem e pareciam cortados sem folga */
.msn-ic.logo > *{width:26px !important;height:26px !important;border-radius:6px !important;box-shadow:none !important;margin:0 !important;overflow:hidden;display:block;}
.msn-ic.logo img,.msn-ic.logo svg{width:100%;height:100%;display:block;object-fit:cover;}
.msn-ic .dot{display:block;width:10px;height:10px;border-radius:50%;}
.msn-tx{flex:1;min-width:0;display:flex;flex-direction:column;}
.msn-t{font-size:13.5px;font-weight:600;color:var(--txt,#e8f4fd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.msn-s{font-size:11.5px;color:var(--txt3,rgba(150,200,240,.6));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.msn-tp{font-size:10.5px;color:var(--txt3,rgba(150,200,240,.6));flex:none;}
.msn-vazio{padding:18px 12px;font-size:13px;color:var(--txt2,rgba(200,230,255,.75));line-height:1.55;}
.msn-vazio button{font:inherit;font-size:12px;margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid var(--glass-b,rgba(56,182,255,.22));background:var(--glass,rgba(10,37,64,.45));color:var(--txt,#e8f4fd);cursor:pointer;}
.msn-pe{padding:8px 14px;border-top:1px solid var(--glass-b,rgba(56,182,255,.22));font-size:11px;color:var(--txt3,rgba(150,200,240,.6));}
.msn-esc button:focus-visible,.msn-x:focus-visible{outline:2px solid var(--accent,#38b6ff);outline-offset:2px;}
@media (max-width:560px){ #msn-ov{padding:0;} .msn-box{width:100%;max-height:none;min-height:100%;border-radius:0;} .msn-pe{display:none;} }
@media (prefers-reduced-motion:reduce){ .msn-box.scan .msn-disc i{animation:none;} }`;
  function montar(){
    if(st.montado) return; st.montado = true;
    const s = document.createElement('style'); s.id = 'msn-css'; s.textContent = CSS; document.head.appendChild(s);
    const ov = document.createElement('div'); ov.id = 'msn-ov';
    ov.innerHTML = '<div class="msn-box" role="dialog" aria-modal="true" aria-labelledby="msn-ttl-b">'
      + '<div class="msn-hd"><span class="msn-disc" aria-hidden="true"><i></i><b></b></span>'
      + '<div class="msn-col"><div class="msn-ttl"><b id="msn-ttl-b">Sonar</b><span class="msn-st" id="msn-st" aria-live="polite"></span></div>'
      + '<input id="msn-in" class="msn-in" type="text" role="combobox" aria-expanded="true" aria-controls="msn-lista" aria-autocomplete="list" autocomplete="off" spellcheck="false" maxlength="120" aria-label="O que você procura?"></div>'
      + '<button class="msn-x" type="button" id="msn-x" aria-label="Fechar">✕</button></div>'
      + '<div class="msn-esc" id="msn-esc" role="tablist" aria-label="Onde buscar"></div>'
      + '<div class="msn-lista" id="msn-lista" role="listbox" aria-label="Resultados"></div>'
      + '<div class="msn-pe" id="msn-pe"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e=>{ if(e.target===ov) fechar(); });
    $('msn-x').addEventListener('click', ()=>fechar());
    const inp = $('msn-in');
    // Prefixo ("r: meta") vira a ABA: o escopo passa a ser o da aba (destacada como chip) e o texto fica só com a busca.
    // Assim não existe "prefixo diz Radar, aba diz Maré": quem manda é sempre a aba, e trocar de aba troca o escopo.
    inp.addEventListener('input', ()=>{
      const m = inp.value.match(/^([a-z]):\s*/i), alvo = m && st.opts.prefixos && st.opts.prefixos[m[1].toLowerCase()];
      if(alvo && st.opts.escopos.some(e=>e.id===alvo)){ st.esc = alvo; inp.value = inp.value.slice(m[0].length); }
      novaBusca(); scan(true); render(); });
    // Teclas da janela: tratadas aqui e paradas, para os atalhos globais da página (Tab entre cards, Enter abre card, Esc fecha modais…) não reagirem.
    inp.addEventListener('keydown', e=>{
      const k = e.key; let usou = true;
      if(k==='ArrowDown') marca(st.sel+1);
      else if(k==='ArrowUp') marca(st.sel-1);
      else if(k==='Enter') abrirItem(st.sel, e.ctrlKey||e.metaKey);
      else if(k==='Tab'){ const es = st.opts.escopos, i = es.findIndex(x=>x.id===st.esc); st.esc = es[(i + (e.shiftKey?-1:1) + es.length) % es.length].id; novaBusca(); render(); }
      else if(k==='Escape') fechar();
      else if(/^[1-9]$/.test(k) && !inp.value && !e.ctrlKey && !e.metaKey && !e.altKey && st.opts.escopos[Number(k)]){ st.esc = st.opts.escopos[Number(k)].id; novaBusca(); render(); }
      else usou = false;
      if(usou){ e.preventDefault(); e.stopPropagation(); }
    });
    $('msn-esc').addEventListener('click', e=>{ const b = e.target.closest('[data-esc]'); if(!b) return; st.esc = b.dataset.esc; novaBusca(); render(); inp.focus(); });
    $('msn-lista').addEventListener('click', e=>{
      if(e.target.closest('[data-retry]')){ st.erro = false; render(); inp.focus(); return; }
      const it = e.target.closest('[data-i]'); if(it) abrirItem(Number(it.dataset.i), e.ctrlKey||e.metaKey);
    });
    $('msn-lista').addEventListener('mousemove', e=>{ const it = e.target.closest('[data-i]'); if(it && Number(it.dataset.i)!==st.sel) marca(Number(it.dataset.i)); });
    // Esc em qualquer foco dentro da janela (ex.: no ✕): antes dos atalhos da página
    window.addEventListener('keydown', e=>{ if(e.key==='Escape' && aberto()){ e.preventDefault(); e.stopImmediatePropagation(); fechar(); } }, true);
  }
  // O disco varre enquanto procura: ao digitar (até ~0,5 s depois da última tecla) e enquanto o Radar carrega. Parado = sem animação.
  function scan(on){
    const box = document.querySelector('#msn-ov .msn-box'); if(!box) return;
    clearTimeout(st.tScan);
    if(on){ box.classList.add('scan'); st.scanAte = Date.now() + 550; }   // cada tecla garante ~0,5 s de varredura
    const para = ()=>{ if(st.carregando){ st.tScan = setTimeout(para, 200); return; } box.classList.remove('scan'); };   // com o Radar carregando, segue até a leitura terminar
    st.tScan = setTimeout(para, Math.max(0, (st.scanAte||0) - Date.now()));
    status();
  }
  // Texto ao lado do título: anunciado sem pressa (não a cada tecla).
  function status(){
    clearTimeout(st.tStatus);
    const el = $('msn-st'); if(!el) return;
    const q = ($('msn-in').value||'').trim();
    if(!q){ el.textContent = st.opts.subtitulo || 'busca em todo o Oceano'; return; }
    el.textContent = 'escaneando…';
    st.tStatus = setTimeout(()=>{ if(st.carregando){ status(); return; } const n = st.total;
      el.textContent = !n ? 'nada por aqui' : st.mostrados < n ? 'mostrando '+st.mostrados+' de '+n : (n===1 ? '1 resultado' : n+' resultados'); }, 600);
  }
  function grupos(){
    const o = st.opts, inp = $('msn-in');
    const q = inp.value.trim(), esc0 = st.esc;
    const toks = norm(q).split(/[^a-z0-9]+/).filter(Boolean);   // mesma régua do texto indexado: "conversao?", "a/b", "(okr)" casam (achado do Antigravity)
    const precisaRadar = !!o.radar && (esc0===(o.radar.esc||'radar') || (esc0==='tudo' && q.length>=2));
    if(precisaRadar && !st.radar && !st.carregando && !st.erro) radarCarregar();
    const ctx = {esc:esc0, vazio:!q};
    let gs = [].concat((o.fontes ? o.fontes(q, toks, ctx) : []) || [], fonteRadar(q, toks), (o.depois ? o.depois(q, toks, ctx) : []) || []);
    gs = gs.filter(g=>g && Array.isArray(g.itens) && (esc0==='tudo' || g.esc===esc0));
    if(!q){
      const rec = esc0==='tudo' ? recentes().map(doRecente).filter(Boolean) : [];
      gs = gs.filter(g=>esc0!=='tudo' || g.noVazio).map(g=>({g:g.g, itens:g.itens.slice(0, esc0==='tudo'?6:12)})).filter(g=>g.itens.length);
      if(rec.length) gs.unshift({g:'Recentes', itens:rec});
      st.total = st.mostrados = gs.reduce((n,g)=>n+g.itens.length, 0);
    } else {
      let total = 0, mostrados = 0;
      gs = gs.map(g=>{
        const its = g.itens.map(it=>({it, p: it.sempre ? 1 : pontua(it.t+' '+(it.busca||''), it.toks||toks)})).filter(y=>y.p>0).sort((a,b)=>b.p-a.p).map(y=>y.it);
        const lim = esc0==='tudo' ? (g.max || 5) : st.limite, vis = its.slice(0, lim);
        const conta = its.filter(it=>it.tipo!=='acao').length; total += conta; mostrados += vis.filter(it=>it.tipo!=='acao').length;
        // Mais resultados do que cabem: diz quantos (nunca finge que é o total) e oferece o caminho para ver o resto.
        if(its.length > lim){
          const aba = o.escopos.find(e=>e.id===g.esc);
          if(esc0==='tudo' && aba && aba.id!=='tudo') vis.push({k:'mais:'+g.g, ic:'⋯', t:'Ver os '+its.length+' de '+g.g, sub:'Exibindo '+lim+' de '+its.length+' · abre a aba '+aba.l, tipo:'acao', manter:true, go:()=>{ st.esc = aba.id; novaBusca(); render(); }});
          else if(esc0!=='tudo') vis.push({k:'mais:'+g.g, ic:'⋯', t:'Mostrar mais', sub:'Exibindo '+lim+' de '+its.length+' em '+g.g, tipo:'acao', manter:true, go:()=>{ st.limite += LIMITE; render(); }});
          else vis.push({k:'mais:'+g.g, ic:'⋯', t:'Exibindo '+lim+' de '+its.length, sub:'Refine a busca para achar o resto', tipo:'acao', manter:true, go:()=>{}});
        }
        return {g:g.g, itens:vis, fim:!!g.fim};
      }).filter(g=>g.itens.length);
      st.total = total; st.mostrados = mostrados;
      gs.sort((a,b)=>a.fim-b.fim);   // grupos "plano B" (ex.: buscar nos cards de outro squad) vão para o fim
    }
    return {gs, q, esc0, precisaRadar};
  }
  const TIPO = {produto:'Produto', comando:'Comando', squad:'Maré', busca:'Maré', card:'Card', atalho:'Radar', objetivo:'Objetivo', marco:'Marco', link:'Link', ajuda:'Ajuda', acao:'Ação'};
  function icHtml(ic){ ic = String(ic||''); return ic.charAt(0)==='<' ? ic : esc(ic); }   // HTML de ícone só vem da própria página (logo do produto), nunca do banco
  function render(){
    if(!st.opts) return;
    const {gs, q, esc0, precisaRadar} = grupos();
    $('msn-esc').innerHTML = st.opts.escopos.map((e,i)=>'<button type="button" role="tab" tabindex="-1" data-esc="'+esc(e.id)+'" aria-selected="'+(e.id===esc0)+'">'+(i?'<span class="msn-k">'+i+'</span>':'')+esc(e.l)+'</button>').join('');
    st.itens = gs.flatMap(g=>g.itens);
    // Seleção pela IDENTIDADE do item (não pela posição): o Radar chegando depois insere grupos acima e não pode mudar o que está marcado.
    const iK = st.selK ? st.itens.findIndex(it=>it.k===st.selK) : -1;
    st.sel = iK>=0 ? iK : (st.sel < st.itens.length ? st.sel : 0);
    st.selK = st.itens[st.sel] ? st.itens[st.sel].k : null;
    let i = -1;
    let html = gs.map(g=>'<div class="msn-g" role="presentation">'+esc(g.g)+'</div>'+g.itens.map(it=>{ i++;
      const ich = icHtml(it.ic), icc = /class="dot"/.test(ich) ? ' dotc' : (ich.charAt(0)==='<' ? ' logo' : '');
      return '<div class="msn-it" role="option" id="msn-o-'+i+'" data-i="'+i+'" aria-selected="'+(i===st.sel)+'"><span class="msn-ic'+icc+'" aria-hidden="true">'+ich+'</span><span class="msn-tx"><span class="msn-t">'+esc(it.t)+'</span>'+(it.sub?'<span class="msn-s">'+esc(it.sub)+'</span>':'')+'</span><span class="msn-tp">'+esc(it.tipoTxt || TIPO[it.tipo] || '')+'</span></div>'; }).join('')).join('');
    if(precisaRadar && st.carregando) html += '<div class="msn-vazio" role="status">⏳ Procurando no Radar…</div>';
    else if(precisaRadar && st.erro) html += '<div class="msn-vazio" role="status">Não deu para buscar no Radar agora.<button type="button" data-retry>Tentar de novo</button></div>';
    if(!st.itens.length && !(precisaRadar && st.carregando)){
      const dica = st.opts.vazio || 'Tente outra palavra.';
      html = (q ? '<div class="msn-vazio" role="status">Nada encontrado para “'+esc(q)+'”. '+dica+'</div>' : '<div class="msn-vazio" role="status">'+(st.opts.inicio || dica)+'</div>') + (precisaRadar && st.erro ? html : '');
    }
    $('msn-lista').innerHTML = html;
    $('msn-in').setAttribute('aria-activedescendant', st.itens.length ? 'msn-o-'+st.sel : '');
    rodape(); status();
  }
  function marca(n){
    if(!st.itens.length) return;
    st.sel = (n + st.itens.length) % st.itens.length;
    document.querySelectorAll('#msn-lista .msn-it').forEach(el=>el.setAttribute('aria-selected', String(Number(el.dataset.i)===st.sel)));
    const el = $('msn-o-'+st.sel); if(el) el.scrollIntoView({block:'nearest'});
    $('msn-in').setAttribute('aria-activedescendant', 'msn-o-'+st.sel);
    st.selK = st.itens[st.sel] ? st.itens[st.sel].k : null;
    rodape();
  }
  // Busca nova (texto, aba): volta para o 1º item e para o limite padrão.
  function novaBusca(){ st.sel = 0; st.selK = null; st.limite = LIMITE; }
  // O rodapé só promete "aba nova" quando o item marcado tem um endereço para abrir.
  function rodape(){
    const pe = $('msn-pe'); if(!pe) return;
    const it = st.itens[st.sel], tecla = MAC ? '⌘' : 'Ctrl';
    pe.textContent = '↑↓ navegar · Enter abre' + (it && it.url ? ' · '+tecla+'+Enter abre em aba nova' : '') + ' · Tab troca onde buscar · Esc fecha';
  }
  function abrirItem(n, novaAba){
    const it = st.itens[n]; if(!it) return;
    if(it.manter){ if(it.go) it.go(); $('msn-in').focus(); return; }   // ação de dentro do Sonar (ver mais, atualizar): não fecha nem vira recente
    lembrar(it); st.gatilho = null; fechar();
    if(novaAba && it.url){ window.open(it.link ? linkOk(it.url) : it.url, '_blank', 'noopener'); return; }
    if(it.go) it.go();
  }
  function aberto(){ const ov = $('msn-ov'); return !!(ov && ov.classList.contains('open')); }
  function abrir(o){
    if(!st.opts) return;
    const u = st.opts.user && st.opts.user(); if(!u) return;
    montar();
    if(st.opts.aoAbrir) try{ st.opts.aoAbrir(); }catch(e){}
    o = o || {};
    st.gatilho = document.activeElement; st.esc = (o.esc && st.opts.escopos.some(e=>e.id===o.esc)) ? o.esc : 'tudo'; novaBusca(); st.erro = false;
    const inp = $('msn-in'); inp.placeholder = st.opts.placeholder || 'Buscar no Oceano…'; inp.value = String(o.q||'').slice(0,120);
    $('msn-ov').classList.add('open');
    render(); if(inp.value) scan(true);
    setTimeout(()=>{ inp.focus({preventScroll:true}); try{ inp.setSelectionRange(inp.value.length, inp.value.length); }catch(e){} }, 20);
  }
  function fechar(){
    const ov = $('msn-ov'); if(!ov || !ov.classList.contains('open')) return;
    ov.classList.remove('open'); scan(false); clearTimeout(st.tStatus);
    const g = st.gatilho; st.gatilho = null;
    if(g && g.isConnected && g.focus) try{ g.focus({preventScroll:true}); }catch(e){}
  }
  function iniciar(opts){
    st.opts = Object.assign({escopos:[{id:'tudo',l:'Tudo'}], prefixos:{}}, opts||{});
    if(st.opts.atalho && !st.atalhoOk){
      st.atalhoOk = true;
      document.addEventListener('keydown', e=>{
        if(!(e.ctrlKey||e.metaKey) || e.altKey || e.shiftKey || (e.key!=='k' && e.key!=='K')) return;
        if(!st.opts.user || !st.opts.user()) return;
        e.preventDefault();
        if(aberto()) fechar(); else abrir();
      });
    }
  }
  window.MareSonar = {iniciar, abrir, fechar, aberto, tecla: MAC ? '⌘K' : 'Ctrl K', _pontua:pontua, _norm:norm, _paginaOk:paginaOk, _linkOk:linkOk, _separaMeus:separaMeus};
})();
