/* mare-metas-dev.js — 🐟 METAS e DESAFIOS ("O mar tá pra peixe"), módulo compartilhado (raiz do domínio) usado por kanban(-dev) e painel(-dev).
   Mesmo ciclo dev→prod do mare-notif/mare-dicas: as páginas -dev carregam mare-metas-dev.js?v=N, as de produção mare-metas.js?v=N.

   O que vive aqui (as páginas só ligam e chamam):
     • MATEMÁTICA pura (testável em Node): pct, esperado (ritmo), status, marco (de 20 em 20 %), falta, ritmo necessário por dia, formatação.
     • VISUAL no estilo do Radar (tokens CSS das páginas: --teal/--warn/--danger/--accent/--cyan): anel de progresso com marca do "esperado hoje", barra de
       marcos com peixes, gráfico de evolução (linha real × ritmo ideal × meta), KPIs, cartões de desafio, ranking de squads.
     • FORMULÁRIOS (nova meta/desafio com lembrete) e "Atualizar valor" (definir total ou somar), iguais no Maré e no Painel.
     • POPUP 🐟 "O mar tá pra peixe!" quando uma meta cruza 20/40/60/80/100 %.
     • CAMADA DE DADOS (usa window._db/_ref/_set/_update/_get/_onValue, que as duas páginas já expõem): ouvir, salvar, registrar, histórico.

   Dados (dev usa o sufixo _dev, como dados_diarios_dev; produção, sem sufixo):
     kanban/metas_digital[_dev]/{id}            metas e desafios do Digital inteiro (configurados no Painel)
     kanban/metas_squads[_dev]/{squadId}/{id}   metas e desafios de cada squad (configurados no Maré; `global:true` = aparece na visão do Digital)
     kanban/metas_log[_dev]/{id}/{chave}        histórico dos valores informados {v, t, por, nome, nota?}
   Meta: {id, escopo:'digital'|'squad', squad?, tipo:'meta'|'desafio', titulo, emoji, fmt:'brl'|'num'|'pct', sufixo?, alvo, inicial, atual?,
          inicio?, fim?, submarca?, canal?, global?, ativo, lembrete:{modo:'off'|'cada'|'diario'|'horarios', ...}, responsaveis?[uid],
          marco(0-100, o MAIOR já atingido), marcoTs, atualizadoEm, atualizadoPor, atualizadoNome, criadoEm, criadoPor, ordem}
   Os lembretes de preenchimento (functions/metas/lembretes.js) leem esses mesmos nós. */
