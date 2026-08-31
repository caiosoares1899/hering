// functions/agente-agil-orquestrador/resumoMeuDia.js
//
// "🤖 Resumo do Agente Ágil" dentro de "Meu Dia" (kanban-dev.html/
// kanban.html) — pedido direto do usuário: "acho que o 'Meu Dia' é uma
// oportunidade legal pro Agente Ágil... ele fazer um grande levantamento e
// resumo do board pro usuário! cards incompletos, faltando coisa, atrasado,
// bloqueado". Desenho combinado antes do código (mesmo processo do resto
// deste roadmap):
//
// - **Sob demanda, pessoal** — não é um scan agendado tipo dueOverdueTrigger.
//   Só roda quando a pessoa clica no botão. É o modelo mais barato possível
//   (zero custo se ninguém clicar) e evita todo o cuidado que um gatilho
//   automático amplo exigiria (auto-disparo, escopo, etc.).
// - **NÃO ESCREVE NADA NO BOARD.** Não posta comentário em nenhum card (não
//   teria um card natural — é cross-card, cross-squad), não move coluna, não
//   edita campo nenhum. Só lê e devolve texto direto pra quem chamou. Isso
//   elimina de vez a categoria inteira de risco que todo o resto deste
//   roadmap teve que gerenciar com tanto cuidado (loop de auto-disparo,
//   escrita indevida, etc.) — aqui não tem NENHUMA ferramenta de escrita
//   disponível pro modelo (tools: [] no llmClient.decide()).
// - **Escopo de squad**: só cards dos squads onde o Agente Ágil já atua —
//   mesma lista que `AGENTE_AGIL_MENTION_SQUADS` no client
//   (kanban-dev.html) hoje: `dev` e `dados`. Vem de squadScope.js
//   (revisão arquitetural 2026-08-31) — compartilhado com
//   dueOverdueTrigger.js, que tinha a MESMA lista hardcodada
//   independentemente aqui antes. Ainda não dá pra compartilhar com o
//   client (ES modules) — mesmo trade-off já aceito em flow.js/board.js
//   (replicar lá é mais barato que criar um shim entre runtimes
//   diferentes) — mas entre arquivos desta mesma pasta (CommonJS, mesmo
//   runtime) não havia motivo pra continuar duplicado.
// - **Chamada via onRequest + Bearer idToken**, não onCall/httpsCallable —
//   mesmo motivo de spotify/disconnect.js: nenhuma página do app importa o
//   SDK de Functions hoje, e onRequest com verificação manual do token já é
//   o padrão estabelecido do projeto pra isso.
// - **Kill switch dinâmico** (limits.isEnabled) respeitado igual ao resto do
//   orquestrador — falha fail-safe (desligado por padrão).
// - **Rate limit por pessoa** (2 minutos): não é proteção de segurança, é
//   só pra evitar clique duplo/repetido gerando custo de LLM à toa. Grava o
//   timestamp ANTES de chamar o LLM (não depois), pra uma 2ª requisição que
//   chegue enquanto a 1ª ainda está em voo também seja barrada.
// - **Filtra ANTES do LLM ver os cards**: os sinais (atrasado, bloqueado, sem
//   descrição, checklist vazio/pendente) são calculados aqui, em código
//   determinístico — o LLM só INTERPRETA e PRIORIZA esses sinais já prontos,
//   não decide sozinho "isso conta como atrasado?". Mesmo espírito de
//   visao_board (métricas fixas, não interpretação livre sobre dado bruto).
// - **Sem cards pendentes → não chama o LLM** — devolve uma mensagem fixa
//   ("tudo em dia"), custo zero. Só vale a pena gastar tokens quando há
//   alguma coisa real pra analisar.

const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const { cardsPath } = require('../agente-agil/board');
const flowLib = require('../agente-agil/flow');
const { escolheClienteParaTarefa } = require('./escolheClienteParaTarefa');
const { isEnabled } = require('./limits');
const { RESUMO_MEUDIA_SQUADS } = require('./squadScope');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Mesma lista que AGENTE_AGIL_MENTION_SQUADS no client — ver squadScope.js
// e comentário no topo do arquivo.
const SQUADS_ATIVOS = RESUMO_MEUDIA_SQUADS;

