// Ponta a ponta do Agente Ágil no Painel: pergunta → LLM falso → FERRAMENTAS REAIS (painel/ferramentas.js, do Codex) sobre um banco falso → resposta → trava de números.
// É o teste que junta as três peças (chat.js + ferramentas.js + conferirNumeros.js). O LLM é determinístico, mas LÊ o resultado real da ferramenta para montar o texto.
const test = require('node:test');
const assert = require('node:assert/strict');
const { processarMensagem } = require('../painel/chat');
const { buildPainelTools } = require('../painel/ferramentas');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');

const AGORA = new Date('2026-11-06T15:00:00.000Z');
const iso = (d) => new Date(AGORA.getTime() - d * 86400000).toISOString();
const cols = [{ id: 'backlog', name: 'Backlog' }, { id: 'progress', name: 'Em Progresso' }, { id: 'blocker', name: 'Impedimentos' }, { id: 'done', name: 'Concluído' }];
const cards = [
  { id: 'c1', title: 'Cuidados com a pele', col: 'progress', due: '2026-11-05', createdAt: iso(9), flow: { firstStartAt: iso(6) } },
  { id: 'c2', title: 'Fluidez do checkout', col: 'progress', due: '2026-11-08', createdAt: iso(5), flow: { firstStartAt: iso(3) } },
  { id: 'c3', title: 'Bloqueado', col: 'blocker', createdAt: iso(2), flow: { firstStartAt: iso(2) } },
  { id: 'c4', title: 'Entregue', col: 'done', createdAt: iso(10), flow: { firstStartAt: iso(8), doneAt: iso(2) } },
];
const semente = () => ({ kanban: {
  config: { agente_agil_orquestrador: { enabled: true, painel_enabled: true } },
  usuarios: { caio: { email: 'caio.soares@ciahering.com.br', nome: 'Caio', role: 'adm' } },
  squads: { dev: { dados: { cards, columns: cols, agil_cfg: { wip: '2' }, flow_baseline: { at: iso(90) } } }, omnichannel: { dados: { cards: [], columns: cols } } },
} });
const doChat = (db, llmClient, extra) => processarMensagem(db, Object.assign({ env: 'dev', uid: 'caio', msgId: 'm1', message: { role: 'user', text: 'como está o squad dev?', ts: AGORA.toISOString(), ctx: { aba: 'visao', filtro: 'dev' } }, llmClient, builderDeFerramentas: buildPainelTools, agora: AGORA }, extra));
const resposta = (db) => db._data().kanban.agente_painel_dev.caio.m1_r;
const ultimaSaida = (history) => { const r = history.filter((h) => h.role === 'tool_results').pop(); return r && r.results[0].output; };

// LLM que lê a saída REAL da ferramenta e escreve um texto com os números dela (ou com um número trocado, se `errar`).
const llmLeitor = ({ errar } = {}) => { let n = 0; return { async decide({ history }) {
  n++;
  if (n === 1) return { toolCalls: [{ id: '1', name: 'painel_visao', input: { squad: 'dev' } }], text: null };
  if (n === 2) { const s = ultimaSaida(history).squads[0]; const ativos = errar ? s.ativos + 7 : s.ativos;
    return { toolCalls: [{ id: '2', name: 'responder', input: { texto: `O squad dev tem ${ativos} cards ativos, ${s.wip} em progresso (limite ${s.limite_wip}) e ${s.bloqueados} bloqueado.`, fonte: 'Visão · dev', atalhos: [{ rotulo: 'Ver na Visão · dev', aba: 'visao', filtro: 'dev' }] } }], text: null }; }
  return { toolCalls: [], text: 'ok' }; } }; };

test('ponta a ponta: a resposta usa os números REAIS da ferramenta e passa na trava de números', async () => {
  const db = makeFakeDb(semente()); const out = await doChat(db, llmLeitor());
  assert.equal(out.processed, true); assert.equal(out.conferido, true);
  const r = resposta(db); assert.equal(r.text, 'O squad dev tem 4 cards ativos, 2 em progresso (limite 2) e 1 bloqueado.');
  assert.deepEqual(r.atalhos, [{ rotulo: 'Ver na Visão · dev', aba: 'visao', filtro: 'dev' }]); assert.equal(r.conferido, true);
});

test('ponta a ponta: número trocado pelo modelo é pego pela trava contra a saída real da ferramenta', async () => {
  const db = makeFakeDb(semente()); await doChat(db, llmLeitor({ errar: true }));
  const r = resposta(db); assert.equal(r.conferido, false); assert.deepEqual(r.naoConferidos, ['11']);
});

test('ponta a ponta: erro de argumento (esqueceu "dias", passou o NOME do squad) volta ao modelo e a conversa segue', async () => {
  const db = makeFakeDb(semente()); let n = 0;
  const llm = { async decide({ history }) { n++;
    if (n === 1) return { toolCalls: [{ id: '1', name: 'painel_fluxo', input: { squad: 'Mídia Criativa' } }], text: null };       // inválido nos dois campos
    if (n === 2) { assert.equal(ultimaSaida(history).ok, false); return { toolCalls: [{ id: '2', name: 'painel_fluxo', input: { squad: 'dev', dias: 14 } }], text: null }; }
    if (n === 3) { const o = ultimaSaida(history); return { toolCalls: [{ id: '3', name: 'responder', input: { texto: `Entregas em 14 dias: ${o.vazao.entregues}.`, fonte: 'Fluxo · dev · 14 dias' } }], text: null }; }
    return { toolCalls: [], text: 'ok' }; } };
  const out = await doChat(db, llm); assert.equal(out.processed, true); assert.equal(resposta(db).conferido, true); assert.match(resposta(db).text, /^Entregas em 14 dias: \d+\.$/);
});

test('ponta a ponta (dev): a ferramenta só lê o que o Painel dev lê — nenhum usuário, e-mail, feedback ou config entra no que o modelo vê', async () => {
  const db = makeFakeDb(semente()); const vistos = []; const base = llmLeitor();
  const llm = { async decide(x) { vistos.push(JSON.stringify(x.history)); return base.decide(x); } };
  await doChat(db, llm); const tudo = vistos.join('\n');
  assert.ok(!/@ciahering|caio\.soares|painel_enabled|usuarios/.test(tudo), 'dado pessoal/config vazou para o contexto do modelo');
  assert.match(tudo, /Cuidados|ativos/);
});
