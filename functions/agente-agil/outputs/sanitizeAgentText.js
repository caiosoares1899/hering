// functions/agente-agil/outputs/sanitizeAgentText.js
//
// Achado real (canário do htmlAnexo, 2026-09-28): ao comentar sobre um
// relatório recém-hospedado (texto mais longo/complexo que o normal), o
// modelo terminou o `texto` vazando um fragmento de fechamento de tag
// alucinado (`</texto>\n</invoke>`) — artefato de formatação interna,
// nunca conteúdo de verdade que alguém pediu pra escrever. Nenhum
// comentário/risco/descrição de card em português deveria legitimamente
// terminar com uma tag XML solta desse tipo, então corta com segurança
// antes de persistir — sem isso, o card fica com um sufixo visível sem
// sentido pra sempre, sem ninguém ter como saber por quê.
//
// Usado só nos 3 campos de texto livre que o modelo pode gerar e que vão
// direto pro board sem passar por nenhum vocabulário fixo/validação de
// valor (comentario.texto, risco.texto, editarCampos.desc) — diferente de
// mover_coluna/checklist_item/tags, que já são valores restritos.

function sanitizeAgentText(texto) {
  return String(texto || '')
    .replace(/\s*(<\/[a-zA-Z_][\w-]*>\s*)+$/, '')
    .trimEnd();
}

module.exports = { sanitizeAgentText };
