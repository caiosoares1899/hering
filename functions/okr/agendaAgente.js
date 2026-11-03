// functions/okr/agendaAgente.js
//
// 🗓️ Subagente de AGENDA no agente do Radar (2026-11-03). Orquestra o calendário de gestão do Digital por conversa: marcar reunião, criar/remarcar/excluir entrega,
// mudar a situação de uma entrega e cobrar os responsáveis.
// REGRA DE OURO: o agente NUNCA grava no calendário. Cada ferramenta só PREPARA uma proposta (kanban/okr/agenda_propostas/{id}, status 'pendente') e a pessoa
// confirma com 1 clique no cartão que aparece sob a resposta do agente no chat (okr-dev.html aplica pelos mesmos caminhos da tela, com as mesmas permissões e
// os mesmos avisos no sino). Motivo: uma data alucinada numa reunião recorrente dispararia notificação pra dezenas de pessoas na hora.
//
//   propor_agenda_evento — acao: criar | editar | excluir | mudar_situacao
//   propor_cobranca      — cobrar agora os responsáveis de uma entrega (sino + push, tipo okr_cobranca); 1 cobrança manual por entrega a cada 48 h
//
// Permissão (espelho do cliente): criar/editar/excluir = ADM, ou PO/Organizador/🎯 Gestor OKR da torre do evento (agenda global só ADM);
// mudar_situacao = isso OU um dos responsáveis (convidados) da entrega.

const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { isAdmUid, canCreateObjetivo, torreValida, TORRE_PADRAO, torreAtiva, TORRES } = require('./agenteHelpers');
const cal = require('./calendario');

const PROPOSTAS = 'kanban/okr/agenda_propostas';
const COOLDOWN_COBRANCA_MS = 48 * 3600000;
const VALIDADE_PROPOSTA_MS = 30 * 86400000;   // propostas antigas são limpas quando uma nova nasce
const TIPOS = ['reuniao', 'evento', 'lembrete', 'entrega'];
const MACROS = ['plan', 'check', 'do', 'engajamento'];
const STATUS = ['a_fazer', 'andamento', 'entregue'];
const REPETICOES = {
  nenhuma: null,
  semanal: { tipo: 'semanal', unidade: 'semana', intervalo: 1 },
  quinzenal: { tipo: 'quinzenal', unidade: 'semana', intervalo: 2 },
  mensal: { tipo: 'mensal', unidade: 'mes', intervalo: 1 },
  trimestral: { tipo: 'trimestral', unidade: 'mes', intervalo: 3 },
  semestral: { tipo: 'semestral', unidade: 'mes', intervalo: 6 },
  anual: { tipo: 'anual', unidade: 'ano', intervalo: 1 },
};
const ROTULO_TIPO = { reuniao: 'Reunião', evento: 'Evento', lembrete: 'Lembrete', entrega: 'Entrega' };
const ROTULO_STATUS = { a_fazer: 'A fazer', andamento: 'Em andamento', entregue: 'Entregue' };
const data = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD');
const hora = () => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM');

const propostaEventoSchema = z.object({
  acao: z.enum(['criar', 'editar', 'excluir', 'mudar_situacao']).describe('criar = evento novo; editar/excluir/mudar_situacao precisam de evento_id (pegue em listar_agenda).'),
  evento_id: z.string().min(1).optional(),
  titulo: z.string().min(1).max(120).optional(),
  tipo: z.enum(TIPOS).optional().describe('reuniao, evento, lembrete ou entrega (prazo com responsáveis e situação).'),
  data: data().optional().describe('Data do evento, ou o PRAZO se for entrega.'),
  hora_inicio: hora().optional(), hora_fim: hora().optional(),
  dia_inteiro: z.boolean().optional().describe('Entrega e lembrete sem hora = dia inteiro.'),
  macro: z.enum([...MACROS, 'nenhuma']).optional().describe('Macro da gestão: plan, check, do, engajamento (ou nenhuma pra limpar).'),
  situacao: z.enum(STATUS).optional().describe('Só entrega: a_fazer, andamento ou entregue.'),
  plano_pai_id: z.string().optional().describe('Só entrega: id da entrega-plano maior à qual esta pertence ("" pra soltar).'),
  responsaveis: z.array(z.string().min(2)).max(20).optional().describe('Nomes (ou e-mails) de quem entrega/participa. A lista SUBSTITUI a atual. Nome ambíguo ou desconhecido volta como erro — pergunte à pessoa.'),
  repeticao: z.enum(Object.keys(REPETICOES)).optional().describe('Só reunião/evento/lembrete (entrega não repete).'),
  repetir_ate: data().optional(),
  local: z.string().max(120).optional(), link: z.string().max(400).optional(), descricao: z.string().max(4000).optional(),
  torre: z.enum(TORRES).optional().describe('Agenda do evento novo (sem informar, vale a torre da pessoa que pediu).'),
}).strict();

