// functions/agente-agil-orquestrador/scripts/gerarHistoricoRealistaSquadDev.js
//
// Gera ~300 cards com histórico fabricado mas plausível (3 meses), mais
// recorrentes, campanhas e lembretes — pra dar ao visao_board (e outras
// leituras) uma base de dados "saudável" de teste, depois que o squad dev
// foi limpo do lixo acumulado de testes anteriores.
//
// RODA SÓ LOCAL — mesmo padrão de dryRunVisaoBoardContraSquadDev.js
// (credenciais na sua máquina, não neste sandbox).
//   cd functions
//   set ANTHROPIC_API_KEY=... (não usado aqui, mas GOOGLE_APPLICATION_CREDENTIALS sim)
//   node agente-agil-orquestrador/scripts/gerarHistoricoRealistaSquadDev.js
//
// Config puxada da config REAL do squad dev (colunas/tags/agil_cfg), pra não
// inventar id que não existe. Coluna "col_1786558288337" (MODELOS DE CARD)
// fica de fora de propósito — não é uma etapa de fluxo real.
//
// Todo card gerado carrega a tag `tag_ficticio_agente` ("🧪 Fictício (Agente
// Ágil)") — já existe no squad, é o mesmo padrão usado em testes anteriores
// desta sessão — pra ficar rastreável/fácil de limpar depois, sem
// atrapalhar nenhum cálculo (visao_board não filtra por tag).
//
// Cards concluídos há mais de 45 dias são arquivados (simula uma limpeza
// periódica real) — os mais recentes ficam ativos em "Concluído", como um
// board de verdade que não arquiva no mesmo dia.

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const SQUAD_ID = 'dev';
const DATABASE_URL = 'https://hering-onboarding-default-rtdb.firebaseio.com';
const FICTICIO_TAG = 'tag_ficticio_agente';
const IMPEDIMENTO_TAG = 'tag_impedimento_68a8';
const MEMBERS = ['MS', 'RMM', 'JF', 'AGF', 'CO', 'PA'];
const ARCHIVE_CUTOFF_DIAS = 45;

const NOW = new Date();
const DIAS = (n) => n * 86400000;
const isoAt = (msAgo) => new Date(NOW.getTime() - msAgo).toISOString();
const dateOnlyAt = (msAgo) => isoAt(msAgo).slice(0, 10);
const rnd = (min, max) => min + Math.random() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[rndInt(0, arr.length - 1)];
const pickSome = (arr, n) => {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(rndInt(0, copy.length - 1), 1)[0]);
  return out;
};
const rndId = (createdMsAgo) => 'c' + (NOW.getTime() - createdMsAgo) + '_' + Math.random().toString(36).slice(2, 6);

const TAG_POOL = {
  dev: ['feat', 'infra', 'bug', 'ml', 'data'],
  submarca: ['tag_sm_adulto', 'tag_sm_kids', 'tag_sm_sports', 'tag_sm_intimates', 'tag_sm_teens'],
  tamanho: ['tag_tam_p', 'tag_tam_m', 'tag_tam_g', 'tag_tam_gg'],
  outras: ['tag_seo_6877', 'tag_google_analy_6a19', 'tag_mapa_de_calo_6a19', 'tag_a__o_6691', 'tag_verificar_6691'],
};

const TITULOS = {
  dev: [
    'Corrigir bug de checkout em {sub}',
    'Otimizar consulta lenta no dashboard de {sub}',
    'Implementar exportação de relatório — {sub}',
    'Ajustar cache de imagens da vitrine {sub}',
    'Refatorar módulo de frete — {sub}',
    'Corrigir divergência de estoque em {sub}',
    'Subir nova versão da API de busca',
    'Investigar lentidão no checkout mobile',
    'Migrar job de sincronização de pedidos',
  ],
  marketing: [
    'E-mail marketing — {camp}',
    'Mídia paga (Google/Meta Ads) — {camp}',
    'Posts redes sociais — {camp}',
    'Banner da home — {camp}',
    'Ajuste de SEO nas páginas de {sub}',
    'Análise de mapa de calor — checkout',
    'Relatório de performance de campanha — {camp}',
    'Briefing de fotos — coleção {sub}',
  ],
  dados: [
    'Modelo de recomendação — {sub}',
    'Pipeline de dados de vendas — {sub}',
    'Dashboard de acompanhamento — {camp}',
    'Análise de conversão por submarca',
    'Validação de dataset de treino (ML)',
  ],
};
const CAMPANHAS = ['Dia dos Pais 2026', 'Coleção P/V 2027', 'Black Friday', 'Volta às aulas'];
const SUBMARCAS = ['Hering Adulto', 'Hering Kids', 'Hering Sports', 'Hering Intimates', 'Hering Teens'];

