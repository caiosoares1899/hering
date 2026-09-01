// functions/agente-agil-orquestrador/tools/criarCard.js
//
// criar_card — a peça que faltava pro orquestrador cobrir "recebi
// informação que não é sobre nenhum card existente" (ex.: um especialista
// externo reporta um problema novo, sem card nenhum aberto pra ele ainda).
// Pedido direto do usuário (2026-08-27), ao corrigir o desenho do
// orquestrador: "criar um card, editar um card, tagear, mencionar um
// humano" — editar/tagear/mencionar já cobertos pelo vocabulário
// reaproveitado de agente-agil/schema.js; só faltava criar. Gap já
// registrado no README ("não existe criar_card no toolset dele").
//
// NÃO escreve direto em kanban/squads/{squad}/dados/cards. /cards é um
// array reescrito por INTEIRO a cada fbSaveAll() do cliente — um card
// inserido por fora, sem passar pelo array em memória de nenhum cliente
// aberto, seria apagado silenciosamente no primeiro fbSaveAll() de
// qualquer pessoa do squad depois (mesmo risco documentado no topo de
// functions/intake/submit.js, motivo de existir intake_pending em vez de
// escrever em /cards direto). Em vez de inventar um mecanismo novo pra
// resolver essa corrida, este handler REUSA o mesmo caminho seguro que já
// existe pro formulário público de intake: grava em
// kanban/squads/{squad}/dados/intake_pending/{id} (nó comum, chaveado por
// push-id, sem esse risco) — o board já tem a tela pronta pra revisar e
// confirmar esses pedidos (renderIntakeBody()/_intakeCriarCard() em
// kanban-dev.html), zero código novo do lado do cliente.
//
// Decisão deliberada de segurança, não uma limitação por preguiça: um card
// criado pelo orquestrador entra como RASCUNHO revisável por um humano, não
// direto no board — criar card é a ação mais "permanente" do toolset (as
// outras editam um card que já existe; esta faz um nascer), e a única do
// grupo sem um jeito seguro conhecido de aplicar direto sem risco real de
// perda silenciosa de dado.
//
// Réplica das mesmas regras obrigatórias que o agente client-side já aplica
// no próprio criar_card dele (kanban-dev.html, handler da ação CRIAR_CARD)
// — squad com Ficha Técnica ativa recusa (agente não sabe preencher os
// campos da ficha), squad com Submarca ativa exige uma das opções válidas.
// Sem essa réplica, o orquestrador deixaria um card num estado que um
// humano seria bloqueado de salvar pelo próprio modal — exatamente o gap
// que o README já registrava como pendência pro dia em que criar_card
// existisse.

const { z } = require('zod');

const criarCardSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'prazo deve estar no formato YYYY-MM-DD').optional(),
  submarca: z.string().min(1).optional(),
  squad_solicitante: z.string().min(1).optional(),
  // Achado real, testando na prática (2026-09-01): o agente recebeu um
  // processo em várias etapas e não tinha onde colocar isso a não ser
  // dentro da descrição como texto corrido — o rascunho confirmado sempre
  // nascia com checklist vazio. Cap em 20 itens (mesmo espírito de limites
  // já aplicados em outras ferramentas, ex. checklist_item) — evita um
  // rascunho gigante que ninguém revisa de verdade.
  checklist: z.array(z.string().min(1)).max(20).optional(),
  // tags: LABELS de texto livre (nunca IDs — o modelo não tem como saber o
  // esquema de ids do squad), casados por label no cliente ao confirmar
  // (_intakeCriarCard(), mesmo padrão que squad_solicitante/submarca já
  // usam — silenciosamente ignora o que não achar correspondência exata,
  // não trava a criação do rascunho por causa disso). riscos: mesmo
  // formato que card.riscos já usa no board (array de strings puras, sem
  // metadado — ver outputs/risco.js/getRiscos()). Cap de 10 nos dois,
  // consistente com o resto do vocabulário de ferramentas.
  tags: z.array(z.string().min(1)).max(10).optional(),
  riscos: z.array(z.string().min(1)).max(10).optional(),
});

