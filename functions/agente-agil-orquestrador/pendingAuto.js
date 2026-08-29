// functions/agente-agil-orquestrador/pendingAuto.js
//
// Fila de "gatilhos de Automação pendentes" — kanban/squads/{squad}/dados/
// agente_pending_auto/{pushId} = {eventType, cardId, extra, ts}.
//
// Achado real (/monitorarbugs, 2026-08-29): Automações (AUTO_TRIGGERS/
// runAutoRules) só existem no cliente (kanban-dev.html), avaliadas ao vivo
// sempre que uma mutação passa por um caminho que já sabe disparar (modal,
// drag, bulk actions...). O orquestrador escreve direto no Firebase via
// Admin SDK pra mover/editar um card já existente (mover_coluna,
// editar_campos, checklist_item, risco — ver realHandlers.js), sem passar
// por nenhum desses caminhos — uma regra "Card movido para Y" nunca
// disparava pra um mover_coluna do Agente Ágil. `criar_card` NÃO tem esse
// problema: ele nunca cria um card direto, só um rascunho em
// intake_pending que um humano confirma pelo modal normal (mesmo
// saveCard() que já dispara tudo certo, ver tools/criarCard.js) — por isso
// só as ferramentas que editam um card já existente enfileiram aqui.
//
// Em vez de portar o motor de Automações inteiro pro servidor (reescrita
// de verdade, fora de escopo — AUTO_ACTIONS mexe em DOM/estado só do
// cliente), o backend só ANUNCIA que algo aconteceu; quem decide o que
// fazer continua sendo o cliente, exatamente como já é pra qualquer
// mutação humana. A fila serve só pra isso — reivindicada via transaction()
// em kanban-dev.html (_claimPendingAuto()), garantindo que a automação
// dispara exatamente 1 vez mesmo com várias pessoas com o board aberto ao
// mesmo tempo, não 1 vez por aba.
function enqueuePendingAuto(db, squadId, { eventType, cardId, extra }) {
  const ref = db.ref(`kanban/squads/${squadId}/dados/agente_pending_auto`).push();
  return ref.set({ eventType, cardId, extra: extra ?? null, ts: new Date().toISOString() });
}

// Compara o card antes/depois de um write plan aplicado e enfileira os
// eventos de Automação correspondentes — mesmas condições que o cliente já
// usa pra disparar os mesmos triggers (ver branch de edição de saveCard()/
// scheduleAutoSave() em kanban-dev.html), só que a partir de um diff de
// estado em vez de um call site sabendo de antemão o que mudou. Cobre só os
// campos que as ferramentas reais do orquestrador (mover_coluna,
// editar_campos, checklist_item, risco) conseguem tocar — nenhuma delas
// mexe em coverColor/padraoId/isOKR/blocker, então esses triggers não
// entram aqui (ver AUTO_TRIGGERS em kanban-dev.html pro conjunto completo).
async function enqueuePendingAutoFromDiff(db, squadId, cardId, before, after) {
  const events = [];
  if ((before.col || '') !== (after.col || '') && after.col) {
    events.push({ eventType: 'move', extra: after.col });
  }
  if ((before.priority || '') !== (after.priority || '') && after.priority) {
    events.push({ eventType: 'priority' });
  }
  const prevTags = before.tags || [];
  const curTags = after.tags || [];
  curTags.filter((t) => !prevTags.includes(t)).forEach((t) => events.push({ eventType: 'tag_added', extra: t }));
  prevTags.filter((t) => !curTags.includes(t)).forEach((t) => events.push({ eventType: 'tag_removed', extra: t }));
  const prevDone = (before.checklist || []).filter((i) => i && i.done).length;
  const curChecklist = after.checklist || [];
  if (curChecklist.length && curChecklist.every((i) => i && i.done) && prevDone < curChecklist.length) {
    events.push({ eventType: 'checklist_complete' });
  }
  if ((after.riscos || []).length > (before.riscos || []).length) {
    events.push({ eventType: 'risk_added' });
  }
  for (const ev of events) {
    await enqueuePendingAuto(db, squadId, { cardId, eventType: ev.eventType, extra: ev.extra });
  }
}

module.exports = { enqueuePendingAuto, enqueuePendingAutoFromDiff };
