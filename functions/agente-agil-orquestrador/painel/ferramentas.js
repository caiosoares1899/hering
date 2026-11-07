const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { nodeFor } = require('./nodeFor');

const DAY = 86400000;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const BASE = ['dados', 'prf', 'midiacriativa'];
const DEV = ['dev', 'omnichannel'];
const COL_NAMES = { backlog: 'Backlog', todo: 'A Fazer', progress: 'Em Progresso', blocker: 'Impedimentos', done: 'Concluído' };
const squadSchema = z.string().regex(ID).optional();
const visaoSchema = z.object({ squad: squadSchema }).strict();
const fluxoSchema = z.object({ squad: squadSchema, dias: z.union([z.literal(7), z.literal(14), z.literal(15), z.literal(30)]) }).strict();
const statusSchema = z.object({}).strict();
const valores = v => Object.values(v || {}).filter(Boolean);
const round1 = n => n == null ? null : Number(n.toFixed(1));
const indisponivel = motivo => ({ disponivel: false, motivo });
// Não repassar texto que contenha possíveis dados pessoais/segredos, nem URLs.
function texto(v) {
  const s = String(v == null ? '' : v);
  if (/@|uid|token|https?:|\+?\d[\d\s().-]{7,}\d/i.test(s)) return '[conteúdo omitido]';
  return s.replace(/[\x00-\x1f]/g, ' ').slice(0, 80);
}
function data(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
}
const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;
// A tela usa o fuso do navegador; esta camada adota o fuso operacional de Brasília.
function meiaNoite(agora, deslocamento = 0) {
  const dia = new Date(agora).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return Date.parse(dia + 'T00:00:00-03:00') + deslocamento * DAY;
}
function parseData(v) { return new Date(v + (v.length <= 10 ? 'T12:00:00-03:00' : '')).getTime(); }

// espelha loadExtraSquads do painel-dev.html; prod tem os três squads base + extras.
async function listarSquads(ler, env) {
  const meta = await ler('squads_meta');
  const ids = env === 'dev' ? DEV : BASE.concat(Object.keys(meta).filter(id => meta[id]?.label && ID.test(id) && !BASE.includes(id)));
  return ids.map(id => ({ id, wipLimit: env === 'dev' || BASE.includes(id) ? 3 : parseInt(meta[id].wipLimit) || 3 }));
}

// espelha _applySquadDados do painel-dev.html, sem carregar membros ou dados privados.
async function lerBoards(ler, squads) {
  return Promise.all(squads.map(async sq => {
    const [cards, cols, agilCfg, blockerMode, flowBaseline] = await Promise.all([
      ler('squad_cards', sq.id), ler('squad_columns', sq.id, null), ler('squad_agil_cfg', sq.id),
      ler('squad_blocker_mode', sq.id), ler('squad_flow_baseline', sq.id),
    ]);
    return { ...sq, cards: valores(cards), columns: cols ? valores(cols) : Object.entries(COL_NAMES).map(([id, name]) => ({ id, name })), agilCfg, blockerMode: typeof blockerMode === 'string' ? blockerMode : 'col', flowBaseline };
  }));
}

// espelha renderSquadCards e _avisosQuadroSquad do painel-dev.html.
function visaoSquad(d, agora) {
  const cards = d.cards.filter(c => !c.archived);
  const contar = id => cards.filter(c => c.col === id).length;
  const limite = parseInt(d.agilCfg.wip || d.wipLimit || 3);
  const diffs = cards.filter(c => c.due && c.col !== 'done').map(c => Math.round((Date.parse(c.due + 'T00:00:00-03:00') - meiaNoite(agora)) / DAY));
  return {
    squad: texto(d.id), ativos: cards.length, wip: contar('progress'), limite_wip: Number.isFinite(limite) ? limite : null,
    entregues: contar('done'), pontos_entregues: cards.filter(c => c.col === 'done').reduce((s, c) => s + parseInt(c.sp || 0), 0),
    bloqueados: contar('blocker'),
    colunas_total: d.columns.length,
    colunas: d.columns.slice(0, 20).map(col => ({ coluna: texto(col.name || col.id), atual: contar(col.id), percentual: cards.length ? Math.round(contar(col.id) / cards.length * 100) : 0, limite_wip: col.id === 'progress' ? (Number.isFinite(limite) ? limite : null) : typeof col.wip === 'number' && col.wip > 0 ? col.wip : null })),
    prazos: { vencidos: diffs.filter(n => n < 0).length, vence_hoje: diffs.filter(n => n === 0).length, vencendo: diffs.filter(n => n >= 0 && n <= 2).length },
  };
}