(function(root){
  'use strict';

  const IS_DEV = typeof location !== 'undefined' && /-dev\.html/.test(location.pathname);
  const SFX = IS_DEV ? '_dev' : '';
  const PATHS = { digital: 'kanban/metas_digital' + SFX, squads: 'kanban/metas_squads' + SFX, log: 'kanban/metas_log' + SFX };
  const SP = 'America/Sao_Paulo';

  // ── Listas fixas (mesmos ids de SUBMARCA_TAGS / CANAL_VENDA_TAGS do kanban-dev.html — manter iguais) ──
  const SUBMARCAS = [
    { id: 'tag_sm_adulto_com', label: 'Hering Adulto Comercial' }, { id: 'tag_sm_adulto_cad', label: 'Hering Adulto Cadastro' },
    { id: 'tag_sm_kids_com', label: 'Hering Kids Comercial' }, { id: 'tag_sm_kids_cad', label: 'Hering Kids Cadastro' },
    { id: 'tag_sm_sports_com', label: 'Hering Sports Comercial' }, { id: 'tag_sm_sports_cad', label: 'Hering Sports Cadastro' },
    { id: 'tag_sm_intimates_com', label: 'Hering Intimates Comercial' }, { id: 'tag_sm_intimates_cad', label: 'Hering Intimates Cadastro' },
    { id: 'tag_sm_teen_com', label: 'Hering Teen Comercial' }, { id: 'tag_sm_teen_cad', label: 'Hering Teen Cadastro' },
  ];
  const CANAIS = [
    { id: 'tag_cv_meli1', label: 'Mercado Livre (ME1)' }, { id: 'tag_cv_meli2', label: 'Mercado Livre (ME2)' }, { id: 'tag_cv_melifull', label: 'Mercado Livre (Full)' },
    { id: 'tag_cv_dafiti', label: 'Dafiti' }, { id: 'tag_cv_netshoes', label: 'Netshoes' }, { id: 'tag_cv_shopee', label: 'Shopee' }, { id: 'tag_cv_shopeekids', label: 'Shopee Kids' },
    { id: 'tag_cv_amazon', label: 'Amazon' }, { id: 'tag_cv_amazonfba', label: 'Amazon (FBA)' }, { id: 'tag_cv_privalia', label: 'Privalia' }, { id: 'tag_cv_magalu', label: 'Magazine Luiza' },
    { id: 'tag_cv_zzmall', label: 'ZZ Mall' }, { id: 'tag_cv_offpremium', label: 'Off Premium' }, { id: 'tag_cv_tiktokshop', label: 'TikTok Shop' },
  ];
  const EMOJIS = ['🎯', '🏆', '🔥', '👕', '🧒', '🛒', '📱', '💰', '🚀', '⭐', '🎁', '📦'];
  const MARCOS = [20, 40, 60, 80, 100];

  // ════════════════ MATEMÁTICA (pura) ════════════════
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isNum = v => v !== null && v !== undefined && v !== '' && isFinite(Number(v));
  const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: SP });
  function diaN(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null; }
  const curto = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '/' + m[2] : ''; };

  function ptNum(v, dec) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: dec == null ? 0 : dec }); }
  // Valor legível de relance: R$ 1,25 mi · R$ 350 mil · R$ 4.800 · 1.250 camisetas · 42%
  function fmtVal(m, v, longo) {
    if (!isNum(v)) return '—';
    v = Number(v);
    if (m && m.fmt === 'pct') return ptNum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) + '%';
    const a = Math.abs(v);
    let t;
    if (!longo && a >= 1e6) t = ptNum(v / 1e6, 2) + ' mi';
    else if (!longo && a >= 1e5) t = ptNum(v / 1e3, 0) + ' mil';
    else t = ptNum(v, a < 100 && v % 1 ? 1 : 0);
    if (m && m.fmt === 'brl') return 'R$ ' + t;
    return t + (m && m.sufixo ? ' ' + m.sufixo : '');
  }

  // % pra MOSTRAR: arredonda, mas só diz 100 quando a meta foi batida de verdade (99,7 % aparece 99 %, não "100%" sem o 🏆 e sem o popup).
  const pctTxt = p => p == null || !isFinite(p) ? '—' : (p < 100 ? Math.min(99, Math.round(p)) : Math.round(p)) + '%';
  // % da meta (pode passar de 100). null = ainda sem valor informado.
  function pct(m) {
    if (!m || !isNum(m.atual) || !isNum(m.alvo)) return null;
    const i = isNum(m.inicial) ? Number(m.inicial) : 0, t = Number(m.alvo);
    if (t === i) return null;
    return (Number(m.atual) - i) / (t - i) * 100;
  }
  // ── Diarização (ritmo NÃO linear): o time define antes quanto a meta pede de cada dia. `m.curva` = { 'AAAA-MM-DD': peso } (valor do dia ou peso — vale a proporção).
  const isoDe = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const curvaPeso = v => (isNum(v) && Number(v) > 0 ? Number(v) : 0);
  function curvaTotal(m) { return Object.keys((m && m.curva) || {}).reduce((t, k) => t + curvaPeso(m.curva[k]), 0); }
  function temCurva(m) { const a = diaN(m && m.inicio), b = diaN(m && m.fim); return !!(m && m.curva && typeof m.curva === 'object' && a != null && b != null && b > a && curvaTotal(m) > 0); }
  // % acumulado da curva até o fim do dia `hoje` (só dias dentro do período).
  function curvaAcum(m, hoje) {
    const a = diaN(m.inicio), b = diaN(m.fim), h = Math.min(diaN(hoje), b), tot = curvaTotal(m); let acc = 0;
    for (let d = a; d <= h; d++) acc += curvaPeso(m.curva[isoDe(d)]);
    return acc / tot * 100;
  }
  // Quanto a meta pede só DESTE dia (na unidade da meta), pela curva; null = sem curva ou fora do período.
  function metaDoDia(m, hoje) {
    if (!temCurva(m)) return null;
    const h = diaN(hoje || hojeSP()); if (h == null || h < diaN(m.inicio) || h > diaN(m.fim)) return null;
    return curvaPeso(m.curva[isoDe(h)]) / curvaTotal(m) * (Number(m.alvo) - (isNum(m.inicial) ? Number(m.inicial) : 0));
  }
  // Fração do dia que já passou em Brasília (0 = meia-noite, 1 = fim do dia).
  function fracAgora() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: SP, hour12: false, hour: '2-digit', minute: '2-digit' }).format(new Date()).split(':');
    return ((Number(p[0]) % 24) * 60 + Number(p[1])) / 1440;
  }
  // % que "deveria" estar hoje: LINEAR = fim do dia pelo calendário (último dia = 100); COM DIARIZAÇÃO = o acumulado até ontem + a parte de hoje na proporção da hora do dia
  // (sem isso, um dia pesado da curva — ex.: 50 % da meta no último dia — deixaria o farol vermelho às 00:01). `hoje` explícito = fim do dia (determinístico, testes);
  // `fracDia` (0–1) força a fração. null = sem período (ou período de 1 dia só).
  function esperado(m, hoje, fracDia) {
    const agoraImplicito = hoje === undefined || hoje === null || hoje === '';
    const a = diaN(m && m.inicio), b = diaN(m && m.fim), h = diaN(hoje || hojeSP());
    if (a == null || b == null || b <= a || h == null) return null;
    if (h < a) return 0;
    if (temCurva(m)) {
      if (h > b) return 100;
      const frac = fracDia != null ? Math.max(0, Math.min(1, fracDia)) : (agoraImplicito ? fracAgora() : 1);
      const ontem = h > a ? curvaAcum(m, isoDe(h - 1)) : 0;
      return Math.min(100, ontem + curvaPeso(m.curva[isoDe(h)]) / curvaTotal(m) * 100 * frac);
    }
    if (h >= b) return 100;
    return (h - a + 1) / (b - a + 1) * 100;
  }
  // Número em formato brasileiro ("R$ 1.234,56", "1.500", "12,5%") → Number; NaN se não der.
  function numPt(x) {
    let t = String(x == null ? '' : x).replace(/R\$|%|\s/g, ''); if (!t) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else if (t.includes(',')) t = t.replace(',', '.');
    const v = Number(t); return isFinite(v) ? v : NaN;
  }
  // Lê o que a pessoa colou da planilha: uma coluna de valores NA ORDEM dos dias, ou linhas "dd/mm valor". `datas` = os dias do período. → {valores:{data:valor}, aviso}
  function lerColado(texto, datas) {
    const linhas = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean), out = {};
    const DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
    const diaDe = (tok) => { const mt = DATA.exec(tok); if (!mt) return null; const mm = mt[2].padStart(2, '0') + '-' + mt[1].padStart(2, '0'); return datas.find(d => d.slice(5) === mm && (!mt[3] || d.slice(0, 4) === (mt[3].length === 2 ? '20' + mt[3] : mt[3]))) || ''; };
    const celulas = l => l.split(/[\t;]+/).map(c => c.trim()).filter(Boolean);
    let comData = 0, ignoradas = 0;
    const emOrdem = [];
    linhas.forEach(l => {
      let c = celulas(l), dia = null, val = null;
      if (c.length === 1) { const sp = /^(\S+)\s+(.+)$/.exec(c[0]); if (sp && DATA.test(sp[1])) c = [sp[1], sp[2]]; }
      if (c.length >= 2 && DATA.test(c[0])) { comData++; dia = diaDe(c[0]); val = numPt(c[1]); if (dia && !isNaN(val) && val >= 0) out[dia] = val; else ignoradas++; return; }
      if (c.length > 1 && linhas.length === 1) { c.forEach(x => emOrdem.push(numPt(x))); return; }   // uma linha só, vários valores (colou uma LINHA da planilha)
      emOrdem.push(numPt(c[c.length - 1]));
    });
    let aviso = '';
    if (comData) { aviso = ignoradas ? ignoradas + ' linha(s) ignorada(s) (data fora do período ou valor inválido).' : ''; return { valores: out, aviso }; }
    emOrdem.forEach((v, i) => { if (i < datas.length && !isNaN(v) && v >= 0) out[datas[i]] = v; });
    if (emOrdem.some(v => isNaN(v) || v < 0)) aviso = 'Alguns valores não são números válidos e foram ignorados.';
    else if (emOrdem.length !== datas.length) aviso = emOrdem.length + ' valor(es) colado(s) para ' + datas.length + ' dia(s) — confira.';
    return { valores: out, aviso };
  }
  // Situação — mesma linguagem do Radar (verde no ritmo · amarelo atenção · vermelho atrasada · azul batida · cinza sem dado).
  const STATUS = {
    batida: { id: 'batida', label: 'Meta batida', ico: '🏆', cor: 'var(--accent)' },
    no_ritmo: { id: 'no_ritmo', label: 'No ritmo', ico: '🟢', cor: 'var(--teal)' },
    atencao: { id: 'atencao', label: 'Atenção', ico: '🟡', cor: 'var(--warn)' },
    atrasada: { id: 'atrasada', label: 'Atrasada', ico: '🔴', cor: 'var(--danger)' },
    andamento: { id: 'andamento', label: 'Em andamento', ico: '🔵', cor: 'var(--cyan)' },
    encerrada: { id: 'encerrada', label: 'Encerrada', ico: '⚪', cor: 'var(--danger)' },
    futura: { id: 'futura', label: 'Ainda não começou', ico: '⏳', cor: 'var(--txt3)' },
    sem_dado: { id: 'sem_dado', label: 'Sem valor ainda', ico: '⚪', cor: 'var(--txt3)' },
  };
  function status(m, hoje, fracDia) {
    const agoraImplicito = !hoje;
    hoje = hoje || hojeSP();
    const p = pct(m), h = diaN(hoje), a = diaN(m && m.inicio), b = diaN(m && m.fim);
    if (a != null && h < a) return STATUS.futura;
    if (p === null) return (b != null && h > b) ? STATUS.encerrada : STATUS.sem_dado;
    if (p >= 100) return STATUS.batida;
    if (b != null && h > b) return STATUS.encerrada;
    const e = esperado(m, agoraImplicito ? undefined : hoje, fracDia);
    if (e == null) return STATUS.andamento;
    if (e <= 0) return STATUS.no_ritmo;   // a curva ainda não pediu nada (início do 1º dia / dia de peso zero)
    const r = p / e * 100;
    return r >= 95 ? STATUS.no_ritmo : r >= 70 ? STATUS.atencao : STATUS.atrasada;
  }
  // Maior múltiplo de 20 já alcançado (0, 20, 40, 60, 80, 100).
  function marcoDe(p) { if (p === null || p === undefined || !isFinite(p) || p < 20) return 0; return p >= 100 ? 100 : Math.floor(p / 20) * 20; }
  function valorDoMarco(m, marco) { const i = isNum(m.inicial) ? Number(m.inicial) : 0; return i + (Number(m.alvo) - i) * marco / 100; }
  function proximoMarco(m) {
    const p = pct(m), cur = marcoDe(p);
    if (cur >= 100) return null;
    const alvoMarco = cur + 20, valor = valorDoMarco(m, alvoMarco);
    return { marco: alvoMarco, valor, falta: valor - (isNum(m.atual) ? Number(m.atual) : (isNum(m.inicial) ? Number(m.inicial) : 0)) };
  }
  // Quanto falta pro alvo (nos dois sentidos: meta de subir ou de descer). Sem valor ainda = a distância toda.
  function falta(m) {
    const i = isNum(m.inicial) ? Number(m.inicial) : 0, t = Number(m.alvo);
    if (!isNum(m.atual)) return Math.abs(t - i);
    return t >= i ? Math.max(0, t - Number(m.atual)) : Math.max(0, Number(m.atual) - t);
  }
  function diasRestantes(m, hoje) { const b = diaN(m && m.fim), h = diaN(hoje || hojeSP()); return (b == null || h == null) ? null : Math.max(0, b - h); }
  // Quanto precisa entrar por dia (contando hoje) pra bater a meta no prazo.
  function ritmoNecessario(m, hoje) {
    const d = diasRestantes(m, hoje); if (d == null) return null;
    const f = falta(m); if (f <= 0) return 0;
    return f / (d + 1);
  }
  // O que gravar quando alguém informa um valor: sobe o marco (nunca desce — o popup é por conquista) e carimba quando e quem.
  function patchDeRegistro(m, valor, user, agora) {
    agora = agora || Date.now();
    const novo = Object.assign({}, m, { atual: Number(valor) });
    const mc = marcoDe(pct(novo));
    const patch = { atual: Number(valor), atualizadoEm: agora, atualizadoPor: (user && user.uid) || null, atualizadoNome: (user && user.nome) || '' };
    if (mc > (Number(m.marco) || 0)) { patch.marco = mc; patch.marcoTs = agora; }
    return patch;
  }
  function ago(ms, agora) {
    if (!ms) return '';
    const s = Math.max(0, ((agora || Date.now()) - ms) / 1000);
    if (s < 90) return 'agora há pouco';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    return 'há ' + Math.round(s / 86400) + ' d';
  }
  // Quanto tempo sem atualizar é "atrasado" pro lembrete configurado (alimenta o selo ⏰ do cartão).
  function intervaloLembreteMs(m) {
    const l = m && m.lembrete; if (!l || l.modo === 'off' || !l.modo) return 24 * 3600e3;
    if (l.modo === 'cada') return (Number(l.cada) || 1) * 3600e3;
    return 24 * 3600e3;
  }
  function desatualizada(m, agora) {
    agora = agora || Date.now();
    if (!m || m.ativo === false || (pct(m) !== null && pct(m) >= 100)) return false;
    const hoje = hojeSP(), a = diaN(m.inicio), b = diaN(m.fim), h = diaN(hoje);
    if ((a != null && h < a) || (b != null && h > b)) return false;
    return !m.atualizadoEm || (agora - m.atualizadoEm) > intervaloLembreteMs(m) * 2;
  }
  function lembreteTxt(l) {
    if (!l || !l.modo || l.modo === 'off') return 'sem lembrete';
    if (l.modo === 'cada') return 'a cada ' + (Number(l.cada) || 1) + 'h (' + (l.de || '08:00') + '–' + (l.ate || '20:00') + ')';
    if (l.modo === 'diario') return '1× por dia às ' + (l.hora || '09:00');
    return 'às ' + (l.horas || []).join(', ');
  }
  const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/, DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
  // Valida/normaliza o que veio do formulário. Devolve {ok:true, meta} ou {ok:false, erro}.
  function validar(inp) {
    const m = {};
    m.escopo = inp.escopo === 'squad' ? 'squad' : 'digital';
    if (m.escopo === 'squad') { if (!/^[A-Za-z0-9_-]{1,40}$/.test(inp.squad || '')) return { ok: false, erro: 'Squad inválida.' }; m.squad = inp.squad; }
    m.tipo = inp.tipo === 'desafio' ? 'desafio' : 'meta';
    m.titulo = String(inp.titulo || '').trim().slice(0, 80);
    if (!m.titulo) return { ok: false, erro: 'Dê um nome à ' + (m.tipo === 'desafio' ? 'desafio' : 'meta') + '.' };
    m.emoji = String(inp.emoji || (m.tipo === 'desafio' ? '🏆' : '🎯')).slice(0, 4);
    m.fmt = ['brl', 'num', 'pct'].includes(inp.fmt) ? inp.fmt : 'num';
    m.sufixo = m.fmt === 'num' ? String(inp.sufixo || '').trim().slice(0, 16) : '';
    if (!isNum(inp.alvo) || Number(inp.alvo) === 0) return { ok: false, erro: 'Informe o valor da meta (alvo).' };
    m.alvo = Number(inp.alvo);
    m.inicial = isNum(inp.inicial) ? Number(inp.inicial) : 0;
    if (m.inicial === m.alvo) return { ok: false, erro: 'O valor inicial não pode ser igual ao alvo.' };
    if (isNum(inp.atual)) m.atual = Number(inp.atual);
    m.inicio = DATA_RE.test(inp.inicio || '') ? inp.inicio : '';
    m.fim = DATA_RE.test(inp.fim || '') ? inp.fim : '';
    if ((m.inicio && !m.fim) || (!m.inicio && m.fim)) { if (m.inicio) m.fim = m.inicio; else m.inicio = m.fim; }   // um dia só
    if (m.inicio && m.fim && diaN(m.fim) < diaN(m.inicio)) return { ok: false, erro: 'O fim do período é antes do início.' };
    m.submarca = SUBMARCAS.some(x => x.id === inp.submarca) ? inp.submarca : '';
    m.canal = CANAIS.some(x => x.id === inp.canal) ? inp.canal : '';
    if (inp.ritmo === 'dia') {   // diarização: peso por dia dentro do período
      const a = diaN(m.inicio), b = diaN(m.fim);
      if (a == null || b == null || b <= a) return { ok: false, erro: 'Pra distribuir a meta por dia, informe o período (de/até) com pelo menos 2 dias.' };
      if (b - a + 1 > 93) return { ok: false, erro: 'Período grande demais pra distribuir por dia (máximo 93 dias).' };
      const cv = {}; let tot = 0;
      for (let d = a; d <= b; d++) { const w = curvaPeso(((inp.curva || {})[isoDe(d)])); cv[isoDe(d)] = w; tot += w; }
      if (tot <= 0) return { ok: false, erro: 'Informe quanto a meta pede de pelo menos um dia (ou use o ritmo linear).' };
      m.curva = cv;
    }
    m.global = m.escopo === 'squad' ? !!inp.global : false;
    m.ativo = inp.ativo !== false;
    const l = inp.lembrete || {};
    const modo = ['off', 'cada', 'diario', 'horarios'].includes(l.modo) ? l.modo : 'off';
    m.lembrete = { modo };
    if (modo === 'cada') {
      m.lembrete.cada = [1, 2, 3, 4].includes(Number(l.cada)) ? Number(l.cada) : 1;
      m.lembrete.de = HORA_RE.test(l.de || '') ? l.de : '08:00';
      m.lembrete.ate = HORA_RE.test(l.ate || '') ? l.ate : '20:00';
      if (m.lembrete.ate <= m.lembrete.de) return { ok: false, erro: 'No lembrete, o horário final precisa ser depois do inicial.' };
    }
    if (modo === 'diario') m.lembrete.hora = HORA_RE.test(l.hora || '') ? l.hora : '09:00';
    if (modo === 'horarios') {
      const hs = [...new Set((l.horas || []).filter(h => HORA_RE.test(h)))].sort().slice(0, 4);
      if (!hs.length) return { ok: false, erro: 'No lembrete por horário exato, informe pelo menos um horário.' };
      m.lembrete.horas = hs;
    }
    const resp = (inp.responsaveis || []).filter(x => typeof x === 'string' && x && x.length <= 128);
    if (resp.length) m.responsaveis = [...new Set(resp)].slice(0, 12);
    if (inp.id) m.id = inp.id;
    if (isNum(inp.ordem)) m.ordem = Number(inp.ordem);
    return { ok: true, meta: m };
  }
  function ordenar(lista) {
    return lista.slice().sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'meta' ? -1 : 1) || (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.criadoEm || 0).localeCompare(String(b.criadoEm || 0)));
  }

  // ════════════════ VISUAL ════════════════
  const CSS = `
.mm{--mm-r:14px;color:var(--txt);font-family:inherit;}
.mm *{box-sizing:border-box;}
.mm-sec{margin:0 0 16px;}
.mm-sec-t{display:flex;align-items:center;gap:8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:var(--txt3);margin:0 0 8px;}
.mm-sec-t::after{content:"";flex:1;height:1px;background:var(--glass-b,rgba(255,255,255,.1));}
.mm-hero{position:relative;border-radius:var(--mm-r);padding:16px 14px 14px;background:linear-gradient(160deg,rgba(var(--surface-rgb,16,31,48),.85),rgba(var(--surface-rgb,16,31,48),.55));border:1px solid var(--glass-b,rgba(255,255,255,.1));overflow:hidden;}
.mm-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 80% at 100% 0%,var(--mm-c,transparent) 0%,transparent 55%);opacity:.14;}
.mm-hero-top{display:flex;align-items:center;gap:14px;position:relative;}
.mm-hero-txt{flex:1;min-width:0;}
.mm-kick{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--txt3);font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.mm-ttl{font-family:"DM Sans",sans-serif;font-size:17px;font-weight:800;line-height:1.2;margin:2px 0 6px;word-break:break-word;}
.mm-big{font-family:"DM Sans",sans-serif;font-size:26px;font-weight:700;line-height:1.1;}
.mm-big small{font-size:12px;font-weight:500;color:var(--txt3);}
.mm-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--mm-c,var(--txt3)) 16%,transparent);color:var(--mm-c,var(--txt2));border:1px solid color-mix(in srgb,var(--mm-c,var(--txt3)) 38%,transparent);white-space:nowrap;}
.mm-ring{position:relative;flex:none;}
.mm-ring svg{display:block;transform:rotate(-90deg);overflow:visible;}
.mm-ring-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.05;}
.mm-ring-c b{font-family:"DM Sans",sans-serif;font-weight:700;color:var(--txt);}
.mm-ring-c small{font-size:9.5px;color:var(--txt3);margin-top:2px;}
.mm-ring .mm-arc{transition:stroke-dasharray .6s cubic-bezier(.2,.8,.2,1);}
.mm-ring.batida .mm-arc{filter:drop-shadow(0 0 6px var(--accent));}
.mm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:12px;position:relative;}
.mm-kpi{border-radius:10px;padding:7px 9px;background:rgba(var(--ink-rgb,0,0,0),.32);border:1px solid var(--glass-b,rgba(255,255,255,.08));}
.mm-kpi small{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--txt3);font-weight:700;}
.mm-kpi b{display:block;font-size:14px;font-weight:700;margin-top:1px;}
.mm-kpi.warn b{color:var(--warn);} .mm-kpi.bad b{color:var(--danger);} .mm-kpi.ok b{color:var(--teal);}
.mm-marcos{margin-top:14px;position:relative;}
.mm-mtrack{display:flex;gap:3px;height:12px;}
.mm-mseg{flex:1;border-radius:3px;background:rgba(var(--ink-rgb,0,0,0),.55);overflow:hidden;position:relative;}
.mm-mseg:first-child{border-radius:7px 3px 3px 7px;} .mm-mseg:last-child{border-radius:3px 7px 7px 3px;}
.mm-mseg i{position:absolute;inset:0 auto 0 0;display:block;background:linear-gradient(90deg,color-mix(in srgb,var(--mm-c,var(--teal)) 60%,transparent),var(--mm-c,var(--teal)));border-radius:inherit;transition:width .5s;}
.mm-mfish{display:flex;gap:3px;margin-top:3px;}
.mm-mfish span{flex:1;text-align:right;font-size:9.5px;color:var(--txt3);line-height:1.1;}
.mm-mfish span em{display:block;font-style:normal;font-size:15px;filter:grayscale(1);opacity:.28;transition:all .3s;}
.mm-mfish span.on{color:var(--txt2);font-weight:700;}
.mm-mfish span.on em{filter:none;opacity:1;animation:mm-bob 2.6s ease-in-out infinite;}
.mm-mfish span.on:nth-child(2) em{animation-delay:.3s;} .mm-mfish span.on:nth-child(3) em{animation-delay:.6s;} .mm-mfish span.on:nth-child(4) em{animation-delay:.9s;} .mm-mfish span.on:nth-child(5) em{animation-delay:1.2s;}
@keyframes mm-bob{0%,100%{transform:translateY(0) rotate(0);}50%{transform:translateY(-3px) rotate(-8deg);}}
.mm-next{font-size:11.5px;color:var(--txt2);margin-top:8px;line-height:1.45;position:relative;}
.mm-next b{color:var(--txt);}
.mm-upd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;position:relative;flex-wrap:wrap;}
.mm-upd-t{font-size:10.5px;color:var(--txt3);}
.mm-upd-t.stale{color:var(--warn);font-weight:700;}
.mm-btn{font:inherit;font-size:12px;font-weight:700;padding:7px 13px;border-radius:10px;border:1px solid var(--glass-b,rgba(255,255,255,.14));background:rgba(var(--surface-rgb,16,31,48),.7);color:var(--txt);cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.mm-btn:hover{border-color:var(--accent);}
.mm-btn.p{background:linear-gradient(135deg,var(--accent),var(--teal));color:#04141f;border:0;}
.mm-btn.d{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent);}
.mm-btn.s{font-size:11px;padding:4px 9px;border-radius:8px;}
.mm-btn:disabled{opacity:.55;cursor:default;}
.mm-chart{margin-top:12px;position:relative;color:var(--txt2);}
.mm-chart svg{width:100%;height:auto;display:block;overflow:visible;}
.mm-chart-vazio{font-size:11.5px;color:var(--txt3);text-align:center;padding:14px 4px;}
.mm-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--txt3);margin-top:4px;}
.mm-leg i{display:inline-block;width:14px;height:0;border-top:2.5px solid var(--mm-c,var(--teal));vertical-align:middle;margin-right:4px;}
.mm-leg i.id{border-top:2px dashed var(--txt3);} .mm-leg i.mt{border-top:2px dashed var(--accent);}
.mm-grid{display:grid;grid-template-columns:1fr;gap:10px;}
.mm-card{position:relative;border-radius:12px;padding:11px 12px;background:rgba(var(--surface-rgb,16,31,48),.6);border:1px solid var(--glass-b,rgba(255,255,255,.1));border-left:4px solid var(--mm-c,var(--txt3));}
.mm-card-h{display:flex;align-items:flex-start;gap:9px;}
.mm-card-e{font-size:22px;line-height:1;flex:none;}
.mm-card-t{flex:1;min-width:0;}
.mm-card-t b{display:block;font-size:13px;line-height:1.25;word-break:break-word;}
.mm-card-pct{font-family:"DM Sans",sans-serif;font-size:20px;font-weight:700;color:var(--mm-c,var(--txt));line-height:1;flex:none;}
.mm-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;}
.mm-tag{font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:999px;background:rgba(var(--ink-rgb,0,0,0),.4);border:1px solid var(--glass-b,rgba(255,255,255,.1));color:var(--txt2);white-space:nowrap;}
.mm-tag.dia{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent);}
.mm-bar{height:9px;border-radius:99px;background:rgba(var(--ink-rgb,0,0,0),.55);overflow:hidden;margin:8px 0 5px;position:relative;}
.mm-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--mm-c,var(--teal)) 55%,transparent),var(--mm-c,var(--teal)));transition:width .5s;}
.mm-bar u{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--txt);opacity:.75;border-radius:2px;}
.mm-card-f{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--txt3);flex-wrap:wrap;}
.mm-card-f b{color:var(--txt2);}
.mm-card-a{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
.mm-rank{display:flex;flex-direction:column;gap:6px;}
.mm-rk{display:grid;grid-template-columns:minmax(0,92px) 1fr 44px;align-items:center;gap:8px;font-size:11.5px;}
.mm-rk-n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--txt2);}
.mm-rk-b{height:14px;border-radius:7px;background:rgba(var(--ink-rgb,0,0,0),.5);overflow:hidden;position:relative;}
.mm-rk-b i{display:block;height:100%;border-radius:7px;background:var(--mm-c,var(--teal));}
.mm-rk-v{text-align:right;font-weight:700;color:var(--mm-c,var(--txt));}
.mm-vazio{border:1px dashed var(--glass-b,rgba(255,255,255,.18));border-radius:12px;padding:18px 12px;text-align:center;font-size:12px;color:var(--txt3);line-height:1.55;}
.mm-vazio b{display:block;font-size:26px;margin-bottom:4px;}
.mm-tabs{display:flex;gap:4px;margin:0 0 12px;padding:3px;border-radius:12px;background:rgba(var(--ink-rgb,0,0,0),.4);border:1px solid var(--glass-b,rgba(255,255,255,.1));}
.mm-tab{flex:1;font:inherit;font-size:12px;font-weight:700;padding:8px 6px;border-radius:9px;border:0;background:none;color:var(--txt3);cursor:pointer;white-space:nowrap;}
.mm-tab.on{background:rgba(var(--surface-rgb,16,31,48),.95);color:var(--txt);box-shadow:0 1px 6px rgba(0,0,0,.25);}
.mm-tab .n{font-size:10px;opacity:.75;margin-left:3px;}
/* modais */
.mm-ov{position:fixed;inset:0;z-index:99990;background:rgba(3,10,18,.72);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px 16px;overflow-y:auto;}
.mm-md{width:100%;max-width:520px;border-radius:16px;background:rgba(var(--surface-rgb,16,31,48),.99);border:1px solid var(--glass-b,rgba(255,255,255,.12));padding:20px 20px 18px;box-shadow:0 30px 80px rgba(0,0,0,.55);color:var(--txt);}
.mm-md h3{margin:0 0 2px;font-family:"DM Sans",sans-serif;font-weight:800;font-size:17px;}
.mm-md .sub{font-size:12px;color:var(--txt3);margin:0 0 8px;line-height:1.5;}
.mm-md label,.mm-md .lb{display:block;font-size:11.5px;font-weight:700;color:var(--txt2);margin:13px 0 5px;}
.mm-md .opt{font-weight:400;color:var(--txt3);}
.mm-md input[type=text],.mm-md input[type=number],.mm-md input[type=date],.mm-md input[type=time],.mm-md select{width:100%;font:inherit;font-size:13px;padding:9px 11px;border-radius:10px;border:1px solid var(--glass-b,rgba(255,255,255,.14));background:rgba(var(--ink-rgb,0,0,0),.4);color:var(--txt);}
.mm-md input:focus,.mm-md select:focus{outline:none;border-color:var(--accent);}
.mm-md select option{background:#101f30;color:#eaf2f8;}
.mm-r2{display:grid;grid-template-columns:1fr 1fr;gap:10px;} .mm-r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.mm-chips{display:flex;gap:6px;flex-wrap:wrap;}
.mm-ch{font:inherit;font-size:12px;padding:6px 11px;border-radius:999px;border:1px solid var(--glass-b,rgba(255,255,255,.14));background:rgba(var(--ink-rgb,0,0,0),.3);color:var(--txt2);cursor:pointer;}
.mm-ch[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 22%,transparent);border-color:var(--accent);color:var(--txt);font-weight:700;}
.mm-ch.em{font-size:17px;padding:3px 8px;}
.mm-acts{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;} .mm-acts .g{flex:1;}
.mm-msg{margin-top:12px;font-size:12.5px;padding:9px 12px;border-radius:10px;background:color-mix(in srgb,var(--danger) 14%,transparent);border:1px solid color-mix(in srgb,var(--danger) 40%,transparent);color:var(--danger);}
.mm-prev{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(var(--ink-rgb,0,0,0),.35);border:1px solid var(--glass-b,rgba(255,255,255,.1));font-size:12.5px;line-height:1.5;}
.mm-cv-rows{max-height:230px;overflow-y:auto;margin-top:8px;border:1px solid var(--glass-b,rgba(255,255,255,.1));border-radius:10px;padding:4px 8px;background:rgba(var(--ink-rgb,0,0,0),.25);}
.mm-cv-r{display:grid;grid-template-columns:78px 1fr 52px;gap:8px;align-items:center;padding:3px 0;font-size:12px;color:var(--txt2);}
.mm-cv-r input{padding:5px 8px !important;font-size:12px !important;}
.mm-cv-r .mm-cv-acc{text-align:right;color:var(--txt3);font-size:11px;}
.mm-cv-r.fds{color:var(--txt3);}
.mm-chk{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--txt2);margin-top:12px;line-height:1.4;cursor:pointer;}
.mm-chk input{margin-top:2px;}
/* popup 🐟 */
.mm-fish-ov{position:fixed;inset:0;z-index:99995;display:flex;align-items:center;justify-content:center;background:rgba(3,10,18,.62);padding:14px;animation:mm-in .25s ease-out;}
@keyframes mm-in{from{opacity:0}to{opacity:1}}
.mm-fish{position:relative;width:min(440px,100%);border-radius:22px;overflow:hidden;text-align:center;padding:26px 22px 22px;background:linear-gradient(180deg,#0e2a45 0%,#0a2540 55%,#06365a 100%);border:1px solid rgba(126,200,227,.35);box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset;color:#eaf6ff;}
.mm-fish h2{margin:0;font-family:"DM Sans",sans-serif;font-weight:800;font-size:22px;letter-spacing:.01em;position:relative;z-index:2;}
.mm-fish .big{font-family:"DM Sans",sans-serif;font-size:62px;font-weight:800;line-height:1.05;margin:6px 0 0;position:relative;z-index:2;background:linear-gradient(180deg,#fff,#7ee3ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
.mm-fish .sub{font-size:13.5px;color:#bfe3f7;margin:2px 0 0;position:relative;z-index:2;line-height:1.45;}
.mm-fish .sub b{color:#fff;}
.mm-fish .stage{position:relative;height:150px;margin:6px -22px 0;z-index:1;}
.mm-fish .stage .f{position:absolute;bottom:18px;font-size:34px;animation:mm-jump 2.1s cubic-bezier(.3,.7,.4,1) infinite;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));}
@keyframes mm-jump{0%{transform:translate(0,40px) rotate(-40deg);opacity:0}8%{opacity:1}35%{transform:translate(18px,-80px) rotate(-8deg)}50%{transform:translate(32px,-96px) rotate(18deg)}72%{transform:translate(50px,-40px) rotate(60deg)}88%{transform:translate(62px,34px) rotate(95deg);opacity:1}100%{transform:translate(66px,50px) rotate(110deg);opacity:0}}
.mm-fish .wave{position:absolute;left:-10%;right:-10%;bottom:0;height:46px;z-index:2;background:linear-gradient(180deg,rgba(35,150,210,.55),rgba(8,70,120,.95));border-radius:50% 50% 0 0/38% 38% 0 0;animation:mm-wave 3.2s ease-in-out infinite;}
.mm-fish .wave.w2{bottom:-8px;opacity:.7;animation-delay:-1.4s;background:linear-gradient(180deg,rgba(80,190,240,.5),rgba(10,90,150,.9));}
@keyframes mm-wave{0%,100%{transform:translateX(-2%)}50%{transform:translateX(2%)}}
.mm-fish .go{position:relative;z-index:3;margin-top:14px;font:inherit;font-weight:800;font-size:14px;padding:11px 26px;border-radius:12px;border:0;cursor:pointer;color:#04141f;background:linear-gradient(135deg,#7ee3ff,#2ecc9c);}
.mm-fish .x{position:absolute;top:10px;right:12px;z-index:4;background:none;border:0;color:#9fc7de;font-size:18px;cursor:pointer;}
.mm-fish.cem{background:linear-gradient(180deg,#3a2a05 0%,#0a2540 60%,#06365a 100%);border-color:rgba(255,209,102,.55);}
@media (prefers-reduced-motion:reduce){.mm-fish .stage .f,.mm-mfish span.on em,.mm-fish .wave{animation:none!important}.mm-fish .stage .f{opacity:1;transform:translate(10px,-30px)}}
@media (max-width:420px){.mm-r2,.mm-r3{grid-template-columns:1fr;}.mm-hero-top{flex-direction:column;align-items:flex-start;}}
`;
  function injetaCss() {
    if (typeof document === 'undefined' || document.getElementById('mm-css')) return;
    const st = document.createElement('style'); st.id = 'mm-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  // Anel de progresso (SVG) — traço na cor da situação, marcas a cada 20 % e um "tique" branco no ESPERADO de hoje (ritmo).
  function anelHtml(m, o) {
    o = o || {}; const size = o.size || 118, th = o.th || 11, r = (size - th) / 2, C = 2 * Math.PI * r;
    const p = pct(m), pv = Math.max(0, Math.min(100, p == null ? 0 : p)), st = status(m);
    const esp = esperado(m);
    let tique = '';
    if (esp != null && esp > 0 && esp < 100) {
      const ang = esp / 100 * 2 * Math.PI, cx = size / 2, cy = size / 2;
      const x1 = cx + (r - th / 2 - 2) * Math.cos(ang), y1 = cy + (r - th / 2 - 2) * Math.sin(ang), x2 = cx + (r + th / 2 + 2) * Math.cos(ang), y2 = cy + (r + th / 2 + 2) * Math.sin(ang);
      tique = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--txt)" stroke-width="2.4" stroke-linecap="round"><title>Esperado hoje: ${Math.round(esp)}%</title></line>`;
    }
    const marcas = [20, 40, 60, 80].map(k => { const a = k / 100 * 2 * Math.PI, cx = size / 2, cy = size / 2, ri = r - th / 2, ro = r + th / 2; return `<line x1="${(cx + ri * Math.cos(a)).toFixed(1)}" y1="${(cy + ri * Math.sin(a)).toFixed(1)}" x2="${(cx + ro * Math.cos(a)).toFixed(1)}" y2="${(cy + ro * Math.sin(a)).toFixed(1)}" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/>`; }).join('');
    const txt = pctTxt(p);
    const fs = Math.round(size * (txt.length > 4 ? .2 : .26));
    return `<div class="mm-ring ${st.id}" style="width:${size}px;height:${size}px;--mm-c:${st.cor}" role="img" aria-label="${esc(m.titulo)}: ${esc(txt)} da meta, ${esc(st.label)}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(var(--ink-rgb,0,0,0),.6)" stroke-width="${th}"/>
      <circle class="mm-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${st.cor}" stroke-width="${th}" stroke-linecap="round" stroke-dasharray="${(C * pv / 100).toFixed(1)} ${C.toFixed(1)}"/>${marcas}${tique}</svg>
      <div class="mm-ring-c"><b style="font-size:${fs}px">${esc(txt)}</b><small>${p != null && p >= 100 ? '🏆 batida!' : 'da meta'}</small></div></div>`;
  }
  // Barra de marcos: 5 degraus de 20 % + um peixe por degrau conquistado.
  function marcosHtml(m) {
    const p = pct(m) == null ? 0 : pct(m), st = status(m), mc = marcoDe(p);
    const segs = MARCOS.map((k, i) => { const w = Math.max(0, Math.min(100, (p - i * 20) / 20 * 100)); return `<div class="mm-mseg" title="${i * 20}–${k}%"><i style="width:${w.toFixed(0)}%"></i></div>`; }).join('');
    const fish = MARCOS.map(k => `<span class="${mc >= k ? 'on' : ''}"><em>🐟</em>${k}%</span>`).join('');
    const nx = proximoMarco(m);
    const prox = !isNum(m.atual) ? `Informe o primeiro valor para começar a encher a rede.` : nx ? `Próximo peixe em <b>${nx.marco}%</b> — faltam <b>${esc(fmtVal(m, Math.max(0, nx.falta)))}</b>.` : `🎉 <b>Rede cheia!</b> Os 5 peixes foram pescados.`;
    return `<div class="mm-marcos" style="--mm-c:${st.cor}"><div class="mm-mtrack">${segs}</div><div class="mm-mfish">${fish}</div><div class="mm-next">${prox}</div></div>`;
  }
  function kpisHtml(m) {
    const st = status(m), dr = diasRestantes(m), rn = ritmoNecessario(m), esp = esperado(m), p = pct(m);
    const k = [];
    k.push(`<div class="mm-kpi"><small>Atual</small><b>${esc(fmtVal(m, m.atual))}</b></div>`);
    k.push(`<div class="mm-kpi"><small>Meta</small><b>${esc(fmtVal(m, m.alvo))}</b></div>`);
    if (isNum(m.atual) && (p == null || p < 100)) k.push(`<div class="mm-kpi"><small>Falta</small><b>${esc(fmtVal(m, falta(m)))}</b></div>`);
    if (dr != null) k.push(`<div class="mm-kpi ${dr <= 1 && (p == null || p < 100) ? 'warn' : ''}"><small>Restam</small><b>${dr === 0 ? 'hoje é o dia' : dr + (dr === 1 ? ' dia' : ' dias')}</b></div>`);
    if (rn != null && rn > 0 && (p == null || p < 100)) k.push(`<div class="mm-kpi ${st.id === 'atrasada' ? 'bad' : st.id === 'atencao' ? 'warn' : ''}"><small>Precisa/dia</small><b>${esc(fmtVal(m, rn))}</b></div>`);
    const md = metaDoDia(m); if (md != null) k.push(`<div class="mm-kpi"><small>Meta de hoje</small><b>${esc(fmtVal(m, md))}</b></div>`);
    if (esp != null && p != null) { const d = Math.round(p - esp); k.push(`<div class="mm-kpi ${d >= 0 ? 'ok' : d > -15 ? 'warn' : 'bad'}"><small>Vs. ritmo</small><b>${d >= 0 ? '+' : ''}${d} pp</b></div>`); }
    return `<div class="mm-kpis">${k.join('')}</div>`;
  }
  const tagsHtml = m => {
    const t = [];
    if (m.inicio) t.push(`<span class="mm-tag dia">📅 ${esc(m.inicio === m.fim ? curto(m.inicio) : curto(m.inicio) + '–' + curto(m.fim))}</span>`);
    if (temCurva(m)) t.push(`<span class="mm-tag" title="O time definiu quanto a meta pede de cada dia">📅 diarizada</span>`);
    const sm = SUBMARCAS.find(x => x.id === m.submarca); if (sm) t.push(`<span class="mm-tag">🏷️ ${esc(sm.label.replace(/^Hering\s+/, ''))}</span>`);
    const cv = CANAIS.find(x => x.id === m.canal); if (cv) t.push(`<span class="mm-tag">🛒 ${esc(cv.label)}</span>`);
    return t.length ? `<div class="mm-tags">${t.join('')}</div>` : '';
  };
  // Gráfico de evolução (estilo Radar): linha real × ritmo ideal (tracejado cinza) × meta (tracejado azul). pontos = [{t:ms, v:valor}].
  function graficoHtml(m, pontos) {
    const st = status(m);
    const pts = (pontos || []).filter(x => isFinite(x.t) && isFinite(x.v)).sort((a, b) => a.t - b.t);
    if (!pts.length) return `<div class="mm-chart-vazio">O gráfico aparece quando houver o primeiro valor informado.</div>`;
    const W = 360, H = 170, pl = 46, pr = 12, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
    const a = diaN(m.inicio), b = diaN(m.fim);
    let t0 = a != null ? a * 864e5 + 3 * 3600e3 : pts[0].t, t1 = b != null ? b * 864e5 + 27 * 3600e3 : pts[pts.length - 1].t;
    t0 = Math.min(t0, pts[0].t); t1 = Math.max(t1, pts[pts.length - 1].t); if (t1 === t0) t1 = t0 + 864e5;
    const ini = isNum(m.inicial) ? Number(m.inicial) : 0, alvo = Number(m.alvo);
    const ys = pts.map(x => x.v).concat([ini, alvo]); let mn = Math.min(...ys), mx = Math.max(...ys); const g = (mx - mn) * .08 || 1; mn -= g; mx += g; if (Math.min(...ys) >= 0 && mn < 0) mn = 0;
    const X = t => pl + iw * (t - t0) / (t1 - t0), Y = v => pt + ih * (1 - (v - mn) / (mx - mn));
    const fy = v => fmtVal(m, v);
    const grid = [0, 1, 2, 3].map(k => { const v = mn + (mx - mn) * k / 3; return `<line x1="${pl}" y1="${Y(v).toFixed(1)}" x2="${W - pr}" y2="${Y(v).toFixed(1)}" stroke="currentColor" stroke-opacity=".1"/><text x="${pl - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="currentColor" fill-opacity=".6">${esc(fy(v))}</text>`; }).join('');
    const meta = `<line x1="${pl}" y1="${Y(alvo).toFixed(1)}" x2="${W - pr}" y2="${Y(alvo).toFixed(1)}" stroke="var(--accent)" stroke-dasharray="5 4" stroke-opacity=".85"/><text x="${W - pr}" y="${(Y(alvo) - 4).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="var(--accent)">🎯 meta</text>`;
    let ideal = '';
    if (temCurva(m)) {   // ritmo ideal = a curva definida pelo time (acumulado ao fim de cada dia), não uma reta
      const pts2 = [[X(a * 864e5 + 3 * 3600e3), Y(ini)]]; let acc = 0; const tot = curvaTotal(m);
      for (let d = a; d <= b; d++) { acc += curvaPeso(m.curva[isoDe(d)]); pts2.push([X(d * 864e5 + 27 * 3600e3), Y(ini + acc / tot * (alvo - ini))]); }
      ideal = `<polyline fill="none" stroke="var(--txt3)" stroke-dasharray="3 4" stroke-opacity=".9" points="${pts2.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"/>`;
    } else if (a != null && b != null && b > a) ideal = `<line x1="${X(a * 864e5 + 3 * 3600e3).toFixed(1)}" y1="${Y(ini).toFixed(1)}" x2="${X(b * 864e5 + 27 * 3600e3).toFixed(1)}" y2="${Y(alvo).toFixed(1)}" stroke="var(--txt3)" stroke-dasharray="3 4" stroke-opacity=".9"/>`;
    const xy = pts.map(x => [X(x.t), Y(x.v)]);
    const linha = xy.length > 1 ? `<path d="M${xy[0][0].toFixed(1)},${(pt + ih).toFixed(1)} L${xy.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')} L${xy[xy.length - 1][0].toFixed(1)},${(pt + ih).toFixed(1)}Z" fill="${st.cor}" fill-opacity=".12"/><polyline fill="none" stroke="${st.cor}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="${xy.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>` : '';
    const dots = pts.map((x, i) => `<circle cx="${xy[i][0].toFixed(1)}" cy="${xy[i][1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.2}" fill="${st.cor}" stroke="rgba(255,255,255,.85)" stroke-width="1.2"><title>${esc(new Date(x.t).toLocaleString('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + fy(x.v))}</title></circle>`).join('');
    const dl = d => new Date(d).toLocaleDateString('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit' });
    const xl = `<text x="${pl}" y="${H - 8}" font-size="9" fill="currentColor" fill-opacity=".6">${dl(t0)}</text><text x="${W - pr}" y="${H - 8}" text-anchor="end" font-size="9" fill="currentColor" fill-opacity=".6">${dl(t1)}</text>`;
    const ult = xy[xy.length - 1];
    const rot = `<text x="${Math.min(W - pr - 4, ult[0] + 7)}" y="${(ult[1] - 8).toFixed(1)}" text-anchor="${ult[0] > W - 70 ? 'end' : 'start'}" font-size="10" font-weight="700" fill="${st.cor}">${esc(fy(pts[pts.length - 1].v))}</text>`;
    return `<div class="mm-chart" style="--mm-c:${st.cor}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução de ${esc(m.titulo)}">${grid}${meta}${ideal}${linha}${dots}${rot}${xl}</svg>
      <div class="mm-leg"><span><i></i>real</span>${ideal ? '<span><i class="id"></i>' + (temCurva(m) ? 'ritmo do time (diarização)' : 'ritmo ideal') + '</span>' : ''}<span><i class="mt"></i>meta</span></div></div>`;
  }
  // "180 / 500 camisetas" · "R$ 840 mil / R$ 2 mi" · "42% / 100%" — a unidade aparece uma vez só.
  function fmtPar(m) {
    if (m.fmt === 'num') return (isNum(m.atual) ? ptNum(m.atual, Math.abs(m.atual) < 100 && m.atual % 1 ? 1 : 0) : '—') + ' / ' + fmtVal(m, m.alvo);
    return fmtVal(m, m.atual) + ' / ' + fmtVal(m, m.alvo);
  }
  function statusPill(m) { const st = status(m); return `<span class="mm-pill" style="--mm-c:${st.cor}">${st.ico} ${esc(st.label)}</span>`; }
  function atualizadoHtml(m) {
    const st = desatualizada(m);
    const t = m.atualizadoEm ? `Atualizado ${ago(m.atualizadoEm)}${m.atualizadoNome ? ' por ' + esc(String(m.atualizadoNome).split(' ')[0]) : ''}` : (isNum(m.atual) ? 'Valor informado' : 'Ainda sem valor informado');
    return `<span class="mm-upd-t${st ? ' stale' : ''}">${st ? '⏰ ' : '🕒 '}${t}${st ? ' — atualize!' : ''}</span>`;
  }
  // HERO: a meta principal, grande — anel + título + KPIs + marcos + gráfico (sob demanda).
  function heroHtml(m, o) {
    o = o || {}; const st = status(m);
    const donos = o.escopoTxt ? ` · ${esc(o.escopoTxt)}` : '';
    return `<div class="mm-hero" style="--mm-c:${st.cor}" data-mm-id="${esc(m.id)}" data-mm-esc="${esc(m.escopo)}" data-mm-sq="${esc(m.squad || '')}">
      <div class="mm-hero-top">${anelHtml(m, { size: o.size || 118 })}
        <div class="mm-hero-txt"><div class="mm-kick">${esc(m.emoji || '🎯')} ${m.tipo === 'desafio' ? 'Desafio' : 'Meta'}${donos}</div><div class="mm-ttl">${esc(m.titulo)}</div>
        <div class="mm-big">${esc(fmtVal(m, m.atual))} <small>de ${esc(fmtVal(m, m.alvo))}</small></div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">${statusPill(m)}</div>${tagsHtml(m)}</div></div>
      ${kpisHtml(m)}${marcosHtml(m)}
      <div class="mm-upd">${atualizadoHtml(m)}<span style="display:flex;gap:6px">${o.pode ? `<button type="button" class="mm-btn p s" data-mm-act="reg">✏️ Atualizar valor</button>` : ''}<button type="button" class="mm-btn s" data-mm-act="graf">📈 Evolução</button>${o.gestor ? `<button type="button" class="mm-btn s" data-mm-act="edit">⚙</button>` : ''}</span></div>
      <div class="mm-chart-slot" hidden></div></div>`;
  }
  // CARTÃO (desafios e metas secundárias): emoji, título, tags (dia/submarca/canal), barra com "esperado" e rodapé de números.
  function cartaoHtml(m, o) {
    o = o || {}; const st = status(m), p = pct(m), esp = esperado(m), dr = diasRestantes(m);
    const w = Math.max(0, Math.min(100, p == null ? 0 : p));
    const faltaTxt = isNum(m.atual) ? (p >= 100 ? '🏆 batida!' : 'falta <b>' + esc(fmtVal(m, falta(m))) + '</b>') : 'sem valor ainda';
    const prazo = dr == null ? '' : (dr === 0 ? '<b>é hoje!</b>' : 'em <b>' + dr + (dr === 1 ? ' dia' : ' dias') + '</b>');
    return `<div class="mm-card" style="--mm-c:${st.cor}" data-mm-id="${esc(m.id)}" data-mm-esc="${esc(m.escopo)}" data-mm-sq="${esc(m.squad || '')}">
      <div class="mm-card-h"><div class="mm-card-e">${esc(m.emoji || '🏆')}</div><div class="mm-card-t"><b>${esc(m.titulo)}</b>${tagsHtml(m)}</div><div class="mm-card-pct">${pctTxt(p)}</div></div>
      <div class="mm-bar" title="${esc(st.label)}"><i style="width:${w.toFixed(0)}%"></i>${esp != null && esp > 0 && esp < 100 ? `<u style="left:${esp.toFixed(0)}%" title="Esperado hoje: ${Math.round(esp)}%"></u>` : ''}</div>
      <div class="mm-card-f"><span>${esc(fmtPar(m))} · ${faltaTxt}</span><span>${statusPill(m)} ${prazo}</span></div>
      <div class="mm-card-f" style="margin-top:4px"><span>${atualizadoHtml(m)}</span>${o.escopoTxt ? `<span>${esc(o.escopoTxt)}</span>` : ''}</div>
      <div class="mm-card-a">${o.pode ? `<button type="button" class="mm-btn p s" data-mm-act="reg">✏️ Atualizar</button>` : ''}<button type="button" class="mm-btn s" data-mm-act="graf">📈</button>${o.gestor ? `<button type="button" class="mm-btn s" data-mm-act="edit">⚙ Editar</button>` : ''}</div>
      <div class="mm-chart-slot" hidden></div></div>`;
  }
  function rankingHtml(itens) {
    // itens: [{nome, emoji, pct, cor}]
    if (!itens.length) return '';
    return `<div class="mm-rank">${itens.map(i => `<div class="mm-rk" style="--mm-c:${i.cor}" title="${esc(i.nome)}: ${i.pct == null ? 'sem valor' : pctTxt(i.pct)}"><span class="mm-rk-n">${esc(i.emoji || '')} ${esc(i.nome)}</span><span class="mm-rk-b"><i style="width:${Math.max(0, Math.min(100, i.pct == null ? 0 : i.pct)).toFixed(0)}%"></i></span><span class="mm-rk-v">${pctTxt(i.pct)}</span></div>`).join('')}</div>`;
  }

  // ════════════════ ESTADO + DADOS ════════════════
  const S = { digital: {}, squads: {}, ctx: null, unsubs: [], logCache: {} };
  function refDe(path) { const w = root; return w._ref(w._db, path); }
  function lista(obj) { return Object.keys(obj || {}).map(id => Object.assign({ id }, obj[id])).filter(m => m && typeof m === 'object' && m.titulo); }
  const comEscopoDigital = m => Object.assign({}, m, { escopo: 'digital' });
  function metasDigital() { return ordenar(lista(S.digital).map(comEscopoDigital).filter(m => m.ativo !== false)); }
  function metasSquad(sq) { return ordenar(lista(S.squads[sq]).map(m => Object.assign({ squad: sq, escopo: 'squad' }, m)).filter(m => m.ativo !== false)); }
  function todasDaSquad(sq) { return ordenar(lista(S.squads[sq]).map(m => Object.assign({ squad: sq, escopo: 'squad' }, m))); }   // inclui arquivadas (tela de configuração)
  function todasDigital() { return ordenar(lista(S.digital).map(comEscopoDigital)); }
  // (acima: metasDigital/todasDigital já devolvem escopo:'digital' — o nó não guarda o campo)
  function squadsGlobais() {
    const out = {};
    Object.keys(S.squads).forEach(sq => { const l = metasSquad(sq).filter(m => m.global); if (l.length) out[sq] = l; });
    return out;
  }
  const pathMeta = m => (m.escopo === 'squad' ? PATHS.squads + '/' + m.squad : PATHS.digital) + '/' + m.id;
  function novoId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function ouvir(path, alvo, cb) {
    try {
      const un = root._onValue(refDe(path), snap => { alvo(snap.val() || {}); cb && cb(); }, () => {});
      S.unsubs.push(un); return un;
    } catch (e) { return null; }
  }
  // Liga os listeners. `todasSquads` = também escuta as metas de TODAS as squads (visão do Digital); senão só a squad atual.
  function iniciar(ctx) {
    S.ctx = ctx; injetaCss();
    S.unsubs.forEach(u => { try { u && u(); } catch (e) {} }); S.unsubs = [];
    const mudou = () => { try { ctx.onChange && ctx.onChange(); } catch (e) { console.warn('[metas] onChange', e); } vigiaMarcos(); };
    ouvir(PATHS.digital, v => { S.digital = v; }, mudou);
    if (ctx.todasSquads) ouvir(PATHS.squads, v => { S.squads = v; }, mudou);
    else if (ctx.squad) ouvir(PATHS.squads + '/' + ctx.squad, v => { S.squads = Object.assign({}, S.squads, { [ctx.squad]: v }); }, mudou);
  }
  function ouvirTodasSquads() {   // chamado ao abrir a aba "Digital" no Maré (lazy)
    if (S._todas) return; S._todas = true;
    ouvir(PATHS.squads, v => { S.squads = v; }, () => { try { S.ctx && S.ctx.onChange && S.ctx.onChange(); } catch (e) {} vigiaMarcos(); });
  }
  async function salvar(inp, user) {
    const v = validar(inp); if (!v.ok) return v;
    const m = v.meta, agora = Date.now();
    if (!m.id) { m.id = novoId(); m.criadoEm = agora; m.criadoPor = (user && user.uid) || null; }
    const antigo = (m.escopo === 'squad' ? (S.squads[m.squad] || {}) : S.digital)[m.id] || {};
    // preserva o que o formulário não edita (valor atual, marco, autoria)
    ['atual', 'atualizadoEm', 'atualizadoPor', 'atualizadoNome', 'marco', 'marcoTs', 'criadoEm', 'criadoPor', 'lembreteUltimo'].forEach(k => { if (antigo[k] !== undefined && m[k] === undefined) m[k] = antigo[k]; });
    if (m.ordem === undefined) m.ordem = antigo.ordem !== undefined ? antigo.ordem : agora;
    const out = {}; Object.keys(m).forEach(k => { if (k !== 'id') out[k] = m[k]; });
    await root._set(refDe(pathMeta(m)), out);
    return { ok: true, meta: Object.assign({ id: m.id }, out) };
  }
  // As regras só dão .write nas CHAVES do histórico (metas_log/{id}/{chave}), não no nó-pai: apagar `metas_log/{id}` de uma vez é NEGADO (e o erro era engolido,
  // deixando o histórico órfão no banco). Apaga chave a chave, num update só.
  async function remover(m) {
    await root._set(refDe(pathMeta(m)), null);
    try {
      const ks = Object.keys((await root._get(refDe(PATHS.log + '/' + m.id))).val() || {});
      if (ks.length) { const u = {}; ks.forEach(k => { u[k] = null; }); await root._update(refDe(PATHS.log + '/' + m.id), u); }
    } catch (e) { console.warn('[metas] histórico não apagado', e); }
    delete S.logCache[m.id];
    return { ok: true };
  }
  async function arquivar(m, ativo) { await root._set(refDe(pathMeta(m) + '/ativo'), !!ativo); return { ok: true }; }
  // Informa um valor: grava atual + marco + histórico num update só (multi-caminho = tudo ou nada).
  async function registrar(m, valor, user, nota) {
    if (!isNum(valor)) return { ok: false, erro: 'Informe um número.' };
    const patch = patchDeRegistro(achar(m.id, m.escopo, m.squad) || m, valor, user);   // marco comparado com o MAIS NOVO do banco (o `m` da tela pode estar velho: o marco já conquistado nunca desce)
    const upd = {}; Object.keys(patch).forEach(k => { upd[pathMeta(m) + '/' + k] = patch[k]; });
    const chave = String(patch.atualizadoEm).padStart(14, '0') + '_' + Math.random().toString(36).slice(2, 5);
    const lg = { v: Number(valor), t: patch.atualizadoEm, por: (user && user.uid) || null, nome: (user && user.nome) || '' }; if (nota) lg.nota = String(nota).slice(0, 140);
    upd[PATHS.log + '/' + m.id + '/' + chave] = lg;
    await root._update(refDe('kanban'), Object.fromEntries(Object.entries(upd).map(([k, v]) => [k.replace(/^kanban\//, ''), v])));
    delete S.logCache[m.id];
    return { ok: true, patch };
  }
  async function lerLog(id) {
    if (S.logCache[id] && Date.now() - S.logCache[id].t < 20000) return S.logCache[id].pts;
    let v = {};
    try { v = (await root._get(refDe(PATHS.log + '/' + id))).val() || {}; } catch (e) { v = {}; }
    const pts = Object.keys(v).sort().slice(-80).map(k => ({ t: Number(v[k].t), v: Number(v[k].v), nome: v[k].nome })).filter(x => isFinite(x.t) && isFinite(x.v));
    S.logCache[id] = { t: Date.now(), pts }; return pts;
  }
  function achar(id, esc_, sq) { return (esc_ === 'squad' ? lista(S.squads[sq]).map(m => Object.assign({ squad: sq, escopo: 'squad' }, m)) : lista(S.digital).map(m => Object.assign({ escopo: 'digital' }, m))).find(m => m.id === id) || null; }

  // ════════════════ MODAIS ════════════════
  function abreOv(html, fechavel) {
    if (typeof document === 'undefined') return null;
    const ov = document.createElement('div'); ov.className = 'mm-ov mm'; ov.innerHTML = '<div class="mm-md" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('mousedown', e => { if (e.target === ov && fechavel !== false) ov.remove(); });
    document.body.appendChild(ov);
    // Esc fecha SÓ este modal: `stopPropagation` impede que o Esc global da página feche também a tela que está por baixo (⚙ Configurações, Dados…). Se o modal já foi
    // fechado por outro caminho (Cancelar, clique fora), o ouvinte se desfaz na próxima tecla em vez de ficar pendurado.
    const onKey = e => { if (!ov.isConnected) { document.removeEventListener('keydown', onKey, true); return; } if (e.key === 'Escape') { e.stopPropagation(); ov.remove(); document.removeEventListener('keydown', onKey, true); } };
    document.addEventListener('keydown', onKey, true);
    return ov;
  }
  // Formulário de meta/desafio (nova ou editar). opts: {escopo, squad, meta?, pessoas?:[{uid,nome}], tipo?, onSave(meta)}
  function abrirForm(opts) {
    injetaCss();
    const m = opts.meta || {}, novo = !m.id, escopo = opts.escopo || m.escopo || 'digital';
    const st = { tipo: m.tipo || opts.tipo || 'meta', fmt: m.fmt || 'brl', emoji: m.emoji || '', sm: m.submarca || '', cv: m.canal || '', resp: new Set(m.responsaveis || []), rit: temCurva(m) ? 'dia' : 'lin', curva: Object.assign({}, m.curva || {}), lemModo: (m.lembrete && m.lembrete.modo) || 'off' };
    const l = m.lembrete || {};
    const resp = (opts.pessoas || []).length ? `<div class="lb">Quem preenche <span class="opt">(opcional — recebe o lembrete)</span></div><div class="mm-chips" id="mm-resp">${(opts.pessoas || []).map(p => `<button type="button" class="mm-ch" data-u="${esc(p.uid)}" aria-pressed="${st.resp.has(p.uid)}">${esc(p.nome)}</button>`).join('')}</div><div class="sub" style="margin:4px 0 0">Sem ninguém marcado: o lembrete vai pros ${escopo === 'squad' ? 'PO e Organizadores da squad' : 'ADMs'}.</div>` : '';
    const ov = abreOv(`<h3 id="mm-f-h"></h3><p class="sub">${escopo === 'digital' ? 'Vale pro <b>Digital inteiro</b> e aparece na aba 🌊 Digital do Maré.' : 'Vale pra esta <b>squad</b> e aparece na aba 🐠 Squad do Maré.'}</p>
      <div class="lb">O que é?</div><div class="mm-chips" id="mm-tipo"><button type="button" class="mm-ch" data-t="meta" aria-pressed="${st.tipo === 'meta'}">🎯 Meta (a principal)</button><button type="button" class="mm-ch" data-t="desafio" aria-pressed="${st.tipo === 'desafio'}">🏆 Desafio extra</button></div>
      <label for="mm-f-t">Nome</label><input type="text" id="mm-f-t" maxlength="80" placeholder="Ex.: Black Friday — captação do Digital" value="${esc(m.titulo || '')}">
      <div class="lb">Ícone</div><div class="mm-chips" id="mm-em">${EMOJIS.map(e => `<button type="button" class="mm-ch em" data-e="${e}" aria-pressed="${st.emoji === e}">${e}</button>`).join('')}</div>
      <div class="lb">Como medir?</div><div class="mm-chips" id="mm-fmt"><button type="button" class="mm-ch" data-f="brl" aria-pressed="${st.fmt === 'brl'}">R$ valor</button><button type="button" class="mm-ch" data-f="num" aria-pressed="${st.fmt === 'num'}"># quantidade</button><button type="button" class="mm-ch" data-f="pct" aria-pressed="${st.fmt === 'pct'}">% percentual</button></div>
      <div id="mm-sufw" ${st.fmt === 'num' ? '' : 'hidden'}><label for="mm-f-s">Unidade <span class="opt">(ex.: camisetas, pedidos)</span></label><input type="text" id="mm-f-s" maxlength="16" value="${esc(m.sufixo || '')}"></div>
      <div class="mm-r2"><div><label for="mm-f-a">Alvo (a meta)</label><input type="number" id="mm-f-a" step="any" inputmode="decimal" value="${isNum(m.alvo) ? m.alvo : ''}"></div><div><label for="mm-f-i">Ponto de partida <span class="opt">(padrão 0)</span></label><input type="number" id="mm-f-i" step="any" inputmode="decimal" value="${isNum(m.inicial) && Number(m.inicial) !== 0 ? m.inicial : ''}"></div></div>
      <div class="lb">Período <span class="opt">(opcional — é o que permite medir o ritmo; num dia só, deixe os dois iguais)</span></div><div class="mm-r2"><input type="date" id="mm-f-d1" value="${esc(m.inicio || '')}"><input type="date" id="mm-f-d2" value="${esc(m.fim || '')}"></div>
      <div class="mm-chips" style="margin-top:7px"><button type="button" class="mm-ch" id="mm-hoje">Só hoje</button><button type="button" class="mm-ch" id="mm-bf">🔥 Black Friday</button></div>
      <div class="lb">Ritmo ao longo do período <span class="opt">(como a meta se distribui nos dias)</span></div><div class="mm-chips" id="mm-rit"><button type="button" class="mm-ch" data-r="lin" aria-pressed="${!temCurva(m)}">📏 Linear — igual todo dia</button><button type="button" class="mm-ch" data-r="dia" aria-pressed="${temCurva(m)}">📅 Por dia — diarização do time</button></div>
      <div id="mm-curva" hidden><p class="sub" style="margin:8px 0 0">Informe <b>quanto a meta pede de cada dia</b> (valor ou peso — vale a proporção entre os dias). O "esperado hoje", o ritmo e o gráfico passam a seguir essa curva.</p>
        <div class="mm-chips" style="margin-top:8px"><button type="button" class="mm-ch" id="mm-cv-igual">Distribuir igual</button><button type="button" class="mm-ch" id="mm-cv-colar">📋 Colar da planilha</button></div>
        <div id="mm-cv-colarbox" hidden><textarea id="mm-cv-txt" rows="3" style="width:100%;font:inherit;font-size:12px;padding:8px 10px;border-radius:10px;border:1px solid var(--glass-b,rgba(255,255,255,.14));background:rgba(var(--ink-rgb,0,0,0),.4);color:var(--txt);margin-top:8px" placeholder="Uma coluna de valores NA ORDEM dos dias — ou linhas no formato 12/11 1500"></textarea><div class="mm-chips" style="margin-top:6px"><button type="button" class="mm-ch" id="mm-cv-aplicar">Aplicar</button></div></div>
        <div class="mm-cv-rows" id="mm-cv-rows"></div><div class="mm-prev" id="mm-cv-sum" style="margin-top:8px"></div></div>
      <div class="mm-r2"><div><label for="mm-f-sm">Submarca <span class="opt">(opcional)</span></label><select id="mm-f-sm"><option value="">—</option>${SUBMARCAS.map(x => `<option value="${x.id}" ${st.sm === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
        <div><label for="mm-f-cv">Canal de venda <span class="opt">(opcional)</span></label><select id="mm-f-cv"><option value="">—</option>${CANAIS.map(x => `<option value="${x.id}" ${st.cv === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div></div>
      ${escopo === 'squad' ? `<label class="mm-chk"><input type="checkbox" id="mm-f-g" ${m.global ? 'checked' : ''}> <span>🌊 <b>Mostrar na visão global</b> (aba Digital, pra todo o Digital ver)</span></label>` : ''}
      <label class="mm-chk"><input type="checkbox" id="mm-f-ativo" ${m.ativo !== false ? 'checked' : ''}> <span>Ativa (aparece na aba Dados e entra nos lembretes)</span></label>
      <div class="lb">⏰ Lembrete de preenchimento <span class="opt">(horário de Brasília)</span></div>
      <select id="mm-f-lem"><option value="off">Sem lembrete</option><option value="cada">A cada 1 h / 2 h…</option><option value="diario">1 vez por dia</option><option value="horarios">Em horários exatos</option></select>
      <div id="mm-lem-cada" hidden><div class="mm-r3" style="margin-top:8px"><div><label for="mm-l-c">A cada</label><select id="mm-l-c"><option value="1">1 hora</option><option value="2">2 horas</option><option value="3">3 horas</option><option value="4">4 horas</option></select></div><div><label for="mm-l-de">Das</label><input type="time" id="mm-l-de" value="${esc(l.de || '08:00')}"></div><div><label for="mm-l-ate">Até</label><input type="time" id="mm-l-ate" value="${esc(l.ate || '20:00')}"></div></div></div>
      <div id="mm-lem-diario" hidden><label for="mm-l-h">Horário</label><input type="time" id="mm-l-h" value="${esc(l.hora || '09:00')}"></div>
      <div id="mm-lem-horarios" hidden><label>Horários <span class="opt">(até 4)</span></label><div class="mm-r3"><input type="time" class="mm-l-hs" value="${esc((l.horas || [])[0] || '09:00')}"><input type="time" class="mm-l-hs" value="${esc((l.horas || [])[1] || '')}"><input type="time" class="mm-l-hs" value="${esc((l.horas || [])[2] || '')}"></div></div>
      ${resp}
      <div class="mm-msg" id="mm-f-err" hidden></div>
      <div class="mm-acts"><button type="button" class="mm-btn p" id="mm-f-ok">${novo ? 'Criar' : 'Salvar'}</button>${!novo && opts.onRemover ? '<button type="button" class="mm-btn d" id="mm-f-rm">🗑 Excluir</button>' : ''}<span class="g"></span><button type="button" class="mm-btn" id="mm-f-x">Cancelar</button></div>`);
    if (!ov) return;
    const $ = id => ov.querySelector('#' + id), $$ = s => [...ov.querySelectorAll(s)];
    const cab = () => { $('mm-f-h').textContent = novo ? (st.tipo === 'desafio' ? '➕ Novo desafio' : '➕ Nova meta') : '⚙ Editar ' + (st.tipo === 'desafio' ? 'desafio' : 'meta'); }; cab();
    const sel = (sc, atr, val) => $$(sc + ' [' + atr + ']').forEach(b => b.setAttribute('aria-pressed', b.getAttribute(atr) === val));
    ov.querySelector('#mm-tipo').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; st.tipo = b.dataset.t; sel('#mm-tipo', 'data-t', st.tipo); cab(); };
    ov.querySelector('#mm-em').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; st.emoji = st.emoji === b.dataset.e ? '' : b.dataset.e; sel('#mm-em', 'data-e', st.emoji); };
    ov.querySelector('#mm-fmt').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.fmt = b.dataset.f; sel('#mm-fmt', 'data-f', st.fmt); $('mm-sufw').hidden = st.fmt !== 'num'; };
    if (ov.querySelector('#mm-resp')) ov.querySelector('#mm-resp').onclick = e => { const b = e.target.closest('[data-u]'); if (!b) return; const u = b.dataset.u; if (st.resp.has(u)) st.resp.delete(u); else st.resp.add(u); b.setAttribute('aria-pressed', st.resp.has(u)); };
    // ── Diarização: uma linha por dia do período, com o acumulado em % ao lado ──
    const diasDoPeriodo = () => { const a = diaN($('mm-f-d1').value), b = diaN($('mm-f-d2').value); if (a == null || b == null || b <= a || b - a + 1 > 93) return []; const o = []; for (let d = a; d <= b; d++) o.push(isoDe(d)); return o; };
    const cvLer = () => { $$('#mm-cv-rows input[data-d]').forEach(i => { if (i.value !== '') st.curva[i.dataset.d] = i.value; else delete st.curva[i.dataset.d]; }); };
    const cvSoma = () => {
      const ins = $$('#mm-cv-rows input[data-d]'), pesos = ins.map(i => curvaPeso(i.value)), tot = pesos.reduce((x, y) => x + y, 0), el = $('mm-cv-sum'); let acc = 0;
      ins.forEach((i, k) => { acc += pesos[k]; i.closest('.mm-cv-r').querySelector('.mm-cv-acc').textContent = tot > 0 ? Math.round(acc / tot * 100) + '%' : '—'; });
      const meta = isNum($('mm-f-a').value) ? Number($('mm-f-a').value) - (isNum($('mm-f-i').value) ? Number($('mm-f-i').value) : 0) : null, fm = { fmt: st.fmt, sufixo: $('mm-f-s').value };
      el.innerHTML = tot > 0 ? `Soma dos dias: <b>${esc(fmtVal(fm, tot))}</b>${meta != null ? ' · meta: <b>' + esc(fmtVal(fm, meta)) + '</b>' + (Math.abs(tot - meta) > Math.abs(meta) * 0.005 ? ' — a soma é diferente da meta, mas tudo bem: a curva usa a <b>proporção</b> de cada dia.' : ' ✔') : ''}` : 'Preencha pelo menos um dia.';
    };
    const cvRender = (semLer) => {   // semLer: o estado foi mudado de propósito (distribuir/colar) — não sobrescrever com o que a grade mostrava
      const ritChips = ov.querySelectorAll('#mm-rit [data-r]'); ritChips.forEach(b => b.setAttribute('aria-pressed', b.dataset.r === st.rit));
      $('mm-curva').hidden = st.rit !== 'dia'; if (st.rit !== 'dia') return;
      if (!semLer) cvLer(); const dias = diasDoPeriodo(), rows = $('mm-cv-rows');
      if (!dias.length) { rows.innerHTML = ''; $('mm-cv-sum').textContent = diaN($('mm-f-d2').value) - diaN($('mm-f-d1').value) + 1 > 93 ? 'Período grande demais pra distribuir por dia (máximo 93 dias).' : 'Informe o período (de/até) acima, com pelo menos 2 dias, pra distribuir a meta por dia.'; return; }
      const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      rows.innerHTML = dias.map(d => { const wd = new Date(diaN(d) * 864e5).getUTCDay(); return `<div class="mm-cv-r${wd === 0 || wd === 6 ? ' fds' : ''}"><span>${SEM[wd]} ${curto(d)}</span><input type="number" min="0" step="any" inputmode="decimal" data-d="${d}" value="${st.curva[d] != null ? esc(st.curva[d]) : ''}" aria-label="Meta do dia ${curto(d)}"><span class="mm-cv-acc"></span></div>`; }).join('');
      cvSoma();
    };
    ov.querySelector('#mm-rit').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; st.rit = b.dataset.r; cvRender(); };
    $('mm-cv-rows').addEventListener('input', cvSoma);
    ['mm-f-d1', 'mm-f-d2'].forEach(id => { $(id).addEventListener('change', () => cvRender()); $(id).addEventListener('input', () => cvRender()); });
    ['mm-f-a', 'mm-f-i', 'mm-f-s'].forEach(id => $(id).addEventListener('input', () => { if (st.rit === 'dia') cvSoma(); }));
    $('mm-fmt').addEventListener('click', () => { if (st.rit === 'dia') cvSoma(); });
    $('mm-cv-igual').onclick = () => { const dias = diasDoPeriodo(); if (!dias.length) return; const meta = isNum($('mm-f-a').value) ? Number($('mm-f-a').value) - (isNum($('mm-f-i').value) ? Number($('mm-f-i').value) : 0) : 0, v = meta > 0 ? Math.round(meta / dias.length * 100) / 100 : 1; dias.forEach(d => { st.curva[d] = v; }); cvRender(true); };
    $('mm-cv-colar').onclick = () => { $('mm-cv-colarbox').hidden = !$('mm-cv-colarbox').hidden; if (!$('mm-cv-colarbox').hidden) $('mm-cv-txt').focus(); };
    $('mm-cv-aplicar').onclick = () => { const r = lerColado($('mm-cv-txt').value, diasDoPeriodo()); cvLer(); Object.keys(r.valores).forEach(d => { st.curva[d] = r.valores[d]; }); cvRender(true); if (r.aviso) $('mm-cv-sum').textContent = '⚠️ ' + r.aviso; else $('mm-cv-colarbox').hidden = true; };
    $('mm-hoje').onclick = () => { const h = hojeSP(); $('mm-f-d1').value = h; $('mm-f-d2').value = h; cvRender(); };
    $('mm-bf').onclick = () => { const bf = blackFriday(); $('mm-f-d1').value = bf.ini; $('mm-f-d2').value = bf.fim; cvRender(); };
    cvRender();
    const lemMostra = () => { const v = $('mm-f-lem').value; ['cada', 'diario', 'horarios'].forEach(k => { $('mm-lem-' + k).hidden = v !== k; }); };
    $('mm-f-lem').value = st.lemModo; $('mm-l-c').value = String(l.cada || 1); lemMostra(); $('mm-f-lem').onchange = lemMostra;
    $('mm-f-x').onclick = () => ov.remove();
    if ($('mm-f-rm')) $('mm-f-rm').onclick = async () => { if (!confirm('Excluir "' + (m.titulo || '') + '" e o histórico dos valores?')) return; await opts.onRemover(m); ov.remove(); };
    $('mm-f-ok').onclick = async () => {
      const lemModo = $('mm-f-lem').value, lembrete = { modo: lemModo };
      if (lemModo === 'cada') Object.assign(lembrete, { cada: Number($('mm-l-c').value), de: $('mm-l-de').value, ate: $('mm-l-ate').value });
      if (lemModo === 'diario') lembrete.hora = $('mm-l-h').value;
      if (lemModo === 'horarios') lembrete.horas = $$('.mm-l-hs').map(i => i.value).filter(Boolean);
      const inp = { id: m.id, escopo, squad: opts.squad || m.squad, tipo: st.tipo, titulo: $('mm-f-t').value, emoji: st.emoji, fmt: st.fmt, sufixo: $('mm-f-s').value, alvo: $('mm-f-a').value, inicial: $('mm-f-i').value,
        inicio: $('mm-f-d1').value, fim: $('mm-f-d2').value, submarca: $('mm-f-sm').value, canal: $('mm-f-cv').value, global: $('mm-f-g') ? $('mm-f-g').checked : false, ativo: $('mm-f-ativo').checked, lembrete, responsaveis: [...st.resp], ordem: m.ordem, ritmo: st.rit, curva: (cvLer(), st.curva) };
      const v = validar(inp), er = $('mm-f-err');
      if (!v.ok) { er.textContent = v.erro; er.hidden = false; return; }
      er.hidden = true; $('mm-f-ok').disabled = true;
      try { const r = await opts.onSave(inp); if (r && r.ok === false) { er.textContent = r.erro || 'Não deu pra salvar.'; er.hidden = false; $('mm-f-ok').disabled = false; return; } ov.remove(); }
      catch (e) { er.textContent = (e && (e.code === 'PERMISSION_DENIED' || /permission/i.test(e.message || ''))) ? 'Sem permissão pra salvar. Se for a 1ª vez, as regras do banco precisam ser publicadas (firebase deploy --only database) — avise o ADM.' : 'Não deu pra salvar agora. Tente de novo.'; er.hidden = false; $('mm-f-ok').disabled = false; }
    };
    ($('mm-f-t')).focus();
  }
  // Black Friday (sexta depois da 4ª quinta de novembro) do ano corrente — ou do próximo, se já passou há mais de uma semana.
  function blackFriday(hoje) {
    const h = hoje ? new Date(hoje + 'T12:00:00') : new Date(); const calc = ano => { const d1 = new Date(ano, 10, 1).getDay(); return new Date(ano, 10, 1 + ((4 - d1 + 7) % 7) + 21 + 1); };
    let bf = calc(h.getFullYear()); if (new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 7) < h) bf = calc(h.getFullYear() + 1);
    const f = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const seg = new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() - 4), dom = new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 3);
    return { dia: f(bf), ini: f(seg), fim: f(dom) };   // da segunda da semana da Black Friday até a Cyber Monday (a sexta é o dia)
  }
  // "Atualizar valor": definir o total OU somar ao que já tem, com prévia ao vivo ("vai pra 47 % · próximo peixe em 60 %").
  function abrirRegistrar(m, opts) {
    injetaCss(); opts = opts || {};
    let modo = 'total';
    const ov = abreOv(`<h3>✏️ Atualizar valor</h3><p class="sub">${esc(m.emoji || '🎯')} <b>${esc(m.titulo)}</b> — hoje em <b>${esc(fmtVal(m, m.atual))}</b> de ${esc(fmtVal(m, m.alvo))}.</p>
      <div class="mm-chips"><button type="button" class="mm-ch" data-m="total" aria-pressed="true">Definir o total</button><button type="button" class="mm-ch" data-m="somar" aria-pressed="false">+ Somar ao atual</button></div>
      <label for="mm-r-v" id="mm-r-l">Valor total acumulado${m.fmt === 'brl' ? ' (R$)' : m.fmt === 'pct' ? ' (%)' : m.sufixo ? ' (' + esc(m.sufixo) + ')' : ''}</label><input type="number" id="mm-r-v" step="any" inputmode="decimal" placeholder="${isNum(m.atual) ? esc(String(m.atual)) : '0'}">
      <label for="mm-r-n">Nota <span class="opt">(opcional)</span></label><input type="text" id="mm-r-n" maxlength="140" placeholder="Ex.: fechamento das 14h">
      <div class="mm-prev" id="mm-r-p">Digite o valor para ver o efeito.</div><div class="mm-msg" id="mm-r-e" hidden></div>
      <div class="mm-acts"><button type="button" class="mm-btn p" id="mm-r-ok">Atualizar</button><span class="g"></span><button type="button" class="mm-btn" id="mm-r-x">Cancelar</button></div>`);
    if (!ov) return;
    const $ = id => ov.querySelector('#' + id);
    // Sempre parte do valor MAIS NOVO (o listener ao vivo mantém isso): "somar" não pode usar o que a tela viu quando o modal abriu — se outra pessoa informou
    // nesse meio-tempo, a soma dela se perdia.
    const fresco = () => achar(m.id, m.escopo, m.squad) || m;
    const novoVal = () => { const v = $('mm-r-v').value; if (!isNum(v)) return null; const f = fresco(); return modo === 'somar' ? (isNum(f.atual) ? Number(f.atual) : (isNum(f.inicial) ? Number(f.inicial) : 0)) + Number(v) : Number(v); };
    const prev = () => {
      const nv = novoVal(), el = $('mm-r-p'); if (nv == null) { el.textContent = 'Digite o valor para ver o efeito.'; return; }
      const nm = Object.assign({}, fresco(), { atual: nv }), p = pct(nm), mc = marcoDe(p), up = mc > (Number(fresco().marco) || 0);
      el.innerHTML = `Vai para <b>${esc(fmtVal(m, nv))}</b> → <b>${pctTxt(p)}</b> da meta (${statusPill(nm)})${up ? `<br>🐟 <b>Novo peixe!</b> Cruzou ${mc}% — vai aparecer o popup pra todo mundo.` : ''}`;
    };
    ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { modo = b.dataset.m; ov.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('mm-r-l').firstChild.textContent = modo === 'somar' ? 'Quanto entrou desde a última vez' : 'Valor total acumulado'; prev(); });
    $('mm-r-v').oninput = prev; $('mm-r-x').onclick = () => ov.remove();
    $('mm-r-ok').onclick = async () => {
      const nv = novoVal(), er = $('mm-r-e');
      if (nv == null) { er.textContent = 'Informe um número.'; er.hidden = false; return; }
      if (nv < 0 && m.fmt !== 'num') { er.textContent = 'O valor não pode ser negativo.'; er.hidden = false; return; }
      $('mm-r-ok').disabled = true;
      try { const r = await opts.onSave(nv, $('mm-r-n').value.trim()); if (r && r.ok === false) { er.textContent = r.erro || 'Não deu pra salvar.'; er.hidden = false; $('mm-r-ok').disabled = false; return; } ov.remove(); }
      catch (e) { er.textContent = (e && (e.code === 'PERMISSION_DENIED' || /permission/i.test(e.message || ''))) ? 'Sem permissão pra gravar. Se for a 1ª vez, as regras do banco precisam ser publicadas — avise o ADM.' : 'Não deu pra salvar agora. Tente de novo.'; er.hidden = false; $('mm-r-ok').disabled = false; }
    };
    $('mm-r-v').focus();
  }

  // ════════════════ POPUP 🐟 ════════════════
  const LS_VISTO = 'mare_peixes_vistos' + SFX;
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_VISTO) || '{}') || {}; } catch (e) { return {}; } };
  const lsSet = o => { try { localStorage.setItem(LS_VISTO, JSON.stringify(o)); } catch (e) {} };
  let _fila = [], _mostrando = false;
  const JANELA_MS = 6 * 3600e3;   // só celebra marco "fresco" (até 6 h): quem abre o Maré depois não leva uma enxurrada de popups velhos
  // Chamado a cada atualização das metas: enfileira os marcos novos que esta pessoa ainda não viu.
  function vigiaMarcos() {
    if (typeof document === 'undefined') return;
    const vistos = lsGet(), agora = Date.now(); let mudou = false;
    const cand = [...metasDigital(), ...((S.ctx && S.ctx.squad) ? metasSquad(S.ctx.squad) : [])];
    cand.forEach(m => {
      const mc = Number(m.marco) || 0; if (!mc) return;
      const v = Number(vistos[m.id]) || 0; if (mc <= v) return;
      const fresco = m.marcoTs && (agora - m.marcoTs) < JANELA_MS;
      if (fresco) { if (!_fila.some(x => x.id === m.id && x.marco === mc)) _fila.push({ id: m.id, marco: mc, meta: m }); }
      else { vistos[m.id] = mc; mudou = true; }   // marco antigo: marca como visto em silêncio
    });
    if (mudou) lsSet(vistos);
    proximoPopup();
  }
  function proximoPopup() {
    if (_mostrando || !_fila.length) return;
    const it = _fila.shift(), vistos = lsGet();
    if ((Number(vistos[it.id]) || 0) >= it.marco) return proximoPopup();
    _mostrando = true; vistos[it.id] = it.marco; lsSet(vistos);
    mostrarPeixes(it.meta, it.marco, () => { _mostrando = false; setTimeout(proximoPopup, 400); });
  }
  function mostrarPeixes(m, marco, fim) {
    injetaCss(); if (typeof document === 'undefined') return;
    const cem = marco >= 100, n = Math.max(1, Math.min(7, cem ? 7 : marco / 20 + 1));
    const dono = m.escopo === 'squad' ? (m.squad ? 'a squad' : '') : 'o Digital';
    const nx = proximoMarco(m);
    const fish = Array.from({ length: n }, (_, i) => `<span class="f" style="left:${6 + i * (84 / Math.max(1, n))}%;animation-delay:${(i * .33).toFixed(2)}s;font-size:${28 + (i % 3) * 5}px">${['🐟', '🐠', '🐡'][i % 3]}</span>`).join('');
    const el = document.createElement('div'); el.className = 'mm-fish-ov mm';
    el.innerHTML = `<div class="mm-fish ${cem ? 'cem' : ''}" role="dialog" aria-modal="true" aria-label="O mar tá pra peixe"><button class="x" aria-label="Fechar">✕</button>
      <h2>${cem ? '🏆 Meta batida! 🎉' : 'O mar tá pra peixe! 🐟'}</h2><div class="big">${marco}%</div>
      <p class="sub">${esc(m.emoji || '🎯')} <b>${esc(m.titulo)}</b><br>${cem ? 'A rede encheu! Parabéns, time.' : (dono ? 'Chegamos a <b>' + marco + '%</b> da meta ' + (m.escopo === 'digital' ? 'do Digital' : 'da squad') + '.' : '') + (nx ? ' Próximo peixe em <b>' + nx.marco + '%</b>.' : '')}</p>
      <div class="stage">${fish}<div class="wave"></div><div class="wave w2"></div></div><button class="go" type="button">${cem ? 'Bora comemorar! 🥳' : 'Bora pescar mais! 🚀'}</button></div>`;
    const fecha = () => { if (!el.isConnected) return; el.remove(); document.removeEventListener('keydown', onKey, true); clearTimeout(tm); fim && fim(); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); fecha(); } };
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('mousedown', e => { if (e.target === el) fecha(); });
    el.querySelector('.x').onclick = fecha; el.querySelector('.go').onclick = fecha;
    const tm = setTimeout(fecha, cem ? 14000 : 9000);
    document.body.appendChild(el);
  }

  // ════════════════ PAINÉIS PRONTOS (a página só escolhe onde colocar) ════════════════
  // ctx de render: {pode(meta)->bool (quem atualiza valor), gestor(meta)->bool (quem edita), escopoTxt?}
  function painelSquadHtml(sq, o) {
    o = o || {}; const ms = metasSquad(sq), principal = ms.find(m => m.tipo === 'meta'), outros = ms.filter(m => m !== principal);
    if (!ms.length) return `<div class="mm mm-vazio"><b>🐠</b>Esta squad ainda não tem meta nem desafio.<br>${o.gestorGeral ? 'Crie em <b>⚙ Configurações → 🐟 Metas</b>.' : 'O PO ou o Organizador cria em ⚙ Configurações → 🐟 Metas.'}</div>`;
    const opt = m => ({ pode: o.pode ? o.pode(m) : false, gestor: false });
    let h = `<div class="mm">`;
    if (principal) h += `<div class="mm-sec">${heroHtml(principal, Object.assign(opt(principal), { escopoTxt: o.nomeSquad || '' }))}</div>`;
    const desafios = outros.filter(m => m.tipo === 'desafio'), metas2 = outros.filter(m => m.tipo === 'meta');
    if (metas2.length) h += `<div class="mm-sec"><div class="mm-sec-t">🎯 Outras metas</div><div class="mm-grid">${metas2.map(m => cartaoHtml(m, opt(m))).join('')}</div></div>`;
    if (desafios.length) h += `<div class="mm-sec"><div class="mm-sec-t">🏆 Desafios</div><div class="mm-grid">${desafios.map(m => cartaoHtml(m, opt(m))).join('')}</div></div>`;
    return h + `</div>`;
  }
  // Ranking das squads (só as metas marcadas "mostrar na visão global"): uma barra por squad, na cor da situação, em ordem de %.
  function squadsRankingHtml(nomeDe) {
    const g = squadsGlobais(), sqs = Object.keys(g); if (!sqs.length) return '';
    nomeDe = nomeDe || (id => ({ nome: id, emoji: '🐠' }));
    const linhas = sqs.map(sq => { const l = g[sq], m = l.find(x => x.tipo === 'meta') || l[0], nm = nomeDe(sq); return { nome: nm.nome, emoji: nm.emoji, pct: pct(m), cor: status(m).cor }; }).sort((a, b) => (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct));
    return rankingHtml(linhas);
  }
  // nomeDe(sqId) -> {nome, emoji}
  function painelDigitalHtml(o) {
    o = o || {}; const dg = metasDigital(), principal = dg.find(m => m.tipo === 'meta'), outras = dg.filter(m => m !== principal);
    const opt = m => ({ pode: o.pode ? o.pode(m) : false, gestor: false });
    let h = `<div class="mm">`;
    if (principal) h += `<div class="mm-sec">${heroHtml(principal, Object.assign(opt(principal), { escopoTxt: 'Digital' }))}</div>`;
    else h += `<div class="mm-sec"><div class="mm-vazio"><b>🌊</b>A meta global do Digital ainda não foi cadastrada.<br>${o.editorGlobal ? 'Cadastre no Painel → 📊 Dados → 🐟 Metas do Digital.' : 'Quem cuida dos dados cadastra no Painel → 📊 Dados.'}</div></div>`;
    const desafios = outras.filter(m => m.tipo === 'desafio'), metas2 = outras.filter(m => m.tipo === 'meta');
    if (metas2.length) h += `<div class="mm-sec"><div class="mm-sec-t">🎯 Outras metas do Digital</div><div class="mm-grid">${metas2.map(m => cartaoHtml(m, opt(m))).join('')}</div></div>`;
    if (desafios.length) h += `<div class="mm-sec"><div class="mm-sec-t">🏆 Desafios do Digital</div><div class="mm-grid">${desafios.map(m => cartaoHtml(m, opt(m))).join('')}</div></div>`;
    const g = squadsGlobais(), nomeDe = o.nomeDe || (id => ({ nome: id, emoji: '🐠' }));
    const sqs = Object.keys(g);
    if (sqs.length) {
      const prin = sqs.map(sq => { const l = g[sq], m = l.find(x => x.tipo === 'meta') || l[0], st = status(m), nm = nomeDe(sq); return { sq, nome: nm.nome, emoji: nm.emoji, pct: pct(m), cor: st.cor, m }; }).sort((a, b) => (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct));
      h += `<div class="mm-sec"><div class="mm-sec-t">🐠 Squads <span style="font-weight:500;text-transform:none;letter-spacing:0">(metas marcadas "mostrar na visão global")</span></div>${rankingHtml(prin)}
        <div class="mm-grid" style="margin-top:12px">${sqs.map(sq => g[sq].map(m => cartaoHtml(m, { pode: o.pode ? o.pode(m) : false, gestor: false, escopoTxt: (nomeDe(sq).emoji || '') + ' ' + nomeDe(sq).nome })).join('')).join('')}</div></div>`;
    }
    return h + `</div>`;
  }
  // Liga os botões (✏️ atualizar · 📈 evolução · ⚙ editar) de um container já desenhado.
  function ligar(container, ctx) {
    if (!container || container._mmLigado) return; container._mmLigado = true;
    container.addEventListener('click', async e => {
      const b = e.target.closest('[data-mm-act]'); if (!b) return;
      const box = b.closest('[data-mm-id]'); if (!box) return;
      const m = achar(box.dataset.mmId, box.dataset.mmEsc, box.dataset.mmSq); if (!m) return;
      const act = b.dataset.mmAct;
      if (act === 'reg') abrirRegistrar(m, { onSave: (v, nota) => registrar(m, v, ctx.user(), nota) });
      if (act === 'edit' && ctx.editar) ctx.editar(m);
      if (act === 'graf') {
        const slot = box.querySelector('.mm-chart-slot'); if (!slot) return;
        if (!slot.hidden) { slot.hidden = true; return; }
        slot.hidden = false; slot.innerHTML = '<div class="mm-chart-vazio">Carregando…</div>';
        const pts = await lerLog(m.id); slot.innerHTML = graficoHtml(m, pts);
      }
    });
  }

  const api = {
    IS_DEV, PATHS, SUBMARCAS, CANAIS, MARCOS, STATUS,
    // matemática
    hojeSP, fmtVal, pctTxt, pct, esperado, temCurva, curvaAcum, metaDoDia, lerColado, numPt, status, marcoDe, valorDoMarco, proximoMarco, falta, diasRestantes, ritmoNecessario, patchDeRegistro, ago, desatualizada, lembreteTxt, validar, ordenar, blackFriday, intervaloLembreteMs,
    // visual
    injetaCss, anelHtml, marcosHtml, kpisHtml, graficoHtml, heroHtml, cartaoHtml, rankingHtml, squadsRankingHtml, statusPill, painelSquadHtml, painelDigitalHtml, ligar,
    // dados
    iniciar, ouvirTodasSquads, salvar, remover, arquivar, registrar, lerLog, metasDigital, metasSquad, todasDaSquad, todasDigital, squadsGlobais, achar,
    // modais
    abrirForm, abrirRegistrar, mostrarPeixes, vigiaMarcos,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MareMetas = api;
})(typeof window !== 'undefined' ? window : globalThis);
