// functions/agente-agil-orquestrador/analiseDados.js
//
// "🤖 Ponto de vista do Agente Ágil" dentro dos painéis "📊 Dados do Board"
// (aba Insights) e "🎨 Controle de Criativos" (kanban-dev.html/kanban.html)
// — pedido direto do usuário: "ali em dados do board, dentro de insights,
// traz um botao para o agente agil tb ler esses dados e trazer o ponto de
// vista dele! pode por dentro de controle de criativos tb". Mesmo desenho
// de resumoMeuDia.js (ver comentário no topo daquele arquivo), com as
// diferenças abaixo:
//
// - **Um endpoint só, dois contextos.** Em vez de duplicar o arquivo pros
//   dois painéis, `contexto` ('board_insights' | 'criativos') escolhe o
//   system prompt certo em CONTEXTOS — o resto do encanamento (auth, kill
//   switch, rate limit) é idêntico pros dois.
// - **O cliente já calculou os números — não lemos cards de novo aqui.**
//   Diferente de resumoMeuDia.js (que lê os cards direto do Admin SDK e
//   calcula os sinais aqui), os dois painéis de origem
//   (renderBoardDataInsights()/renderCriativosDashboard() em
//   kanban-dev.html) já computam tudo client-side pra exibir na tela —
//   reimplementar a mesma agregação aqui seria duplicar lógica que só
//   existe pra desenhar HTML. O cliente envia o resumo já pronto (`resumo`,
//   um objeto JSON simples de números/contagens) no corpo do POST; o
//   backend só valida formato/tamanho, nunca confia em texto livre do
//   cliente como se fosse fato (mesma regra de nunca inventar informação
//   que já vale pro LLM vale aqui pro dado de entrada: é só o que os
//   painéis já mostram na tela, nada novo).
// - **NÃO ESCREVE NADA NO BOARD** — mesma garantia de resumoMeuDia.js
//   (tools: [] no llmClient.decide()).
// - **Escopo de squad**: ANALISE_DADOS_SQUADS (squadScope.js) — squadId
//   vem no corpo do POST (o painel já sabe em qual squad está), validado
//   contra a lista antes de gastar qualquer chamada de LLM.
// - **Kill switch + rate limit por pessoa** (2 minutos) — mesmo padrão.

const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const { escolheClienteParaTarefa } = require('./escolheClienteParaTarefa');
const { isEnabled } = require('./limits');
const { ANALISE_DADOS_SQUADS } = require('./squadScope');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutos entre pedidos, por pessoa
const MAX_RESUMO_JSON_CHARS = 12000; // teto generoso pro payload de números agregados

const REGRAS_COMUNS = `
Regras:
- Nunca invente informação que não veio nos dados recebidos — só use os números fornecidos.
- Você não tem nenhuma ferramenta de ação aqui (não pode comentar, mover, editar nada) — sugira o que O TIME deveria fazer, nunca diga que você vai fazer algo.
- Texto corrido ou tópicos curtos, sem markdown pesado (vai aparecer numa caixinha de painel, não num documento). Máximo ~180 palavras.
- Se os números estiverem saudáveis, pode ser breve e positivo — não precisa forçar 180 palavras de análise onde não tem o que analisar.`;

const CONTEXTOS = {
  board_insights: {
    label: '📊 Dados do Board',
    prompt: `Você é o Agente Ágil, analisando o painel "Dados do Board" (aba Insights) de um squad do Maré Digital (board de squads da Hering) pra alguém do time.

Você recebe um resumo já agregado do board: total de cards ativos, distribuição por prioridade, carga de trabalho por responsável, cards com risco registrado, cards marcados como OKR por coluna, e cards parados há mais tempo sem atividade.

Sua tarefa: escrever um ponto de vista curto e direto, em português, destacando o que mais merece atenção — concentração de prioridade crítica, sobrecarga de alguém específico, riscos acumulados, cards esquecidos há muito tempo. Priorize o que é mais urgente ou mais fora do padrão esperado.${REGRAS_COMUNS}`,
  },
  criativos: {
    label: '🎨 Controle de Criativos',
    prompt: `Você é o Agente Ágil, analisando o painel "Controle de Criativos" de um squad do Maré Digital (board de squads da Hering) pra alguém do time.

Você recebe um resumo já agregado das peças criativas em andamento: total, quantos concluídos, quantos atrasados, quantos em andamento, percentual de conclusão, composição por variações, distribuição por prioridade, e o top de canais/plataformas/formatos/listas mais usados.

Sua tarefa: escrever um ponto de vista curto e direto, em português, destacando o que mais merece atenção — volume de atrasados, concentração excessiva num canal/formato só, prioridade mal distribuída, ritmo de conclusão. Priorize o que é mais urgente ou mais fora do padrão esperado.${REGRAS_COMUNS}`,
  },
};

