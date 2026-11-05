// functions/agente-agil-orquestrador/tools/origemExterna.js
//
// 🔐 Card que nasceu de um pedido de Intake (texto de gente de FORA, anônima) é "origem externa": o agente continua lendo, analisando, comentando, movendo coluna, checklist, risco,
// prioridade e tags — mas NÃO publica relatório HTML, NÃO sobrescreve a descrição (é onde está o texto de fora) e NÃO @menciona gente por texto livre. É a barreira DETERMINÍSTICA
// da injeção de prompt indireta (o parágrafo no systemPrompt é só mitigação). Auditoria de segurança de 05/11/2026.
//
// A marca é `card.intakeId` (a mesma do selo 📥 do board — por isso cards antigos já nascem protegidos), liberada por uma PESSOA com o botão "Liberar para o Agente Ágil"
// (`card.intakeLiberado`, campo que nenhuma ferramenta do agente consegue escrever). Rascunho criado pelo próprio agente (criar_card → intake_pending, origem 'agente-agil')
// carrega `intakeOrigem: 'agente-agil'` e não é tratado como de fora.
//
// O gate vale SÓ no caminho das ferramentas do LLM (realHandlers.runWritePlan): o relatório HTML que o especialista autenticado manda (intakeTrigger, deterministicamente, fora
// do modelo) segue por buildWritePlan direto e não passa por aqui.

const MSG_BLOQUEIO =
  'Este card veio de um pedido de Intake (texto de fora do time), então o Agente Ágil não publica relatório, não reescreve a descrição e não menciona pessoas aqui. ' +
  'Conte isso no seu comentário final; se alguém do time quiser liberar, é só abrir o card e clicar em "Liberar para o Agente Ágil" (ou fazer essa parte à mão).';

const origemExterna = (card) => !!(card && card.intakeId && !card.intakeLiberado && card.intakeOrigem !== 'agente-agil');

// Devolve null (pode seguir) ou { ok:false, error:'origem_externa', message } para o modelo repassar.
function bloqueioDeSaida(outputs) {
  for (const o of outputs || []) {
    if (o && o.type === 'relatorio_html') return { ok: false, error: 'origem_externa', bloqueado: 'relatorio_html', message: MSG_BLOQUEIO };
    if (o && o.type === 'editar_campos' && o.desc !== undefined) return { ok: false, error: 'origem_externa', bloqueado: 'descricao', message: MSG_BLOQUEIO };
  }
  return null;
}

module.exports = { origemExterna, bloqueioDeSaida, MSG_BLOQUEIO };