function tituloAleatorio() {
  const cat = pick(['dev', 'dev', 'marketing', 'marketing', 'dados']); // dev/marketing mais frequentes
  const tpl = pick(TITULOS[cat]);
  return tpl.replace('{sub}', pick(SUBMARCAS)).replace('{camp}', pick(CAMPANHAS));
}

function tagsAleatorias() {
  const out = [FICTICIO_TAG, pick(TAG_POOL.dev)];
  if (Math.random() < 0.5) out.push(pick(TAG_POOL.submarca));
  if (Math.random() < 0.3) out.push(pick(TAG_POOL.tamanho));
  if (Math.random() < 0.2) out.push(pick(TAG_POOL.outras));
  return [...new Set(out)];
}

// Constrói um card com histórico de fluxo fabricado. `etapas` é a sequência
// de colunas visitadas em ordem; `tempos` (mesmo tamanho - 1) são os
// intervalos em horas entre cada transição, do mais antigo pro mais recente.
function construirCard({ criadoMsAgo, etapas, tempos, blocked = false }) {
  const criadoAt = isoAt(criadoMsAgo);
  const tags = tagsAleatorias();
  const log = [{ from: null, to: etapas[0], at: criadoAt }];
  const enteredAt = { [etapas[0]]: criadoAt };
  // cursor é "ms atrás de agora" — cada intervalo em tempos[] avança no
  // tempo (aproxima de agora), por isso subtrai a cada passo.
  let cursor = criadoMsAgo;
  for (let i = 1; i < etapas.length; i++) {
    cursor -= tempos[i - 1] * 3600000;
    const at = isoAt(Math.max(cursor, 0));
    log.push({ from: etapas[i - 1], to: etapas[i], at });
    enteredAt[etapas[i]] = at;
  }
  const colAtual = etapas[etapas.length - 1];
  const done = colAtual === 'done';
  const firstStartAt = enteredAt['progress'] || null;
  const doneAt = done ? enteredAt['done'] : null;

  const card = {
    id: rndId(criadoMsAgo),
    title: tituloAleatorio(),
    desc: '',
    tag: tags[1] || '',
    tags,
    col: colAtual,
    owner: pick(MEMBERS),
    priority: pick(['', '', 'low', 'medium', 'medium', 'high']),
    createdAt: dateOnlyAt(criadoMsAgo),
    updatedAt: log[log.length - 1].at,
    checklist: [],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
    comments: {},
    history: log.map((l, i) => ({
      who: pick(MEMBERS),
      what: i === 0 ? 'criou o card' : 'moveu para ' + l.to,
      at: l.at,
    })),
    flow: { firstStartAt, doneAt, enteredAt, log },
  };
  if (blocked) {
    card.blocker = true;
    card.tags = [...new Set([...card.tags, IMPEDIMENTO_TAG])];
  }
  if (doneAt) {
    const doneMsAgo = NOW.getTime() - new Date(doneAt).getTime();
    if (doneMsAgo > DIAS(ARCHIVE_CUTOFF_DIAS)) card.archived = true;
  }
  return card;
}