function buildUserMessage(contexto, resumo) {
  return `Resumo agregado atual (${CONTEXTOS[contexto].label}):\n${JSON.stringify(resumo)}\n\nEscreva o ponto de vista priorizado.`;
}

// Lógica pura — `llmClient` injetado (nunca resolve escolheClienteParaTarefa/
// secret aqui), testável com cliente scriptado. `agenteAgilAnaliseDados` (o
// export da Cloud Function) é só o encanamento: auth, rate limit, kill
// switch, validação de entrada, resolve client real, chama isto.
async function gerarAnaliseDados({ contexto, resumo, llmClient }) {
  const result = await llmClient.decide({
    system: CONTEXTOS[contexto].prompt,
    history: [{ role: 'user', text: buildUserMessage(contexto, resumo) }],
    tools: [],
  });
  const analise = (result.text || '').trim() || 'Não consegui gerar uma análise dessa vez — tenta de novo em instantes.';
  return { ok: true, analise };
}

// ── Cloud Function (onRequest) ──────────────────────────────────────────
async function handleAnaliseDados(req, res) {
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

  const { contexto, squadId, resumo } = req.body || {};
  if (typeof contexto !== 'string' || !CONTEXTOS[contexto]) {
    res.status(400).json({ ok: false, error: 'contexto_invalido' });
    return;
  }
  if (typeof squadId !== 'string' || !ANALISE_DADOS_SQUADS.includes(squadId)) {
    res.status(400).json({ ok: false, error: 'squad_nao_habilitado' });
    return;
  }
  if (!resumo || typeof resumo !== 'object' || Array.isArray(resumo)) {
    res.status(400).json({ ok: false, error: 'resumo_invalido' });
    return;
  }
  if (JSON.stringify(resumo).length > MAX_RESUMO_JSON_CHARS) {
    res.status(400).json({ ok: false, error: 'resumo_muito_grande' });
    return;
  }

  const db = getDatabase();

  if (!(await isEnabled(db))) {
    res.status(200).json({ ok: false, error: 'agente_desligado' });
    return;
  }

  const rateLimitRef = db.ref('kanban/usuarios/' + uid + '/agente_analise_dados_last');
  const lastSnap = await rateLimitRef.get();
  const last = lastSnap.val();
  const now = Date.now();
  if (typeof last === 'number' && now - last < RATE_LIMIT_MS) {
    res.status(200).json({ ok: false, error: 'rate_limited', retryAfterMs: RATE_LIMIT_MS - (now - last) });
    return;
  }
  // Grava ANTES de chamar o LLM — mesmo motivo de resumoMeuDia.js: barrar
  // uma 2ª requisição que chegue enquanto a 1ª ainda está em voo.
  await rateLimitRef.set(now);

  try {
    const { llmClient } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: '', db });
    const resultado = await gerarAnaliseDados({ contexto, resumo, llmClient });
    res.status(200).json(resultado);
  } catch (e) {
    console.error('[agenteAgilAnaliseDados] erro:', e);
    res.status(200).json({ ok: false, error: 'llm_error' });
  }
}

const agenteAgilAnaliseDados = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [ANTHROPIC_API_KEY] },
  handleAnaliseDados
);

module.exports = {
  agenteAgilAnaliseDados,
  gerarAnaliseDados,
  buildUserMessage,
  CONTEXTOS,
  RATE_LIMIT_MS,
  MAX_RESUMO_JSON_CHARS,
};
