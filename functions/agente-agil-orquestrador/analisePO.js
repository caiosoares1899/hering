// functions/agente-agil-orquestrador/analisePO.js
//
// "🤖 Análise do board (PO)" dentro de "Meu Dia" (kanban-dev.html/
// kanban.html) — pedido direto do usuário: "no meu dia, acho que podia ter
// um botao para o PO/Org/ADM receber uma analise do board pelo Agente
// Ágil, como um PO! Trazer analise rapida de como ta o board, cards
// impedidos, cards atrasados, cards incompletos... e ai eu quero pedir
// para quando isso acontecer, se ele notar algum padrão nos cards,
// solicitar/sugerir que o PO crie campanhas/coleções! ai ele tem q ja ter
// acesso a essas campanhas/coleções e ir comparando com o fluxo do board
// para n sugerir coisas q n façam sentido ou ja estão sendo executadas".
// Escopo confirmado com o usuário: só o squad atual (ACTIVE_SQUAD), não
// cross-squad como o resto de "Meu Dia" — mesmo escopo de "Dados do
// Board"/"Controle de Criativos" (analiseDados.js).
//
// Desenho:
// - Mesmo padrão base de resumoMeuDia.js/analiseDados.js: onRequest +
//   Bearer idToken, kill switch dinâmico, rate limit de 2min/pessoa,
//   `tools: []` (nenhuma escrita no board possível).
// - Botão visível só pra PO/Organizador/ADM NO CLIENT
//   (`AGENTE_AGIL_ANALISE_PO_SQUADS.has(ACTIVE_SQUAD) && _isPOorOrg()`) —
//   o backend aqui só checa domínio, igual resumoMeuDia/analiseDados, não
//   o papel da pessoa. Decisão deliberada, não descuido: os dados que
//   entram no payload (métricas do board, listas de cards atrasados/
//   bloqueados/incompletos, campanhas ativas) já são visíveis a QUALQUER
//   membro do squad através de outros painéis (Dados do Board, Controle
//   de Criativos, lista de Campanhas — que qualquer um pode ABRIR, só as
//   ações de editar/criar campanha são restritas por `_isPOorOrg()`) —
//   restringir o botão a PO/Org/ADM é curadoria de PARA QUEM a sugestão
//   de campanha é relevante, não controle de acesso a dado novo.
// - DIFERENTE de analiseDados.js: lê os cards/campanhas direto via Admin
//   SDK (não recebe um resumo pronto do cliente) — precisa de dado bruto
//   (títulos de card, tags, comparação com campanhas) que os painéis de
//   origem (Dados do Board/Criativos) não calculam prontos, mais parecido
//   com resumoMeuDia.js nesse aspecto.
// - Reaproveita `summarizeBoard()` de tools/visaoBoard.js pras métricas
//   fixas (WIP, throughput, cycle/lead time, gargalo por coluna,
//   contagem de bloqueios) — mesma fonte de verdade que o Agente Ágil já
//   usa na ferramenta `visao_board`, não reimplementa o cálculo.
// - **Padrão → sugestão de campanha, calculado em código, não pelo LLM**:
//   agrupa os cards ativos por tag, tira as tags que já pertencem a uma
//   campanha ATIVA ou EM PLANEJAMENTO (`kanban/campanhas`, global —
//   "já sendo executada" = esses 2 status; encerrada não conta, pode ter
//   sentido relançar), e só sobra pro LLM ver as tags sem cobertura, com
//   volume mínimo (`MIN_CLUSTER_TAG`) pra não sugerir campanha em cima de
//   ruído de 1-2 cards. O LLM decide SE vale a pena sugerir, nunca inventa
//   a lista de tags/campanhas sozinho.

