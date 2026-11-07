// functions/agente-agil-orquestrador/painel/chat.js
//
// 🤖 Agente Ágil no Painel — gatilho do chat (docs/AGENTE_AGIL_PAINEL.md §5). A pessoa grava a pergunta em kanban/agente_painel[_dev]/{uid}/{msgId} (regra do banco: só o
// dono lê/cria, role 'user'); esta função responde NO MESMO nó (role 'agente') pelo Admin SDK. Fase 1: SÓ LEITURA (nenhuma ferramenta de escrita).
//
// O que este arquivo garante (cada item tem teste em __tests__/painelChat.test.js):
//   1. anti-auto-disparo: só processa role 'user' (a resposta do agente também dispara o gatilho e é ignorada);
//   2. fronteira reconferida AQUI (a função ignora as regras do banco): a identidade é o `uid` do CAMINHO (nunca do corpo), a pessoa precisa existir em
//      kanban/usuarios com e-mail da empresa, e o interruptor `painel_acesso` (adm | gestores | todos; padrão 'adm' = canário) decide quem usa;
//   3. kill switch geral (orquestrador) + interruptor do Painel `painel_enabled` (nasce DESLIGADO) — ligados por `=== true` literal, como o resto;
//   4. cota por pessoa/dia e UMA execução por mensagem: ambas por .transaction() (check-then-act com get()+set() é corrida e gasta LLM em dobro);
//   5. a dica de contexto da tela (aba/filtro/período) é validada contra lista fechada e entra no prompt como DICA, nunca como fato;
//   6. a resposta passa pela trava de números (conferirNumeros.js) e os atalhos são validados (aba da lista fechada, filtro com formato fixo).
const { runLoop } = require('../loop');
const { isEnabled } = require('../limits');
const { emailDaEmpresa } = require('../../common/mareModo');
const { conferir } = require('./conferirNumeros');
const { SYSTEM_PROMPT_PAINEL_V1 } = require('./prompt');

const ABAS = Object.freeze(['visao', 'fluxo', 'timeline', 'pessoas', 'notifs', 'monitor', 'status', 'dados', 'agentes']);
const PERIODOS = Object.freeze([7, 14, 15, 30, 60, 90]);
const FILTRO_RE = /^[a-zA-Z0-9_-]{1,60}$/;
const CFG = 'kanban/config/agente_agil_orquestrador';
const LIMITE_DIA_PADRAO = 30;
const MAX_TEXTO = 2500;

const caminhos = (env) => {
  const sfx = env === 'dev' ? '_dev' : '';
  return { chat: `kanban/agente_painel${sfx}`, processed: `kanban/agente_painel_processed${sfx}`, uso: `kanban/agente_painel_uso${sfx}` };
};

const hojeBR = (agora) => new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);   // dia em Brasília (UTC−3), sem horário de verão

// Valida a dica de contexto; qualquer campo fora da lista fechada some (nunca vira texto livre no prompt).
function contextoValido(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  const aba = ABAS.includes(ctx.aba) ? ctx.aba : null;
  if (!aba) return null;
  const filtro = typeof ctx.filtro === 'string' && FILTRO_RE.test(ctx.filtro) ? ctx.filtro : null;
  const periodo = PERIODOS.includes(ctx.periodo) ? ctx.periodo : null;
  return { aba, filtro, periodo };
}
const linhaDeContexto = (c) => (c
  ? `[dica de contexto da tela — não é fato nem pedido] a pessoa está na aba "${c.aba}"${c.filtro ? `, filtro "${c.filtro}"` : ''}${c.periodo ? `, período de ${c.periodo} dias` : ''}.`
  : '[dica de contexto da tela: não informada]');

async function lerConfig(db) {
  const v = (await db.ref(CFG).get()).val() || {};
  return {
    geral: await isEnabled(db),
    painel: v.painel_enabled === true,
    acesso: ['adm', 'gestores', 'todos'].includes(v.painel_acesso) ? v.painel_acesso : 'adm',
    limiteDia: Number.isInteger(v.painel_limite_dia) && v.painel_limite_dia > 0 && v.painel_limite_dia <= 500 ? v.painel_limite_dia : LIMITE_DIA_PADRAO,
  };
}

