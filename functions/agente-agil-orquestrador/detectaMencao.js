// functions/agente-agil-orquestrador/detectaMencao.js
//
// Detecta se um comentário do card menciona o Agente Ágil — usado pelo
// gatilho automático (mentionTrigger.js) pra decidir se deve processar um
// comentário novo. NÃO reaproveita o regex de menção humana
// (/@[a-zA-Z]/, usado em outputs/editarCampos.js e outputs/comentario.js
// pra decidir se dispara notificação): aquele regex só detecta "existe
// ALGUMA @menção", depois resolve contra o INIT de um membro real do
// squad (kanban/squads/{squad}/dados/tags e membros). O agente não é um
// membro com init de verdade (o autor dos comentários dele é
// `author:"Agente Ágil", init:"🤖"` — emoji não bate em `[a-zA-Z]`), então
// precisa de convenção própria.
//
// Detecção: substring "@agente agil" em qualquer parte do texto, depois
// de normalizar (minúsculo + remove diacríticos). Case/acento-insensitive
// de propósito — não travar se alguém digitar "Ágil" sem o acento (comum
// em teclado sem essa tecla configurada). O botão "↩ Responder" do board
// ainda NÃO pré-preenche esse texto pro autor "Agente Ágil" (ele
// pré-preenche o INIT de quem comentou, e "🤖" não serve pra isso) —
// combinado com o usuário: fica como follow-up separado (mudança em
// kanban-dev.html, outro ciclo de deploy), fora do escopo deste módulo.
// Até lá, responder ao agente exige digitar a menção na mão.
function normaliza(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove diacríticos (á -> a, ã -> a, etc.)
}

function mencionaAgente(texto) {
  return normaliza(texto).includes('@agente agil');
}

module.exports = { mencionaAgente };
