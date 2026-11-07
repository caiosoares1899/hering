const test = require('node:test');
const assert = require('node:assert/strict');
const { _texto: texto } = require('../painel/ferramentas');

test('títulos legítimos NÃO são omitidos (uid/token só valem como palavra inteira)', () => {
  for (const t of ['Cuidados com a pele', 'Campanha fluido', 'Fluidez do checkout', 'Squid Game', 'Tokenização de pagamentos', 'Coleção Verão 2027']) assert.equal(texto(t), t, t);
});

test('dado pessoal ou segredo é omitido: e-mail, telefone, URL, "uid" e "token" como palavra', () => {
  for (const t of ['contato@empresa.com', 'ligar 11 98765-4321', 'veja https://x.com/a', 'uid do usuário abc', 'o token expirou', 'Token: abc']) assert.equal(texto(t), '[conteúdo omitido]', t);
});

test('limita a 80 caracteres e troca caracteres de controle por espaço', () => {
  assert.equal(texto('a'.repeat(200)).length, 80);
  assert.equal(texto('linha1\nlinha2\ttab'), 'linha1 linha2 tab');
});