function gerarCards() {
  const cards = [];

  // 240 concluídos normais, espalhados nos últimos 90 dias, cycle 1-6 dias
  for (let i = 0; i < 240; i++) {
    const criadoMsAgo = DIAS(rnd(3, 90));
    const horasBacklog = rnd(2, 48);
    const horasTodo = rnd(2, 30);
    const horasProgress = rnd(20, 130); // 1-5.5 dias
    const horasEntreProgressEDone = rnd(1, 20);
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: ['backlog', 'todo', 'progress', 'done'],
        tempos: [horasBacklog, horasTodo, horasProgress + horasEntreProgressEDone],
      }),
    );
  }

  // 25 concluídos rápidos (tarefa simples, poucas horas)
  for (let i = 0; i < 25; i++) {
    const criadoMsAgo = DIAS(rnd(3, 90));
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: ['todo', 'progress', 'done'],
        tempos: [rnd(0.5, 3), rnd(0.5, 5)],
      }),
    );
  }

  // 15 passaram por impedimento antes de concluir (gargalo real em "Impedimentos")
  for (let i = 0; i < 15; i++) {
    const criadoMsAgo = DIAS(rnd(10, 90));
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: ['backlog', 'progress', 'blocker', 'progress', 'done'],
        tempos: [rnd(4, 30), rnd(10, 40), rnd(24, 96), rnd(10, 40)], // 1-4 dias parado bloqueado
      }),
    );
  }

  // 8 ativos agora em progresso (WIP saudável, bem abaixo do limite de 12)
  for (let i = 0; i < 8; i++) {
    const criadoMsAgo = DIAS(rnd(1, 12));
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: ['todo', 'progress'],
        tempos: [rnd(4, 24)],
      }),
    );
  }

  // 10 ainda no backlog/a fazer, nunca iniciados
  for (let i = 0; i < 10; i++) {
    const criadoMsAgo = DIAS(rnd(1, 20));
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: [pick(['backlog', 'todo'])],
        tempos: [],
      }),
    );
  }

  // 2 bloqueados agora de verdade (blockerMode:'tag' -> card.blocker, não coluna)
  for (let i = 0; i < 2; i++) {
    const criadoMsAgo = DIAS(rnd(3, 15));
    cards.push(
      construirCard({
        criadoMsAgo,
        etapas: ['todo', 'progress'],
        tempos: [rnd(4, 24)],
        blocked: true,
      }),
    );
  }

  return cards; // 240+25+15+8+10+2 = 300
}

function gerarRecorrente(cards) {
  const template = { title: 'Relatório semanal de performance', tag: 'data', tags: ['data', FICTICIO_TAG], desc: 'Consolidado semanal de métricas do squad.' };
  const slug = template.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const recIndexUpdates = {};
  // 10 instâncias semanais nos últimos ~70 dias, todas concluídas rápido (relatório é tarefa curta)
  for (let i = 0; i < 10; i++) {
    const criadoMsAgo = DIAS(7 * i + rnd(0, 1));
    const c = construirCard({
      criadoMsAgo,
      etapas: ['progress', 'done'],
      tempos: [rnd(1, 6)],
    });
    c.title = template.title;
    c.tags = template.tags.slice();
    c.tag = 'data';
    c.recorrenteDe = slug;
    c.recorrenteData = dateOnlyAt(criadoMsAgo);
    recIndexUpdates[slug + '/' + c.recorrenteData] = c.id;
    cards.push(c);
  }
  return { recorrentes: [template], recIndexUpdates };
}

function gerarCampanhas() {
  const nowIso = NOW.toISOString();
  const campDiaPais = {
    id: 'c' + (NOW.getTime() - DIAS(60)) + '_diapais',
    nome: 'Dia dos Pais 2026',
    tipo: 'campanha',
    mote: 'Presente certeiro pra quem não erra',
    tags: ['tag_camp_diapais26', 'tag-diapais'],
    tag: 'tag_camp_diapais26',
    dataInicio: dateOnlyAt(DIAS(60)),
    dataFim: dateOnlyAt(DIAS(30)),
    status: 'concluida',
    mostrarArquivados: 'ativos',
    tema: 'neutro',
    multiSquad: false,
    squads: [SQUAD_ID],
    criadoEm: isoAt(DIAS(61)),
    criadoPor: 'Agente Ágil (dado simulado)',
    atualizadoEm: isoAt(DIAS(29)),
    entradas: {
      e1: { id: 'e1', tipo: 'resultado', titulo: 'Fechamento de campanha', corpo: 'Campanha encerrada dentro do prazo, entregas de mídia paga e e-mail concluídas.', links: [], autor: 'Agente Ágil (dado simulado)', autorUid: '', ts: isoAt(DIAS(29)), _squad: SQUAD_ID },
    },
  };
  const campColecao = {
    id: 'c' + (NOW.getTime() - DIAS(20)) + '_colecao',
    nome: 'Coleção P/V 2027',
    tipo: 'colecao',
    mote: 'Leveza pra estação nova',
    tags: ['tag_col_pv2027'],
    tag: 'tag_col_pv2027',
    dataInicio: dateOnlyAt(DIAS(20)),
    dataFim: dateOnlyAt(DIAS(-40)), // termina no futuro (ainda em andamento)
    status: 'ativa',
    mostrarArquivados: 'ativos',
    tema: 'neutro',
    multiSquad: false,
    squads: [SQUAD_ID],
    criadoEm: isoAt(DIAS(21)),
    criadoPor: 'Agente Ágil (dado simulado)',
    atualizadoEm: nowIso,
    entradas: {
      e1: { id: 'e1', tipo: 'aprendizado', titulo: 'Briefing aprovado', corpo: 'Direção de arte aprovada pelo time de marketing, produção de fotos iniciada.', links: [], autor: 'Agente Ágil (dado simulado)', autorUid: '', ts: isoAt(DIAS(18)), _squad: SQUAD_ID },
    },
  };
  return [campDiaPais, campColecao];
}

