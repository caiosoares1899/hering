// functions/plantao/plantao.js — 🛟 Plantão de Bugs (férias do Caio, 16/10 → 03/11/2026). Runbook: docs/PLANTAO_BUGS.md.
//
// O que o servidor faz (sem IA por enquanto — custo zero, 100% testável):
//   1. plantaoBugNovo — quando o Assistente Férias (Oceano) grava um bug em kanban/feedback/{id} (origem 'assistente_ferias'):
//        • cria a ficha do bug em kanban/plantao/{id} (estado 'aguardando') — nó SÓ de ADM (database.rules.json);
//        • junta DUPLICADOS (mesmo arquivo-alvo + descrição parecida com um bug ainda aberto): estado 'duplicado', sem barulho;
//        • senão, avisa os ADMs (sino + push, tipo `plantao_bug`) — o aviso abre o card do bug na squad Dados.
//   2. plantaoVigia — de 3 em 3 horas (só 08–20h de Brasília) avisa os ADMs de bug PARADO: aguardando há muito tempo (🔴 2h · 🟠 6h · resto 24h)
//        ou em análise/PR/teste/escalado há mais de 24h. No máximo 1 aviso por bug por dia.
// Chave geral: kanban/config/plantao_ativo = false pausa tudo (as duas funções saem sem fazer nada). Ausente = ligado.
// Quem valida o conserto é SEMPRE um ADM (tela no Oceano → aba 🐛 Reportar Bug): a ficha guarda PR, script de teste, resultado e quem validou.
const { onValueCreated } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

const ABERTOS = ['aguardando', 'em_analise', 'pr_aberto', 'testando', 'reprovado'];   // ainda precisam de gente
const VIGIADOS_24H = ['em_analise', 'pr_aberto', 'testando', 'reprovado', 'escalado'];
const FIM = ['validado', 'em_prod', 'duplicado', 'cancelado'];
const JANELA_DUPLICADO_DIAS = 14;
const LIMITE_SIMILARIDADE = 0.5;
const PARADAS = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'que', 'com', 'por', 'para', 'pra', 'ao', 'se', 'nao', 'não', 'ta', 'tá', 'esta', 'está', 'mas', 'ou', 'foi', 'ser', 'ter', 'aqui', 'isso', 'esse', 'essa', 'ele', 'ela', 'quando', 'ainda', 'muito', 'mais', 'tem', 'fica', 'ficou', 'fazer', 'the']);

const ativo = async (db) => (await db.ref('kanban/config/plantao_ativo').get()).val() !== false;
const dataBr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);          // AAAA-MM-DD
const horaBr = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(d));

function tokens(t) {
  return new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !PARADAS.has(w)));
}
function similaridade(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);   // Jaccard
}
// Procura, entre as fichas ainda abertas, a que descreve o mesmo problema. `outros` = { id: ficha }.
function acharDuplicado({ id, arquivoAlvo, resumo, outros, agora }) {
  const corte = agora.getTime() - JANELA_DUPLICADO_DIAS * 86400000;
  let melhor = null;
  for (const [oid, o] of Object.entries(outros || {})) {
    if (oid === id || !o || FIM.includes(o.estado) || o.estado === 'escalado' || (o.criadoEm || 0) < corte) continue;
    if (o.arquivoAlvo !== arquivoAlvo) continue;
    const s = similaridade(resumo, o.resumo);
    if (s >= LIMITE_SIMILARIDADE && (!melhor || s > melhor.s)) melhor = { id: oid, s };
  }
  return melhor;
}

async function listarAdms(db) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  return Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
}
// Notifica todos os ADMs (id fixo = não duplica nem reabre uma já lida). Devolve quantos receberam.
async function avisarAdms(db, { id, title, sub, cardId, agora }) {
  let n = 0;
  for (const uid of await listarAdms(db)) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set(Object.assign({ id, type: 'plantao_bug', title, sub: String(sub || '').slice(0, 280), squad: 'dados', read: false, ts: agora.toISOString() }, cardId ? { cardId } : {}));
    n++;
  }
  return n;
}

// Mesmo cálculo de feriasCardIdBug (oceano-dev.html) — o teste cobre os dois formatos de entrada.
const cardIdDoBug = (id) => {
  const s = String(id || '').trim();
  return s.startsWith('c_ferias_') ? s : 'c_ferias_' + s.replace(/^bug_ferias_/, '').replace(/[^0-9A-Za-z_]/g, '');
};
const limpa = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);

