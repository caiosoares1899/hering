// functions/agente-agil-orquestrador/tools/bibliotecaAgil.js
//
// Base de conhecimento estática do Agente Ágil: conceitos de metodologia
// ágil (WIP, sprint, throughput...) + como as funcionalidades do Maré
// Digital funcionam na prática (recorrência, ficha técnica, dependências,
// riscos, campanhas...). Existe pro agente ter uma referência confiável ao
// atuar como "braço de PO" — não só agir sobre o card atual, mas também
// explicar/orientar sobre o board em si.
//
// DUPLICAÇÃO DELIBERADA: todo o texto abaixo é extraído e adaptado de
// `HELP_CONTENT` em kanban-dev.html (abas 'agil', 'board', 'cards',
// 'config', 'comunicacao') — mesmo precedente já usado em
// `agente-agil/flow.js` e `tools/visaoBoard.js`: kanban.html não tem
// nenhum `<script src>` externo (client ES modules / Cloud Function
// CommonJS não compartilham import sem um shim novo), então manter os dois
// textos em sincronia é responsabilidade de quem edita HELP_CONTENT, não
// de um módulo compartilhado. HTML de formatação usado no modal (`<b>`,
// `<div>`, `<code>`) foi removido — aqui o texto é pra um LLM ler, não pra
// renderizar numa tela.
//
// SEM DISTINÇÃO fake/real: diferente de ler_card e visao_board, esta
// ferramenta nunca toca o Firebase — é dado 100% estático e
// determinístico. Um único handler serve os dois modos de buildTools().
//
// SCHEMA VAZIO no v1: sem parâmetro de filtro por grupo/verbete. Sempre
// retorna os dois grupos completos. Mesma filosofia de "simples primeiro"
// já usada em visao_board — se o custo por chamada importar depois que o
// agente usar de verdade, um filtro é uma mudança pequena de v2, não
// retrabalho.
const { z } = require('zod');

const bibliotecaAgilSchema = z.object({});

const CONCEITOS_AGEIS = [
  {
    titulo: 'WIP (Work in Progress)',
    texto:
      'Quantidade de cards simultaneamente em progresso. Limitar o WIP melhora o fluxo e reduz o tempo de ciclo. A regra geral é não ter mais cards em progresso do que membros ativos. O board mostra o contador no header da coluna Em Progresso (ex: 4/3 em vermelho quando excedido).',
  },
  {
    titulo: 'Sprint',
    texto:
      'Ciclo de trabalho com duração fixa (geralmente 1-2 semanas). Começa com planejamento, tem daily diária e termina com revisão e retrospectiva. Configure em Config → Ágil.',
  },
  {
    titulo: 'Throughput',
    texto:
      'Número de cards concluídos por sprint. Um indicador saudável de produtividade do time. O Agente Ágil monitora e alerta quando está abaixo do esperado.',
  },
  {
    titulo: 'Impedimentos',
    texto:
      'Bloqueios que impedem o progresso de um card. Devem ser escalados imediatamente. Use a coluna Impedimentos e chame o Agente Ágil com "Como escalar esse bloqueio?".',
  },
  {
    titulo: 'OKR no Kanban',
    texto:
      'Marque cards estratégicos como OKR (botão direito → Marcar como OKR). Eles aparecem com borda dourada e são priorizados no snapshot do Agente Ágil.',
  },
  {
    titulo: 'Objetivo da sprint',
    texto:
      'Uma frase que resume o valor entregue nessa sprint. Deve ser específico, mensurável e acordado com stakeholders. Aparece no topo do board e no contexto do Agente Ágil.',
  },
  {
    titulo: 'Retrospectiva',
    texto:
      'Cerimônia ao fim de cada sprint para inspecionar o processo. Use a aba Retrospectiva do Agente Ágil para estruturar pontos de melhoria e transformá-los em ações.',
  },
  {
    titulo: 'Product Owner (PO)',
    texto:
      'Responsável por maximizar o valor entregue pelo time. No Maré Digital, o PO gerencia configurações, acessa o Agente Ágil e usa o campo Insights do PO em cada card para descrever objetivo e critério de aceite (formato SMART).',
  },
  {
    titulo: 'Papéis no board',
    texto:
      'Convidado e Membro: cria, edita e move cards, posta lembretes e kudos (Convidado é só um rótulo diferente, pra sinalizar gente de fora — ex. freelancer — e é o único papel que pode ser removido da lista pelo PO). Organizador: gerencia colunas e tags. PO: acesso total incluindo Agente Ágil, automações e configurações. ADM: acesso irrestrito a todos os squads.',
  },
];

