/* mare-gcal-dev.js — 📊 Calendários do Gantt: configuração ÚNICA + visualizador só de leitura (13/11/2026)
   ─────────────────────────────────────────────────────────────────────────────────────────────
   Dono de tudo o que descreve os calendários publicados em kanban/calendarios_gantt(_dev)/{cal}:
   quais existem (CALS), o nome de cada um, os grupos do filtro "mostrar só" (GRUPOS), rótulos
   renomeados depois de publicados (ROT_NOVO), as cores das linhas e a paleta dos destaques.
   • Maré (kanban-dev.html): carrega este arquivo antes do script principal e LÊ daqui as constantes
     (_GANTT_CAL_GRUPOS, _GANTT_CAL_NOME…). O Gantt interativo do Maré (📤 atualizar, 🕘 histórico,
     ⚠️ destaque do ADM, datas-chave) continua no kanban.
   • Radar (okr-dev.html): baixa este arquivo só quando a pessoa abre Calendário → 📊 Gantt e usa
     MareGCal.montar(): régua de 6 semanas, abas Marca/Comercial Hering/Marketplace/Outlet, ◀ Hoje ▶,
     📆 Mês e filtro por grupo — SÓ LEITURA (os destaques aparecem; editar é no Maré).
   Calendário novo = 1 entrada em CALS (+ GRUPOS, se tiver filtro) + regra em database.rules.json.
   Leitura: a regra do banco exige login Google @ciahering.com.br (sem squad) — use permitido(user).
   Tudo o que vem do banco (texto das barras, rótulos, quem publicou, arquivo) passa por esc().
   Mudou este arquivo → bump do ?v= no kanban-dev.html (<script src>) e no okr-dev.html (_GCAL_V). */