const propostaCobrancaSchema = z.object({
  evento_id: z.string().min(1),
  mensagem: z.string().max(300).optional().describe('Texto da cobrança (curto, cordial). Sem ele, vai o texto padrão com título e prazo.'),
}).strict();

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const dataBR = (d) => String(d || '').split('-').reverse().join('/');
const novoId = () => 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function nomeDe(db, uid) {
  const [pub, usu] = await Promise.all([db.ref('kanban/usuarios_publicos/' + uid + '/nome').get(), db.ref('kanban/usuarios/' + uid + '/nome').get()]);
  return pub.val() || usu.val() || 'alguém';
}

// "Fulana", "fulana silva" ou e-mail → uid. Exatamente 1 acerto, senão erro com as opções (nunca chuta).
async function resolverPessoas(db, termos) {
  const pub = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const gente = Object.entries(pub).filter(([, p]) => p && p.nome).map(([uid, p]) => ({ uid, nome: p.nome, email: String(p.email || '').toLowerCase() }));
  const uids = [], nomes = [];
  for (const t of termos) {
    const q = semAcento(t);
    let achados = gente.filter((g) => g.email === q || semAcento(g.nome) === q);
    if (!achados.length) achados = gente.filter((g) => semAcento(g.nome).includes(q) || g.email.startsWith(q + '@'));
    if (achados.length === 0) return { erro: { error: 'pessoa_nao_encontrada', message: `Não achei ninguém chamado "${t}". Peça o nome completo ou o e-mail.` } };
    if (achados.length > 1) return { erro: { error: 'pessoa_ambigua', message: `"${t}" pode ser: ${achados.slice(0, 6).map((a) => a.nome).join(', ')}. Pergunte qual.` } };
    if (!uids.includes(achados[0].uid)) { uids.push(achados[0].uid); nomes.push(achados[0].nome); }
  }
  return { uids, nomes };
}

// o que a pessoa pode fazer neste evento (espelho de _okrCalPodeCriar/_okrCalPodeEditar/_okrCalPodeStatus do cliente)
async function podeNaAgenda(db, uid, torre) {
  if (await isAdmUid(db, uid)) return true;
  return !!torre && torreValida(torre) && canCreateObjetivo(db, uid, torre);   // ADM já saiu acima; aqui é PO/Organizador/Gestor OKR da torre
}

const quando = (ev) => `${dataBR(ev.data)}${ev.diaInteiro ? ' (dia todo)' : ev.hi ? ' ' + ev.hi + (ev.hf ? '–' + ev.hf : '') : ''}`;
const respTxt = (nomes) => (nomes && nomes.length ? nomes.join(', ') : 'sem responsável');
const resumoEvento = (ev, nomes, rotuloRec) => `**${ROTULO_TIPO[ev.tipo] || 'Evento'}: ${ev.titulo}** — ${quando(ev)}${rotuloRec ? ' · repete ' + rotuloRec : ''}${ev.tipo === 'entrega' ? ` · ${ROTULO_STATUS[ev.status] || 'A fazer'}` : ''}${ev.macro ? ' · ' + ev.macro.toUpperCase() : ''} · ${ev.tipo === 'entrega' ? 'responsáveis' : 'convidados'}: ${respTxt(nomes)}`;