// espelha flowColsFor, _startTs, _doneTs e _createdTs do painel-dev.html.
function flowColsFor(d) {
  const cols = d.columns, ids = cols.map(c => c.id);
  return {
    startId: cols.find(c => c.id === 'progress' || /progress|andamento|fazendo|doing|execu/i.test(c.name || ''))?.id || (ids.length > 1 ? ids[1] : ids[0]),
    doneId: cols.find(c => c.id === 'done' || /conclu|done|feito|finaliz/i.test(c.name || ''))?.id || 'done',
  };
}
function startTs(c) {
  if (c.flow?.firstStartAt) return new Date(c.flow.firstStartAt).getTime();
  if (c.flow?.enteredAt) {
    const vs = Object.values(c.flow.enteredAt).map(v => new Date(v).getTime()).filter(n => !isNaN(n));
    if (vs.length) return Math.min(...vs);
  }
  return c.createdAt ? parseData(c.createdAt) : null;
}
function doneTs(c) { return c.flow?.doneAt ? new Date(c.flow.doneAt).getTime() : c.doneAt ? new Date(c.doneAt).getTime() : null; }
function createdTs(c) { return c.createdAt ? parseData(c.createdAt) : startTs(c); }
// espelha percentile e median do painel-dev.html (nearest rank, inclusive n par).
function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1))];
}
// espelha _flowStage do painel-dev.html.
function flowStage(d, c, fc) {
  if (c.col === fc.doneId) return 'concluido';
  if (d.blockerMode === 'col' ? c.col === 'blocker' : !!c.blocker) return 'bloqueado';
  const ids = d.columns.map(x => x.id), si = ids.indexOf(fc.startId), ci = ids.indexOf(c.col);
  return si >= 0 && ci >= 0 && ci < si ? 'fila' : 'andamento';
}
// espelha _collectFlowCards do painel-dev.html; cycle/lead NÃO têm corte por dias.
function coletarFluxo(boards, agora, dias) {
  const cycle = [], lead = [], open = [], done = []; let fila = 0;
  const corte = meiaNoite(agora, -(dias - 1));
  boards.forEach(d => {
    const baseline = d.flowBaseline.at ? new Date(d.flowBaseline.at).getTime() : 0, fc = flowColsFor(d);
    d.cards.filter(c => !c.archived).forEach(c => {
      const st = startTs(c), dn = doneTs(c), cr = createdTs(c);
      if (c.col === fc.doneId && dn && dn >= baseline) {
        if (st && dn >= st) cycle[cycle.length] = (dn - st) / DAY;
        if (cr && dn >= cr) lead[lead.length] = (dn - cr) / DAY;
        done[done.length] = dn;
      } else if (c.col !== fc.doneId) {
        const stage = flowStage(d, c, fc);
        if (stage === 'fila') fila++;
        else if (st) open[open.length] = { squad: texto(d.id), card: c, age: (agora - st) / DAY, stage, coluna: d.columns.find(col => col.id === c.col)?.name || c.col };
      }
    });
  });
  return { cycle, lead, open, done, fila, corte };
}
// espelha _squadThroughput14 do painel-dev.html (janela móvel, não civil).
function throughput14(d, agora) {
  const fc = flowColsFor(d), baseline = d.flowBaseline.at ? new Date(d.flowBaseline.at).getTime() : 0;
  return d.cards.filter(c => !c.archived && c.col === fc.doneId && doneTs(c) && doneTs(c) >= agora - 14 * DAY && doneTs(c) >= baseline).length;
}
function comparacao(atual, anterior) {
  const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { atual, anterior, referencia: 'período anterior', texto: atual === anterior ? `permaneceu em ${fmt(atual)} cards por semana` : `${atual > anterior ? 'subiu' : 'caiu'} de ${fmt(anterior)} para ${fmt(atual)} cards por semana` };
}
// espelha renderFlowMetrics e renderAgingWip do painel-dev.html.
function fluxo(boards, agora, dias) {
  const f = coletarFluxo(boards, agora, dias), cm = percentile(f.cycle, 50), cp = percentile(f.cycle, 85);
  const threshold = cp != null ? cp : cm != null ? cm * 2 : null;
  const sorted = f.open.sort((a, b) => b.age - a.age);
  const item = o => ({ squad: texto(o.squad), titulo: texto(o.card.title || '(sem título)'), coluna: texto(o.coluna), idade_dias: Math.round(o.age), bloqueado: o.stage === 'bloqueado', alerta: threshold != null ? o.age > threshold : Math.round(o.age) >= 14 });
  const atual = f.done.filter(t => t >= f.corte).length, anterior = f.done.filter(t => t >= f.corte - dias * DAY && t < f.corte).length;
  return {
    dias, cycle_time: { mediana_dias: round1(cm), p85_dias: round1(cp), amostra: f.cycle.length },
    lead_time: { mediana_dias: round1(percentile(f.lead, 50)), p85_dias: round1(percentile(f.lead, 85)), amostra: f.lead.length },
    vazao: { entregues: atual, por_semana: round1(atual / (dias / 7)), comparacao: comparacao(round1(atual / (dias / 7)), round1(anterior / (dias / 7))) },
    throughput14_total_squads: boards.length,
    throughput14_por_squad: boards.slice(0, 20).map(d => ({ squad: texto(d.id), entregues: throughput14(d, agora) })),
    wip: { em_andamento: sorted.length, na_fila: f.fila, limite_dias: round1(threshold), acima_limite: threshold != null ? sorted.filter(o => o.age > threshold).length : 0, parado_ha_mais_tempo: sorted[0] ? { ...item(sorted[0]), alerta: threshold != null && sorted[0].age > threshold } : null, itens: sorted.slice(0, 8).map(item) },
  };
}