const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutos entre pedidos, por pessoa

// Data no calendário de São Paulo — mesma função (mesmo motivo) de
// dueOverdueTrigger.js: independente do timezone do processo do Cloud
// Function, mesmo formato (YYYY-MM-DD) que card.due já usa.
function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function diasDeAtraso(due, hoje) {
  const a = new Date(due + 'T00:00:00');
  const b = new Date(hoje + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Sinais objetivos de UM card, calculados em código (não pelo LLM) — ver
// comentário no topo do arquivo. `owner`/`participants` já vieram
// pré-filtrados por quem chama (collectPendingCards), então não precisa
// checar aqui de novo.
function sinaisDoCard(card, { hoje }) {
  const semDescricao = !card.desc || !String(card.desc).trim();
  const checklist = Array.isArray(card.checklist) ? card.checklist : [];
  const checklistVazio = checklist.length === 0;
  const checklistPendente = checklist.filter((it) => it && it.done !== true).length;
  const bloqueado = card.blocker === true || card.col === 'blocker';
  const atrasado = !!card.due && card.due < hoje;
  const venceHoje = !!card.due && card.due === hoje;
  const semPrazo = !card.due;
  return {
    titulo: card.title || '(sem título)',
    prazo: card.due || null,
    atrasado,
    diasAtraso: atrasado ? diasDeAtraso(card.due, hoje) : null,
    venceHoje,
    semPrazo,
    bloqueado,
    semDescricao,
    checklistVazio,
    checklistPendente,
  };
}

// Cards ATIVOS (não arquivados, não concluídos) de `uid` como responsável
// OU participante, nos squads em SQUADS_ATIVOS onde a pessoa é membro —
// mesmo conjunto de dados que _meuDiaAllCards() no client, mas lido direto
// via Admin SDK (sem passar pelas regras do RTDB) e já filtrado pra só os
// squads onde o Agente Ágil atua.
async function collectPendingCards(db, uid) {
  const userSnap = await db.ref('kanban/usuarios_publicos/' + uid).get();
  const user = userSnap.val();
  if (!user) return { init: null, squads: [], cards: [] };

  const init = (user.init && String(user.init).trim()) || null;
  const squadsDoUsuario = user.squads ? Object.keys(user.squads).filter((sq) => user.squads[sq] === true) : [];
  const squadsRelevantes = squadsDoUsuario.filter((sq) => SQUADS_ATIVOS.includes(sq));
  if (!init || !squadsRelevantes.length) return { init, squads: squadsRelevantes, cards: [] };

  const hoje = todaySP();
  const porSquad = await Promise.all(
    squadsRelevantes.map(async (squadId) => {
      const [cardsSnap, flowMeta] = await Promise.all([
        db.ref(cardsPath(squadId)).get(),
        flowLib.readFlowMeta(db, squadId),
      ]);
      const cardsVal = cardsSnap.val();
      const todosOsCards = Array.isArray(cardsVal) ? cardsVal.filter(Boolean) : Object.values(cardsVal || {});
      return todosOsCards
        .filter((c) => !c.archived)
        .filter((c) => !flowLib.isDoneColumn(c.col, flowMeta))
        .filter((c) => c.owner === init || (Array.isArray(c.participants) && c.participants.includes(init)))
        .map((c) => ({ squadId, ...sinaisDoCard(c, { hoje }) }));
    })
  );

  return { init, squads: squadsRelevantes, cards: porSquad.flat() };
}

const SYSTEM_PROMPT = `Você é o Agente Ágil, ajudando uma pessoa a organizar o começo do dia dentro do Maré Digital (o board de squads da Hering).

Você recebe uma lista de cards ATIVOS (não concluídos, não arquivados) dessa pessoa — como responsável ou participante — nos squads onde você atua. Cada card já vem com sinais objetivos calculados: prazo, se está atrasado (e há quantos dias), se vence hoje, se está bloqueado, se tem descrição, se o checklist está vazio e quantos itens ainda faltam marcar.

Sua tarefa: analisar esses sinais e escrever um resumo curto, direto, em português, priorizando o que merece atenção primeiro e por quê. Trate bloqueado e atrasado como mais urgente que "sem prazo".

Regras:
- Nunca invente informação que não veio nos dados (motivo de atraso, conteúdo de checklist, o que falta na descrição etc.) — só use os sinais fornecidos.
- Você não tem nenhuma ferramenta de ação aqui (não pode comentar, mover, editar nada) — sugira o que A PESSOA deveria fazer, nunca diga que você vai fazer algo.
- Texto corrido ou tópicos curtos, sem markdown pesado (vai aparecer numa caixinha de painel, não num documento). Máximo ~180 palavras.
- Se muitos cards estiverem em dia, pode ser breve e positivo — não precisa forçar 180 palavras de análise onde não tem o que analisar.`;

function buildUserMessage(cards) {
  const linhas = cards.map((c, i) => `${i + 1}. [${c.squadId}] "${c.titulo}" — ${JSON.stringify({
    prazo: c.prazo,
    atrasado: c.atrasado,
    diasAtraso: c.diasAtraso,
    venceHoje: c.venceHoje,
    semPrazo: c.semPrazo,
    bloqueado: c.bloqueado,
    semDescricao: c.semDescricao,
    checklistVazio: c.checklistVazio,
    checklistPendente: c.checklistPendente,
  })}`);
  return `Cards ativos da pessoa (${cards.length} no total):\n${linhas.join('\n')}\n\nEscreva o resumo priorizado.`;
}

const MENSAGEM_SEM_CARDS = '🎉 Nada pendente nos squads onde eu atuo — seus cards ativos estão todos em dia (sem atraso, sem bloqueio, com prazo definido). Bom trabalho!';

// Lógica pura — `llmClient` injetado (nunca resolve escolheClienteParaTarefa/
// secret aqui), testável com fake db e cliente scriptado. `agenteAgilResumoMeuDia`
// (o export da Cloud Function) é só o encanamento: auth, rate limit, kill
// switch, resolve client real, chama isto.
async function gerarResumoMeuDia({ db, uid, llmClient }) {
  const { cards } = await collectPendingCards(db, uid);
  if (!cards.length) {
    return { ok: true, resumo: MENSAGEM_SEM_CARDS, totalCards: 0 };
  }
  const result = await llmClient.decide({
    system: SYSTEM_PROMPT,
    history: [{ role: 'user', text: buildUserMessage(cards) }],
    tools: [],
  });
  const resumo = (result.text || '').trim() || 'Não consegui gerar um resumo dessa vez — tenta de novo em instantes.';
  return { ok: true, resumo, totalCards: cards.length };
}

// ── Cloud Function (onRequest) ──────────────────────────────────────────
async function handleResumoMeuDia(req, res) {
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

  const db = getDatabase();

  if (!(await isEnabled(db))) {
    res.status(200).json({ ok: false, error: 'agente_desligado' });
    return;
  }

  const rateLimitRef = db.ref('kanban/usuarios/' + uid + '/agente_resumo_meudia_last');
  const lastSnap = await rateLimitRef.get();
  const last = lastSnap.val();
  const now = Date.now();
  if (typeof last === 'number' && now - last < RATE_LIMIT_MS) {
    res.status(200).json({ ok: false, error: 'rate_limited', retryAfterMs: RATE_LIMIT_MS - (now - last) });
    return;
  }
  // Grava ANTES de chamar o LLM — ver comentário no topo do arquivo sobre
  // barrar uma 2ª requisição que chegue enquanto a 1ª ainda está em voo.
  await rateLimitRef.set(now);

  try {
    const { llmClient } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: '', db });
    const resultado = await gerarResumoMeuDia({ db, uid, llmClient });
    res.status(200).json(resultado);
  } catch (e) {
    console.error('[agenteAgilResumoMeuDia] erro:', e);
    res.status(200).json({ ok: false, error: 'llm_error' });
  }
}

const agenteAgilResumoMeuDia = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [ANTHROPIC_API_KEY] },
  handleResumoMeuDia
);

module.exports = {
  agenteAgilResumoMeuDia,
  gerarResumoMeuDia,
  collectPendingCards,
  sinaisDoCard,
  buildUserMessage,
  todaySP,
  SQUADS_ATIVOS,
  RATE_LIMIT_MS,
  MENSAGEM_SEM_CARDS,
};
