// functions/agente-agil-orquestrador/__tests__/resumoMeuDia.test.js
//
// Cobertura de collectPendingCards()/sinaisDoCard()/gerarResumoMeuDia() —
// a lógica pura do "🤖 Resumo do Agente Ágil" dentro de "Meu Dia". Não
// testa o wrapper agenteAgilResumoMeuDia (onRequest) em si — exigiria
// mockar firebase-functions/v2/https + firebase-admin/auth, mesmo
// raciocínio já aplicado a mentionTrigger.js/dueOverdueTrigger.js: a
// lógica que importa já está toda em gerarResumoMeuDia()/collectPendingCards().
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const flowLib = require('../../agente-agil/flow');
const {
  collectPendingCards,
  gerarResumoMeuDia,
  sinaisDoCard,
  todaySP,
  SQUADS_ATIVOS,
  MENSAGEM_SEM_CARDS,
} = require('../resumoMeuDia');

const HOJE = todaySP();
const ONTEM = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const SEMANA_QUE_VEM = new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const COLUNAS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'progress', name: 'Em andamento' },
  { id: 'done', name: 'Concluído' },
];
const FLOW_CONFIG = { startCols: [], doneCols: ['done'], reportCols: [] };

function seedDb({ dev, dados, usuariosPublicos } = {}) {
  flowLib._resetCacheForTests();
  return makeFakeDb({
    kanban: {
      usuarios_publicos: usuariosPublicos || {},
      squads: {
        dev: {
          dados: {
            cards: (dev && dev.cards) || {},
            columns: (dev && dev.columns) || COLUNAS,
            config: { flow: (dev && dev.flowConfig) || FLOW_CONFIG },
          },
        },
        dados: {
          dados: {
            cards: (dados && dados.cards) || {},
            columns: (dados && dados.columns) || COLUNAS,
            config: { flow: (dados && dados.flowConfig) || FLOW_CONFIG },
          },
        },
        // Squad fora de SQUADS_ATIVOS — pra provar que fica de fora mesmo
        // sendo membro lá.
        ecomm: {
          dados: {
            cards: { 0: { id: 'c-ecomm', title: 'Card do ecomm', col: 'backlog', owner: 'CO' } },
            columns: COLUNAS,
            config: { flow: FLOW_CONFIG },
          },
        },
      },
    },
  });
}

test('sinaisDoCard: calcula atrasado/diasAtraso/venceHoje/semPrazo/bloqueado/semDescricao/checklist corretamente', () => {
  const atrasado = sinaisDoCard({ title: 'A', due: ONTEM, blocker: true, checklist: [{ done: false }, { done: true }] }, { hoje: HOJE });
  assert.equal(atrasado.atrasado, true);
  assert.equal(atrasado.diasAtraso, 1);
  assert.equal(atrasado.venceHoje, false);
  assert.equal(atrasado.semPrazo, false);
  assert.equal(atrasado.bloqueado, true);
  assert.equal(atrasado.checklistVazio, false);
  assert.equal(atrasado.checklistPendente, 1);

  const semNada = sinaisDoCard({ title: 'B' }, { hoje: HOJE });
  assert.equal(semNada.atrasado, false);
  assert.equal(semNada.semPrazo, true);
  assert.equal(semNada.semDescricao, true);
  assert.equal(semNada.checklistVazio, true);
  assert.equal(semNada.bloqueado, false);

  const hoje = sinaisDoCard({ title: 'C', due: HOJE, desc: 'tem descrição' }, { hoje: HOJE });
  assert.equal(hoje.venceHoje, true);
  assert.equal(hoje.atrasado, false);
  assert.equal(hoje.semDescricao, false);
});

test('collectPendingCards: junta cards de dev+dados, ignora squad fora de SQUADS_ATIVOS mesmo sendo membro', async () => {
  assert.deepEqual(SQUADS_ATIVOS, ['dev', 'dados']);
  const db = seedDb({
    usuariosPublicos: {
      'uid-1': { init: 'CO', squads: { dev: true, dados: true, ecomm: true } },
    },
    dev: { cards: { 0: { id: 'c1', title: 'Card dev', col: 'backlog', owner: 'CO' } } },
    dados: { cards: { 0: { id: 'c2', title: 'Card dados', col: 'backlog', owner: 'CO' } } },
  });

  const { cards, squads } = await collectPendingCards(db, 'uid-1');
  assert.deepEqual(squads.sort(), ['dados', 'dev']);
  assert.equal(cards.length, 2);
  assert.ok(cards.every((c) => c.squadId !== 'ecomm'));
});

test('collectPendingCards: só squads onde a pessoa é membro (mesmo estando em SQUADS_ATIVOS)', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } }, // não é membro de "dados"
    dev: { cards: { 0: { id: 'c1', title: 'Card dev', col: 'backlog', owner: 'CO' } } },
    dados: { cards: { 0: { id: 'c2', title: 'Card dados', col: 'backlog', owner: 'CO' } } },
  });

  const { cards, squads } = await collectPendingCards(db, 'uid-1');
  assert.deepEqual(squads, ['dev']);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].squadId, 'dev');
});

