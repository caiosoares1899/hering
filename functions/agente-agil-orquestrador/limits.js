// functions/agente-agil-orquestrador/limits.js
//
// Kill switch e teto de iterações do orquestrador. Isolado num módulo próprio
// pra deixar claro que são as duas únicas válvulas de segurança do loop —
// qualquer outra trava (validação de payload, permissões, etc.) vive em
// outro lugar.
//
// Importante: nada em loop.js lê o kill switch diretamente. isEnabled() só é
// consultado pelos *callers* de produção, que resolvem o valor ANTES de
// chamar runLoop() e passam `enabled` já pronto (ver loop.js — não dá mais
// pra usar isEnabled() como default de parâmetro, ver comentário abaixo).
// Isso mantém a suíte de testes estruturalmente desacoplada do valor real do
// switch: os testes sempre passam `enabled: true` explicitamente e nunca
// ficam bloqueados por este arquivo.
//
// Kill switch DINÂMICO (2026-08-14, item 1 do plano de acionamento sem
// supervisão direta): antes era uma constante hardcoded no código
// (`KILL_SWITCH_ENABLED = false`) — pausar o orquestrador exigia mudar
// código e fazer deploy. Combinado com o usuário: antes de QUALQUER
// acionamento sem humano olhando o terminal (@menção, e futuramente gatilho
// automático), o ADM precisa conseguir pausar instantaneamente. Agora
// isEnabled(db) lê `kanban/config/agente_agil_orquestrador/enabled` no
// Realtime Database.
//
// Postura fail-safe preservada (mesmo espírito do valor antigo, que
// começava `false`): sem `db` (ex.: chamada que não tem banco à mão) ou
// erro de leitura -> desligado. Nó ausente no Firebase (nunca foi ligado
// ainda) -> desligado. Só um `true` literal liga — qualquer outro valor
// (`false`, string, número, objeto malformado) também desliga. Nunca liga
// por acidente; só desliga por acidente na pior hipótese, que é a direção
// segura de errar.
async function isEnabled(db) {
  if (!db) return false;
  try {
    const snap = await db.ref('kanban/config/agente_agil_orquestrador/enabled').get();
    return snap.val() === true;
  } catch (e) {
    return false;
  }
}

// Cada iteração é uma ida e volta ao LLM. A cadeia de referência já discutida
// (mover_coluna + checklist_item + comentário) consome 3 iterações com tool
// call + 1 iteração final só de texto = 4. Dobrar isso dá folga pra uma cadeia
// legítima maior (ex: ler estado antes de agir) sem deixar de pegar rápido um
// loop descontrolado.
const MAX_ITERATIONS = 8;

module.exports = { isEnabled, MAX_ITERATIONS };
