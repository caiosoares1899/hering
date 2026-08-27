// functions/agente-agil-orquestrador/agenteLog.js
//
// Histórico do Agente Ágil, por squad — pedido direto do usuário: "quero
// uma area q guarde todas as alterações nos cards que ele faça naquela
// squad, para servir de historico para o PO... pode ate gravar quem
// pediu, se for o caso, ou se foi autonomo". Escrito num ponto só
// (mentionTrigger.js:processarMencao(), depois que runLoop() termina) —
// cobre os 3 gatilhos que existem hoje (@menção manual, Automação, scan
// diário de vencidos), já que todos passam pela mesma rota (escrevem um
// comentário @Agente Ágil real, ver dueOverdueTrigger.js /
// AUTO_ACTIONS.notify_agent no client).
//
// Path: kanban/squads/{squadId}/dados/agente_log/{logId}. Guarda só
// `cardId` (não título) — o cliente já tem `cards` em memória e resolve o
// título na hora de renderizar; evita 1 leitura extra do Firebase por
// interação do agente só pra duplicar um dado que o cliente já tem.
// Lido pelo client em kanban-dev.html (aba "🤖 Histórico do Agente"
// dentro de Configurações — mesmo gate de PO/Organizador/ADM de todo o
// resto do painel de Configurações, não precisa de checagem própria).
//
// Sem cap/retenção por enquanto (mesmo espírito de outras listas deste
// repo — comentários, notificações — que também crescem sem poda ativa):
// é um log de baixo volume (1 entrada por interação do agente que muda
// algo de verdade, não por tool call), e o cliente só lê os N mais
// recentes. Revisitar se algum dia virar problema real de custo.

const AUTOMACAO_UID = 'automacao';

function truncate(s, max) {
  if (s == null) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// Tools que de fato mudam algo persistido no card — ler_card/visao_board/
// biblioteca_agil são só leitura, ficam fora do log ("todas as
// alterações", não "tudo que o agente fez").
const MUTATING_TOOLS = new Set([
  'comentario',
  'link',
  'relatorio_html',
  'checklist_item',
  'agent_status',
  'mover_coluna',
  'editar_campos',
  'perguntar_humano',
]);

// Frase curta em português, sem jargão técnico — pro PO ler o histórico
// sem precisar entender o payload bruto de cada ferramenta.
function resumirAcaoLegivel(call) {
  const input = call.input || {};
  switch (call.name) {
    case 'mover_coluna':
      return `moveu para a coluna "${input.coluna}"`;
    case 'editar_campos': {
      const campos = Object.keys(input).filter((k) => input[k] !== undefined && input[k] !== null && input[k] !== '');
      return campos.length ? `editou: ${campos.join(', ')}` : 'editou campos do card';
    }
    case 'checklist_item':
      return `${input.done ? 'marcou' : 'desmarcou'} item do checklist: "${truncate(input.item, 60)}"`;
    case 'agent_status':
      return `atualizou status do agente: ${input.status}`;
    case 'comentario':
      return `comentou: "${truncate(input.texto, 120)}"`;
    case 'link':
      return `adicionou um link${input.label ? ': ' + truncate(input.label, 60) : ''}`;
    case 'relatorio_html':
      return 'gerou um relatório';
    case 'perguntar_humano':
      return `perguntou: "${truncate(input.pergunta, 120)}"`;
    default:
      return call.name;
  }
}

// Achata result.steps (ver loop.js) numa lista de frases legíveis, só das
// ações que de fato mudaram algo (ignora leitura, dryRun e falha).
function coletarAcoesAgente(steps) {
  const acoes = [];
  for (const step of steps || []) {
    for (const call of step.toolCalls || []) {
      if (!MUTATING_TOOLS.has(call.name)) continue;
      if (call.output && call.output.dryRun) continue; // simulação não é alteração real
      if (call.output && call.output.ok === false) continue; // falhou, nada mudou de fato
      acoes.push(resumirAcaoLegivel(call));
    }
  }
  return acoes;
}

// `acoes` já vem pronta (coletarAcoesAgente(result.steps) + qualquer ação
// extra que o chamador precise emendar — ex.: o fallback de comentario em
// mentionTrigger.js, que não passa por result.steps, ver comentário lá).
async function registrarLogAgente(db, { squadId, cardId, comment, acoes }) {
  if (!acoes || !acoes.length) return; // nada mudou de fato — não polui o histórico

  const autonomous = !comment || comment.uid === AUTOMACAO_UID;
  const entry = {
    id: 'log' + Date.now() + Math.random().toString(36).slice(2, 7),
    ts: new Date().toISOString(),
    cardId,
    autonomous,
    requestedBy: autonomous ? null : { uid: comment.uid, name: comment.author || comment.init || comment.uid, init: comment.init || '' },
    pedido: comment ? truncate(comment.text, 300) : null,
    acoes,
  };
  await db.ref(`kanban/squads/${squadId}/dados/agente_log/${entry.id}`).set(entry);
  return entry;
}

module.exports = { resumirAcaoLegivel, coletarAcoesAgente, registrarLogAgente, AUTOMACAO_UID };