// Mesma lista fixa de kanban-dev.html (const SUBMARCA_TAGS, só os labels —
// os ids não importam aqui, quem grava a tag de verdade é o humano ao
// confirmar o rascunho pelo modal normal). Ids/labels não mudam sem uma
// migração de dados combinada com o time — seguro duplicar aqui, mesmo
// espírito de outputs/*.js já duplicarem constantes do cliente quando faz
// sentido isolar.
const SUBMARCA_LABELS = [
  'Hering Adulto Comercial', 'Hering Adulto Cadastro',
  'Hering Kids Comercial', 'Hering Kids Cadastro',
  'Hering Sports Comercial', 'Hering Sports Cadastro',
  'Hering Intimates Comercial', 'Hering Intimates Cadastro',
  'Hering Teen Comercial', 'Hering Teen Cadastro',
];

function makeFakeCriarCardHandler() {
  return async function fakeCriarCardHandler(input) {
    return { ok: true, simulated: true, tool: 'criar_card', wouldHaveExecuted: input };
  };
}

function makeRealCriarCardHandler({ db, squadId, especialista, dryRun = true }) {
  return async function realCriarCardHandler(input) {
    const [criativosSnap, submarcaSnap] = await Promise.all([
      db.ref(`kanban/squads/${squadId}/dados/config/criativos_ativo`).get(),
      db.ref(`kanban/squads/${squadId}/dados/config/submarca_ativo`).get(),
    ]);

    if (criativosSnap.val()) {
      return {
        ok: false,
        error: 'ficha_tecnica_obrigatoria',
        message: 'Este squad exige Ficha Técnica preenchida pra criar um card — o Agente Ágil ainda não sabe preencher esses campos. Peça pra um humano criar manualmente.',
      };
    }

    if (submarcaSnap.val()) {
      const opcoes = SUBMARCA_LABELS.join(', ');
      if (!input.submarca) {
        return { ok: false, error: 'submarca_obrigatoria', message: `Este squad exige Submarca pra criar um card. Opções: ${opcoes}` };
      }
      const match = SUBMARCA_LABELS.find((l) => l.toLowerCase() === String(input.submarca).toLowerCase());
      if (!match) {
        return { ok: false, error: 'submarca_invalida', message: `Submarca "${input.submarca}" não é uma opção válida. Opções: ${opcoes}` };
      }
    }

    const demandante = especialista ? `🔌 ${especialista}` : '🤖 Agente Ágil';

    if (dryRun) {
      return { ok: true, dryRun: true, tool: 'criar_card', wouldHaveExecuted: { ...input, demandante } };
    }

    const pendingRef = db.ref(`kanban/squads/${squadId}/dados/intake_pending`).push();
    const entry = {
      id: pendingRef.key,
      titulo: input.titulo,
      descricao: input.descricao || '',
      demandante,
      squadDemandante: input.squad_solicitante || demandante,
      contato: '',
      prazo: input.prazo || '',
      submarca: input.submarca || '',
      // Checklist opcional (2026-09-01) — array de textos simples, aplicado
      // pelo humano ao confirmar (ver _intakeCriarCard() no cliente); os
      // itens nascem sempre desmarcados, mesma regra que qualquer outro
      // caminho de criação de checklist já segue (ver _criarCardRecorrente()
      // etc.) — não faz sentido um card nascer com item já concluído.
      checklist: Array.isArray(input.checklist) ? input.checklist : [],
      // tags/riscos (2026-09-01) — mesmo espírito do checklist acima:
      // sempre presentes no rascunho ([] quando não informado), aplicados
      // pelo humano ao confirmar. tags ficam como LABELS crus aqui — o
      // casamento por id só faz sentido do lado do cliente, que é quem
      // conhece o esquema de tags do squad (ver _intakeCriarCard()).
      tags: Array.isArray(input.tags) ? input.tags : [],
      riscos: Array.isArray(input.riscos) ? input.riscos : [],
      origem: 'agente-agil',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await pendingRef.set(entry);

    return {
      ok: true,
      dryRun: false,
      tool: 'criar_card',
      pendingId: pendingRef.key,
      message: `Rascunho de card "${input.titulo}" criado — aguardando confirmação de um humano (ver Pedidos de Intake no board).`,
    };
  };
}

module.exports = { criarCardSchema, makeFakeCriarCardHandler, makeRealCriarCardHandler, SUBMARCA_LABELS };
