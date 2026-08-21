// functions/agente-agil-orquestrador/escolheClienteParaTarefa.js
//
// Único lugar que decide QUAL client de LLM uma tarefa do orquestrador
// recebe, ANTES de chamar runLoop() (ver loop.js) — não dentro dele.
// loop.js só conhece o contrato genérico decide({system, history, tools})
// e não deveria saber que tiers de modelo existem, mesmo espírito de
// isolamento já usado pra limits.js (kill switch/iterações) e
// systemPrompt.js (conteúdo de produto).
//
// Roteamento real (item 7 do roadmap, "Próximos passos" no README) —
// v1, combinado com o usuário em 2026-08-21: SEM heurística por LLM
// (perguntar pro Haiku "isso é simples ou complexo?" antes só somaria
// custo/latência/mais uma fonte de erro de julgamento sem dado real pra
// validar, mesma razão que manteve isto hardcoded até aqui). A decisão é:
//   1. Override manual do ADM (kanban/config/agente_agil_orquestrador/
//      model_tier_override) SEMPRE vence, se presente e válido — único
//      jeito de rodar em 'opus' hoje. Mesmo padrão fail-safe de
//      limits.isEnabled(): sem db, erro de leitura, nó ausente ou valor
//      fora de MODEL_BY_TIER -> ignora o override, cai na heurística.
//   2. Sem override: heurística de texto (classificaComplexidade) decide
//      entre 'haiku' e 'sonnet' — NUNCA escolhe 'opus' sozinha. 'opus'
//      fica só atrás do override manual até existir volume real pra
//      calibrar um critério automático (decisão explícita, não esquecida).
const { createAnthropicLlmClient, DEFAULT_MODEL } = require('./llmClient');

// Tier -> model id da Anthropic.
const MODEL_BY_TIER = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: DEFAULT_MODEL,
  opus: 'claude-opus-5',
};

const TIERS_VALIDOS = new Set(Object.keys(MODEL_BY_TIER));

// Mesmo padrão de normalização de detectaMencao.js (minúsculo + remove
// diacríticos) — reaproveitado aqui só pela consistência de convenção
// entre os dois módulos, não por dependência real entre eles.
function normalizaTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Marcadores de "pergunta puramente conceitual" — o mesmo tipo de tarefa
// já validada nos canários rodando só `biblioteca_agil` sozinha, sem
// tocar o board ("me explica o conceito de sprint", "como usar cards
// recorrentes", ver README). Deliberadamente estreito: qualquer coisa
// que pareça pedir uma AÇÃO no board (mover, editar, criar, excluir...)
// ou for longa/composta demais pra ser só uma pergunta simples cai no
// default seguro (sonnet) — errar pro lado do modelo mais caro é a
// direção segura aqui, o oposto de um kill switch.
const MARCADORES_PERGUNTA = [
  'o que e', 'o que sao', 'o que significa',
  'como funciona', 'como uso', 'como usar', 'como faco', 'como faço',
  'por que', 'porque', 'qual a diferenca', 'qual e a diferenca',
  'me explica', 'explica', 'pode explicar', 'quais sao',
].map(normalizaTexto);

// Teto de palavras pra ainda contar como "pergunta simples" — uma
// pergunta conceitual real cabe fácil aqui; acima disso é mais provável
// que tenha contexto/nuance que mereça o modelo padrão.
const MAX_PALAVRAS_HAIKU = 20;

// Pura, sem rede/Firebase — testável isolada. Recebe o texto literal da
// tarefa (ex.: comment.text de uma @menção, já incluindo a própria
// menção — removida aqui antes de classificar pra não distorcer a
// contagem de palavras nem colidir com os marcadores).
function classificaComplexidade(taskText) {
  const semMencao = String(taskText || '').replace(/@agente\s*[aá]gil/gi, '').trim();
  if (!semMencao) return 'sonnet';
  const normalizado = normalizaTexto(semMencao);
  const comecaComPergunta = MARCADORES_PERGUNTA.some((m) => normalizado.startsWith(m));
  const palavras = semMencao.split(/\s+/).filter(Boolean).length;
  return comecaComPergunta && palavras <= MAX_PALAVRAS_HAIKU ? 'haiku' : 'sonnet';
}

async function leTierForcado(db) {
  if (!db) return null;
  try {
    const snap = await db.ref('kanban/config/agente_agil_orquestrador/model_tier_override').get();
    const val = snap.val();
    return TIERS_VALIDOS.has(val) ? val : null;
  } catch (e) {
    return null;
  }
}

async function escolheClienteParaTarefa({ apiKey, taskText, db } = {}) {
  const forcado = await leTierForcado(db);
  const tier = forcado || classificaComplexidade(taskText);
  const model = MODEL_BY_TIER[tier];
  return {
    tier,
    model,
    llmClient: createAnthropicLlmClient({ apiKey, model }),
  };
}

module.exports = { escolheClienteParaTarefa, classificaComplexidade, MODEL_BY_TIER, TIERS_VALIDOS };