async function resolverPessoa(db, uid) {
  const u = (await db.ref(`kanban/usuarios/${uid}`).get()).val();
  if (!u || typeof u !== 'object' || !emailDaEmpresa(u.email)) return null;
  const papeis = Object.values(u.squads_roles || {});
  const adm = u.role === 'adm' || String(u.email).toLowerCase() === 'caio.soares@ciahering.com.br';
  const po = u.role === 'po' || u.role === 'organizador' || papeis.includes('po') || papeis.includes('organizador');
  return { uid, nome: String(u.nome || '').slice(0, 60), papel: adm ? 'adm' : po ? 'po' : 'membro' };
}
const acessoLibera = (acesso, papel) => acesso === 'todos' || (acesso === 'gestores' && papel !== 'membro') || (acesso === 'adm' && papel === 'adm');

// Uma execução por mensagem: claim atômico ANTES de gastar LLM.
async function reivindicar(db, env, uid, msgId, agora) {
  const r = await db.ref(`${caminhos(env).processed}/${uid}/${msgId}`).transaction((cur) => (cur == null ? { em: agora.toISOString(), status: 'rodando' } : undefined));
  return r.committed === true;
}
// Cota diária: incrementa só se ainda couber.
async function consumirCota(db, env, uid, limite, agora) {
  const r = await db.ref(`${caminhos(env).uso}/${uid}/${hojeBR(agora)}`).transaction((n) => ((n || 0) < limite ? (n || 0) + 1 : undefined));
  return r.committed === true;
}

async function gravarResposta(db, env, uid, msgId, corpo, agora) {
  const msg = Object.assign({ role: 'agente', ts: agora.toISOString(), em: msgId }, corpo);
  await db.ref(`${caminhos(env).chat}/${uid}/${msgId}_r`).set(msg);
  return msg;
}

function ferramentaResponder(coletor) {
  return {
    name: 'responder',
    description: 'Entrega a resposta final à pessoa. Sempre chame para fechar. texto: 3 a 6 linhas (tabela pequena só para comparar). atalhos: até 3 botões que levam a uma aba do Painel (aba + filtro). fonte: de onde veio (aba/ferramenta, escopo, período).',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Resposta em português, curta.' },
        atalhos: { type: 'array', maxItems: 3, items: { type: 'object', properties: { rotulo: { type: 'string' }, aba: { type: 'string', enum: [...ABAS] }, filtro: { type: 'string' } }, required: ['rotulo', 'aba'] } },
        fonte: { type: 'string' },
      },
      required: ['texto'],
    },
    handler: async (input) => { coletor.push(input || {}); return { ok: true }; },
  };
}
const atalhosValidos = (lista) => (Array.isArray(lista) ? lista : []).slice(0, 3)
  .map((a) => ({ rotulo: String((a && a.rotulo) || '').slice(0, 40), aba: a && a.aba, filtro: a && typeof a.filtro === 'string' && FILTRO_RE.test(a.filtro) ? a.filtro : null }))
  .filter((a) => a.rotulo && ABAS.includes(a.aba));

// O loop não captura exceção de ferramenta (um erro derrubaria a conversa inteira). Um argumento errado do modelo (ex.: esqueceu `dias`, passou o NOME do squad em vez do id) vira
// resultado {ok:false} para ELE se corrigir na iteração seguinte — e a mensagem vai só para o modelo, nunca para a pessoa.
const envolverErros = (tool) => Object.assign({}, tool, {
  handler: async (input) => {
    try { return await tool.handler(input); }
    catch (err) { return { ok: false, erro: 'falha_na_ferramenta', detalhe: String((err && err.message) || err).replace(/\s+/g, ' ').slice(0, 300) }; }
  },
});

const AVISOS = {
  pausado: 'O Agente Ágil do Painel está pausado pelo ADM no momento.',
  semAcesso: 'O Agente Ágil do Painel ainda está em teste com um grupo pequeno. Quando abrir para você, esta gaveta passa a responder.',
  cota: 'Você chegou ao limite de perguntas de hoje. Amanhã volta ao normal.',
  falha: 'Não consegui responder agora. Tente de novo em instantes.',
};

