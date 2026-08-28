// functions/agente-agil-orquestrador/__tests__/systemPrompt.test.js
//
// Smoke test, não um teste de comportamento — o texto em si foi aprovado
// pelo usuário e é armazenado verbatim (ver systemPrompt.js). Isso só
// garante que uma edição futura não corrompa/esvazie o prompt nem perca
// alguma das 8 ferramentas ou a lógica de risco baixo/médio sem que
// alguém perceba.
const test = require('node:test');
const assert = require('node:assert/strict');

const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');
const { buildTools } = require('../tools');

test('SYSTEM_PROMPT_V1 menciona todas as ferramentas que buildTools() expõe', () => {
  const toolNames = buildTools().map((t) => t.name);
  assert.ok(toolNames.length > 0);
  for (const name of toolNames) {
    assert.ok(SYSTEM_PROMPT_V1.includes(name), `prompt deveria mencionar a ferramenta "${name}"`);
  }
});

test('SYSTEM_PROMPT_V1 documenta a distinção de risco baixo/médio e quando perguntar', () => {
  assert.match(SYSTEM_PROMPT_V1, /baixo risco/i);
  assert.match(SYSTEM_PROMPT_V1, /risco médio/i);
  assert.match(SYSTEM_PROMPT_V1, /perguntar_humano/);
  assert.match(SYSTEM_PROMPT_V1, /pedidos abertos/i);
});

// Corrigido 2026-08-26: o texto dizia "só squad dev" mas dados também tem
// escrita real desde 2026-08-24 (agenteAgilMencaoDados) — achado incidental
// ao adicionar o guard do card hotline abaixo.
test('SYSTEM_PROMPT_V1 escopa explicitamente pros squads "dev" e "dados"', () => {
  assert.match(SYSTEM_PROMPT_V1, /squads "dev" e "dados"/);
});

// Card especial "Converse com Agente Ágil" (kanban-dev.html, openAgenteHotline())
// — guarda contra o modelo tentar mover_coluna/editar_campos/etc. nesse card,
// reconhecendo-o só pelo título exato.
test('SYSTEM_PROMPT_V1 protege o card especial "Converse com Agente Ágil" de ações mecânicas', () => {
  assert.match(SYSTEM_PROMPT_V1, /Converse com o Agente Ágil/);
  assert.match(SYSTEM_PROMPT_V1, /NUNCA chame mover_coluna, editar_campos, checklist_item ou agent_status/);
});

// Achado real (2026-08-18): a 1ª @menção real mostrou o modelo respondendo
// só no finalText (nunca chamou comentario) — invisível pra quem perguntou,
// já que finalText só existe no log da Cloud Function. Guarda a instrução
// explícita que fecha essa lacuna (exceção #5 do cabeçalho).
test('SYSTEM_PROMPT_V1 exige que a resposta final sempre seja entregue via comentario', () => {
  assert.match(SYSTEM_PROMPT_V1, /Entrega da resposta/i);
  assert.match(SYSTEM_PROMPT_V1, /sempre precisa ser entregue via comentario/i);
});

// Achado real (item 7, 2026-08-21): "move esse card pra Concluído" (nome de
// exibição real da coluna) fez mover_coluna falhar 2x — o modelo tentou o
// nome como se fosse o ID. Guarda a instrução que fecha essa lacuna,
// apontando pra colunas_disponiveis (ler_card).
test('SYSTEM_PROMPT_V1 deixa claro que mover_coluna espera o ID da coluna, não o nome, e aponta pra ler_card', () => {
  assert.match(SYSTEM_PROMPT_V1, /coluna.*espera o ID/i);
  assert.match(SYSTEM_PROMPT_V1, /colunas_disponiveis/);
});

// Achado real ao vivo (item 7, 2026-08-27): editar_campos falhou (tag
// inexistente no squad), mas o comentario final do modelo afirmou sucesso
// mesmo assim. Reforço explícito no prompt, complementar ao fix de código
// (llmClient.js agora marca is_error:true nos tool_results com ok:false).
test('SYSTEM_PROMPT_V1 instrui o modelo a nunca fingir sucesso quando uma ferramenta falha', () => {
  assert.match(SYSTEM_PROMPT_V1, /Ferramenta que falhou/i);
  assert.match(SYSTEM_PROMPT_V1, /finja que deu certo/i);
});

// Achado real ao vivo (2026-08-28, teste manual via HTTPS simulando um
// especialista pedindo pra avisar o responsável): o modelo escreveu
// "@Caio Oliveira Dos Santos Soares" (nome completo) num comentario — a
// regex de menção (notifications.js, MENTION_RE) não aceita espaço, então
// isso nunca virou uma menção de verdade (não notificou ninguém, não virou
// link). O modelo tinha o "init" certo disponível via ler_card
// (responsavel.init) mas nada no prompt dizia pra usar ele especificamente
// numa menção — só citava "init" em outros contextos.
test('SYSTEM_PROMPT_V1 instrui o modelo a usar as iniciais (init), nunca o nome completo, numa @menção dentro de um comentário', () => {
  assert.match(SYSTEM_PROMPT_V1, /Menções \(@\) dentro de um comentário/i);
  assert.match(SYSTEM_PROMPT_V1, /NUNCA use o nome completo depois do @/i);
  assert.match(SYSTEM_PROMPT_V1, /responsavel\.init/);
});

// Ponto 3 do desenho "orquestrador lendo input de especialistas externos"
// (README.md, 2026-08-25/27): o modelo nunca deve reconciliar sozinho
// especialistas que se contradizem — só sinalizar.
test('SYSTEM_PROMPT_V1 instrui o modelo a sinalizar contradição entre especialistas, nunca reconciliar sozinho', () => {
  assert.match(SYSTEM_PROMPT_V1, /Comentários de especialistas externos/i);
  assert.match(SYSTEM_PROMPT_V1, /origem/);
  assert.match(SYSTEM_PROMPT_V1, /NÃO escolha quem está certo/i);
});

// Achado real ao vivo (item 10, 2026-08-27): mesmo com a description de
// criar_card já avisando sobre dryRun (achado anterior, mesmo dia), o
// modelo continuou narrando sucesso real numa chamada simulada — avisar só
// na description de uma ferramenta não bastou. Regra genérica no nível do
// prompt: dryRun:true nunca é sucesso real, mesmo com ok:true.
test('SYSTEM_PROMPT_V1 instrui o modelo a nunca tratar um resultado dryRun:true como uma ação real', () => {
  assert.match(SYSTEM_PROMPT_V1, /Ferramenta em modo de teste \(dryRun\)/i);
  assert.match(SYSTEM_PROMPT_V1, /"dryRun".*true.*(simulou|simulação)/i);
});