const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const { cardsPath } = require('../agente-agil/board');
const flowLib = require('../agente-agil/flow');
const { escolheClienteParaTarefa } = require('./escolheClienteParaTarefa');
const { isEnabled } = require('./limits');
const { ANALISE_PO_SQUADS } = require('./squadScope');
const { summarizeBoard, DEFAULT_PERIODO_DIAS } = require('./tools/visaoBoard');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutos entre pedidos, por pessoa
const MAX_LISTA_CARDS = 8; // teto de cards citados em cada lista (atrasados/bloqueados/incompletos)
const MIN_CLUSTER_TAG = 3; // não sugere campanha em cima de 1-2 cards

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function diasDeAtraso(due, hoje) {
  const a = new Date(due + 'T00:00:00');
  const b = new Date(hoje + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Mesma lógica de getCardTags() no client (kanban-dev.html) — array
// `tags` novo, fallback pro campo `tag` singular legado.
function getCardTags(card) {
  if (Array.isArray(card.tags)) return card.tags.filter(Boolean);
  if (card.tag) return [card.tag];
  return [];
}

// Campanhas/coleções relevantes pro squad, só as "em execução ou
// planejadas" — mesmo critério de status usado em toda a Ficha de
// Campanhas (ativa/planejamento/encerrada). `squads` vazio = campanha
// global/visível em qualquer squad (mesmo critério de renderCampList()
// no client).
function campanhasRelevantes(campanhasRaw, squadId) {
  return Object.values(campanhasRaw || {}).filter((c) => {
    if (!c || (c.status !== 'ativa' && c.status !== 'planejamento')) return false;
    const squads = c.squads || [];
    return squads.length === 0 || squads.includes(squadId);
  });
}

function tagsDaCampanha(c) {
  if (c.tags && c.tags.length) return c.tags;
  if (c.tag) return [c.tag];
  return [];
}

// Lógica pura — recebe tudo já lido (cards/flowMeta/agilCfg/blockerMode/
// tags/campanhas), sem I/O. Testável com dados fabricados à mão.
// `flowMeta` é `{columns, flowConfig}` (mesmo shape de flowLib.readFlowMeta()).
function buildBoardPOPayload({ squadId, cards, flowMeta, agilCfg, blockerMode, tagsDef, campanhasRaw }) {
  const hoje = todaySP();
  const ativos = (cards || []).filter((c) => c && !c.archived);
  // Só cards NÃO concluídos entram nas listas/contagem de tags abaixo —
  // um card já em coluna de fim não é "atrasado"/"bloqueado"/"incompleto"
  // de forma acionável, e não deveria puxar uma sugestão de campanha
  // (mesmo critério de "ativo" que resumoMeuDia.js usa pro board pessoal).
  const ativosNaoDone = ativos.filter((c) => !flowLib.isDoneColumn(c.col, flowMeta));

  const board = summarizeBoard(cards, { columns: flowMeta.columns, agilCfg, blockerMode, periodoDias: DEFAULT_PERIODO_DIAS });

  const tagsMap = {};
  (tagsDef || []).forEach((t) => { if (t && t.id) tagsMap[t.id] = t.label || t.id; });

  const campanhas = campanhasRelevantes(campanhasRaw, squadId);
  const tagsCobertas = new Set(campanhas.flatMap(tagsDaCampanha));

  const freq = {};
  ativosNaoDone.forEach((c) => {
    getCardTags(c).forEach((tid) => { freq[tid] = (freq[tid] || 0) + 1; });
  });
  const tagsSemCampanha = Object.entries(freq)
    .filter(([tid, n]) => !tagsCobertas.has(tid) && n >= MIN_CLUSTER_TAG)
    .map(([tid, n]) => ({ tag: tagsMap[tid] || tid, qtd: n }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);

  const isBlocked = (c) => (blockerMode === 'col' ? c.col === 'blocker' : !!c.blocker);
  const bloqueados = ativosNaoDone.filter(isBlocked).slice(0, MAX_LISTA_CARDS).map((c) => ({
    titulo: c.title || '(sem título)',
    motivo: c.blockerReason || null,
  }));

  const atrasados = ativosNaoDone
    .filter((c) => c.col !== 'blocker' && !!c.due && c.due < hoje)
    .map((c) => ({ titulo: c.title || '(sem título)', diasAtraso: diasDeAtraso(c.due, hoje) }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, MAX_LISTA_CARDS);

  const incompletos = ativosNaoDone
    .filter((c) => !c.desc || !String(c.desc).trim() || !(Array.isArray(c.checklist) && c.checklist.length))
    .map((c) => ({
      titulo: c.title || '(sem título)',
      semDescricao: !c.desc || !String(c.desc).trim(),
      checklistVazio: !(Array.isArray(c.checklist) && c.checklist.length),
    }))
    .slice(0, MAX_LISTA_CARDS);

  return {
    squad: squadId,
    board,
    atrasados,
    bloqueados,
    incompletos,
    campanhasAtivas: campanhas.map((c) => ({
      nome: c.nome || '(sem nome)',
      tipo: c.tipo === 'colecao' ? 'coleção' : 'campanha',
      status: c.status,
      tags: tagsDaCampanha(c).map((tid) => tagsMap[tid] || tid),
    })),
    tagsSemCampanha,
  };
}

// Lê tudo do Firebase (Admin SDK) e monta o payload — I/O + delega o
// cálculo pra buildBoardPOPayload() (pura, testável sem fakeDb).
async function collectBoardPOData(db, squadId) {
  const [cardsSnap, meta, agilCfgSnap, blockerModeSnap, tagsSnap, campanhasSnap] = await Promise.all([
    db.ref(cardsPath(squadId)).get(),
    flowLib.readFlowMeta(db, squadId),
    db.ref(`kanban/squads/${squadId}/dados/agil_cfg`).get(),
    db.ref(`kanban/squads/${squadId}/dados/config/blockerMode`).get(),
    db.ref(`kanban/squads/${squadId}/dados/tags`).get(),
    db.ref('kanban/campanhas').get(),
  ]);
  const cardsVal = cardsSnap.val();
  const cards = Array.isArray(cardsVal) ? cardsVal.filter(Boolean) : Object.values(cardsVal || {});

  return buildBoardPOPayload({
    squadId,
    cards,
    flowMeta: meta,
    agilCfg: agilCfgSnap.val() || {},
    blockerMode: blockerModeSnap.val() || 'col',
    tagsDef: tagsSnap.val() || [],
    campanhasRaw: campanhasSnap.val() || {},
  });
}

const SYSTEM_PROMPT = `Você é o Agente Ágil, atuando como um PO experiente que dá uma leitura rápida do board pra quem gerencia o squad (PO, organizador ou admin) dentro do Maré Digital (board de squads da Hering).

Você recebe métricas objetivas do board atual: WIP por coluna vs. limite, throughput/cycle time/lead time do período, gargalo por coluna, contagem de bloqueios, e listas de até 8 cards atrasados/bloqueados/incompletos (com um resumo curto de cada). Você também recebe um retrato de Campanhas & Coleções: as campanhas JÁ ATIVAS ou EM PLANEJAMENTO (nome, tipo, tags) e as tags mais frequentes entre os cards ativos do board que AINDA NÃO pertencem a nenhuma campanha ativa/em planejamento (mínimo 3 cards pra aparecer nessa lista).

Sua tarefa, em português:
1. Escreva uma leitura rápida e direta do board — o que está saudável, o que merece atenção primeiro (WIP estourado, gargalo, atrasados, bloqueados, cards incompletos).
2. SÓ SE fizer sentido pelos dados (não force isso se a lista de tags sem campanha vier vazia ou fraca) — aponte se algum agrupamento de tags sem campanha parece grande/relevante o bastante pra virar uma campanha ou coleção nova, e sugira isso ao PO. NUNCA sugira algo que já apareça na lista de campanhas ativas/em planejamento — isso já está sendo executado.

Regras:
- Nunca invente dado que não veio no payload (motivo de atraso além do fornecido, conteúdo de card, campanha que não foi listada).
- Você não tem nenhuma ferramenta de ação aqui — a sugestão de campanha é pro PO avaliar e decidir, nunca diga que você vai criar ou fazer algo.
- Texto corrido ou tópicos curtos, sem markdown pesado (vai aparecer numa caixinha de painel, não num documento). Máximo ~220 palavras (um pouco mais que outras análises do Agente Ágil, por cobrir saúde do board + possível sugestão de campanha).
- Se o board estiver saudável e não houver padrão de campanha, pode ser breve — não precisa forçar 220 palavras onde não tem o que analisar.`;

function buildUserMessage(payload) {
  return `Estado atual do board (squad ${payload.squad}):\n${JSON.stringify(payload)}\n\nEscreva a leitura do board e, se fizer sentido, a sugestão de campanha/coleção.`;
}

// Lógica pura — `llmClient` injetado. `agenteAgilAnalisePO` (o export da
// Cloud Function) é só o encanamento: auth, rate limit, kill switch,
// resolve client real, chama isto.
async function gerarAnalisePO({ db, squadId, llmClient }) {
  const payload = await collectBoardPOData(db, squadId);
  const result = await llmClient.decide({
    system: SYSTEM_PROMPT,
    history: [{ role: 'user', text: buildUserMessage(payload) }],
    tools: [],
  });
  const analise = (result.text || '').trim() || 'Não consegui gerar uma análise dessa vez — tenta de novo em instantes.';
  return { ok: true, analise };
}

// ── Cloud Function (onRequest) ──────────────────────────────────────────
async function handleAnalisePO(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed.');
    return;
  }

  const authHeader = req.get('Authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    res.status(401).json({ ok: false, error: 'missing_token' });
    return;
  }

  let uid, email;
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    uid = decoded.uid;
    email = decoded.email || '';
  } catch (e) {
    res.status(401).json({ ok: false, error: 'invalid_token' });
    return;
  }
  if (!email.toLowerCase().endsWith('@ciahering.com.br')) {
    res.status(403).json({ ok: false, error: 'domain_not_allowed' });
    return;
  }

  const { squadId } = req.body || {};
  if (typeof squadId !== 'string' || !ANALISE_PO_SQUADS.includes(squadId)) {
    res.status(400).json({ ok: false, error: 'squad_nao_habilitado' });
    return;
  }

  const db = getDatabase();

  if (!(await isEnabled(db))) {
    res.status(200).json({ ok: false, error: 'agente_desligado' });
    return;
  }

  const rateLimitRef = db.ref('kanban/usuarios/' + uid + '/agente_analise_po_last');
  const lastSnap = await rateLimitRef.get();
  const last = lastSnap.val();
  const now = Date.now();
  if (typeof last === 'number' && now - last < RATE_LIMIT_MS) {
    res.status(200).json({ ok: false, error: 'rate_limited', retryAfterMs: RATE_LIMIT_MS - (now - last) });
    return;
  }
  // Grava ANTES de chamar o LLM — mesmo motivo de resumoMeuDia.js/
  // analiseDados.js: barrar uma 2ª requisição em voo.
  await rateLimitRef.set(now);

  try {
    const { llmClient } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: '', db });
    const resultado = await gerarAnalisePO({ db, squadId, llmClient });
    res.status(200).json(resultado);
  } catch (e) {
    console.error('[agenteAgilAnalisePO] erro:', e);
    res.status(200).json({ ok: false, error: 'llm_error' });
  }
}

const agenteAgilAnalisePO = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [ANTHROPIC_API_KEY] },
  handleAnalisePO
);

module.exports = {
  agenteAgilAnalisePO,
  gerarAnalisePO,
  collectBoardPOData,
  buildBoardPOPayload,
  campanhasRelevantes,
  buildUserMessage,
  todaySP,
  RATE_LIMIT_MS,
  MAX_LISTA_CARDS,
  MIN_CLUSTER_TAG,
};