function gerarLembretes() {
  return [
    { id: 'l' + (NOW.getTime() - DIAS(2)), tipo: 'quadro', text: '⏰ Sprint atual termina em breve — revisar cards ainda em "A Fazer".', autor: 'Agente Ágil (dado simulado)', autorUid: '', init: '', ts: isoAt(DIAS(2)) },
    { id: 'l' + (NOW.getTime() - DIAS(5)), tipo: 'po', text: '📋 Validar métricas da campanha "Coleção P/V 2027" com o time de mídia.', autor: 'Agente Ágil (dado simulado)', autorUid: '', init: '', ts: isoAt(DIAS(5)) },
  ];
}

async function main() {
  initializeApp({
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)) : applicationDefault(),
    databaseURL: DATABASE_URL,
  });
  const db = getDatabase();
  const base = `kanban/squads/${SQUAD_ID}/dados`;

  const cardsSnap = await db.ref(`${base}/cards`).get();
  const existentes = cardsSnap.val() || {};
  if (Object.keys(existentes).length > 0) {
    console.error(`squad ${SQUAD_ID} ainda tem ${Object.keys(existentes).length} card(s) — rode o script de arquivamento antes deste, pra não misturar com o histórico simulado.`);
    process.exit(1);
  }

  const cards = gerarCards();
  const { recorrentes, recIndexUpdates } = gerarRecorrente(cards);
  const campanhas = gerarCampanhas();
  const lembretes = gerarLembretes();

  const cardsUpdate = {};
  const cardsUpdatedAtUpdate = {};
  cards.forEach((c) => {
    cardsUpdate[c.id] = c;
    cardsUpdatedAtUpdate[c.id] = c.updatedAt;
  });

  console.log(`Gravando ${cards.length} cards, ${recorrentes.length} template(s) recorrente(s), ${campanhas.length} campanha(s), ${lembretes.length} lembrete(s)...`);

  await db.ref(`${base}/cards`).set(cardsUpdate);
  await db.ref(`${base}/cards_updated_at`).set(cardsUpdatedAtUpdate);
  await db.ref(`${base}/ql_items/recorrentes`).set(recorrentes);
  await db.ref(`${base}/recorrentes_index`).update(recIndexUpdates);
  for (const camp of campanhas) {
    await db.ref(`kanban/campanhas/${camp.id}`).set(camp);
  }
  for (const lem of lembretes) {
    await db.ref(`${base}/lembretes/${lem.id}`).set(lem);
  }

  const ativosProgress = cards.filter((c) => c.col === 'progress' && !c.archived).length;
  const bloqueadosAgora = cards.filter((c) => c.blocker && !c.archived).length;
  console.log('--- Resumo ---');
  console.log('Cards em "Em Progresso" agora:', ativosProgress, '(limite: 12)');
  console.log('Bloqueados agora:', bloqueadosAgora);
  console.log('Arquivados (concluídos há mais de', ARCHIVE_CUTOFF_DIAS, 'dias):', cards.filter((c) => c.archived).length);
  console.log('Concluídos ativos (não arquivados):', cards.filter((c) => c.flow.doneAt && !c.archived).length);
  console.log('Pronto. Rode o dryRun de visao_board de novo pra ver a leitura.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao gerar histórico:', err);
  process.exit(1);
});