test('collectPendingCards: pega card como owner OU participante, ignora card de outra pessoa', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } },
    dev: {
      cards: {
        0: { id: 'c1', title: 'Meu como owner', col: 'backlog', owner: 'CO' },
        1: { id: 'c2', title: 'Meu como participante', col: 'backlog', owner: 'XY', participants: ['CO'] },
        2: { id: 'c3', title: 'De outra pessoa', col: 'backlog', owner: 'XY' },
      },
    },
  });

  const { cards } = await collectPendingCards(db, 'uid-1');
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((c) => c.titulo).sort(), ['Meu como owner', 'Meu como participante']);
});

test('collectPendingCards: exclui card arquivado e card em coluna de fim', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } },
    dev: {
      cards: {
        0: { id: 'c1', title: 'Ativo', col: 'backlog', owner: 'CO' },
        1: { id: 'c2', title: 'Arquivado', col: 'backlog', owner: 'CO', archived: true },
        2: { id: 'c3', title: 'Concluído', col: 'done', owner: 'CO' },
      },
    },
  });

  const { cards } = await collectPendingCards(db, 'uid-1');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].titulo, 'Ativo');
});

test('collectPendingCards: pessoa sem init ou sem squad relevante retorna lista vazia, sem erro', async () => {
  const dbSemInit = seedDb({ usuariosPublicos: { 'uid-1': { squads: { dev: true } } } });
  assert.deepEqual((await collectPendingCards(dbSemInit, 'uid-1')).cards, []);

  const dbUsuarioInexistente = seedDb({});
  assert.deepEqual((await collectPendingCards(dbUsuarioInexistente, 'uid-fantasma')).cards, []);

  const dbSemSquadRelevante = seedDb({ usuariosPublicos: { 'uid-1': { init: 'CO', squads: { ecomm: true } } } });
  assert.deepEqual((await collectPendingCards(dbSemSquadRelevante, 'uid-1')).cards, []);
});

function scriptedLlmClient(script) {
  let calls = 0;
  return {
    calls: () => calls,
    async decide() {
      const response = script[calls];
      calls++;
      return response;
    },
  };
}

test('gerarResumoMeuDia: sem cards pendentes NÃO chama o LLM, devolve mensagem fixa', async () => {
  const db = seedDb({ usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } } });
  const llmClient = scriptedLlmClient([{ text: 'não deveria rodar' }]);

  const resultado = await gerarResumoMeuDia({ db, uid: 'uid-1', llmClient });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.resumo, MENSAGEM_SEM_CARDS);
  assert.equal(resultado.totalCards, 0);
  assert.equal(llmClient.calls(), 0);
});

test('gerarResumoMeuDia: com cards pendentes, chama o LLM sem nenhuma tool e devolve o texto', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } },
    dev: { cards: { 0: { id: 'c1', title: 'Card atrasado', col: 'backlog', owner: 'CO', due: ONTEM } } },
  });
  const llmClient = scriptedLlmClient([{ text: 'Resumo: 1 card atrasado, ataca esse primeiro.' }]);

  const resultado = await gerarResumoMeuDia({ db, uid: 'uid-1', llmClient });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.resumo, 'Resumo: 1 card atrasado, ataca esse primeiro.');
  assert.equal(resultado.totalCards, 1);
  assert.equal(llmClient.calls(), 1);
});

test('gerarResumoMeuDia: passa tools vazio pro LLM (rede de segurança — sem nenhuma ferramenta de escrita disponível)', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } },
    dev: { cards: { 0: { id: 'c1', title: 'Card', col: 'backlog', owner: 'CO', due: SEMANA_QUE_VEM } } },
  });
  let toolsRecebidas = null;
  const llmClient = { async decide({ tools }) { toolsRecebidas = tools; return { text: 'ok' }; } };

  await gerarResumoMeuDia({ db, uid: 'uid-1', llmClient });

  assert.deepEqual(toolsRecebidas, []);
});

test('gerarResumoMeuDia: resposta vazia do LLM cai num texto de fallback, não quebra', async () => {
  const db = seedDb({
    usuariosPublicos: { 'uid-1': { init: 'CO', squads: { dev: true } } },
    dev: { cards: { 0: { id: 'c1', title: 'Card', col: 'backlog', owner: 'CO', due: SEMANA_QUE_VEM } } },
  });
  const llmClient = scriptedLlmClient([{ text: null }]);

  const resultado = await gerarResumoMeuDia({ db, uid: 'uid-1', llmClient });

  assert.equal(resultado.ok, true);
  assert.ok(resultado.resumo.length > 0);
});
