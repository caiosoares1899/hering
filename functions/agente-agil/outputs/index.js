// Registry de outputs suportados. Adicionar um novo tipo (checklistItem,
// agentStatus, mover_coluna — v2) é: criar o arquivo, importar aqui, incluir
// no discriminatedUnion em schema.js.

const comentario = require('./comentario');
const link = require('./link');

module.exports = {
  comentario: comentario.build,
  link: link.build,
};