// Pura o bastante pra teste (db injetado). `bug` = registro em kanban/feedback/{id}.
async function processarBugNovo({ db, id, bug, agora = new Date() }) {
  if (!bug || bug.origem !== 'assistente_ferias') return { pulou: 'outra_origem' };
  if (!(await ativo(db))) return { pulou: 'desligado' };
  const ficha = db.ref(`kanban/plantao/${id}`);
  if ((await ficha.get()).exists()) return { pulou: 'ja_existe' };      // o gatilho pode repetir: idempotente
  const resumo = limpa(bug.texto || bug.msg, 400);
  const dados = {
    estado: 'aguardando', criadoEm: Number(bug.criadoEm) || agora.getTime(), atualizadoEm: agora.getTime(), tentativas: 0,
    arquivoAlvo: limpa(bug.arquivoAlvo, 60), impacto: limpa(bug.impacto, 60), resumo, cardId: cardIdDoBug(id),
  };
  const outros = (await db.ref('kanban/plantao').get()).val() || {};
  const dup = acharDuplicado({ id, arquivoAlvo: dados.arquivoAlvo, resumo, outros, agora });
  if (dup) {
    await ficha.set(Object.assign(dados, { estado: 'duplicado', duplicadoDe: dup.id }));
    return { estado: 'duplicado', duplicadoDe: dup.id, avisados: 0 };
  }
  await ficha.set(dados);
  const avisados = await avisarAdms(db, { id: `plantao_${id}`, title: '🐞 Bug novo no plantão', sub: `${dados.impacto} · ${limpa(bug.app, 40)} — ${resumo.slice(0, 160)}`, cardId: dados.cardId, agora });
  return { estado: 'aguardando', avisados };
}

const limiteHoras = (f) => (f.estado === 'aguardando' ? (/^🔴/.test(f.impacto || '') ? 2 : /^🟠/.test(f.impacto || '') ? 6 : 24) : 24);

// Bug parado → aviso (1 por bug por dia). Só 08–20h de Brasília.
async function rodarVigia({ db, agora = new Date(), log = console }) {
  if (!(await ativo(db))) return { pulou: 'desligado' };
  const h = horaBr(agora);
  if (h < 8 || h >= 20) return { pulou: 'fora_do_horario', hora: h };
  const fichas = (await db.ref('kanban/plantao').get()).val() || {};
  const hoje = dataBr(agora);
  const parados = [];
  for (const [id, f] of Object.entries(fichas)) {
    if (!f || !(f.estado === 'aguardando' || VIGIADOS_24H.includes(f.estado))) continue;
    const horas = (agora.getTime() - (Number(f.atualizadoEm) || Number(f.criadoEm) || agora.getTime())) / 3600000;
    if (horas >= limiteHoras(f)) parados.push({ id, f, horas: Math.floor(horas) });
  }
  let avisados = 0;
  for (const { id, f, horas } of parados) {
    const rotulo = f.estado === 'escalado' ? 'escalado ao Claude' : f.estado === 'aguardando' ? 'sem ninguém pegar' : `parado em "${f.estado}"`;
    avisados += await avisarAdms(db, { id: `plantao_vigia_${id}_${hoje}`, title: '⏰ Bug parado no plantão', sub: `${f.impacto || ''} — ${rotulo} há ${horas}h: ${String(f.resumo || '').slice(0, 140)}`, cardId: f.cardId, agora });
  }
  if (parados.length) log.log(`[plantaoVigia] ${parados.length} bug(s) parado(s); ${avisados} aviso(s) novo(s).`);
  return { parados: parados.length, avisados };
}

exports.plantaoBugNovo = onValueCreated(
  { ref: '/kanban/feedback/{id}', region: 'us-central1', memory: '256MiB' },
  async (event) => { await processarBugNovo({ db: getDatabase(), id: event.params.id, bug: event.data.val() }); }
);
exports.plantaoVigia = onSchedule(
  { schedule: 'every 3 hours', timeZone: 'America/Sao_Paulo', region: 'us-central1', memory: '256MiB', timeoutSeconds: 60 },
  async () => { await rodarVigia({ db: getDatabase() }); }
);
Object.assign(exports, { processarBugNovo, rodarVigia, acharDuplicado, similaridade, avisarAdms, cardIdDoBug, ABERTOS, FIM });