const COMO_BOARD_FUNCIONA = [
  {
    titulo: 'Itens recorrentes',
    texto:
      'Cards que se repetem a cada sprint — entregas fixas, rituais, rotinas. Ao clicar em "✅ Usar", o card é criado no Backlog pré-preenchido.\n\nComo criar: abra ⚡ Funções (toolbar) → 🔁 Recorrentes → "+ Recorrente", preencha título, tag e opcionalmente descrição e responsável, salve — fica permanente na lista.\n\nComo usar na sprint: clique em "✅ Usar" num item — o card é criado no Backlog. O mesmo item pode ser usado sprint após sprint, sem recriar.',
  },
  {
    titulo: 'Recorrência automática',
    texto:
      'Um card pode se recriar automaticamente no board sem intervenção manual. Abra o card, vá em Recorrência e escolha o intervalo: a cada N dias, toda semana num dia fixo, dias úteis (segunda a sexta, pula fim de semana), ou todo mês numa data fixa. Quando o prazo chega e o board é aberto, o card renasce na coluna configurada com todo o conteúdo original (título, tag, responsável, checklist). Ideal para rituais recorrentes como relatórios, posts ou revisões.\n\nDiferença pra "Itens recorrentes": ali é o time que clica "Usar" manualmente a cada sprint; aqui o card se recria sozinho, sem ninguém precisar lembrar.',
  },
  {
    titulo: 'Modelos',
    texto:
      'Cards template com tudo pré-preenchido: tag, descrição, Insights do PO, checklist e riscos. Perfeito para tarefas que sempre seguem o mesmo padrão.\n\nComo criar: a partir de um card existente (rodapé do modal → 📋 Modelo) ou do zero (⚡ Funções → 📋 Modelos → "+ Modelo").\n\nComo usar: clique em "✅ Usar" — card criado no Backlog com tudo preenchido. Campos obrigatórios podem ser marcados no modelo, exigindo preenchimento antes de criar o card.',
  },
  {
    titulo: 'Ficha Técnica (produção criativa)',
    texto:
      'Em Config → Criativos, PO/ADM/Organizador pode ativar a Ficha Técnica — pra times que produzem peças criativas, no lugar de planilha de controle. Com ela ativa, cada card ganha campos extras: Campanha, Funil, Etapa do Funil, Canal, Objetivo, Plataforma, Tipo, Formato, Variações e Direcional de Mídia. Todos obrigatórios pra salvar o card, exceto Direcional de Mídia. As opções de Canal/Objetivo/Plataforma/Tipo/Formato são listas fechadas, geridas pelo PO em Config → Criativos.\n\nUm supercard (ver "Supercard") não tem ficha própria — a seção some e deixa de ser obrigatória assim que o card ganha o primeiro filho, porque cada filho tem sua própria ficha.\n\nImportante pro Agente Ágil: hoje o agente NÃO sabe preencher a Ficha Técnica — se o squad tem ela ativa, ele recusa criar o card sozinho nesse caso e pede pra um humano preencher.',
  },
  {
    titulo: 'Dependências entre cards',
    texto:
      'No campo Dependência dentro do card, vincule um card pai. O card filho mostra uma barra no topo indicando de que depende. O mapa de Dependências (toolbar) mostra todas as relações visualmente. Diferente de "Cards vinculados": aqui existe uma relação de ordem/bloqueio (pai → filho), não só uma referência solta.',
  },
  {
    titulo: 'Cards vinculados',
    texto:
      'Vincule cards relacionados entre si, sem relação de bloqueio ou hierarquia — só uma referência cruzada. O card exibe os vínculos com o status atual de cada um. O Agente Ágil enxerga os vínculos ao analisar o board.',
  },
  {
    titulo: 'Checklist',
    texto:
      'Adicione itens de checklist dentro do card. Clique no texto de qualquer item para editá-lo inline. Arraste pelo handle ⠿ para reordenar. Uma barra de progresso aparece no card do board.',
  },
  {
    titulo: 'Riscos',
    texto:
      'Mapeie riscos diretamente no card com nível (alto, médio, baixo). Cards com riscos mostram um badge ⚠ no board. O Agente Ágil notifica automaticamente o PO quando riscos são adicionados.',
  },
  {
    titulo: 'Menções',
    texto:
      'No campo de descrição, comentário ou nas Campanhas, digite @ para mencionar um membro do time (a pessoa recebe notificação no sino 🔔), ou @card: para vincular outro card (abre um seletor de busca).',
  },
  {
    titulo: 'Peça vinculada (Milanote)',
    texto:
      'Dentro do card, o campo "Peça no Milanote" vincula o link do board/peça já criada no Milanote. O card ganha um botão "🎨 Abrir peça no Milanote" e um selo 📌 na lista do board, sinalizando de longe que aquele card tem um criativo associado — útil pra saber se a arte já está em produção sem abrir o card.',
  },
  {
    titulo: 'Lembretes direcionados',
    texto:
      'PO e Organizador podem criar lembretes (Configurações → 📌 Lembretes) para um membro específico ou para a squad inteira. O destinatário vê um post-it marcado com 🎯; cada pessoa só enxerga os lembretes destinados a ela ou a "toda a squad". É um canal de comunicação da gestão pro time dentro do próprio board, separado dos comentários de card.',
  },
  {
    titulo: 'Campanhas & Coleções',
    texto:
      'Cada campanha/coleção (📣 Campanhas na toolbar) é vinculada a uma tag do board — todos os cards com essa tag entram automaticamente. Dentro da campanha aparece o fluxo dos cards vinculados e um histórico de entradas: aprendizados 💡, resultados 📊, problemas 🚧, links 🔗 e registros 📝. Configura-se nome, mote, período, squads participantes (multi-squad) e tema visual da estação.',
  },
  {
    titulo: 'Arquivados',
    texto:
      'Cards podem ser arquivados (botão Arquivar no modal) em vez de excluídos — ficam fora do board ativo mas continuam existindo, visíveis e restauráveis em "Arquivados" na toolbar (com filtros por nome, tag e responsável). Diferente de excluir, arquivar é reversível.',
  },
  {
    titulo: 'Supercard (cards filhos)',
    texto:
      'Quando um pedido único vira vários cards por formato/veículo/teste diferente (ex.: mídia paga em Feed, Stories, Reels), agrupe num supercard em vez de espalhar solto no board. Dentro do card, em 🔗 Vínculos & anexos → "🧩 Cards filhos (supercard)", vincule um card existente ou crie um filho na hora — ele nasce herdando coluna, prazo, prioridade e demandante do pai. O card pai mostra no board o total concluído (ex.: "3/6 concluído(s)"). Os filhos são cards independentes (cada um anda na própria coluna, com seu responsável e prazo) — nenhum filho bloqueia o outro, diferente de "Dependências". Um card com filhos perde a seção de Ficha Técnica própria (ver "Ficha Técnica").',
  },
  {
    titulo: 'Prazo e Submarca obrigatórios',
    texto:
      'Todo card precisa de um Prazo pra salvar — sem data definida ainda, use o botão "🚫 Sem prazo definido" em vez de chutar uma data. Em squads que usam o campo Submarca, escolher a submarca também é obrigatório. Vale pra criar e editar, pelo modal ou pelo Agente Ágil: o agente segue a mesma regra — recusa criar um card sem Submarca válida quando o squad exige, e um card criado sem prazo informado nasce marcado como "sem prazo definido" em vez de ficar num estado inválido.',
  },
];

function makeBibliotecaAgilHandler() {
  return async function bibliotecaAgilHandler() {
    return {
      grupos: [
        { nome: 'Conceitos ágeis', verbetes: CONCEITOS_AGEIS },
        { nome: 'Como o board funciona', verbetes: COMO_BOARD_FUNCIONA },
      ],
    };
  };
}

module.exports = {
  bibliotecaAgilSchema,
  CONCEITOS_AGEIS,
  COMO_BOARD_FUNCIONA,
  makeBibliotecaAgilHandler,
};
