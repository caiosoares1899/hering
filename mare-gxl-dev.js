/* ══════════════════════════════════════════════════════════════════════════
   mare-gxl-dev.js — 📊 CALENDÁRIOS DO GANTT: leitor de .xlsx + prévia + publicação com histórico (13/11/2026)
   Carregado SOB DEMANDA pelo kanban-dev (Maré → 📊 Gantt → 📤 Atualizar com a planilha) e pelo painel-dev (⚙ → 📊 Gantt);
   a versão de produção, mare-gxl.js, nasce na promoção. Mesmo ciclo dev→prod dos outros módulos (?v=N).

   Leitor: o .xlsx é um zip; o diretório central dá os tamanhos e o DecompressionStream('deflate-raw') abre SÓ as abas que o
   calendário usa (QUER). Sem biblioteca (o FortiGate barra CDN novo). Texto da planilha só vira dado — quem desenha usa esc().
   Publicar (qualquer pessoa da Hering, login Google — conferido também nas regras): grava, NUMA ÚNICA escrita (tudo ou nada), uma CÓPIA da versão em
   kanban/calendarios_gantt_snap(_dev)/{cal}/{id}, o calendário em kanban/calendarios_gantt(_dev)/{cal} e uma linha no histórico
   kanban/calendarios_gantt_hist(_dev)/{cal}/{id} (quem, quando, arquivo, ＋ ✎ −). Restaurar = publicar a cópia de uma versão antiga
   (também vai pro histórico). A lista do histórico NÃO baixa as cópias (nó separado): a cópia só é lida ao restaurar.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareGXL) return;
// ── 📊 Leitor de .xlsx + montadores dos calendários do Gantt (13/11/2026) ────────────────────────────
// Sem biblioteca (o FortiGate bloqueia CDN novo): o .xlsx é um zip; o diretório central dá os tamanhos
// (cabeçalho local pode vir zerado com bit 3) e o DecompressionStream('deflate-raw') abre cada arquivo.
// XML lido por regex (mesma função roda no navegador e no teste em Node). Texto da planilha só vira
// dado (string) — quem desenha usa esc()/textContent.
const GXL = (()=>{
  const MAX_BARRAS = 3000;
  const u16=(b,o)=>b[o]|(b[o+1]<<8), u32=(b,o)=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;
  // Diretório do zip (sem descompactar nada); `abrir(nome)` descompacta só o arquivo pedido — planilhas grandes (a do Marketplace tem
  // 36 abas de ~9 MB de XML cada) só pagam pelas abas que o calendário usa.
  function zipDir(buf){
    const b=new Uint8Array(buf); let e=-1;
    for(let i=b.length-22;i>=Math.max(0,b.length-66000);i--){ if(u32(b,i)===0x06054b50){ e=i; break; } }
    if(e<0) throw new Error('Não parece um arquivo .xlsx (zip sem diretório central).');
    const n=u16(b,e+10); let p=u32(b,e+16); const dir=new Map(); const dec=new TextDecoder('utf-8');
    for(let k=0;k<n;k++){
      if(u32(b,p)!==0x02014b50) throw new Error('Diretório do .xlsx corrompido.');
      const metodo=u16(b,p+10), csize=u32(b,p+20), nlen=u16(b,p+28), xlen=u16(b,p+30), clen=u16(b,p+32), loff=u32(b,p+42);
      dir.set(dec.decode(b.subarray(p+46,p+46+nlen)), { metodo, csize, loff }); p+=46+nlen+xlen+clen;
    }
    async function abrir(nome){
      const x=dir.get(nome); if(!x) return '';
      const ini=x.loff+30+u16(b,x.loff+26)+u16(b,x.loff+28); const dado=b.subarray(ini,ini+x.csize);
      let bytes;
      if(x.metodo===0) bytes=dado;
      else if(x.metodo===8){ const ds=new DecompressionStream('deflate-raw'); const r=new Response(new Blob([dado]).stream().pipeThrough(ds)); bytes=new Uint8Array(await r.arrayBuffer()); }
      else throw new Error('Compressão não suportada no .xlsx ('+x.metodo+').');
      return dec.decode(bytes);
    }
    return { abrir };
  }
  const ent=s=>String(s).replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-fA-F]+));/g,(m,a,d,h)=>a==='lt'?'<':a==='gt'?'>':a==='quot'?'"':a==='apos'?"'":a==='amp'?'&':String.fromCodePoint(d?Number(d):parseInt(h,16)));
  const attr=(tag,n)=>{ const m=new RegExp('\\s'+n+'="([^"]*)"').exec(tag); return m?ent(m[1]):null; };
  const textos=x=>{ let s=''; const re=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g; let m; x=x.replace(/<rPh[\s\S]*?<\/rPh>/g,''); while((m=re.exec(x))) s+=ent(m[1]||''); return s; };
  const colN=l=>{ let c=0; for(const ch of l) c=c*26+ch.charCodeAt(0)-64; return c; };
  function rc(ref){ const m=/^([A-Z]+)(\d+)$/.exec(ref); return m?{r:+m[2],c:colN(m[1])}:null; }
  // Planilha → [{nome, oculta, cells: Map("r,c" → texto), merges:[{r1,c1,r2,c2}], rows: Map(r → Map(c → texto))}]
  // quer(nomeDaAba, oculta) → true/false: só as abas aceitas são descompactadas (as outras voltam sem linhas)
  async function ler(buf, quer){
    const Z=zipDir(buf);
    const wb=await Z.abrir('xl/workbook.xml');
    if(!wb) throw new Error('Arquivo sem planilhas (xl/workbook.xml).');
    const ss=[]; const sst=await Z.abrir('xl/sharedStrings.xml');
    (sst.match(/<si>[\s\S]*?<\/si>|<si\/>/g)||[]).forEach(si=>ss.push(textos(si)));
    const rels={}; (await Z.abrir('xl/_rels/workbook.xml.rels')).replace(/<Relationship\b[^>]*>/g,t=>{ rels[attr(t,'Id')]=attr(t,'Target'); return t; });
    const abas=[];
    wb.replace(/<sheet\b[^>]*>/g,t=>{ abas.push({ nome:attr(t,'name')||'', oculta:/state="(hidden|veryHidden)"/.test(t), rid:attr(t,'r:id') }); return t; });
    const out=[];
    for(const a of abas){
      let alvo=rels[a.rid]||''; alvo=alvo.replace(/^\//,''); if(!alvo.startsWith('xl/')) alvo='xl/'+alvo;
      const pula=quer && !quer(a.nome, a.oculta);
      const xml=pula ? '' : await Z.abrir(alvo); const rows=new Map(); const merges=[];
      const reC=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
      while((m=reC.exec(xml))){
        const tag=m[1], corpo=m[2]||''; const ref=attr(' '+tag,'r'); const pos=ref&&rc(ref); if(!pos) continue;
        const t=attr(' '+tag,'t'); let v=null;
        const vm=/<v>([\s\S]*?)<\/v>/.exec(corpo);
        if(t==='s'&&vm) v=ss[+vm[1]]; else if(t==='inlineStr') v=textos(corpo); else if(vm) v=ent(vm[1]);
        if(v==null||v==='') continue;
        if(!rows.has(pos.r)) rows.set(pos.r,new Map()); rows.get(pos.r).set(pos.c,{v:String(v),num:t!=='s'&&t!=='inlineStr'&&t!=='str'});
      }
      xml.replace(/<mergeCell\b[^>]*ref="([A-Z]+\d+):([A-Z]+\d+)"/g,(x,a1,a2)=>{ const p=rc(a1),q=rc(a2); if(p&&q) merges.push({r1:p.r,c1:p.c,r2:q.r,c2:q.c}); return x; });
      out.push({ nome:a.nome, oculta:a.oculta, rows, merges });
    }
    return out;
  }
  // filtros de aba por calendário (quais descompactar)
  const QUER={
    marca:(n,o)=>!o && /^(HERING|KIDS)\s+20\d\d$/i.test(limpa(n)),
    comercial:(n,o)=>!o && !ABA_FORA_RE.test(n),
    mktplace:(n)=>ABA_MES_RE.test(sem(n)),
  };
  // ── datas ──
  const z2=n=>String(n).padStart(2,'0');
  const iso=d=>d.getUTCFullYear()+'-'+z2(d.getUTCMonth()+1)+'-'+z2(d.getUTCDate());
  const serialIso=n=>iso(new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000));
  const somaDias=(s,k)=>{ const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return iso(d); };
  const limpa=s=>String(s||'').replace(/\s+/g,' ').trim();
  const sem=s=>limpa(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
  // id estável (linha + início + texto): a prévia compara por ele (novo/alterado/removido)
  function hid(s){ let h1=0x811c9dc5, h2=0x01000193; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619)>>>0; h2=Math.imul(h2^c,2246822519)>>>0; } return 'b_'+h1.toString(36)+h2.toString(36); }
  const MESES=['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const DOW=['DOM','SEG','TER','QUA','QUI','SEX','SAB'];

  // ── 🎯 Calendário de Marca: aba "HERING <ano>", linhas COLEÇÃO SELLOUT, WEB e REDE(S) SOCIAIS | HERING.
  // Coluna → data pela linha 2 (números do dia, virando o mês quando volta a 1), conferida pelo dia da semana da linha 3
  // (o cabeçalho de meses da linha 1 fica 1 coluna adiantado em fev–jul: não serve de âncora). Barras = células mescladas.
  const LINHAS_MARCA=[
    { id:'sellout', rot:'Coleção sellout', ok:s=>/^COLECAO SELLOUT\b/.test(s) },
    { id:'web',     rot:'Web',             ok:s=>s==='WEB' },
    { id:'redes',   rot:'Redes sociais',   ok:s=>/^REDES? SOCIAIS?\s*\|\s*HERING$/.test(s) },
    { id:'intimates', rot:'Canais Intimates (site e CRM)', ok:s=>/^CANAIS? INTIMATES\b/.test(s) },
    { id:'sports',    rot:'Canais Sports (site e CRM)',    ok:s=>/^CANAIS? SPORTS\b/.test(s) },
  ];
  // Aba KIDS: mesmas ideias, num bloco à parte (ids "kids_*" — o Maré desenha um separador "Hering Kids" antes).
  const LINHAS_KIDS=[
    { id:'kids_sellout', rot:'Kids · Coleção sellout', ok:s=>/^COLECAO SELLOUT\b/.test(s) },
    { id:'kids_web',     rot:'Kids · Web',             ok:s=>s==='WEB' },
    { id:'kids_redes',   rot:'Kids · Redes sociais',   ok:s=>/^REDES? SOCIAIS?\s*\|\s*(HERING\s+)?KIDS$/.test(s) },
  ];
  // coluna → data numa aba anual: linha 2 = número do dia (vira o mês quando volta a 1), conferida pela linha 3 (dia da semana).
  // O mês inicial vem da 1ª célula da linha 1 (nome do mês ou número de série — a aba KIDS usa a data).
  function _colDatasAno(aba){
    const ano=+/20\d\d/.exec(aba.nome)[0];
    const r1=aba.rows.get(1)||new Map(), r2=aba.rows.get(2)||new Map(), r3=aba.rows.get(3)||new Map();
    const cols=[...r2.keys()].filter(c=>r2.get(c).num && /^\d+(\.0+)?$/.test(r2.get(c).v)).sort((a,b)=>a-b);
    if(cols.length<300) throw new Error('A linha 2 (números dos dias) da aba '+aba.nome+' não tem o ano inteiro — confira se é o Calendário de Campanhas.');
    let mes=null;
    for(const [,x] of [...r1.entries()].sort((a,b)=>a[0]-b[0])){
      if(x.num && +x.v>40000 && +x.v<80000){ mes=+serialIso(+x.v).slice(5,7)-1; break; }
      const k=MESES.findIndex(m=>sem(x.v).startsWith(m)); if(k>=0){ mes=k; break; }
    }
    if(mes===null) mes=0;
    // a 1ª coluna de dia é dia 1 do mês inicial; se a linha 1 citar um mês depois do 1º dia (cabeçalho adiantado), o dia 1 manda
    const colData=new Map(); let ant=0, erros=0, conferidos=0;
    for(const c of cols){
      const dia=Math.round(+r2.get(c).v); if(dia<ant) mes++; ant=dia;
      if(mes>11) break;
      const d=ano+'-'+z2(mes+1)+'-'+z2(dia);
      colData.set(c,d);
      const w=r3.get(c); if(w){ conferidos++; const dow=new Date(d+'T12:00:00Z').getUTCDay(); if(!sem(w.v).startsWith(DOW[dow])) erros++; }
    }
    if(!conferidos || erros>2) throw new Error('As datas da aba '+aba.nome+' não batem com os dias da semana (linha 3) — o formato mudou?');
    return colData;
  }
  function _barrasDaAba(aba, defs, ordem0, linhas, barras, cont){
    const colData=_colDatasAno(aba);
    const span=new Map(); aba.merges.forEach(m=>span.set(m.r1+','+m.c1,m.c2));
    defs.forEach((L,i)=>{
      for(const [r,row] of [...aba.rows.entries()].sort((a,b)=>a[0]-b[0])){
        const rot=row.get(1); if(!rot || !L.ok(sem(rot.v))) continue;
        linhas[L.id]={ rot:L.rot, ordem:ordem0+i };
        for(const [c,x] of row){
          if(c===1) continue; const txt=limpa(x.v); if(!txt) continue;
          const ini=colData.get(c); const fim=colData.get(span.get(r+','+c)||c)||ini; if(!ini) continue;
          if(++cont.n>MAX_BARRAS) throw new Error('Barras demais na planilha (mais de '+MAX_BARRAS+').');
          barras[hid(L.id+'|'+ini+'|'+txt)]={ linha:L.id, ini, fim, txt:txt.slice(0,200) };
        }
        break; // 1ª linha com esse rótulo
      }
    });
  }
  function montarMarca(abas){
    const aba=abas.find(a=>!a.oculta && /^HERING\s+20\d\d$/i.test(limpa(a.nome)));
    if(!aba) throw new Error('Não achei a aba "HERING 20xx" na planilha.');
    const kids=abas.find(a=>!a.oculta && /^KIDS\s+20\d\d$/i.test(limpa(a.nome)));
    const linhas={}, barras={}, cont={n:0};
    _barrasDaAba(aba, LINHAS_MARCA, 0, linhas, barras, cont);
    if(kids) _barrasDaAba(kids, LINHAS_KIDS, 100, linhas, barras, cont);
    if(!Object.keys(barras).length) throw new Error('Não achei barras nas linhas Coleção sellout, Web, Redes sociais e Canais Intimates/Sports.');
    const ds=Object.values(barras); const de=ds.reduce((a,b)=>b.ini<a?b.ini:a,'9999'), ate=ds.reduce((a,b)=>b.fim>a?b.fim:a,'0000');
    return { aba:aba.nome+(kids?' + '+kids.nome:''), linhas, barras, de, ate, meses:null };
  }

  // ── 🛒 Calendário Comercial Digital: uma aba por mês (modelo Vertex42), de 2026 em diante. Mês = a data do
  // cabeçalho (número de série), não o nome da aba. Semana = linha com os números dos dias; abaixo dela, as linhas
  // rotuladas na coluna B (SITE TODO, SALDOS, MÍDIA, CRM, AÇÃO APP); o que vem ANTES do 1º rótulo vira "Lançamentos e
  // datas" (FERIADO, "12h - DROP 90"…). Dias seguidos com o mesmo texto na mesma linha = 1 barra (até virando a semana).
  const LINHAS_COM=[
    { id:'lancamentos', rot:'Lançamentos e datas', ok:()=>false },
    // 13/11: o time renomeou para "Site e App" (as ações valem nos dois); o leitor aceita o nome antigo e o novo
    { id:'site',        rot:'Site e App · todo (não remarcados)', ok:s=>/^SITE( E APP)?\s*-?\s*TODO\b/.test(s) && !/SALDOS/.test(s) },
    { id:'saldos',      rot:'Site e App · saldos', ok:s=>/^SITE\b.*SALDOS/.test(s) },
    { id:'adulto',      rot:'Saldos · Adulto',    ok:s=>/^ADULTO\b/.test(s) },
    { id:'intimates',   rot:'Saldos · Intimates', ok:s=>/^INTIMATES\b/.test(s) },
    { id:'kids',        rot:'Saldos · Kids',      ok:s=>/^KIDS\b/.test(s) },
    { id:'sports',      rot:'Saldos · Sports',    ok:s=>/^SPORTS\b/.test(s) },
    { id:'midia',       rot:'Mídia',              ok:s=>/^MIDIA\b/.test(s) },
    { id:'crm',         rot:'CRM',                ok:s=>/^CRM\b/.test(s) },
    { id:'app',         rot:'Ação App',           ok:s=>/^ACAO APP\b/.test(s) },
    { id:'acao_site',   rot:'Ação Site',          ok:s=>/^ACAO SITE\b/.test(s) },
    { id:'geral',       rot:'Geral (aba sem rótulos)', ok:()=>false },
  ];
  const ABA_FORA=/rascunho|backup|aprova|copy of|^base\b|oculta|n[aã]o considerar/i; const ABA_FORA_RE=ABA_FORA;
  function linhaDeRotulo(s){ const S=sem(s); if(/^SITE\b/.test(S) && /SALDOS/.test(S)) return 'saldos'; for(const L of LINHAS_COM) if(L.ok(S)) return L.id; return null; }
  function montarComercial(abas, anoMin){
    anoMin=anoMin||2026;
    const porMes=new Map(); // 'AAAA-MM' → {aba, dias: Map(iso → Map(linha → Set(txt)))}
    const naoRec=new Map(); // rótulo da coluna B que o leitor não conhece (o conteúdo vai para a linha de cima) → abas
    for(const aba of abas){
      if(aba.oculta || ABA_FORA.test(aba.nome)) continue;
      // mês pelo número de série no topo (linhas 1–4)
      let mes=null;
      for(let r=1;r<=4 && !mes;r++){ const row=aba.rows.get(r); if(!row) continue; for(const [,x] of row){ if(x.num && +x.v>40000 && +x.v<80000){ mes=serialIso(+x.v).slice(0,7); break; } } }
      if(!mes || +mes.slice(0,4)<anoMin) continue;
      const canon=/^[A-Za-zç]{3}\d{2}$/.test(limpa(aba.nome));
      if(porMes.has(mes) && !(canon && !porMes.get(mes).canon)) continue;
      // linhas de semana: ≥3 células numéricas 1..31 em colunas ≥ 3 (dias da semana)
      const semanas=[];
      for(const [r,row] of [...aba.rows.entries()].sort((a,b)=>a[0]-b[0])){
        const nums=[...row.entries()].filter(([c,x])=>c>=3 && /^\d{1,2}(\.0+)?$/.test(limpa(x.v)) && +x.v>=1 && +x.v<=31);   // o dia 1 às vezes vem como texto ("1")
        if(nums.length>=1 && r>4 && nums.length===[...row.entries()].filter(([c])=>c>=3).length) semanas.push({ r, dias:new Map(nums.map(([c,x])=>[c,Math.round(+x.v)])) });
      }
      if(!semanas.length) continue;
      const alt=semanas.length>1 ? Math.min(...semanas.slice(1).map((s,i)=>s.r-semanas[i].r)) : 12;
      const span=new Map(); aba.merges.forEach(m=>span.set(m.r1+','+m.c1,m.c2));
      // aba sem nenhum rótulo de linha (ex.: Ago26): tudo vai para "Geral", em vez de inflar "Lançamentos"
      let temRotulo=false; for(const [,row] of aba.rows){ const x=row.get(2); if(x && linhaDeRotulo(x.v)){ temRotulo=true; break; } }
      const dias=new Map();
      const add=(d,lin,txt)=>{ if(!dias.has(d)) dias.set(d,new Map()); const m=dias.get(d); if(!m.has(lin)) m.set(lin,new Set()); m.get(lin).add(txt); };
      semanas.forEach((s,i)=>{
        const fimR=(semanas[i+1]?semanas[i+1].r:s.r+alt);
        let lin=temRotulo?'lancamentos':'geral';
        for(let r=s.r+1;r<fimR;r++){
          const row=aba.rows.get(r); if(!row) continue;
          const rot=row.get(2); if(rot && !rot.num){ const l=linhaDeRotulo(rot.v); if(l) lin=l; else if(/[\p{L}]/u.test(rot.v)){ const k=limpa(rot.v).slice(0,60); if(!naoRec.has(k)) naoRec.set(k,new Set()); naoRec.get(k).add(aba.nome); } }
          for(const [c,x] of row){
            if(c<3) continue;
            const txt=limpa(x.v); if(!txt || !/[\p{L}\p{N}]/u.test(txt) || /^notes?:?$/i.test(txt)) continue;
            const c2=span.get(r+','+c)||c;
            for(let cc=c;cc<=c2;cc++){ const dia=s.dias.get(cc); if(dia) add(mes+'-'+z2(dia),lin,txt.slice(0,200)); }
          }
        }
      });
      porMes.set(mes,{ aba:aba.nome, canon, dias });
    }
    if(!porMes.size) throw new Error('Não achei abas de mês de '+anoMin+' em diante no Calendário Comercial.');
    // junta dias seguidos com o mesmo texto na mesma linha
    const todos=new Map(); // linha → txt → [datas]
    for(const [,m] of porMes) for(const [d,ls] of m.dias) for(const [lin,set] of ls) for(const t of set){
      if(!todos.has(lin)) todos.set(lin,new Map()); const mt=todos.get(lin); const k=sem(t); if(!mt.has(k)) mt.set(k,{txt:t,ds:[]}); mt.get(k).ds.push(d);
    }
    const linhas={}, barras={}; let n=0;
    LINHAS_COM.forEach((L,ordem)=>{ if(todos.has(L.id)) linhas[L.id]={ rot:L.rot, ordem }; });
    for(const [lin,mt] of todos) for(const [,{txt,ds}] of mt){
      ds.sort(); let ini=ds[0], ant=ds[0];
      const fecha=()=>{ if(++n>MAX_BARRAS) throw new Error('Barras demais (mais de '+MAX_BARRAS+').'); barras[hid(lin+'|'+ini+'|'+sem(txt))]={ linha:lin, ini, fim:ant, txt }; };
      for(const d of ds.slice(1)){ if(d===ant) continue; if(d===somaDias(ant,1)){ ant=d; continue; } fecha(); ini=d; ant=d; }
      fecha();
    }
    const meses=[...porMes.keys()].sort();
    const de=meses[0]+'-01'; const ult=meses[meses.length-1]; const [ay,am]=ult.split('-').map(Number); const ate=iso(new Date(Date.UTC(ay,am,0)));
    return { abas:[...porMes.values()].map(x=>x.aba), linhas, barras, de, ate, meses, naoReconhecidos:[...naoRec.entries()].map(([r,a])=>r+' ('+[...a].join(', ')+')') };
  }
  // ── 🛍️ Calendário Comercial Marketplace (13/11/2026): cada aba com nome de MÊS ("NOVEMBRO 26", "Julho 2026", "DEZEMBRO") é uma régua
  // longa de dias que carrega meses antigos copiados; o mês DA ABA é o bloco cujo cabeçalho (linha 1) é "<Mês> <ano>" — o último da linha.
  // Datas pela linha 2 (dia) conferidas pela linha 3 (dia da semana). Linhas = marketplaces (coluna A: AMAZON, DAFITI, SHOPEE…) a partir de
  // "HERING MARKETPLACE"; as sublinhas sem rótulo herdam o marketplace de cima. Barras = células mescladas (cortadas no fim do mês).
  // Para no 1º bloco de linhas com data por extenso (número de série) na coluna do mês — é uma tabela solta, não o calendário.
  const MKT=[
    { id:'mkt_amazon',   rot:'Amazon',        ok:s=>/^AMAZON\b/.test(s) },
    { id:'mkt_dafiti',   rot:'Dafiti',        ok:s=>/^DAFITI\b/.test(s) },
    { id:'mkt_shopee',   rot:'Shopee',        ok:s=>/^SHOPEE\b/.test(s) },
    { id:'mkt_meli',     rot:'Mercado Livre (Meli + Full)', ok:s=>/^(MELI|MERCADO ?LIVRE)\b/.test(s) },
    { id:'mkt_tiktok',   rot:'TikTok Shop',   ok:s=>/^TIK ?TOK/.test(s) },
    { id:'mkt_magalu',   rot:'Magalu',        ok:s=>/^MAGALU\b|^MAGAZINE LUIZA\b/.test(s) },
    { id:'mkt_netshoes', rot:'Netshoes',      ok:s=>/^NETSHOES\b/.test(s) },
    { id:'mkt_zattini',  rot:'Zattini',       ok:s=>/^ZATTINI\b/.test(s) },
    { id:'mkt_offprem',  rot:'Off Premium',   ok:s=>/^OFF ?PREMIUM\b/.test(s) },
    { id:'mkt_privalia', rot:'Privalia',      ok:s=>/^PRIVALIA\b/.test(s) },
    { id:'mkt_zzmall',   rot:'Zzmall',        ok:s=>/^ZZ ?MALL\b/.test(s) },
    { id:'mkt_posthaus', rot:'Posthaus',      ok:s=>/^POSTHAUS\b/.test(s) },
    { id:'mkt_offhering',rot:'Off Hering',    ok:s=>/^OFF ?HERING\b/.test(s) },
  ];
  const ABA_MES=/^(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)(\s+(20)?\d\d)?$/; const ABA_MES_RE=ABA_MES;
  function montarMarketplace(abas){
    const porMes=new Map(); // 'AAAA-MM' → {aba, oculta, barras:[]}
    const naoRec=new Map();
    for(const aba of abas){
      const N=sem(aba.nome); if(!ABA_MES.test(N)) continue;           // fora: "provisório", "NOVEMBRO BF", resumos, calculadoras…
      const r1=aba.rows.get(1)||new Map(), r2=aba.rows.get(2)||new Map(), r3=aba.rows.get(3)||new Map();
      // bloco do mês: o cabeçalho "<Mês> <ano>" mais à direita da linha 1
      let ini=null, mesN=-1, ano=0;
      for(const [c,x] of [...r1.entries()].sort((a,b)=>b[0]-a[0])){
        const m=/^(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/?\s*(20\d\d)$/.exec(sem(x.v));
        if(m){ ini=c; mesN=MESES.indexOf(m[1]); ano=+m[2]; break; }
      }
      if(ini===null) continue;
      const colData=new Map(); let ant=0, erros=0, conf=0;
      for(let c=ini; c<ini+40; c++){
        const x=r2.get(c); if(!x || !/^\d{1,2}(\.0+)?$/.test(limpa(x.v))) break;
        const dia=Math.round(+x.v); if(dia<=ant) break; ant=dia;
        const d=ano+'-'+z2(mesN+1)+'-'+z2(dia); colData.set(c,d);
        const w=r3.get(c); if(w){ conf++; const dow=new Date(d+'T12:00:00Z').getUTCDay(); if(!sem(w.v).startsWith(DOW[dow])) erros++; }
      }
      if(colData.size<20 || !conf || erros>2) continue;                  // bloco do mês ilegível: não chuta datas
      const cIni=ini, cFim=Math.max(...colData.keys());
      const span=new Map(); aba.merges.forEach(m=>{ if(m.c1>=cIni && m.c1<=cFim) span.set(m.r1+','+m.c1,m.c2); });
      const mesKey=ano+'-'+z2(mesN+1); const barras=[];
      // o rótulo da coluna A é MESCLADO sobre as sublinhas do marketplace: a mescla diz quais linhas são dele
      const spanA=new Map(); aba.merges.forEach(m=>{ if(m.c1===1 && m.r2>m.r1) spanA.set(m.r1,m.r2); });
      let lin=null, linAte=0, emMkt=false;
      for(const [r,row] of [...aba.rows.entries()].sort((a,b)=>a[0]-b[0])){
        const rot=row.get(1); const R=rot&&!rot.num?sem(rot.v):'';
        if(/^HERING MARKETPLACE\b/.test(R)){ emMkt=true; continue; }
        if(!emMkt || r<=3) continue;
        // tabela solta embaixo (datas por extenso na coluna do mês): fim do calendário
        const c0=row.get(cIni); if(c0 && c0.num && +c0.v>40000) break;
        if(R){ const L=MKT.find(L=>L.ok(R)); linAte=spanA.get(r)||Infinity;   // sem mescla: vale até o próximo rótulo
          if(L) lin=L.id; else { lin=null; if(/[A-Z]/.test(R)){ const k=limpa(rot.v).slice(0,60); if(!naoRec.has(k)) naoRec.set(k,new Set()); naoRec.get(k).add(aba.nome); } } }
        else if(r>linAte) lin=null;   // passou do fim da mescla do rótulo: linha de ninguém
        if(!lin) continue;
        for(const [c,x] of row){
          if(c<cIni || c>cFim) continue;
          const txt=limpa(x.v); if(!txt || !/[\p{L}\p{N}]/u.test(txt)) continue;
          const c2=Math.min(span.get(r+','+c)||c, cFim);
          barras.push({ linha:lin, ini:colData.get(c), fim:colData.get(c2)||colData.get(c), txt:txt.slice(0,200) });
        }
      }
      const atual=porMes.get(mesKey);
      // mesmo mês em 2 abas: vale a visível (a oculta costuma ser rascunho/antiga)
      if(atual && (!atual.oculta || aba.oculta)) continue;
      porMes.set(mesKey,{ aba:aba.nome, oculta:aba.oculta, barras });
    }
    if(!porMes.size) throw new Error('Não achei abas de mês (ex.: "NOVEMBRO 26") com o bloco do mês no fim da linha 1 ("Novembro 2026").');
    const linhas={}, barras={}; let n=0;
    for(const [,m] of porMes) for(const b of m.barras){
      if(++n>MAX_BARRAS) throw new Error('Barras demais (mais de '+MAX_BARRAS+').');
      barras[hid(b.linha+'|'+b.ini+'|'+sem(b.txt))]=b;
    }
    MKT.forEach((L,ordem)=>{ if(Object.values(barras).some(b=>b.linha===L.id)) linhas[L.id]={ rot:L.rot, ordem }; });
    const meses=[...porMes.keys()].sort();
    const de=meses[0]+'-01'; const [ay,am]=meses[meses.length-1].split('-').map(Number); const ate=iso(new Date(Date.UTC(ay,am,0)));
    return { abas:[...porMes.values()].map(x=>x.aba), linhas, barras, de, ate, meses, naoReconhecidos:[...naoRec.entries()].map(([r,a])=>r+' ('+[...a].join(', ')+')') };
  }
  // ── prévia: compara com o que está publicado. Os dois calendários trocam TUDO pelo arquivo novo (a planilha que o time
  // mantém tem o ano inteiro); trocar só "os meses do arquivo" duplicava ou cortava barras que atravessam a virada do mês.
  // O que deixa de existir aparece em "− saem" antes de publicar.
  function mesclar(tipo, novo, atual){
    const atualB=(atual&&atual.barras)||{};
    const barras={...novo.barras}, linhas={...novo.linhas};
    const ids=new Set([...Object.keys(barras),...Object.keys(atualB)]);
    const dif={ novas:[], alteradas:[], removidas:[], iguais:0 };
    for(const id of ids){
      const a=atualB[id], b=barras[id];
      if(a&&!b) dif.removidas.push(a); else if(!a&&b) dif.novas.push(b); else if(a.fim!==b.fim||a.txt!==b.txt||a.linha!==b.linha) dif.alteradas.push(b); else dif.iguais++;
    }
    const ds=Object.values(barras);
    const de=ds.reduce((x,y)=>y.ini<x?y.ini:x,'9999-12-31'), ate=ds.reduce((x,y)=>y.fim>x?y.fim:x,'0000-01-01');
    return { barras, linhas, dif, de, ate };
  }
  return { ler, QUER, montarMarca, montarComercial, montarMarketplace, mesclar, _hid:hid };
})();

  // ── calendários conhecidos (nome, explicação, como montar e o que o reenvio faz)
  const CALS={
    marca:     { icone:'🎯', nome:'Calendário de Marca', sub:'Campanhas · aba HERING: Coleção sellout, Web, Redes sociais e Canais Intimates e Sports · aba KIDS: Coleção sellout, Web e Redes sociais', montar:a=>GXL.montarMarca(a) },
    comercial: { icone:'🛒', nome:'Calendário Comercial Hering', sub:'Uma aba por mês, de 2026 em diante: lançamentos, Site e App (todo e saldos), mídia, CRM e ações de app/site', montar:a=>GXL.montarComercial(a, 2026) },
    mktplace:  { icone:'🛍️', nome:'Calendário Comercial Marketplace', sub:'Abas com nome de mês ("NOVEMBRO 26", "Julho 2026"…): o bloco do mês no fim de cada aba, uma linha por marketplace', montar:a=>GXL.montarMarketplace(a) },
  };
  const REGRA='Publicar troca o calendário inteiro pelo arquivo (envie a planilha com todos os meses). Fica no 🕘 Histórico — dá para voltar a qualquer versão.';
  const escH=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const br=i=>(i||'').split('-').reverse().slice(0,2).join('/');
  const suf=()=>/-dev\.html/.test(location.pathname)?'_dev':'';
  const ref=p=>window._ref(window._db,p);
  const caminho={ cal:t=>'kanban/calendarios_gantt'+suf()+'/'+t, hist:t=>'kanban/calendarios_gantt_hist'+suf()+'/'+t, snap:t=>'kanban/calendarios_gantt_snap'+suf()+'/'+t };
  const novoId=()=>'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const quem=u=>String((u&&(u.displayName||u.email))||'').slice(0,80);

  // arquivo → prévia { arquivo, abas, mescla:{barras,linhas,dif,de,ate}, naoRec }  (lança Error com mensagem para a pessoa)
  async function preparar(tipo, file, atual){
    const C=CALS[tipo]; if(!C) throw new Error('Calendário desconhecido.');
    if(file.size>80*1024*1024) throw new Error('Arquivo grande demais (máx. 80 MB).');
    if(typeof DecompressionStream==='undefined') throw new Error('Este navegador não abre .xlsx aqui. Use o Chrome, o Edge ou o Safari atualizados.');
    const abas=await GXL.ler(await file.arrayBuffer(), GXL.QUER[tipo]);
    const novo=C.montar(abas);
    return { arquivo:String(file.name||'planilha.xlsx').slice(0,200), abas:novo.abas?novo.abas.length+' abas de mês':novo.aba, mescla:GXL.mesclar(tipo, novo, atual&&atual.barras?atual:null), naoRec:novo.naoReconhecidos||[] };
  }
  // HTML da prévia (classes gxl-*; o CSS vem junto, injetado 1x). acoes = { publicar:'js()', cancelar:'js()' } — strings de onclick JÁ seguras
  function previaHtml(tipo, pv, acoes){
    estilo();
    if(pv && pv.lendo) return '<div class="gxl-pv gxl-lendo" role="status">⏳ Lendo 📄 '+escH(pv.lendo)+'…</div>';
    if(pv && pv.erro) return '<div class="gxl-pv gxl-erro" role="alert">❌ '+escH(pv.erro)+'</div>';
    if(!pv || !pv.mescla) return '';
    const d=pv.mescla.dif, lin=pv.mescla.linhas, bs=Object.values(pv.mescla.barras);
    const porLinha=Object.keys(lin).sort((a,b)=>lin[a].ordem-lin[b].ordem).map(k=>escH(lin[k].rot)+' <b>'+bs.filter(b=>b.linha===k).length+'</b>').join(' · ');
    const ex=(arr,ico)=>arr.slice(0,6).map(b=>'<li>'+ico+' <b>'+escH(br(b.ini))+(b.fim!==b.ini?'–'+escH(br(b.fim)):'')+'</b> · '+escH((lin[b.linha]||{}).rot||b.linha)+' · '+escH(b.txt)+'</li>').join('')+(arr.length>6?'<li class="gxl-mais">… e mais '+(arr.length-6)+'</li>':'');
    const nada=!d.novas.length&&!d.alteradas.length&&!d.removidas.length;
    return '<div class="gxl-pv">'
      +'<div class="gxl-tit">Prévia de 📄 '+escH(pv.arquivo)+(pv.abas?' <span>('+escH(pv.abas)+')</span>':'')+'</div>'
      +'<div class="gxl-lin">'+porLinha+'</div>'
      +(pv.naoRec&&pv.naoRec.length?'<div class="gxl-aviso" role="alert">⚠ Rótulos que não reconheci — o conteúdo deles não entrou (ou foi para a linha de cima): '+pv.naoRec.slice(0,8).map(escH).join(' · ')+(pv.naoRec.length>8?' …':'')+'. Confira o nome na planilha.</div>':'')
      +'<div class="gxl-dif"><span class="gxl-novo">＋ '+d.novas.length+' novas</span><span class="gxl-alt">✎ '+d.alteradas.length+' mudaram</span><span class="gxl-rem">− '+d.removidas.length+' saem</span><span class="gxl-ig">'+d.iguais+' iguais</span></div>'
      +(nada?'<div class="gxl-ig" style="margin-top:6px;">Nada mudou em relação ao que está publicado.</div>':'<ul class="gxl-ul">'+ex(d.novas,'＋')+ex(d.alteradas,'✎')+ex(d.removidas,'−')+'</ul>')
      +'<div class="gxl-regra">'+escH(REGRA)+'</div>'
      +'<div class="gxl-pe"><button type="button" class="btn-p gxl-ok" onclick="'+acoes.publicar+'"'+(nada?' disabled':'')+'>✅ Publicar para todas as squads</button>'
      +'<button type="button" class="btn gxl-cancel" onclick="'+acoes.cancelar+'">Cancelar</button></div></div>';
  }
  // grava cópia → calendário → linha no histórico. Devolve o calendário gravado.
  async function publicar(tipo, pv, user, extra){
    if(!CALS[tipo] || !pv || !pv.mescla) throw new Error('Nada para publicar.');
    const id=novoId(), agora=Date.now(), d=pv.mescla.dif;
    const meta={ atualizadoEm:agora, porNome:quem(user)||'—', arquivo:String(pv.arquivo||'').slice(0,200), de:pv.mescla.de, ate:pv.mescla.ate };
    const dado={ meta, linhas:pv.mescla.linhas, barras:pv.mescla.barras };
    const h={ em:agora, porUid:String(user&&user.uid||''), porNome:meta.porNome, arquivo:meta.arquivo, acao:(extra&&extra.acao)||'publicou', snap:(extra&&extra.snap)||id,
      n:Object.keys(dado.barras).length, novas:d.novas.length, mudaram:d.alteradas.length, saem:d.removidas.length };
    if(extra&&extra.deEm) h.deEm=extra.deEm;
    // UMA gravação com os 3 caminhos (tudo ou nada): o calendário nunca muda sem a linha do histórico e a cópia
    const rel=c=>c.replace(/^kanban\//,'');
    const pacote={}; pacote[rel(caminho.cal(tipo))]=dado; pacote[rel(caminho.snap(tipo))+'/'+id]=dado; pacote[rel(caminho.hist(tipo))+'/'+id]=h;
    await window._update(ref('kanban'), pacote);
    return dado;
  }
  async function historico(tipo){
    const sn=await window._get(ref(caminho.hist(tipo)));
    const v=(sn&&sn.exists()&&sn.val())||{};
    return Object.entries(v).map(([id,h])=>Object.assign({ id }, h)).filter(h=>h&&typeof h.em==='number').sort((a,b)=>b.em-a.em);
  }
  // volta para a versão de uma linha do histórico (lê só a cópia dela); vira uma linha "restaurou" no histórico
  async function restaurar(tipo, h, user, atual){
    const sn=await window._get(ref(caminho.snap(tipo)+'/'+h.snap));
    if(!sn || !sn.exists()) throw new Error('A cópia desta versão não está mais guardada.');
    const v=sn.val();
    const mescla=GXL.mesclar(tipo, { barras:v.barras||{}, linhas:v.linhas||{} }, atual&&atual.barras?atual:null);
    return publicar(tipo, { arquivo:(v.meta&&v.meta.arquivo)||h.arquivo||'', mescla }, user, { acao:'restaurou', snap:h.snap, deEm:h.em });
  }
  let _estilo=false;
  function estilo(){
    if(_estilo) return; _estilo=true;
    const s=document.createElement('style'); s.id='gxl-css';
    s.textContent='.gxl-pv{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--glass-b);background:rgba(var(--ink-rgb,6,26,46),.35);font-size:12px;color:var(--txt);line-height:1.5;overflow-wrap:anywhere}'
      +'.gxl-erro{color:var(--danger)}.gxl-tit{font-weight:700;margin-bottom:4px}.gxl-tit span{font-weight:400;color:var(--txt2)}.gxl-lin{color:var(--txt2);margin-bottom:6px}'
      +'.gxl-aviso{color:var(--warn);font-weight:600;margin-bottom:6px}.gxl-dif{display:flex;gap:10px;flex-wrap:wrap;font-weight:700}.gxl-novo{color:var(--teal)}.gxl-alt{color:var(--warn)}.gxl-rem{color:var(--danger)}.gxl-ig{color:var(--txt2);font-weight:400}'
      +'.gxl-ul{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px;max-height:200px;overflow:auto}.gxl-ul li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gxl-mais{color:var(--txt2)}'
      +'.gxl-regra{color:var(--txt2);font-size:11px;margin-top:8px}.gxl-pe{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.gxl-pe .btn,.gxl-pe .btn-p{min-height:36px}'
      +'@media (hover:none) and (pointer:coarse){.gxl-pe .btn,.gxl-pe .btn-p{min-height:44px}}';
    document.head.appendChild(s);
  }
  window.MareGXL=Object.assign({}, GXL, { CALS, preparar, previaHtml, publicar, historico, restaurar, caminho });
  try{ estilo(); }catch(e){}   // a lista do 🕘 Histórico usa as mesmas cores da prévia
})();