// espelha _scMontarEventos / _scRender / _scSaude do painel-dev.html.
async function saudeCards(ler, squads, agora) {
  const corte = new Date(agora - 30 * DAY).toISOString(), eventos = [];
  await Promise.all([...new Set(BASE.concat(squads.map(s => s.id)))].map(async id => {
    const [g, r, a] = await Promise.all([ler('guardiao_incidentes', id), ler('guardiao_resolvidos', id), ler('squad_alarmes', id)]);
    const restaurados = {};
    Object.entries(g).forEach(([k, x]) => {
      if (!x || !x.cardId || !(x.detectadoEm >= corte)) return;
      if (x.acao === 'restaurado') restaurados[x.cardId] = x.detectadoEm > (restaurados[x.cardId] || '') ? x.detectadoEm : restaurados[x.cardId];
      eventos[eventos.length] = { bom: x.acao === 'restaurado', resolvido: !!r[k] };
    });
    Object.entries(a).forEach(([k, x]) => {
      if (!x || !x.cardId || !(x.detectadoEm >= corte)) return;
      const rt = restaurados[x.cardId];
      if (rt && Date.parse(rt) >= Date.parse(x.detectadoEm) - 60000) return;
      eventos[eventos.length] = { bom: false, resolvido: !!r['alarme_' + k] };
    });
  }));
  const st = await ler('guardiao_status'), min = st.ts ? Math.max(0, Math.round((agora - Date.parse(st.ts)) / 60000)) : null;
  const atraso = numero(st.atrasoMaxMin);
  const pulso = !st.ts ? { ok: null, texto: 'Guardião: aguardando o primeiro pulso' }
    : min >= 15 ? { ok: false, texto: `Guardião sem pulso há ${min} min` }
      : st.ok === false ? { ok: false, texto: `Guardião: espelho atrasado ${atraso} min` }
        : { ok: true, texto: `Guardião ativo · pulso há ${min} min` };
  return { abertos: eventos.filter(e => !e.bom && !e.resolvido).length, resolvidos: eventos.filter(e => !e.bom && e.resolvido).length, restaurados: eventos.filter(e => e.bom).length,
    _status: { ...pulso, ts: data(st.ts), pulso_min: Number.isFinite(min) ? min : null, atraso_max_min: atraso, abertos_7dias: numero(st.abertosTotal) } };
}
function vigia(v, tipo) {
  if (!Object.keys(v).length) return indisponivel('Aguardando primeira execução do vigia persistido');
  return { disponivel: true, fonte: 'vigia persistido; o navegador pode ter leitura ao vivo mais recente', verificado_em: data(v.verificadoEm), ok: typeof v.ok === 'boolean' ? v.ok : null, abertos: numero(v.abertos), servico_status: texto(tipo === 'github' ? v.pagesStatus || 'unknown' : v.rtdbStatus || 'unknown') };
}
// espelha loadStatusData do painel-dev.html (estimativa JSON, não uso faturado).
async function statusPainel(ler, squads, agora) {
  const [rows, camp, gh, fb, guardiao] = await Promise.all([
    Promise.all(squads.map(async s => {
      const v = await ler('squad_dados', s.id);
      return { squad: texto(s.id), bytes: Buffer.byteLength(JSON.stringify(v)), cards: v.cards ? Array.isArray(v.cards) ? v.cards.filter(Boolean).length : Object.keys(v.cards).length : 0 };
    })), ler('campanhas'), ler('github_saude'), ler('firebase_saude'), saudeCards(ler, squads, agora),
  ]);
  const campBytes = Buffer.byteLength(JSON.stringify(camp)), bytes = rows.reduce((s, r) => s + r.bytes, campBytes), pct = Math.min(100, bytes / 1073741824 * 100);
  return { peso: { bytes, campanhas_bytes: campBytes, cards: rows.reduce((s, r) => s + r.cards, 0), percentual_referencia: Number(pct.toFixed(3)), saude: pct < 25 ? 'Saudável' : pct < 60 ? 'Crescendo' : pct < 85 ? 'Atenção' : 'Crítico', squads_total: rows.length, squads: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 20) },
    latencia: indisponivel('Medição da conexão do navegador'), online: indisponivel('Presenças carregadas na sessão do navegador'),
    github_ao_vivo: indisponivel('Feed consultado pelo navegador; esta ferramenta não acessa rede'), firebase_ao_vivo: indisponivel('Feed e sessão Auth medidos no navegador'),
    github_vigia: vigia(gh, 'github'), firebase_vigia: vigia(fb, 'firebase'), guardiao };
}