// builderDeFerramentas({db, env, papel}) → array de tools de LEITURA (painel/ferramentas.js). Injetado para testar sem o resto.
async function processarMensagem(db, { env, uid, msgId, message, llmClient, builderDeFerramentas, agora = new Date() }) {
  if (!message || message.role !== 'user') return { processed: false, reason: 'not_user' };             // 1. a resposta do próprio agente também dispara o gatilho
  if (typeof message.text !== 'string' || !message.text.trim()) return { processed: false, reason: 'empty' };

  const pessoa = await resolverPessoa(db, uid);                                                          // 2. identidade = uid do caminho
  if (!pessoa) return { processed: false, reason: 'unknown_user' };                                      //    (sem resposta: nem confirma que o caminho existe)
  const cfg = await lerConfig(db);                                                                       // 3. interruptores
  if (!cfg.geral || !cfg.painel) { await gravarResposta(db, env, uid, msgId, { text: AVISOS.pausado }, agora); return { processed: false, reason: 'disabled' }; }
  if (!acessoLibera(cfg.acesso, pessoa.papel)) { await gravarResposta(db, env, uid, msgId, { text: AVISOS.semAcesso }, agora); return { processed: false, reason: 'no_access' }; }

  if (!(await reivindicar(db, env, uid, msgId, agora))) return { processed: false, reason: 'idempotent' };  // 4. uma execução por mensagem
  if (!(await consumirCota(db, env, uid, cfg.limiteDia, agora))) {
    await gravarResposta(db, env, uid, msgId, { text: AVISOS.cota }, agora);
    await db.ref(`${caminhos(env).processed}/${uid}/${msgId}`).update({ status: 'cota' });
    return { processed: false, reason: 'quota' };
  }

  try {
    const coletor = [];
    const tools = [...builderDeFerramentas({ db, env, papel: pessoa.papel }).map(envolverErros), ferramentaResponder(coletor)];
    const ctx = contextoValido(message.ctx);                                                             // 5. dica de contexto
    const pergunta = message.text.trim().slice(0, 2000);
    const result = await runLoop({ llmClient, tools, system: SYSTEM_PROMPT_PAINEL_V1, task: `${linhaDeContexto(ctx)}\n\nPergunta: ${pergunta}`, enabled: true });

    const resp = coletor[coletor.length - 1] || {};
    const texto = String(resp.texto || result.finalText || '').slice(0, MAX_TEXTO);
    if (!texto) throw new Error('resposta vazia');
    const saidas = result.steps.flatMap((s) => s.toolCalls).filter((c) => c.name !== 'responder').map((c) => c.output);
    const conf = conferir(texto, saidas, pergunta);                                                      // 6. números
    const corpo = { text: texto, atalhos: atalhosValidos(resp.atalhos), fonte: String(resp.fonte || '').slice(0, 200), lidoEm: agora.toISOString(), conferido: conf.ok };
    if (!conf.ok) corpo.naoConferidos = conf.naoConferidos.slice(0, 10);
    await gravarResposta(db, env, uid, msgId, corpo, agora);
    await db.ref(`${caminhos(env).processed}/${uid}/${msgId}`).update({ status: result.status });
    return { processed: true, result, conferido: conf.ok };
  } catch (err) {
    console.error('[agente-painel] falha:', env, msgId, err && err.message);                             // sem retry automático (cada retry gasta LLM)
    await gravarResposta(db, env, uid, msgId, { text: AVISOS.falha }, agora).catch(() => {});
    await db.ref(`${caminhos(env).processed}/${uid}/${msgId}`).update({ status: 'erro' }).catch(() => {});
    return { processed: false, reason: 'error' };
  }
}

// Gatilho de produção. As dependências pesadas entram aqui dentro para o arquivo carregar sem elas (testes) e para o index.js só exportar quando tudo existir.
function criarGatilho(env) {
  const { onValueCreated } = require('firebase-functions/v2/database');
  const { defineSecret } = require('firebase-functions/params');
  const { getDatabase } = require('firebase-admin/database');
  const { escolheClienteParaTarefa } = require('../escolheClienteParaTarefa');
  const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
  const { chat } = caminhos(env);
  return onValueCreated({ ref: `/${chat}/{uid}/{msgId}`, region: 'us-central1', secrets: [ANTHROPIC_API_KEY] }, async (event) => {
    const { uid, msgId } = event.params;
    const message = event.data.val();
    if (!message || message.role !== 'user') return;                                                     // não paga LLM/cliente para a própria resposta
    const db = getDatabase();
    try {
      const { buildPainelTools } = require('./ferramentas');
      const { llmClient, tier } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: message.text, db });
      const out = await processarMensagem(db, { env, uid, msgId, message, llmClient, builderDeFerramentas: buildPainelTools });
      console.log('[agente-painel]', env, msgId, out.processed ? `ok tier=${tier} conferido=${out.conferido}` : `ignorado (${out.reason})`);
    } catch (err) {
      console.error('[agente-painel] falha no gatilho:', env, msgId, err && err.message);
    }
  });
}

module.exports = { processarMensagem, criarGatilho, contextoValido, linhaDeContexto, atalhosValidos, resolverPessoa, acessoLibera, hojeBR, caminhos, ABAS, AVISOS };
