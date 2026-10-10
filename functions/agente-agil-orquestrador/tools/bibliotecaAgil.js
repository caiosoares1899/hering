// functions/agente-agil-orquestrador/tools/bibliotecaAgil.js
//
// Base de conhecimento estática do Agente Ágil: conceitos de metodologia
// ágil (WIP, sprint, throughput...) + como as funcionalidades do Maré
// Digital funcionam na prática (recorrência, ficha técnica, dependências,
// riscos, campanhas...). Existe pro agente ter uma referência confiável ao
// atuar como "braço de PO" — não só agir sobre o card atual, mas também
// explicar/orientar sobre o board em si.
//
// 2026-10-10 (pedido: "atualizar o agente sobre a cisão com a Arezzo, os códigos e suas atualizações, o Oceano e as funcionalidades novas"):
// o grupo "Como o board funciona" deixou de ser texto escrito à mão (16 verbetes parados em agosto) e passou a vir de
// `conhecimento/ajudaMare.json` — GERADO a partir do HELP_CONTENT de kanban.html (122 verbetes, mesma redação que as pessoas leem) por
// `npm run conhecimento` (conhecimento/gerar.js); o teste `conhecimento.test.js` falha se o JSON ficar diferente do HELP_CONTENT.
// `conhecimento/novidades.json` traz o que mudou (CHANGELOG, seção de produção). Como são ~120 mil caracteres, a ferramenta ganhou o parâmetro
// `busca`: sem ele devolve só os conceitos ágeis + o ÍNDICE (títulos) e as novidades mais recentes; com ele devolve os verbetes que casam.
// Cloud Functions não leem o repositório em runtime: os JSON entram no pacote do deploy — regenerar exige republicar as funções do orquestrador.
//
// DUPLICAÇÃO DELIBERADA (histórico, vale pros CONCEITOS_AGEIS abaixo): todo o texto abaixo é extraído e adaptado de
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

const MAX_NOVIDADES_INDICE = 12;

const bibliotecaAgilSchema = z.object({
  busca: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Palavras-chave do que você quer saber (ex.: "recorrência", "pausar card", "Radar atingimento", "o que mudou nas dicas"). Sem este campo você recebe só os conceitos ágeis + o índice de tudo que existe; com ele, os verbetes completos que casam.',
    ),
});

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

// O ecossistema Oceano e a "cisão" com a Arezzo — curado à mão (não existe no HELP_CONTENT do board). Fonte: CLAUDE.md, docs/OCEANO.md, docs/arezzo/MARE_SO_HERING.md.
const ECOSSISTEMA_OCEANO = [
  {
    titulo: 'A família Oceano (Maré, Painel, Radar, A Bordo)',
    texto:
      'O que antes era tudo "Maré Digital" virou a família Oceano: Maré Digital (o kanban/board), Painel (administração: pessoas, comunicados, push manual, Central de Notificações, dados), Radar (a página de OKR — Objetivos, Marcos, atingimento, calendário, Mural, apresentação ao vivo), A Bordo (onboarding) e Travessia (futuro: performance/gente). A página Oceano é o lobby: login, vitrine por pessoa, personalização, ajuda e, quando instalada como app, o "host" que abre os produtos. Só os nomes visíveis mudaram — "OKR" continua sendo a metodologia, o papel "Gestor OKR" e o selo dos cards. Ao falar da página de OKR diga "Radar". O menu de produtos (⋮⋮⋮) leva entre os produtos e tem as abas Produtos · Hering (links da empresa) · Meus links (pessoais).',
  },
  {
    titulo: 'Maré só Hering (a cisão com a Arezzo)',
    texto:
      'O Maré passou a atender SÓ a Hering: o login é só Google com e-mail @ciahering.com.br (o login Microsoft/Arezzo fica desligado por um interruptor, não apagado), o OKR tem uma torre só (Digital — Comercial e Corporativa não aparecem pra ninguém) e @menção só alcança quem é @ciahering. Por isso: não fale de Arezzo, de login Microsoft nem de torres Comercial/Corporativa como se existissem; se alguém perguntar, explique que foram separadas e ficam desligadas (dá pra religar, mas hoje não é o caso). Dados antigos dessas áreas continuam gravados mas escondidos.',
  },
  {
    titulo: 'Radar (OKR): Objetivos, Marcos e atingimento',
    texto:
      'No Radar, cada Objetivo pertence a uma gerência da torre Digital e tem Marcos (atividades macro) com status nao_iniciado, no_prazo, risco, atrasado ou concluido. O Objetivo pode ter um atingimento (meta com % de cumprimento): Financeira, Porcentagem, Número, Atingido/Não atingido, Manter acima/abaixo de, Data de entrega ou ♾️ Perene; a barra anda pelo % do atingimento (ou pelos Marcos concluídos, se não houver). Tem calendário de reuniões/eventos (com repetição), Mural de avisos 📢 com selo, apresentação ao vivo (laser, caneta, passar o controle), histórico semanal e dashboard. Quem edita: ADM, PO/Organizador/Gestor OKR e o Responsável do Objetivo. Pra mexer em OKR por conversa existe o chat do Agente Ágil dentro do Radar (botão flutuante) — aqui no card você não edita Objetivos.',
  },
  {
    titulo: 'Painel (administração) e Central de Notificações',
    texto:
      'O Painel é a área de ADM/PO: pessoas e papéis, Mural/Comunicados (inclusive urgentes e push manual), campanhas, dados do board (Visão e Fluxo — WIP, throughput, cycle/lead time, aging, CFD), backups, usuários globais e a Central de Notificações (aba 🔔): o catálogo de todos os tipos de aviso (quando disparam, quem recebe), interruptores de sino e de push por tipo (valem pra todo mundo; só PO/ADM gravam) e quem está com Não Perturbe. Desligar o sino só esconde; nada é apagado. O Painel não mostra dicas.',
  },
  {
    titulo: 'Notificações, sino único e Não Perturbe',
    texto:
      'O sino 🔔 é o mesmo no Maré, no Painel, no Radar e no Oceano: mostra as notificações pessoais (atribuição, menção, prazo, risco, reunião...) e o feed da torre (aviso do Mural, Objetivo criado, Marco concluído). Cada pessoa pode ativar o push no aparelho e usar o Não Perturbe (silencia som e push por um tempo). Notificações lidas somem em 3 dias, as não lidas em 30. O ADM pode desligar o sino e/ou o push de um tipo inteiro na Central de Notificações do Painel.',
  },
  {
    titulo: 'Dicas (mini popups)',
    texto:
      'As dicas são mini avisos no canto da tela com um truque ou lugar útil. Aparecem no máximo UMA por dia em cada produto (Maré, Radar e Oceano contam separado) e cada dica uma vez só; "Saiba mais" abre o assunto na Ajuda e "Não mostrar dicas" desliga por produto. Dá pra religar e rever em Ajuda → 💡 Dicas. O Painel e o A Bordo não mostram dicas.',
  },
];