function buildPainelTools({ db, env, papel }) {
  // AUTH: biblioteca interna. O futuro gatilho autentica interno/canário; papel não amplia acesso aqui.
  void papel;
  nodeFor(env, 'squads_meta'); // falhar fechado antes de qualquer leitura
  const ler = async (nome, squad, fallback = {}) => {
    if (squad !== undefined && !ID.test(squad)) throw new Error('Squad inválido');
    const path = nodeFor(env, nome).replace(':squad', squad || '');
    return (await db.ref(path).get()).val() || fallback;
  };
  const tool = (name, description, schema, executar) => ({ name, description, input_schema: zodToJsonSchema(schema), handler: async input => {
    const args = schema.parse(input);
    const squads = await listarSquads(ler, env);
    // Enum dinâmico: o JSON schema limita sintaxe; o handler zod valida a lista real relida do banco.
    if (args.squad !== undefined) z.enum(squads.map(s => s.id)).parse(args.squad);
    const selecionados = args.squad ? squads.filter(s => s.id === args.squad) : squads;
    const agora = Date.now();
    return { fonte: 'painel', ambiente: env, lido_em: new Date(agora).toISOString(), ...await executar(selecionados, args, agora) };
  } });
  return [
    tool('painel_visao', 'Cartões de squad da Visão, sem ocultação local de colunas; prazos dos avisos do quadro.', visaoSchema, async (squads, args, agora) => ({ ocultacao_local: indisponivel('Preferência de colunas no navegador; contagens sem ocultação'), squads_total: squads.length, squads: (await lerBoards(ler, squads)).slice(0, 20).map(d => visaoSquad(d, agora)) })),
    tool('painel_fluxo', 'Fluxo do Painel: mediana/P85 históricos após baseline, vazão na janela, idade desde início sem fila.', fluxoSchema, async (squads, args, agora) => fluxo(await lerBoards(ler, squads), agora, args.dias)),
    tool('painel_status', 'Status persistido e saúde dos cards/Guardião; medições exclusivas do navegador indisponíveis.', statusSchema, async (squads, args, agora) => statusPainel(ler, squads, agora)),
  ];
}

module.exports = { buildPainelTools };