(function(){
  'use strict';
  const CALS=[
    { id:'marca',     rot:'🎯 Calendário de Marca',    curto:'🎯 Marca',     nome:'Calendário de Marca' },
    { id:'comercial', rot:'🛒 Comercial Hering',       curto:'🛒 Hering',    nome:'Calendário Comercial Hering' },
    { id:'mktplace',  rot:'🛍️ Comercial Marketplace',  curto:'🛍️ Mktplace',  nome:'Calendário Comercial Marketplace' },
    { id:'outlet',    rot:'🏷️ Comercial Outlet',       curto:'🏷️ Outlet',    nome:'Calendário Comercial Outlet' },
  ];
  const NOME=Object.fromEntries(CALS.map(c=>[c.id,c.nome]));
  // 13/11: "Site todo"/"Site Saldos" viraram "Site e App" (as ações valem nos dois) — vale já para o que foi publicado antes do novo nome
  const ROT_NOVO={ comercial:{ site:'Site e App · todo (não remarcados)', saldos:'Site e App · saldos' } };
  // Filtro por grupo de linhas: "Site e App" entra tanto em Site quanto em App. Outlet: as linhas nascem do cabeçalho da planilha (out_<coluna>) — casam por re.
  const GRUPOS={
    comercial:[
      { id:'site', rot:'🖥️ Site', linhas:['site','saldos','adulto','intimates','kids','sports','acao_site'] },
      { id:'app',  rot:'📱 App',  linhas:['site','saldos','app'] },
      { id:'crm',  rot:'✉️ CRM',  linhas:['crm'] },
      { id:'midia',rot:'📣 Mídia',linhas:['midia'] },
      { id:'lanc', rot:'🚀 Lançamentos e datas', linhas:['lancamentos','geral'] },
    ],
    outlet:[
      { id:'principal', rot:'⭐ Principal',   re:/^out_acao_principal/ },
      { id:'secundaria',rot:'Secundária',    re:/^out_acao_secundaria/ },
      { id:'relampago', rot:'⚡ Relâmpago e ofertas do dia', re:/relampago|ofertas_do_dia/ },
      { id:'madrugada', rot:'🌙 Madrugada',   re:/madrugada/ },
      { id:'crm',       rot:'✉️ CRM',          re:/crm/ },
      { id:'midia',     rot:'📣 Mídia e afiliados', re:/midia|afiliados|livelo/ },
      { id:'extras',    rot:'Extras (reloginhos, BEON, benefícios…)', re:/extras|reloginhos|beon|beneficios/ },
    ],
    mktplace:[
      { id:'amazon',  rot:'Amazon',         linhas:['mkt_amazon'] },
      { id:'meli',    rot:'Mercado Livre',  linhas:['mkt_meli'] },
      { id:'shopee',  rot:'Shopee',         linhas:['mkt_shopee'] },
      { id:'dafiti',  rot:'Dafiti',         linhas:['mkt_dafiti'] },
      { id:'tiktok',  rot:'TikTok Shop',    linhas:['mkt_tiktok'] },
      { id:'magalu',  rot:'Magalu',         linhas:['mkt_magalu'] },
      { id:'netshoes',rot:'Netshoes e Zattini', linhas:['mkt_netshoes','mkt_zattini'] },
      { id:'outros',  rot:'Outros (Off Premium, Privalia, Zzmall, Posthaus, Off Hering)', linhas:['mkt_offprem','mkt_privalia','mkt_zzmall','mkt_posthaus','mkt_offhering'] },
    ],
    marca:[
      { id:'colecao', rot:'👕 Coleção', linhas:['sellout','kids_sellout'] },
      { id:'web',     rot:'🖥️ Web',     linhas:['web','kids_web'] },
      { id:'redes',   rot:'📲 Redes',   linhas:['redes','kids_redes'] },
      { id:'canais',  rot:'🛍️ Canais Intimates e Sports', linhas:['intimates','sports'] },
      { id:'kids',    rot:'👶 Kids',    linhas:['kids_sellout','kids_web','kids_redes'] },
    ],
  };
  const LINHA_COR=['#1de9b6','#38b6ff','#f472b6','#f59e0b','#a78bfa','#34d399','#fb7185','#60a5fa','#facc15','#c084fc','#2dd4bf','#94a3b8'];
  // paleta dos destaques das barras e das datas-chave do Maré
  const CORES={ red:'#ff6b6b', orange:'#fb923c', yellow:'#facc15', green:'#34d399', cyan:'#22d3ee', blue:'#60a5fa', purple:'#a78bfa', pink:'#f472b6' };
  const NOME_COR={ red:'Vermelho', orange:'Laranja', yellow:'Amarelo', green:'Verde', cyan:'Ciano', blue:'Azul', purple:'Roxo', pink:'Rosa' };
  const LARGO=['comercial','mktplace','outlet'];   // calendários comerciais: dia largo e texto inteiro

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ehIso=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const iso=dt=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  const parse=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?new Date(+m[1],+m[2]-1,+m[3],12):null; };
  const soma=(dt,n)=>{ const d=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()+n,12); return d; };
  const br=s=>{ const d=parse(s); return d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'):''; };
  const hexA=(h,a)=>{ const m=/^#?([0-9a-f]{6})$/i.exec(h||''); if(!m) return h; const n=parseInt(m[1],16); return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'; };
  const suf=()=>/-dev\.html/.test(location.pathname)?'_dev':'';
  const MES_L=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MES_C=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const DOW=['D','S','T','Q','Q','S','S'];

  // Quem pode ler (a regra do banco): login Google @ciahering.com.br. Convidado externo / outro provedor não vê.
  function permitido(u){
    u=u||{}; const email=String(u.email||'').toLowerCase();
    return email.endsWith('@ciahering.com.br') && (u.providerData||[]).some(p=>p&&p.providerId==='google.com');
  }
  function linhaNoGrupo(g,k){ return !!((g.linhas&&g.linhas.includes(k)) || (g.re&&g.re.test(k))); }

  // ── CSS do visualizador (só entra na página que monta; usa os tokens da página, com valores de reserva)
  const CSS=`
.mgc{--mgc-title:200px;--mgc-day:30px;--mgc-surf:rgb(var(--surface-rgb,var(--slate-rgb,10,30,55)));--mgc-surf2:rgba(var(--surface2-rgb,var(--ink-rgb,3,13,26)),.55);--mgc-line:rgba(56,182,255,.09);--mgc-wknd:rgba(var(--surface2-rgb,var(--ink-rgb,3,13,26)),.45);display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%;color:var(--txt);}
[data-theme="light"] .mgc{--mgc-line:rgba(0,124,168,.12);--mgc-wknd:rgba(0,95,140,.06);}
[data-theme="vice"] .mgc{--mgc-line:rgba(229,159,124,.12);--mgc-wknd:rgba(36,21,33,.45);}
.mgc.is-largo{--mgc-day:150px;}
.mgc-abas{display:flex;gap:4px;padding:4px;background:var(--mgc-surf);border:1px solid var(--glass-b);border-radius:999px;align-self:flex-start;max-width:100%;overflow-x:auto;scrollbar-width:none;}
.mgc-abas::-webkit-scrollbar{display:none;}
.mgc-aba{flex:none;border:none;background:none;color:var(--txt2);font:600 12.5px/1 inherit;font-family:inherit;padding:8px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;}
.mgc-aba:hover{color:var(--txt);}
.mgc-aba.on{background:var(--accent);color:#04121f;}
.mgc-aba:focus-visible,.mgc-chip:focus-visible,.mgc-btn:focus-visible,.mgc-bar:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.mgc-bar-top{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;padding:8px 12px;background:var(--mgc-surf);border:1px solid var(--glass-b);border-radius:var(--r,10px);}
.mgc-btn{border:1px solid var(--glass-b);background:var(--mgc-surf2);color:var(--txt);border-radius:8px;padding:5px 10px;font:700 12px/1.2 inherit;font-family:inherit;cursor:pointer;}
.mgc-btn:hover{border-color:var(--accent);}
.mgc-btn.is-hoje{border-color:var(--accent);}
.mgc-range{font-size:12.5px;font-weight:700;margin:0 4px;}
.mgc-mes{padding:5px 8px;font-size:12px;border:1px solid var(--glass-b);border-radius:8px;background:var(--mgc-surf2);color:var(--txt);font-family:inherit;margin-left:auto;}
.mgc-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 100%;}
.mgc-chip{border:1px solid var(--glass-b);background:var(--mgc-surf2);color:var(--txt2);border-radius:999px;padding:5px 12px;font:600 12px/1.2 inherit;font-family:inherit;cursor:pointer;}
.mgc-chip:hover{color:var(--txt);border-color:var(--accent);}
.mgc-chip.on{background:var(--accent);color:#04121f;border-color:var(--accent);}
[data-theme="light"] .mgc-aba.on,[data-theme="light"] .mgc-chip.on{color:#fff;}
.mgc-aba-c{display:none;}
.mgc-scroll{width:100%;max-width:100%;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--mgc-surf);border:1px solid var(--glass-b);border-radius:var(--r2,14px);}
.mgc-canvas{min-width:calc(var(--mgc-title) + 42 * var(--mgc-day));}
.mgc-row{display:grid;grid-template-columns:var(--mgc-title) minmax(calc(42 * var(--mgc-day)),1fr);min-height:32px;}
.mgc-row.is-1a{border-top:1px solid var(--glass-b);}
.mgc-row.is-1a:first-child{border-top:none;}
.mgc-sticky{position:sticky;left:0;z-index:2;background:var(--mgc-surf);display:flex;align-items:center;gap:6px;padding:4px 10px;border-right:1px solid var(--glass-b);min-width:0;}
.mgc-row:not(.mgc-hd) .mgc-sticky{border-left:3px solid var(--mgc-lin,transparent);}
.mgc-lin{font-size:12px;font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;}
.mgc-cnt{font-size:10.5px;font-weight:700;color:var(--txt2);flex:none;}
.mgc-track{display:grid;grid-template-columns:repeat(42,minmax(var(--mgc-day),1fr));align-items:center;position:relative;background-image:linear-gradient(90deg,var(--mgc-line) 1px,transparent 1px);background-size:calc(100% / 42) 100%;}
.mgc-hd{position:sticky;top:0;z-index:3;background:var(--mgc-surf);}
.mgc-hd .mgc-track{background:none;}
.mgc-mhd{font-size:11.5px;font-weight:700;color:var(--txt);padding:6px 6px 2px;border-left:1px solid var(--glass-b);white-space:nowrap;overflow:hidden;}
.mgc.is-largo .mgc-mhd{overflow:visible;}
.mgc.is-largo .mgc-mhd span{position:sticky;left:calc(var(--mgc-title) + 10px);}
.mgc-dhd{display:flex;flex-direction:column;align-items:center;font-size:10.5px;color:var(--txt2);padding:2px 0 5px;line-height:1.15;}
.mgc-dhd.is-wknd{background:var(--mgc-wknd);}
.mgc-dhd.is-hoje{color:var(--accent);font-weight:800;}
.mgc-dhd b{font-size:12px;color:var(--txt);}
.mgc-dhd.is-hoje b{color:var(--accent);}
.mgc-hoje{grid-row:1;width:2px;height:100%;justify-self:center;background:var(--accent);opacity:.55;pointer-events:none;}
.mgc-bar{grid-row:1;position:relative;z-index:1;display:flex;align-items:center;gap:4px;height:24px;margin:3px 2px;padding:0 7px;border-radius:7px;border:1px solid var(--mgc-tag);color:var(--txt);font-size:11.5px;font-weight:600;min-width:0;overflow:hidden;cursor:pointer;}
.mgc-bar.clip-l{border-top-left-radius:0;border-bottom-left-radius:0;border-left-style:dashed;}
.mgc-bar.clip-r{border-top-right-radius:0;border-bottom-right-radius:0;border-right-style:dashed;}
.mgc-bar.is-dest{font-weight:800;border-width:2px;}
.mgc-bar.is-alerta{box-shadow:0 0 0 1px var(--mgc-tag),0 2px 8px rgba(0,0,0,.25);}
.mgc-bar-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.mgc.is-largo .mgc-row:not(.mgc-hd) .mgc-track{align-items:start;padding:3px 0;}
.mgc.is-largo .mgc-bar{height:auto;min-height:28px;align-items:flex-start;padding:5px 8px;overflow:visible;}
.mgc.is-largo .mgc-bar-txt{white-space:normal;overflow:visible;overflow-wrap:anywhere;line-height:1.35;font-size:12px;position:sticky;left:calc(var(--mgc-title) + 10px);}
.mgc-bloco{display:flex;align-items:center;padding:7px 10px;font-size:12.5px;font-weight:800;color:var(--txt);background:var(--mgc-surf2);border-top:1px solid var(--glass-b);position:sticky;left:0;}
.mgc-bloco.is-kids{margin-top:10px;}
.mgc-vazio{padding:28px 16px;text-align:center;color:var(--txt2);font-size:13px;}
.mgc-det{min-height:20px;font-size:12.5px;color:var(--txt);padding:0 4px;overflow-wrap:anywhere;}
.mgc-det:empty{display:none;}
.mgc-pe{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--txt2);padding:0 4px;}
.mgc-pe b{color:var(--txt);}
@media (max-width:600px){ .mgc-aba-l{display:none;} .mgc-aba-c{display:inline;} }
@media (max-width:768px){ .mgc{--mgc-title:118px;} .mgc.is-largo{--mgc-day:120px;} .mgc-abas{align-self:stretch;gap:2px;} .mgc-aba{flex:1 0 auto;padding:9px 8px;} .mgc-mes{margin-left:0;flex:1 1 100%;} .mgc-lin{white-space:normal;font-size:11.5px;line-height:1.2;} }
@media (hover:none) and (pointer:coarse){ .mgc-aba,.mgc-btn,.mgc-chip,.mgc-mes{min-height:44px;} .mgc-mes{font-size:16px;} }
@media (prefers-reduced-motion:reduce){ .mgc-scroll{scroll-behavior:auto;} }
`;
  function css(){
    if(document.getElementById('mgc-css')) return;
    const st=document.createElement('style'); st.id='mgc-css'; st.textContent=CSS; document.head.appendChild(st);
  }

  // ── Visualizador só de leitura. opts: { aba, aoTrocarAba(id) } → { aba(id), redesenhar(), destruir() }
  function montar(root, opts){
    opts=opts||{}; css();
    const db=window._db, ref=p=>window._ref(db,p), onValue=window._onValue;
    const S={ aba:CALS.some(c=>c.id===opts.aba)?opts.aba:'comercial', off:0, mes:'', rolar:'hoje', det:'', dados:{}, subs:[] };
    let filtro={}; try{ filtro=JSON.parse(localStorage.getItem('mare_gantt_cal_filtro')||'{}')||{}; }catch(e){}
    const salvaFiltro=()=>{ try{ localStorage.setItem('mare_gantt_cal_filtro', JSON.stringify(filtro)); }catch(e){} };

    function carregar(id){
      if(S.dados[id]) return;
      const st=S.dados[id]={ estado:'carregando', dado:null, dest:{} };
      try{
        const u1=onValue(ref('kanban/calendarios_gantt'+suf()+'/'+id), snap=>{ st.dado=snap.exists()?snap.val():null; st.estado='ok'; if(S.aba===id) desenhar(); },
          err=>{ st.estado='erro'; st.erro=/permission/i.test(String(err&&err.message||err))?'permissao':'falha'; if(S.aba===id) desenhar(); });
        const u2=onValue(ref('kanban/gantt_destaques'+suf()+'/'+id), snap=>{ st.dest=(snap.exists()&&snap.val())||{}; if(S.aba===id) desenhar(); }, ()=>{});
        S.subs.push(u1,u2);
      }catch(e){ st.estado='erro'; st.erro='falha'; }
    }
    function inicioPadrao(){ const h=new Date(); const d=new Date(h.getFullYear(),h.getMonth(),h.getDate(),12); return soma(d,-d.getDay()-7); }   // domingo da semana passada (igual ao Maré)

    function corpo(id, ini, fim){
      const st=S.dados[id], nome=NOME[id];
      if(!st || st.estado==='carregando') return { html:'<div class="mgc-vazio" role="status">Carregando o '+esc(nome)+'…</div>' };
      if(st.estado==='erro') return { html:'<div class="mgc-vazio" role="status">'+(st.erro==='permissao'?'Sem acesso ao '+esc(nome)+' — entre com o Google da Hering.':'Não consegui carregar o '+esc(nome)+'. Tente de novo em instantes.')+'</div>' };
      const d=st.dado;
      if(!d || !d.barras) return { html:'<div class="mgc-vazio">O '+esc(nome)+' ainda não foi publicado. Quem cuida da planilha publica pelo Maré Digital (📊 Gantt → 📤 Atualizar planilha).</div>' };
      const linhas=Object.assign({}, d.linhas||{});
      Object.entries(ROT_NOVO[id]||{}).forEach(([k,r])=>{ if(linhas[k]) linhas[k]=Object.assign({}, linhas[k], { rot:r }); });
      const g=(GRUPOS[id]||[]).find(x=>x.id===filtro[id]);
      if(g) Object.keys(linhas).forEach(k=>{ if(!linhaNoGrupo(g,k)) delete linhas[k]; });
      const ordem=Object.keys(linhas).sort((a,b)=>(linhas[a].ordem||0)-(linhas[b].ordem||0));
      const porLinha=new Map(); let fora=0;
      for(const [bid,b0] of Object.entries(d.barras)){
        if(!b0 || !ehIso(b0.ini) || !ehIso(b0.fim) || b0.fim<b0.ini || !linhas[b0.linha]) continue;
        if(b0.fim<ini || b0.ini>fim){ fora++; continue; }
        if(!porLinha.has(b0.linha)) porLinha.set(b0.linha,[]);
        porLinha.get(b0.linha).push(Object.assign({ _id:bid }, b0));
      }
      const dest=st.dest||{}, linhasHtml=[], iniDt=parse(ini);
      const col=s=>Math.round((parse(s)-iniDt)/864e5)+1;
      const temKids=ordem.some(l=>/^kids_/.test(l) && porLinha.has(l)); let bloco='';
      ordem.forEach((lin,i)=>{
        const lista=(porLinha.get(lin)||[]).sort((a,b)=>a.ini<b.ini?-1:a.ini>b.ini?1:(b.fim<a.fim?-1:1));
        if(!lista.length) return;
        const bl=/^kids_/.test(lin)?'kids':'base';
        if(temKids && bl!==bloco){ bloco=bl; linhasHtml.push('<div class="mgc-bloco'+(bl==='kids'?' is-kids':'')+'">'+(bl==='kids'?'👶 Hering Kids':'Hering')+'</div>'); }
        const cor=LINHA_COR[(linhas[lin].ordem||i)%LINHA_COR.length];
        const rot=temKids?String(linhas[lin].rot||lin).replace(/^Kids · /,''):(linhas[lin].rot||lin);
        const pistas=[];
        for(const b of lista){ let k=pistas.findIndex(p=>p.fim<b.ini); if(k<0){ pistas.push({fim:'',bs:[]}); k=pistas.length-1; } pistas[k].fim=b.fim; pistas[k].bs.push(b); }
        pistas.forEach((p,pi)=>{
          const bars=p.bs.map(b=>{
            const cL=b.ini<ini, cR=b.fim>fim, cs=col(cL?ini:b.ini), ce=col(cR?fim:b.fim);
            const per=b.ini===b.fim?br(b.ini):br(b.ini)+' – '+br(b.fim);
            const dz=dest[b._id]||null, corDz=dz&&CORES[dz.cor], alerta=!!(dz&&dz.alerta), cb=corDz||cor;
            const tip=(alerta?'⚠️ Importante · ':corDz?'★ Destacada · ':'')+String(b.txt||'')+' · '+per+' · '+rot;
            return '<div class="mgc-bar'+(corDz?' is-dest':'')+(alerta?' is-alerta':'')+(cL?' clip-l':'')+(cR?' clip-r':'')+'" role="button" tabindex="0" data-tip="'+esc(tip)+'" title="'+esc(tip)+'" style="grid-column:'+cs+'/'+(ce+1)+';background:'+hexA(cb,corDz?.42:.22)+';--mgc-tag:'+cb+';">'
              +(alerta?'<span aria-hidden="true">⚠️</span>':corDz?'<span aria-hidden="true" style="color:'+cb+'">★</span>':'')
              +'<span class="mgc-bar-txt">'+esc(b.txt)+'</span></div>';
          }).join('');
          linhasHtml.push('<div class="mgc-row'+(pi===0?' is-1a':'')+'" style="--mgc-lin:'+cor+'"><div class="mgc-sticky">'
            +(pi===0?'<span class="mgc-lin" title="'+esc(rot)+'">'+esc(rot)+'</span><span class="mgc-cnt">'+lista.length+'</span>':'')
            +'</div><div class="mgc-track">'+(S.hojeCol?'<span class="mgc-hoje" style="grid-column:'+S.hojeCol+'"></span>':'')+bars+'</div></div>');
        });
      });
      const m=d.meta||{};
      const quando=m.atualizadoEm?(()=>{ const dt=new Date(m.atualizadoEm); return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})+' às '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); })():'';
      const pe='<span>📄 <b>'+esc(nome)+'</b>'+(quando?' · atualizado em '+esc(quando)+(m.porNome?' por '+esc(m.porNome):''):'')+'</span>'
        +(fora?'<span>'+fora+' '+(fora===1?'ação':'ações')+' em outras semanas (use ◀ ▶ ou 📆 Mês)</span>':'')
        +(g?'<span><b>Mostrando só '+esc(g.rot)+'</b></span>':'')
        +'<span>Toque numa barra para ler o texto inteiro · a planilha é atualizada no Maré Digital</span>';
      if(!linhasHtml.length) return { html:'<div class="mgc-vazio">'+(g?'Nada de '+esc(g.rot)+' nestas 6 semanas — use ◀ ▶ ou toque em Tudo':'Nada do '+esc(nome)+' nestas 6 semanas — use ◀ ▶ ou 📆 Mês')+'</div>', pe };
      return { html:linhasHtml.join(''), pe };
    }

    function desenhar(){
      if(!root.isConnected) return;
      carregar(S.aba);
      const base=inicioPadrao(), iniDt=soma(base,S.off), fimDt=soma(iniDt,41), ini=iso(iniDt), fim=iso(fimDt);
      const hojeIso=iso(new Date()), dias=[];
      for(let i=0;i<42;i++){ const dt=soma(iniDt,i); dias.push({ dt, iso:iso(dt) }); }
      const hi=dias.findIndex(x=>x.iso===hojeIso); S.hojeCol=hi>=0?hi+1:0;
      const meses=[]; dias.forEach((x,i)=>{ const k=x.dt.getFullYear()+'-'+x.dt.getMonth(), u=meses[meses.length-1]; if(u&&u.k===k) u.f=i+1; else meses.push({ k, m:x.dt.getMonth(), y:x.dt.getFullYear(), i:i+1, f:i+1 }); });
      const largo=LARGO.includes(S.aba);
      root.classList.add('mgc'); root.classList.toggle('is-largo', largo);
      const ano=new Date().getFullYear();
      const grupos=GRUPOS[S.aba]||[], gSel=grupos.some(x=>x.id===filtro[S.aba])?filtro[S.aba]:'';
      const c=corpo(S.aba, ini, fim);
      const rolagem=root.querySelector('.mgc-scroll'), x0=rolagem?rolagem.scrollLeft:0;
      root.innerHTML=
        '<div class="mgc-abas" role="tablist" aria-label="Calendários">'+CALS.map(k=>'<button type="button" role="tab" class="mgc-aba'+(k.id===S.aba?' on':'')+'" data-aba="'+k.id+'" aria-selected="'+(k.id===S.aba)+'" tabindex="'+(k.id===S.aba?0:-1)+'" aria-label="'+esc(k.nome)+'"><span class="mgc-aba-l">'+esc(k.rot)+'</span><span class="mgc-aba-c" aria-hidden="true">'+esc(k.curto)+'</span></button>').join('')+'</div>'
        +'<div class="mgc-bar-top">'
          +'<button type="button" class="mgc-btn" data-nav="-28" aria-label="4 semanas antes">◀</button>'
          +'<button type="button" class="mgc-btn'+(S.off===0?' is-hoje':'')+'" data-nav="0">Hoje</button>'
          +'<button type="button" class="mgc-btn" data-nav="28" aria-label="4 semanas depois">▶</button>'
          +'<span class="mgc-range">'+esc(br(ini)+' – '+br(fim)+'/'+fimDt.getFullYear())+'</span>'
          +'<select class="mgc-mes" aria-label="Ir para o mês"><option value="">📆 Mês</option>'+MES_L.map((n,i)=>{ const v=ano+'-'+String(i+1).padStart(2,'0'); return '<option value="'+v+'"'+(S.mes===v?' selected':'')+'>'+n+' '+ano+'</option>'; }).join('')+'</select>'
          +(grupos.length?'<div class="mgc-chips" role="group" aria-label="Mostrar só">'+[{id:'',rot:'Tudo'}].concat(grupos).map(x=>'<button type="button" class="mgc-chip'+(x.id===gSel?' on':'')+'" data-g="'+x.id+'" aria-pressed="'+(x.id===gSel)+'">'+esc(x.rot)+'</button>').join('')+'</div>':'')
        +'</div>'
        +'<div class="mgc-scroll" tabindex="0" aria-label="'+esc(NOME[S.aba])+' — régua de 6 semanas"><div class="mgc-canvas">'
          +'<div class="mgc-row mgc-hd"><div class="mgc-sticky"><span class="mgc-lin">'+esc(CALS.find(k=>k.id===S.aba).curto)+'</span></div><div class="mgc-track">'
            +meses.map(ms=>{ const span=ms.f-ms.i+1; return '<div class="mgc-mhd" style="grid-row:1;grid-column:'+ms.i+'/'+(ms.f+1)+'"><span>'+esc(span<=4&&!largo?MES_C[ms.m]+' '+String(ms.y).slice(2):MES_L[ms.m]+' '+ms.y)+'</span></div>'; }).join('')
            +dias.map((x,i)=>{ const w=x.dt.getDay(); return '<div class="mgc-dhd'+(w===0||w===6?' is-wknd':'')+(i+1===S.hojeCol?' is-hoje':'')+'" data-date="'+x.iso+'" style="grid-row:2;grid-column:'+(i+1)+'"><span>'+DOW[w]+'</span><b>'+x.dt.getDate()+'</b></div>'; }).join('')
          +'</div></div>'
          +c.html
        +'</div></div>'
        +'<div class="mgc-det" role="status" aria-live="polite">'+esc(S.det)+'</div>'
        +(c.pe?'<div class="mgc-pe">'+c.pe+'</div>':'');
      const sc=root.querySelector('.mgc-scroll');
      const dia=root.querySelector('.mgc-dhd').getBoundingClientRect().width||30;
      if(S.rolar==='hoje' && S.hojeCol) sc.scrollLeft=Math.max(0,(S.hojeCol-2)*dia);
      else if(S.rolar==='mes' && S.mes){ const k=dias.findIndex(x=>x.iso===S.mes+'-01'); sc.scrollLeft=k>=0?Math.max(0,k*dia):0; }
      else if(S.rolar==='inicio') sc.scrollLeft=0;
      else sc.scrollLeft=x0;
      S.rolar='';
    }

    function ir(off, rolar){ S.off=off; S.rolar=rolar; S.det=''; desenhar(); }
    function irMes(v){
      const alvo=parse(v+'-01'); if(!alvo) return;
      const base=inicioPadrao(), ini=soma(alvo,-alvo.getDay()-7);
      S.mes=v; ir(Math.round((ini-base)/864e5),'mes');
    }
    function trocaAba(id){
      if(!CALS.some(c=>c.id===id) || id===S.aba) return;
      S.aba=id; S.rolar='hoje'; S.det='';
      if(typeof opts.aoTrocarAba==='function'){ try{ opts.aoTrocarAba(id); }catch(e){} }
      desenhar();
      const b=root.querySelector('.mgc-aba[data-aba="'+id+'"]'); if(b) b.focus({preventScroll:true});
    }
    function clique(ev){
      const t=ev.target.closest('button,.mgc-bar'); if(!t || !root.contains(t)) return;
      if(t.dataset.aba) return trocaAba(t.dataset.aba);
      if(t.dataset.nav!=null){ const n=+t.dataset.nav; S.mes=''; return n===0?ir(0,'hoje'):ir(S.off+n,'inicio'); }
      if(t.dataset.g!=null){ const g=t.dataset.g; filtro[S.aba]=(filtro[S.aba]===g)?'':g; salvaFiltro(); S.det=''; desenhar(); const f=root.querySelector('.mgc-chip[data-g="'+(filtro[S.aba]||'')+'"]'); if(f) f.focus({preventScroll:true}); return; }
      if(t.classList.contains('mgc-bar')){ S.det=t.getAttribute('data-tip')||''; const d=root.querySelector('.mgc-det'); if(d) d.textContent=S.det; }
    }
    function tecla(ev){
      const t=ev.target;
      if(t.classList&&t.classList.contains('mgc-bar') && (ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); return clique(ev); }
      if(t.classList&&t.classList.contains('mgc-aba') && (ev.key==='ArrowRight'||ev.key==='ArrowLeft')){
        ev.preventDefault(); const i=CALS.findIndex(c=>c.id===S.aba), n=CALS[(i+(ev.key==='ArrowRight'?1:-1)+CALS.length)%CALS.length]; trocaAba(n.id);
      }
    }
    function muda(ev){ if(ev.target.classList.contains('mgc-mes')){ const v=ev.target.value; if(v) irMes(v); else { S.mes=''; } } }
    root.addEventListener('click', clique); root.addEventListener('keydown', tecla); root.addEventListener('change', muda);
    desenhar();
    return {
      aba:id=>trocaAba(id),
      redesenhar:()=>desenhar(),
      destruir:()=>{ root.removeEventListener('click', clique); root.removeEventListener('keydown', tecla); root.removeEventListener('change', muda); S.subs.forEach(u=>{ try{ typeof u==='function'&&u(); }catch(e){} }); S.subs=[]; root.classList.remove('mgc','is-largo'); root.innerHTML=''; },
      _estado:S,
    };
  }

  window.MareGCal={ CALS, NOME, ROT_NOVO, GRUPOS, LINHA_COR, CORES, NOME_COR, LARGO, permitido, montar, esc, v:1 };
})();
