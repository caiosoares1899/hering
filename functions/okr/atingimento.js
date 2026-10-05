// functions/okr/atingimento.js
//
// 📈 Atingimento dos Objetivos (OKR) no lado do servidor — o Agente Ágil do chat de OKR LÊ e ATUA nele
// (ver agenteTools.js: resumo_atingimentos / registrar_atingimento / configurar_atingimento).
//
// O bloco entre ATING-ENGINE-BEGIN/END é uma CÓPIA LITERAL do motor de cálculo de painel-dev.html/painel.html
// (tipos, moedas, parse/format pt-BR, % por tipo, registro atual): o servidor TEM que calcular o % exatamente
// como a tela, senão o agente diria um número e a barra do painel outro. __tests__/atingimento.test.js lê os dois
// HTML e falha se o bloco divergir, além de comparar o resultado em centenas de casos aleatórios. Se mudar o motor
// no painel, copie o bloco de novo pra cá (e pro okr-apresentacao.slide.html, que tem a cópia mínima).
//
// Fora do bloco: só o que é do servidor (resumo pro agente, validação de entrada, montagem do registro).

/* ATING-ENGINE-BEGIN */
const OKR_ATING_TIPOS = [
  {id:'financeira', ico:'💰', label:'Financeira'},
  {id:'porcentagem', ico:'📊', label:'Porcentagem (%)'},
  {id:'numero', ico:'🔢', label:'Número (#)'},
  {id:'binario', ico:'✅', label:'Atingido/Não atingido (0%/100%)'},
  {id:'acima', ico:'⬆️', label:'Manter acima de'},
  {id:'abaixo', ico:'⬇️', label:'Manter abaixo de'},
  {id:'data', ico:'📅', label:'Data de entrega'},
  {id:'perene', ico:'♾️', label:'Perene (acompanha pelos marcos)'},
];
const OKR_ATING_MOEDAS = {
  BRL:{label:'Real (R$)', sym:'R$', cur:'BRL'}, USD:{label:'Dólar (US$)', sym:'US$', cur:'USD'}, EUR:{label:'Euro (€)', sym:'€', cur:'EUR'},
  PCT:{label:'Porcentagem (%)', sym:'%'}, NUM:{label:'Número (#)', sym:'#'},
};
// Unidade efetiva do tipo (o que aparece junto dos valores): financeira = moeda escolhida; % e Número fixos; Manter acima/abaixo = a escolhida.
function _okrAtingUnidade(at){
  if(!at) return 'NUM';
  if(at.tipo==='financeira') return OKR_ATING_MOEDAS[at.moeda] && OKR_ATING_MOEDAS[at.moeda].cur ? at.moeda : 'BRL';
  if(at.tipo==='porcentagem') return 'PCT';
  if(at.tipo==='acima' || at.tipo==='abaixo') return OKR_ATING_MOEDAS[at.moeda] ? at.moeda : 'PCT';
  return 'NUM';
}
// Aceita "1.234,56", "1234,5", "1234.5", "R$ 100", "50 %" — devolve NaN se não for número.
function _okrParseNum(v){
  if(typeof v==='number') return isFinite(v) ? v : NaN;
  let t = String(v==null?'':v).trim().replace(/R\$|US\$|€|%|\s/g,'');
  if(!t) return NaN;
  if(t.includes(',')) t = t.replace(/\./g,'').replace(',','.');
  else if((t.match(/\./g)||[]).length>1) t = t.replace(/\./g,'');
  else if(/^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace('.','');   // "1.000" no padrão pt-BR é mil, não 1,000
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}
function _okrFmtNum(n, unidade){
  if(n==null || !isFinite(n)) return '—';
  const m = OKR_ATING_MOEDAS[unidade];
  if(m && m.cur) return new Intl.NumberFormat('pt-BR',{style:'currency',currency:m.cur}).format(n);
  if(unidade==='PCT') return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' %';
  return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
}
function _okrAtingTipoIco(t){ return (OKR_ATING_TIPOS.find(x=>x.id===t)||{}).ico||'📈'; }
function _okrAtingTipoLabel(t){ return (OKR_ATING_TIPOS.find(x=>x.id===t)||{}).label||t; }
function _okrAtingConfigurado(at){ return !!(at && at.tipo && OKR_ATING_TIPOS.some(t=>t.id===at.tipo)); }
// % (0–100, inteiro) de UM registro, segundo a configuração. Valores além da meta travam em 100; abaixo do início, em 0.
function _okrAtingPctDe(at, l){
  if(!_okrAtingConfigurado(at) || !l) return 0;
  const clamp = x => Math.max(0, Math.min(100, Math.round(x)));
  const v = Number(l.valor), ini = Number(at.inicial)||0, meta = Number(at.meta);
  switch(at.tipo){
    case 'financeira': case 'porcentagem': case 'numero':
      if(!isFinite(v) || !isFinite(meta)) return 0;
      if(meta===ini) return v>=meta ? 100 : 0;
      return clamp((v-ini)/(meta-ini)*100);             // meta < início (reduzir custo, por ex.) também funciona
    case 'binario':
      return (l.atingido===true || v>=100) ? 100 : 0;
    case 'acima':
      return (isFinite(v) && isFinite(meta) && v>=meta) ? 100 : 0;
    case 'abaixo':
      return (isFinite(v) && isFinite(meta) && v<=meta) ? 100 : 0;
    case 'data': {                                       // entrega fora de TODAS as faixas = 0%; em mais de uma, vale a maior
      const d = l.em || '';
      let best = 0;
      (at.datas||[]).forEach(f=>{ if(f && f.de && f.ate && d>=f.de && d<=f.ate) best = Math.max(best, Number(f.pct)||0); });
      return clamp(best);
    }
  }
  return 0;
}
// Registro mais recente (por data do atingimento; empate = o lançado por último).
function _okrAtingAtual(at){
  const ls = (at && at.lancamentos || []).filter(Boolean).slice();
  if(!ls.length) return null;
  ls.sort((a,b)=> String(a.em||'').localeCompare(String(b.em||'')) || String(a.criadoEm||'').localeCompare(String(b.criadoEm||'')));
  return ls[ls.length-1];
}
// null = Objetivo SEM atingimento configurado (a barra segue os marcos); número = % atual (0 se ainda não há registro).
function _okrAtingPctObj(o){
  const at = o && o.atingimento;
  if(!_okrAtingConfigurado(at)) return null;
  if(at.tipo==='perene') return null;          // ♾️ perene: sem meta nem registros — a barra continua pelos marcos
  const l = _okrAtingAtual(at);
  return l ? _okrAtingPctDe(at, l) : 0;
}
/* ATING-ENGINE-END */

// ── Só do servidor ──────────────────────────────────────────────────────────────────────────────────────────────

const TIPOS_COM_META_NUMERICA = ['financeira', 'porcentagem', 'numero', 'acima', 'abaixo'];
const MOEDAS_IDS = Object.keys(OKR_ATING_MOEDAS);

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' sem passar por Date (evita erro de fuso).
function dataBR(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

// Mesmo texto de _okrAtingLancTxt() (painel-dev.html) — é o que o 📜 Histórico mostra.
function lancamentoTexto(at, l) {
  if (at.tipo === 'binario') return l.atingido ? '✅ Atingido' : '⏳ Não atingido';
  if (at.tipo === 'data') return '📦 Entregue em ' + dataBR(l.em);
  return _okrFmtNum(Number(l.valor), _okrAtingUnidade(at));
}

// Realtime Database devolve lista como array ou, se tiver buraco, como objeto {idx: item}.
function lancamentosDe(at) {
  const raw = at && at.lancamentos;
  const lista = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return lista.filter(Boolean);
}
function datasDe(at) {
  const raw = at && at.datas;
  const lista = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return lista.filter(Boolean);
}

// Mesma conta de _okrObjProgressoPct() (painel): atingimento quando há meta (não perene); senão, % de marcos concluídos.
function progressoDoObjetivo(objetivo, marcosAtivos) {
  const viaAting = _okrAtingPctObj(normalizar(objetivo));
  if (viaAting !== null) return { pct: viaAting, origem: 'atingimento' };
  const ms = marcosAtivos || [];
  if (!ms.length) return { pct: 0, origem: 'marcos' };
  return { pct: Math.round((ms.filter((m) => m.progresso === 'concluido').length / ms.length) * 100), origem: 'marcos' };
}

// O motor do painel espera arrays; o RTDB pode devolver objeto. Devolve uma cópia rasa só com `atingimento` normalizado.
function normalizar(objetivo) {
  const at = objetivo && objetivo.atingimento;
  if (!at || typeof at !== 'object') return { atingimento: null };
  return { atingimento: { ...at, lancamentos: lancamentosDe(at), datas: datasDe(at) } };
}

function diasEntre(deStr, ateStr) {
  const a = Date.parse(deStr + 'T00:00:00Z'), b = Date.parse(ateStr + 'T00:00:00Z');
  return isFinite(a) && isFinite(b) ? Math.round((b - a) / 86400000) : null;
}

// Resumo do atingimento de UM Objetivo pro agente (null = sem atingimento configurado).
function resumoAtingimento(objetivo, hoje) {
  const at = normalizar(objetivo).atingimento;
  if (!_okrAtingConfigurado(at)) return null;
  const un = _okrAtingUnidade(at);
  const tipo = at.tipo;
  const base = { tipo, tipo_rotulo: _okrAtingTipoLabel(tipo), perene: tipo === 'perene' };
  if (tipo === 'perene') return { ...base, observacao: 'Perene: sem meta nem registros — a barra do Objetivo anda pelos marcos.' };
  const ls = at.lancamentos.slice().sort((a, b) => String(a.em || '').localeCompare(String(b.em || '')) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  const atual = _okrAtingAtual(at);
  const out = { ...base, unidade: un, pct: _okrAtingPctObj({ atingimento: at }), total_registros: ls.length };
  if (TIPOS_COM_META_NUMERICA.includes(tipo)) {
    out.meta = Number(at.meta);
    out.meta_texto = _okrFmtNum(Number(at.meta), un);
    if (tipo !== 'acima' && tipo !== 'abaixo') { out.valor_inicial = Number(at.inicial) || 0; out.valor_inicial_texto = _okrFmtNum(Number(at.inicial) || 0, un); }
  }
  if (tipo === 'data') out.faixas = at.datas.map((f) => ({ de: f.de || '', ate: f.ate || '', pct: Number(f.pct) || 0 }));
  if (atual) {
    out.atual = { data: atual.em || '', texto: lancamentoTexto(at, atual), pct: _okrAtingPctDe(at, atual) };
    if (tipo !== 'binario' && tipo !== 'data') out.atual.valor = Number(atual.valor);
    if (hoje && atual.em) out.dias_desde_ultimo_registro = diasEntre(atual.em, hoje);
  }
  out.registros_recentes = ls.slice(-5).reverse().map((l) => ({ id: l.id, data: l.em || '', texto: lancamentoTexto(at, l), pct: _okrAtingPctDe(at, l), por: l.por || '', nota: l.nota || '' }));
  return out;
}

module.exports = {
  OKR_ATING_TIPOS,
  OKR_ATING_MOEDAS,
  TIPOS_COM_META_NUMERICA,
  MOEDAS_IDS,
  _okrAtingUnidade,
  _okrParseNum,
  _okrFmtNum,
  _okrAtingTipoIco,
  _okrAtingTipoLabel,
  _okrAtingConfigurado,
  _okrAtingPctDe,
  _okrAtingAtual,
  _okrAtingPctObj,
  dataBR,
  lancamentoTexto,
  lancamentosDe,
  datasDe,
  progressoDoObjetivo,
  normalizar,
  resumoAtingimento,
};
