// Registry de outputs suportados. Adicionar um novo tipo (checklistItem,
// agentStatus, mover_coluna — v2) é: criar o arquivo, importar aqui, incluir
// no discriminatedUnion em schema.js.

const comentario = require('./comentario');
const link = require('./link');
const relatorioHtml = require('./relatorioHtml');

module.exports = {
  comentario: comentario.build,
  link: link.build,
  relatorio_html: relatorioHtml.build,
};