// ── conhecimento gerado (ver conhecimento/gerar.js) ──
function lerJson(nome) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(`../conhecimento/${nome}.json`);
  } catch (e) {
    return [];
  }
}
const AJUDA_MARE = lerJson('ajudaMare');
const NOVIDADES = lerJson('novidades');
const { ABAS } = require('../conhecimento/gerar');

const AJUDA_RADAR = lerJson('ajudaRadar');
const AJUDA_OCEANO = lerJson('ajudaOceano');
const busca = require('../conhecimento/busca');

function candidatos() {
  const c = [];
  CONCEITOS_AGEIS.forEach((v) => c.push({ grupo: 'Conceitos ágeis', titulo: v.titulo, texto: v.texto }));
  ECOSSISTEMA_OCEANO.forEach((v) => c.push({ grupo: 'Família Oceano', titulo: v.titulo, texto: v.texto }));
  AJUDA_MARE.forEach((v) => c.push({ grupo: `Ajuda do Maré · ${ABAS[v.aba] || v.aba}`, titulo: v.titulo, texto: v.texto }));
  AJUDA_RADAR.forEach((v) => c.push({ grupo: 'Ajuda do Radar', titulo: v.titulo, texto: v.texto }));
  AJUDA_OCEANO.forEach((v) => c.push({ grupo: 'Ajuda do Oceano', titulo: v.titulo, texto: v.texto }));
  NOVIDADES.forEach((v) => c.push({ grupo: 'Novidades', titulo: v.titulo, texto: v.texto, data: v.data, peso: 0.4 }));
  return c;
}

function buscar(texto) {
  return busca.buscar(candidatos(), texto);
}

function indiceAjuda() {
  const porAba = {};
  AJUDA_MARE.forEach((v) => {
    const nome = ABAS[v.aba] || v.aba;
    (porAba[nome] = porAba[nome] || []).push(v.titulo);
  });
  if (AJUDA_RADAR.length) porAba['Radar (OKR)'] = AJUDA_RADAR.map((v) => v.titulo);
  if (AJUDA_OCEANO.length) porAba['Oceano'] = AJUDA_OCEANO.map((v) => v.titulo);
  return porAba;
}

function makeBibliotecaAgilHandler() {
  return async function bibliotecaAgilHandler(input) {
    const busca = input && typeof input.busca === 'string' ? input.busca.trim() : '';
    if (busca) {
      const verbetes = buscar(busca);
      if (verbetes && verbetes.length) return { busca, verbetes };
      return {
        busca,
        verbetes: [],
        aviso: 'Nada casou com essa busca. Tente outras palavras (nome da funcionalidade, como aparece na tela) ou chame sem busca pra ver o índice de tudo que existe.',
      };
    }
    return {
      como_usar:
        'Esta é a base de conhecimento do Maré Digital e do Oceano. Abaixo: os conceitos ágeis e a família Oceano completos, o ÍNDICE (títulos) de toda a Ajuda do Maré e as novidades mais recentes. Pra ler um verbete ou uma novidade inteira, chame de novo com `busca` (ex.: "pausar card", "automação gatilho", "Radar atingimento").',
      grupos: [
        { nome: 'Conceitos ágeis', verbetes: CONCEITOS_AGEIS },
        { nome: 'Família Oceano', verbetes: ECOSSISTEMA_OCEANO },
      ],
      indice_ajuda_do_mare: indiceAjuda(),
      novidades_recentes: NOVIDADES.slice(0, MAX_NOVIDADES_INDICE).map((n) => ({ data: n.data, titulo: n.titulo })),
    };
  };
}

module.exports = {
  bibliotecaAgilSchema,
  CONCEITOS_AGEIS,
  ECOSSISTEMA_OCEANO,
  AJUDA_MARE,
  AJUDA_RADAR,
  AJUDA_OCEANO,
  NOVIDADES,
  buscar,
  makeBibliotecaAgilHandler,
};
