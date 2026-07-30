// functions/agente-agil-orquestrador/limits.js
//
// Kill switch e teto de iterações do orquestrador. Isolado num módulo próprio
// pra deixar claro que são as duas únicas válvulas de segurança do loop —
// qualquer outra trava (validação de payload, permissões, etc.) vive em
// outro lugar.
//
// Importante: nada em loop.js lê KILL_SWITCH_ENABLED diretamente. isEnabled()
// só é consultado pelos *callers* de produção como valor padrão de `enabled`
// quando o parâmetro é omitido (ver runLoop() em loop.js) — o loop em si
// recebe `enabled` já resolvido. Isso mantém a suíte de testes estruturalmente
// desacoplada do valor real do switch: os testes sempre passam `enabled: true`
// explicitamente e nunca ficam bloqueados por este arquivo.
const KILL_SWITCH_ENABLED = false;

function isEnabled() {
  return KILL_SWITCH_ENABLED;
}

// Cada iteração é uma ida e volta ao LLM. A cadeia de referência já discutida
// (mover_coluna + checklist_item + comentário) consome 3 iterações com tool
// call + 1 iteração final só de texto = 4. Dobrar isso dá folga pra uma cadeia
// legítima maior (ex: ler estado antes de agir) sem deixar de pegar rápido um
// loop descontrolado.
const MAX_ITERATIONS = 8;

module.exports = { isEnabled, MAX_ITERATIONS };
