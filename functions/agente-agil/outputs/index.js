// Registry de outputs suportados. Adicionar um novo tipo é: criar o
// arquivo, importar aqui, incluir no discriminatedUnion em schema.js.

const comentario = require('./comentario');
const link = require('./link');
const relatorioHtml = require('./relatorioHtml');
const checklistItem = require('./checklistItem');
const agentStatus = require('./agentStatus');
const moverColuna = require('./moverColuna');
const editarCampos = require('./editarCampos');

module.exports = {
  comentario: comentario.build,
  link: link.build,
  relatorio_html: relatorioHtml.build,
  checklist_item: checklistItem.build,
  agent_status: agentStatus.build,
  mover_coluna: moverColuna.build,
  editar_campos: editarCampos.build,
};
