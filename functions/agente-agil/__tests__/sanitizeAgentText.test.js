// functions/agente-agil/__tests__/sanitizeAgentText.test.js
//
// Achado real (canário do htmlAnexo, 2026-09-28): comentando sobre um
// relatório recém-hospedado, o modelo vazou um fragmento de fechamento de
// tag alucinado (`</texto>\n</invoke>`) no fim do texto do comentário —
// artefato de formatação interna, nunca conteúdo real. Cobertura da função
// pura isolada (ver uso real em outputs/comentario.js/risco.js/editarCampos.js).
const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeAgentText } = require('../outputs/sanitizeAgentText');

test('remove o fragmento exato observado no canário real', () => {
  const sujo = 'Link: https://exemplo.com/relatorio.html\n\nDisponível para consulta.</texto>\n</invoke>\n';
  assert.equal(sanitizeAgentText(sujo), 'Link: https://exemplo.com/relatorio.html\n\nDisponível para consulta.');
});

test('texto normal, sem tag nenhuma, não muda em nada', () => {
  assert.equal(sanitizeAgentText('Card atualizado, sem pendências.'), 'Card atualizado, sem pendências.');
});

test('remove múltiplas tags de fechamento em sequência no fim', () => {
  assert.equal(sanitizeAgentText('Texto real</parameter></invoke>'), 'Texto real');
});

test('não mexe em tag no MEIO do texto, só no fim', () => {
  const texto = 'Isso </não> é uma tag de fechamento de verdade, é parte do texto mesmo';
  assert.equal(sanitizeAgentText(texto), texto);
});

test('null/undefined viram string vazia, sem quebrar', () => {
  assert.equal(sanitizeAgentText(null), '');
  assert.equal(sanitizeAgentText(undefined), '');
});

test('string vazia continua vazia', () => {
  assert.equal(sanitizeAgentText(''), '');
});

test('remove espaço em branco à direita mesmo sem tag nenhuma', () => {
  assert.equal(sanitizeAgentText('Texto com espaço sobrando   \n\n'), 'Texto com espaço sobrando');
});

test('texto que termina em URL com > por acaso (improvável, mas não é uma tag) não deveria ser afetado', () => {
  const texto = 'Veja em <https://exemplo.com>';
  assert.equal(sanitizeAgentText(texto), texto);
});
