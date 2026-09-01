// functions/agente-agil-orquestrador/squadScope.js
//
// Fonte única de "em quais squads o Agente Ágil está ativo, pra qual
// capacidade" — revisão arquitetural 2026-08-31. Antes desta extração,
// dueOverdueTrigger.js (SQUADS) e resumoMeuDia.js (SQUADS_ATIVOS)
// hardcodavam ['dev', 'dados'] cada um por conta própria — os dois já
// tinham comentário cruzado avisando "mesma lista que o outro arquivo",
// mas continuavam sendo 2 (na prática 3, contando o client —
// kanban-dev.html tem sua própria AGENTE_AGIL_MENTION_SQUADS) cópias
// manuais do mesmo fato. Risco real: um squad novo entra numa lista e
// alguém esquece de atualizar a(s) outra(s) — nada acusa isso, o scan/
// resumo simplesmente não cobre o squad novo, silenciosamente.
//
// mentionTrigger.js FICA DE FORA de propósito: cada squad ali é uma Cloud
// Function EXPORTADA por nome (createMentionTrigger({squadId}), ver
// module.exports lá) — exigência do próprio modelo de deploy do Firebase
// Functions gen2 (permite `firebase deploy --only functions:
// agenteAgilMencaoDados` só daquele squad); não é duplicação acidental, é
// o jeito certo de fazer isso, e não dá pra virar um array genérico sem
// mudar o modelo de deploy. MENTION_SQUADS aqui existe como REFERÊNCIA de
// leitura pra quem precisa saber "em quais squads a menção está ligada"
// sem duplicar o hardcode — dueOverdueTrigger.js usa ela pra decidir se
// vale a pena escrever o comentário sintético (não faz sentido escrever
// num squad onde nada vai processar). mentionTrigger.js faz uma checagem
// de drift própria contra esta lista no module load (ver comentário lá) —
// se alguém adicionar um squad aqui sem deployar a Cloud Function
// correspondente (ou vice-versa), um console.warn avisa no log em vez de
// falhar silenciosamente.
const MENTION_SQUADS = Object.freeze(['dev', 'dados']);

// Squads varridos por dueOverdueTrigger.js (scan diário de due_today/
// due_overdue). Histórico: 'dev' desde a criação (2026-08-24), 'dados'
// adicionado 2026-08-25.
const DUE_SCAN_SQUADS = Object.freeze(['dev', 'dados']);

// Squads onde resumoMeuDia.js responde a pedidos de "🤖 Resumo do Agente
// Ágil" em Meu Dia.
const RESUMO_MEUDIA_SQUADS = Object.freeze(['dev', 'dados']);

// Squads onde a ferramenta notificar_especialista_externo (tools/
// notificarEspecialistaExterno.js) está disponível pro modelo — chamada
// HTTP de saída de verdade pra uma URL cadastrada em painel.html. Decisão
// explícita do usuário (2026-08-31): entra REAL direto (sem modo sombra),
// mas só no squad de teste — mesmo raciocínio de conter o raio de
// alcance de uma capacidade nova sem repetir todo o ciclo de dry-run que
// as outras ferramentas passaram, já que aqui o risco é "chamar uma URL
// que o próprio ADM configurou", não escrever no board.
const NOTIFICAR_ESPECIALISTA_SQUADS = Object.freeze(['dev']);

// Squads onde analiseDados.js responde ao botão "🤖 Ponto de vista do
// Agente Ágil" dentro dos painéis "Dados do Board" (Insights) e "Controle
// de Criativos". Mesmo valor que RESUMO_MEUDIA_SQUADS hoje, mas como
// constante própria — convenção deste arquivo (ver comentário no topo):
// cada capacidade tem seu próprio nome, mesmo quando o valor atual
// coincide, porque já houve caso de duas listas divergirem depois
// (NOTIFICAR_ESPECIALISTA_SQUADS acima).
const ANALISE_DADOS_SQUADS = Object.freeze(['dev', 'dados']);

// Squads onde analisePO.js responde ao botão "🤖 Análise do board (PO)"
// dentro de "Meu Dia" — visível só pra PO/Organizador/ADM no client
// (mesmo threat model de ANALISE_DADOS_SQUADS: o dado já é visível a
// qualquer membro do squad via outros painéis — Dados do Board, Controle
// de Criativos, lista de Campanhas —, então o botão é restrito por
// decisão de produto, não por exposição de dado novo). Mesmo valor de
// ANALISE_DADOS_SQUADS hoje, constante própria pela mesma convenção do
// resto deste arquivo.
const ANALISE_PO_SQUADS = Object.freeze(['dev', 'dados']);

module.exports = {
  MENTION_SQUADS,
  DUE_SCAN_SQUADS,
  RESUMO_MEUDIA_SQUADS,
  NOTIFICAR_ESPECIALISTA_SQUADS,
  ANALISE_DADOS_SQUADS,
  ANALISE_PO_SQUADS,
};