async function gravarProposta(db, p) {
  const ref = db.ref(PROPOSTAS).push();
  await ref.set({ ...p, id: ref.key, status: 'pendente', ts: new Date().toISOString() });
  // limpeza oportunista das antigas (a lista é pequena; nunca derruba a proposta nova)
  try {
    const todas = (await db.ref(PROPOSTAS).get()).val() || {};
    const corte = Date.now() - VALIDADE_PROPOSTA_MS;
    await Promise.all(Object.entries(todas).filter(([id, x]) => id !== ref.key && x && x.ts && new Date(x.ts).getTime() < corte).map(([id]) => db.ref(`${PROPOSTAS}/${id}`).remove()));
  } catch (e) { /* noop */ }
  return ref.key;
}

function makeProporEventoHandler({ db, requestingUid, dryRun, coletor }) {
  return async (input) => {
    const parsed = propostaEventoSchema.safeParse(input || {});
    if (!parsed.success) return { ok: false, error: 'entrada_invalida', message: parsed.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ') };
    const inp = parsed.data;
    if (dryRun) return { ok: true, dryRun: true, tool: 'propor_agenda_evento', wouldHaveExecuted: inp };
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const eventos = (await db.ref('kanban/okr/calendario/eventos').get()).val() || {};
    const antigo = inp.evento_id ? eventos[inp.evento_id] : null;
    if (inp.acao !== 'criar') {
      if (!inp.evento_id) return { ok: false, error: 'evento_id_obrigatorio', message: 'Diga qual evento (use listar_agenda pra achar o id).' };
      if (!antigo || !torreAtiva(antigo.torre)) return { ok: false, error: 'evento_nao_encontrado', message: `Nenhum evento com id "${inp.evento_id}".` };
    }
    const nomeQuem = await nomeDe(db, requestingUid);
    const base = { acao: inp.acao, porUid: requestingUid, porNome: nomeQuem };

    // ── mudar_situacao ──
    if (inp.acao === 'mudar_situacao') {
      if (antigo.tipo !== 'entrega') return { ok: false, error: 'so_entrega', message: 'Só entrega tem situação (a fazer / em andamento / entregue).' };
      if (!inp.situacao) return { ok: false, error: 'situacao_obrigatoria', message: 'Informe a situação: a_fazer, andamento ou entregue.' };
      const resp = cal.convidadosDe(antigo);
      if (!resp.includes(requestingUid) && !(await podeNaAgenda(db, requestingUid, antigo.torre || ''))) return { ok: false, error: 'sem_permissao', message: 'Só quem é responsável pela entrega, ou ADM/organizador da agenda, muda a situação.' };
      const resumo = `**Entrega: ${antigo.titulo}** — situação **${ROTULO_STATUS[antigo.status] || 'A fazer'} → ${ROTULO_STATUS[inp.situacao]}**`;
      const id = await gravarProposta(db, { ...base, eventoId: antigo.id || inp.evento_id, situacao: inp.situacao, resumo });
      coletor.push(id);
      return { ok: true, proposta_id: id, resumo, proximo_passo: 'Diga à pessoa que a proposta está pronta no cartão abaixo da sua resposta e que ela confirma com ✅. NÃO diga que já mudou.' };
    }

    // ── excluir ──
    if (inp.acao === 'excluir') {
      if (!(await podeNaAgenda(db, requestingUid, antigo.torre || ''))) return { ok: false, error: 'sem_permissao', message: 'Só ADM, ou PO/Organizador/Gestor OKR da torre da agenda, exclui evento.' };
      const rec = cal.recTexto(antigo);
      const resumo = `**Excluir ${ROTULO_TIPO[antigo.tipo] || 'evento'}: ${antigo.titulo}** — ${quando(antigo)}${rec ? ` · ${rec} (a série inteira)` : ''}`;
      const id = await gravarProposta(db, { ...base, eventoId: inp.evento_id, resumo });
      coletor.push(id);
      return { ok: true, proposta_id: id, resumo, proximo_passo: 'Avise que a exclusão só acontece quando a pessoa confirmar no cartão (✅). NÃO diga que já excluiu.' };
    }

    // ── criar / editar: monta o evento final ──
    const tipo = inp.tipo || (antigo && antigo.tipo) || null;
    if (!tipo) return { ok: false, error: 'tipo_obrigatorio', message: 'Qual o tipo: reunião, evento, lembrete ou entrega?' };
    const titulo = (inp.titulo || (antigo && antigo.titulo) || '').trim();
    const dt = inp.data || (antigo && antigo.data) || '';
    if (!titulo) return { ok: false, error: 'titulo_obrigatorio', message: 'Qual o título?' };
    if (!dt) return { ok: false, error: 'data_obrigatoria', message: tipo === 'entrega' ? 'Qual o prazo (data)?' : 'Qual a data?' };
    if (inp.acao === 'criar' && dt < hoje) return { ok: false, error: 'data_no_passado', message: `${dataBR(dt)} já passou. Confirme a data com a pessoa.` };
    if (tipo === 'entrega' && inp.repeticao && inp.repeticao !== 'nenhuma') return { ok: false, error: 'entrega_nao_repete', message: 'Entrega não repete — crie uma por trimestre/coleção.' };
    const torre = inp.acao === 'criar' ? (inp.torre !== undefined ? inp.torre : TORRE_PADRAO) : (antigo.torre || '');
    if (!torreAtiva(torre) && torre) return { ok: false, error: 'torre_inativa', message: 'Essa torre não está ativa no Radar.' };
    if (!(await podeNaAgenda(db, requestingUid, torre))) return { ok: false, error: 'sem_permissao', message: torre ? 'Só ADM, ou PO/Organizador/Gestor OKR dessa torre, cria ou edita evento.' : 'A agenda global é só do ADM.' };

    let convidados = antigo ? cal.convidadosDe(antigo) : [], nomes = null;
    if (inp.responsaveis) {
      const r = await resolverPessoas(db, inp.responsaveis);
      if (r.erro) return { ok: false, ...r.erro };
      convidados = r.uids; nomes = r.nomes;
    }
    if (!nomes) nomes = await Promise.all(convidados.map((u) => nomeDe(db, u)));

    let diaInteiro = inp.dia_inteiro !== undefined ? inp.dia_inteiro : (antigo ? !!antigo.diaInteiro : (tipo === 'entrega' || (!inp.hora_inicio && tipo === 'lembrete')));
    let hi = inp.hora_inicio !== undefined ? inp.hora_inicio : (antigo ? antigo.hi || '' : ''), hf = inp.hora_fim !== undefined ? inp.hora_fim : (antigo ? antigo.hf || '' : '');
    if (tipo === 'entrega') diaInteiro = true;
    if (!diaInteiro && !hi) return { ok: false, error: 'hora_obrigatoria', message: 'Qual o horário de início (ou é dia inteiro)?' };
    if (!diaInteiro && hf && hf <= hi) return { ok: false, error: 'hora_invalida', message: 'O fim precisa ser depois do início.' };
    if (diaInteiro) { hi = ''; hf = ''; }

    let rec = antigo ? cal.recNorm(antigo) : null, rotuloRec = '';
    if (inp.repeticao !== undefined) {
      const r = REPETICOES[inp.repeticao];
      rec = r ? { ...r, ate: inp.repetir_ate || '' } : null;
      if (rec && rec.ate && rec.ate < dt) return { ok: false, error: 'fim_antes_do_inicio', message: 'O fim da repetição é antes da data do evento.' };
    } else if (rec && inp.repetir_ate !== undefined) rec = { ...rec, ate: inp.repetir_ate };
    if (tipo === 'entrega') rec = null;
    if (rec) rotuloRec = cal.recTexto({ rec });

    let paiId = inp.plano_pai_id !== undefined ? inp.plano_pai_id : (antigo && antigo.paiId) || '';
    if (tipo === 'entrega' && paiId) {
      const pai = eventos[paiId];
      if (!pai || pai.tipo !== 'entrega' || pai.paiId || paiId === inp.evento_id) return { ok: false, error: 'plano_pai_invalido', message: 'O plano maior precisa ser uma entrega que não faça parte de outro plano.' };
    }
    const macro = inp.macro !== undefined ? (inp.macro === 'nenhuma' ? '' : inp.macro) : (antigo && antigo.macro) || '';
    const ts = new Date().toISOString();
    const id = antigo ? inp.evento_id : novoId();
    const ev = {
      id, titulo, tipo, data: dt, diaInteiro: !!diaInteiro, hi, hf, torre: torre || '',
      areaIds: antigo ? cal.lista(antigo.areaIds) : [], objetivoIds: antigo ? cal.lista(antigo.objetivoIds) : [], tagIds: antigo ? cal.lista(antigo.tagIds) : [],
      convidados, lembrar: (antigo && antigo.lembrar) || { vespera: tipo !== 'lembrete', dia: true },
      local: inp.local !== undefined ? inp.local.trim() : (antigo && antigo.local) || '', link: inp.link !== undefined ? inp.link.trim() : (antigo && antigo.link) || '',
      descricao: inp.descricao !== undefined ? inp.descricao.trim() : (antigo && antigo.descricao) || '',
      rec, excecoes: (antigo && antigo.excecoes) || {}, macro,
      ...(tipo === 'entrega' ? { status: inp.situacao || (antigo && antigo.status) || 'a_fazer', paiId: paiId || '' } : {}),
      ...(antigo && antigo.statusPor ? { statusPor: antigo.statusPor, statusEm: antigo.statusEm || '' } : {}),
      ...(antigo && antigo.cadencia ? { cadencia: antigo.cadencia } : {}),
      ...(antigo && antigo.origem ? { origem: antigo.origem } : {}),
      criadoPor: (antigo && antigo.criadoPor) || { uid: requestingUid, nome: nomeQuem }, criadoEm: (antigo && antigo.criadoEm) || ts, atualizadoEm: ts,
    };
    if (ev.link && !/^https:\/\//i.test(ev.link)) return { ok: false, error: 'link_invalido', message: 'O link precisa começar com https://' };
    let resumo = resumoEvento(ev, nomes, rotuloRec);
    if (inp.acao === 'editar') {
      const antes = quando(antigo);
      resumo = `**Editar** — ${resumo}` + (antes !== quando(ev) ? ` (era ${antes})` : '') + (cal.recNorm(antigo) ? ' · vale pra série inteira' : '');
    } else resumo = `**Criar** — ${resumo}`;
    const idProp = await gravarProposta(db, { ...base, eventoId: id, ev, baseEm: antigo ? antigo.atualizadoEm || '' : '', resumo });
    coletor.push(idProp);
    return { ok: true, proposta_id: idProp, resumo, proximo_passo: 'Diga à pessoa, em 1–2 frases, que a proposta está pronta no cartão abaixo da sua resposta e que ela confirma com ✅ (ou descarta). NÃO diga que já criou/alterou.' };
  };
}

function makeProporCobrancaHandler({ db, requestingUid, dryRun, coletor }) {
  return async (input) => {
    const parsed = propostaCobrancaSchema.safeParse(input || {});
    if (!parsed.success) return { ok: false, error: 'entrada_invalida', message: parsed.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ') };
    const inp = parsed.data;
    if (dryRun) return { ok: true, dryRun: true, tool: 'propor_cobranca', wouldHaveExecuted: inp };
    const ev = (await db.ref('kanban/okr/calendario/eventos/' + inp.evento_id).get()).val();
    if (!ev || !torreAtiva(ev.torre)) return { ok: false, error: 'evento_nao_encontrado', message: `Nenhuma entrega com id "${inp.evento_id}".` };
    if (ev.tipo !== 'entrega') return { ok: false, error: 'so_entrega', message: 'Só entrega tem responsável pra cobrar.' };
    if (ev.status === 'entregue') return { ok: false, error: 'ja_entregue', message: 'Essa entrega já está marcada como entregue.' };
    const resp = cal.convidadosDe(ev);
    if (!resp.length) return { ok: false, error: 'sem_responsavel', message: 'Essa entrega não tem responsável — defina quem entrega antes de cobrar.' };
    if (!(await podeNaAgenda(db, requestingUid, ev.torre || '')) && !(ev.criadoPor && ev.criadoPor.uid === requestingUid)) return { ok: false, error: 'sem_permissao', message: 'Só ADM, organizador da agenda ou quem criou a entrega cobra.' };
    const todas = (await db.ref(PROPOSTAS).get()).val() || {};
    const recente = Object.values(todas).find((p) => p && p.acao === 'cobrar' && p.eventoId === inp.evento_id && p.status === 'confirmada' && p.em && Date.now() - new Date(p.em).getTime() < COOLDOWN_COBRANCA_MS);
    if (recente) return { ok: false, error: 'cobranca_recente', message: `Essa entrega já foi cobrada há menos de 48 h (por ${recente.porNome || 'alguém'}). Espere um pouco pra não virar spam.` };
    const nomes = await Promise.all(resp.map((u) => nomeDe(db, u)));
    const nomeQuem = await nomeDe(db, requestingUid);
    const mensagem = (inp.mensagem || `Oi! Como está "${ev.titulo}"? O prazo é ${dataBR(ev.data)}${ev.data < new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) ? ' (já passou)' : ''}. Se já entregou, marque como Entregue no Radar.`).trim();
    const resumo = `**Cobrar: ${ev.titulo}** (prazo ${dataBR(ev.data)}) — para ${nomes.join(', ')}: “${mensagem}”`;
    const id = await gravarProposta(db, { acao: 'cobrar', porUid: requestingUid, porNome: nomeQuem, eventoId: inp.evento_id, eventoData: ev.data, uids: resp, mensagem, resumo });
    coletor.push(id);
    return { ok: true, proposta_id: id, resumo, proximo_passo: 'Diga que a cobrança está pronta no cartão abaixo da sua resposta e só sai quando a pessoa confirmar (✅). NÃO diga que já enviou.' };
  };
}

// Defs das ferramentas (mesmo formato de buildOkrTools). `coletor` = array compartilhado com o `responder`, que anexa os ids das propostas à mensagem.
function buildAgendaTools({ mode, db, requestingUid, dryRun, coletor, fake }) {
  const real = mode === 'real';
  return [
    {
      name: 'propor_agenda_evento',
      description: 'PROPÕE uma mudança no calendário (você NUNCA grava direto — a pessoa confirma com 1 clique num cartão sob a sua resposta). acao: "criar" (reunião/evento/lembrete/entrega novos), "editar" (qualquer campo; evento_id vem de listar_agenda), "excluir" ou "mudar_situacao" (só entrega: a_fazer/andamento/entregue). Entrega = prazo (data) + responsaveis (nomes) + situação, não repete; pode ter macro (plan, check, do, engajamento) e plano_pai_id. Reunião precisa de hora_inicio (ou dia_inteiro). NUNCA invente data, hora ou responsável: se faltar, pergunte; nome ambíguo volta como erro. Depois de chamar, conte em 1–2 frases o que você preparou e peça pra confirmar no cartão.',
      input_schema: zodToJsonSchema(propostaEventoSchema),
      handler: real ? makeProporEventoHandler({ db, requestingUid, dryRun, coletor }) : fake('propor_agenda_evento'),
    },
    {
      name: 'propor_cobranca',
      description: 'PROPÕE cobrar agora os responsáveis de uma ENTREGA aberta (notificação no sino + push). A pessoa confirma no cartão sob a sua resposta. Limite: 1 cobrança manual por entrega a cada 48 h; sem responsável não dá. mensagem é opcional (curta e cordial). Use quando pedirem "cobra o fulano", "cobra os atrasados" (uma proposta por entrega — veja os atrasos em listar_agenda com so_atrasadas).',
      input_schema: zodToJsonSchema(propostaCobrancaSchema),
      handler: real ? makeProporCobrancaHandler({ db, requestingUid, dryRun, coletor }) : fake('propor_cobranca'),
    },
  ];
}

module.exports = { buildAgendaTools, propostaEventoSchema, propostaCobrancaSchema, resolverPessoas, PROPOSTAS, COOLDOWN_COBRANCA_MS, REPETICOES };
