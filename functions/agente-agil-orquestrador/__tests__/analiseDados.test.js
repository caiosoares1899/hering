// functions/agente-agil-orquestrador/__tests__/analiseDados.test.js
//
// Cobertura de gerarAnaliseDados()/buildUserMessage()/CONTEXTOS — a lógica
// pura do "🤖 Ponto de vista do Agente Ágil" (painéis Dados do Board e
// Controle de Criativos). Não testa o wrapper agenteAgilAnaliseDados
// (onRequest) em si — mesmo raciocínio já aplicado a resumoMeuDia.test.js:
// a lógica que importa já está toda em gerarAnaliseDados().
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  gerarAnaliseDados,
  buildUserMessage,
  CONTEXTOS,
} = require('../analiseDados');

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

test('CONTEXTOS: só board_insights e criativos existem, cada um com prompt próprio', () => {
  assert.deepEqual(Object.keys(CONTEXTOS).sort(), ['board_insights', 'criativos']);
  assert.notEqual(CONTEXTOS.board_insights.prompt, CONTEXTOS.criativos.prompt);
  assert.ok(CONTEXTOS.board_insights.prompt.includes('Dados do Board'));
  assert.ok(CONTEXTOS.criativos.prompt.includes('Criativos'));
});

test('buildUserMessage: inclui o resumo agregado como JSON e o rótulo do contexto certo', () => {
  const msg = buildUserMessage('criativos', { total: 10, atrasados: 2 });
  assert.ok(msg.includes('"total":10'));
  assert.ok(msg.includes('"atrasados":2'));
  assert.ok(msg.includes('Controle de Criativos'));
});

test('gerarAnaliseDados: chama o LLM sem nenhuma tool (rede de segurança — sem ferramenta de escrita)', async () => {
  let toolsRecebidas = null;
  let systemRecebido = null;
  const llmClient = {
    async decide({ tools, system }) {
      toolsRecebidas = tools;
      systemRecebido = system;
      return { text: 'Ponto de vista aqui.' };
    },
  };

  const resultado = await gerarAnaliseDados({
    contexto: 'board_insights',
    resumo: { total: 5, prioCounts: { alta: 2 } },
    llmClient,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.analise, 'Ponto de vista aqui.');
  assert.deepEqual(toolsRecebidas, []);
  assert.equal(systemRecebido, CONTEXTOS.board_insights.prompt);
});

test('gerarAnaliseDados: usa o prompt certo pro contexto "criativos"', async () => {
  let systemRecebido = null;
  const llmClient = { async decide({ system }) { systemRecebido = system; return { text: 'ok' }; } };

  await gerarAnaliseDados({ contexto: 'criativos', resumo: { total: 3 }, llmClient });

  assert.equal(systemRecebido, CONTEXTOS.criativos.prompt);
});

test('gerarAnaliseDados: resposta vazia do LLM cai num texto de fallback, não quebra', async () => {
  const llmClient = scriptedLlmClient([{ text: null }]);

  const resultado = await gerarAnaliseDados({ contexto: 'board_insights', resumo: { total: 1 }, llmClient });

  assert.equal(resultado.ok, true);
  assert.ok(resultado.analise.length > 0);
});

test('gerarAnaliseDados: devolve o texto do LLM com espaços nas pontas removidos', async () => {
  const llmClient = scriptedLlmClient([{ text: '  Análise com espaço.  ' }]);

  const resultado = await gerarAnaliseDados({ contexto: 'criativos', resumo: { total: 1 }, llmClient });

  assert.equal(resultado.analise, 'Análise com espaço.');
});
