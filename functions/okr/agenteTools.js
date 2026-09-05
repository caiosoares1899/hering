// functions/okr/agenteTools.js
//
// Vocabulário de ferramentas do Agente Ágil no domínio OKR (Objetivos/
// Marcos, kanban/okr/*) — mesmo motor (loop.js/runLoop) e mesmo padrão
// fake/real de functions/agente-agil-orquestrador/tools/, mas um toolset
// TOTALMENTE novo: o orquestrador de card não tem nenhuma noção de
// Objetivo/Marco (confirmado antes de começar — README/systemPrompt.js só
// falam de card/board), então nada é reaproveitado além do MOTOR.
//
// Permissão replica a MESMA regra client-side (_okrCanEdit()/
// _okrCanCreate() em painel.html): ADM (kanban/config/adm_emails) pode
// criar Objetivo novo; ADM ou Responsável do Objetivo pode editá-lo/
// adicionar Marco. `requestingUid` (quem mandou a mensagem no chat) é
// resolvido UMA VEZ ao montar o toolset — nunca um campo que o próprio
// modelo preenche, senão ele poderia "se autorizar".
//
// Campos de lista (Indicadores/Progressos/Próximos Passos/Riscos/Planos de
// Ação) só ADICIONAM item — nunca substituem a lista inteira. Mais simples
// e mais seguro: "ajudar a preencher" é sobre somar conteúdo, não sobre
// reescrever o que já tinha (evita perda de dado por um pedido ambíguo).

const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { resolveObjetivo, canEditObjetivo, isAdmUid, pushHistory, notifyObjetivoEditado } = require('./agenteHelpers');

const OKR_GERENCIA_IDS = ['geral', 'comercial', 'performance', 'dadosia', 'cx', 'tech', 'crm'];
const OKR_STATUS_IDS = ['nao_iniciado', 'no_prazo', 'risco', 'atrasado', 'concluido'];
const listaDeTexto = () => z.array(z.string().min(1)).max(20).optional();

// ── Schemas ──────────────────────────────────────────────────────────────

const listarObjetivosSchema = z.object({
  area_id: z.enum(OKR_GERENCIA_IDS).optional(),
});

const lerObjetivoSchema = z.object({
  objetivo_id: z.string().min(1).optional(),
  titulo: z.string().min(1).optional(),
});

const criarObjetivoSchema = z.object({
  titulo: z.string().min(1),
  area_id: z.enum(OKR_GERENCIA_IDS),
  pilar: z.string().min(1).optional(),
  descricao: z.string().min(1).optional(),
  trimestres: z.array(z.string().min(1)).max(6).optional(),
  indicadores: listaDeTexto(),
});

const editarCamposOkrSchema = z.object({
  objetivo_id: z.string().min(1).optional(),
  titulo_objetivo: z.string().min(1).optional(),
  novo_titulo: z.string().min(1).optional(),
  area_id: z.enum(OKR_GERENCIA_IDS).optional(),
  pilar: z.string().min(1).optional(),
  descricao: z.string().min(1).optional(),
  trimestres_adicionar: z.array(z.string().min(1)).max(6).optional(),
  indicadores_adicionar: listaDeTexto(),
  progressos_adicionar: listaDeTexto(),
  proximos_passos_adicionar: listaDeTexto(),
  riscos_adicionar: listaDeTexto(),
  planos_acao_adicionar: listaDeTexto(),
});

const criarMarcoSchema = z.object({
  objetivo_id: z.string().min(1).optional(),
  titulo_objetivo: z.string().min(1).optional(),
  nome: z.string().min(1),
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'prazo deve estar no formato YYYY-MM-DD')
    .optional(),
  progresso: z.enum(OKR_STATUS_IDS).optional(),
});

const editarMarcoSchema = z.object({
  marco_id: z.string().min(1).optional(),
  objetivo_id: z.string().min(1).optional(),
  titulo_objetivo: z.string().min(1).optional(),
  nome_marco: z.string().min(1).optional(),
  novo_nome: z.string().min(1).optional(),
  progresso: z.enum(OKR_STATUS_IDS).optional(),
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'prazo deve estar no formato YYYY-MM-DD')
    .optional(),
});

const responderSchema = z.object({
  texto: z.string().min(1),
});

// ── Handlers fake (simulação, nunca tocam o Firebase) ───────────────────

function fake(name) {
  return async (input) => ({ ok: true, simulated: true, tool: name, wouldHaveExecuted: input });
}

// ── Handlers reais ───────────────────────────────────────────────────────

function makeListarObjetivosHandler({ db }) {
  return async (input) => {
    const snap = await db.ref('kanban/okr/objetivos').get();
    const todos = snap.val() || {};
    let ativos = Object.entries(todos).filter(([, o]) => o && !o.arquivado);
    if (input?.area_id) ativos = ativos.filter(([, o]) => o.areaId === input.area_id);
    const lista = ativos.map(([id, o]) => ({
      id,
      titulo: o.titulo || '',
      area_id: o.areaId || 'geral',
      trimestres: Array.isArray(o.trimestres) && o.trimestres.length ? o.trimestres : o.trimestre ? [o.trimestre] : [],
      pilar: o.pilar || '',
    }));
    return { ok: true, total: lista.length, objetivos: lista };
  };
}

function makeLerObjetivoHandler({ db }) {
  return async (input) => {
    const resolved = await resolveObjetivo(db, input);
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id, objetivo: o } = resolved;
    const marcosSnap = await db.ref('kanban/okr/marcos').get();
    const marcos = Object.entries(marcosSnap.val() || {})
      .filter(([, m]) => m && m.objetivoId === id && !m.arquivado)
      .map(([mid, m]) => ({ id: mid, nome: m.nome || '', progresso: m.progresso || 'nao_iniciado', prazo: m.prazo || '' }));
    return {
      ok: true,
      id,
      titulo: o.titulo || '',
      area_id: o.areaId || 'geral',
      pilar: o.pilar || '',
      descricao: o.descricao || '',
      trimestres: Array.isArray(o.trimestres) && o.trimestres.length ? o.trimestres : o.trimestre ? [o.trimestre] : [],
      indicadores: o.indicadores || [],
      progressos: o.progressos || [],
      proximos_passos: o.proximosPassos || [],
      riscos: o.riscos || [],
      planos_acao: o.planosAcao || [],
      marcos,
    };
  };
}

function makeCriarObjetivoHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    if (!(await isAdmUid(db, requestingUid))) {
      return { ok: false, error: 'sem_permissao', message: 'Só ADM pode criar um Objetivo novo. Peça pra um ADM criar, ou eu ajudo a preencher um Objetivo que já existe.' };
    }
    if (dryRun) return { ok: true, dryRun: true, tool: 'criar_objetivo', wouldHaveExecuted: input };

    const id = 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const payload = {
      id,
      titulo: input.titulo,
      areaId: input.area_id,
      pilar: input.pilar || '',
      descricao: input.descricao || '',
      trimestres: input.trimestres || [],
      indicadores: input.indicadores || [],
      progressos: [],
      proximosPassos: [],
      riscos: [],
      planosAcao: [],
      responsaveis: [],
      tagIds: [],
      history: [],
      arquivado: false,
      criadoEm: new Date().toISOString(),
      criadoPor: '🤖 Agente Ágil',
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: '🤖 Agente Ágil',
    };
    await db.ref('kanban/okr/objetivos/' + id).set(payload);
    await pushHistory(db, 'kanban/okr/objetivos/' + id, { what: 'criou o Objetivo (via chat com o Agente Ágil)', tipo: 'criado' });
    return { ok: true, dryRun: false, tool: 'criar_objetivo', objetivo_id: id, message: `Objetivo "${input.titulo}" criado.` };
  };
}

function makeEditarCamposOkrHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    const resolved = await resolveObjetivo(db, { objetivo_id: input.objetivo_id, titulo: input.titulo_objetivo });
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id, objetivo } = resolved;
    if (!(await canEditObjetivo(db, requestingUid, objetivo))) {
      return { ok: false, error: 'sem_permissao', message: `Só quem é Responsável por "${objetivo.titulo}" (ou ADM) pode editar esse Objetivo.` };
    }
    if (dryRun) return { ok: true, dryRun: true, tool: 'editar_campos_okr', objetivo_id: id, wouldHaveExecuted: input };

    const patch = {};
    const historicos = [];
    if (input.novo_titulo) { patch.titulo = input.novo_titulo; historicos.push({ what: `alterou o título para "${input.novo_titulo}"`, tipo: 'campo' }); }
    if (input.area_id) { patch.areaId = input.area_id; historicos.push({ what: `alterou a gerência para "${input.area_id}"`, tipo: 'campo' }); }
    if (input.pilar) { patch.pilar = input.pilar; historicos.push({ what: `definiu o pilar estratégico: "${input.pilar}"`, tipo: 'campo' }); }
    if (input.descricao) { patch.descricao = input.descricao; historicos.push({ what: 'alterou a descrição do objetivo', tipo: 'campo' }); }

    const listaCampos = [
      ['trimestres_adicionar', 'trimestres', 'um trimestre/período'],
      ['indicadores_adicionar', 'indicadores', 'um indicador de entrega'],
      ['progressos_adicionar', 'progressos', 'um progresso'],
      ['proximos_passos_adicionar', 'proximosPassos', 'um próximo passo'],
      ['riscos_adicionar', 'riscos', 'um risco'],
      ['planos_acao_adicionar', 'planosAcao', 'um plano de ação'],
    ];
    for (const [inputKey, campo, rotulo] of listaCampos) {
      const novos = input[inputKey];
      if (!novos || !novos.length) continue;
      const atual = campo === 'trimestres' ? (Array.isArray(objetivo.trimestres) && objetivo.trimestres.length ? objetivo.trimestres : objetivo.trimestre ? [objetivo.trimestre] : []) : objetivo[campo] || [];
      const semDuplicar = novos.filter((v) => !atual.includes(v));
      if (!semDuplicar.length) continue;
      patch[campo] = [...atual, ...semDuplicar];
      semDuplicar.forEach((v) => historicos.push({ what: `adicionou ${rotulo}: "${v}"`, tipo: campo === 'trimestres' ? 'campo' : 'lista' }));
    }

    if (!Object.keys(patch).length) return { ok: false, error: 'nada_pra_alterar', message: 'Nenhum campo válido foi informado pra alterar.' };

    patch.atualizadoEm = new Date().toISOString();
    patch.atualizadoPor = '🤖 Agente Ágil';
    await db.ref('kanban/okr/objetivos/' + id).update(patch);
    for (const h of historicos) await pushHistory(db, 'kanban/okr/objetivos/' + id, h);
    await notifyObjetivoEditado(db, id, requestingUid);
    return { ok: true, dryRun: false, tool: 'editar_campos_okr', objetivo_id: id, campos_alterados: Object.keys(patch), message: `Objetivo "${objetivo.titulo}" atualizado.` };
  };
}

function makeCriarMarcoHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    const resolved = await resolveObjetivo(db, { objetivo_id: input.objetivo_id, titulo: input.titulo_objetivo });
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id: objetivoId, objetivo } = resolved;
    if (!(await canEditObjetivo(db, requestingUid, objetivo))) {
      return { ok: false, error: 'sem_permissao', message: `Só quem é Responsável por "${objetivo.titulo}" (ou ADM) pode adicionar Marco nele.` };
    }
    if (dryRun) return { ok: true, dryRun: true, tool: 'criar_marco', objetivo_id: objetivoId, wouldHaveExecuted: input };

    const marcoId = 'marco_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const payload = {
      id: marcoId,
      objetivoId,
      nome: input.nome,
      responsavel: '',
      prazo: input.prazo || '',
      progresso: input.progresso || 'nao_iniciado',
      checklist: [],
      tags: [],
      participantes: [],
      descricao: '',
      history: [{ who: '🤖 Agente Ágil', uid: 'agente-agil', what: 'criou o marco (via chat com o Agente Ágil)', tipo: 'criado', at: new Date().toISOString() }],
      criadoEm: new Date().toISOString(),
      criadoPor: '🤖 Agente Ágil',
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: '🤖 Agente Ágil',
    };
    await db.ref('kanban/okr/marcos/' + marcoId).set(payload);
    await pushHistory(db, 'kanban/okr/objetivos/' + objetivoId, { what: `criou o marco "${input.nome}" (via chat)`, tipo: 'marco' });
    await notifyObjetivoEditado(db, objetivoId, requestingUid);
    return { ok: true, dryRun: false, tool: 'criar_marco', marco_id: marcoId, objetivo_id: objetivoId, message: `Marco "${input.nome}" criado em "${objetivo.titulo}".` };
  };
}

async function resolveMarco(db, { marco_id, objetivo_id, titulo_objetivo, nome_marco }) {
  if (marco_id) {
    const snap = await db.ref('kanban/okr/marcos/' + marco_id).get();
    const m = snap.val();
    if (m && !m.arquivado) return { id: marco_id, marco: m };
    return { error: 'marco_nao_encontrado', message: `Nenhum marco ativo com id "${marco_id}".` };
  }
  const resolvedObj = await resolveObjetivo(db, { objetivo_id, titulo: titulo_objetivo });
  if (resolvedObj.error) return resolvedObj;
  if (!nome_marco) return { error: 'faltou_referencia', message: 'Preciso do marco_id, ou do nome do marco dentro do Objetivo.' };
  const marcosSnap = await db.ref('kanban/okr/marcos').get();
  const todos = marcosSnap.val() || {};
  const alvo = String(nome_marco).toLowerCase().trim();
  const doObjetivo = Object.entries(todos).filter(([, m]) => m && m.objetivoId === resolvedObj.id && !m.arquivado);
  const exatos = doObjetivo.filter(([, m]) => String(m.nome || '').toLowerCase().trim() === alvo);
  if (exatos.length === 1) return { id: exatos[0][0], marco: exatos[0][1], objetivoId: resolvedObj.id, objetivo: resolvedObj.objetivo };
  const parciais = doObjetivo.filter(([, m]) => String(m.nome || '').toLowerCase().includes(alvo));
  if (parciais.length === 1) return { id: parciais[0][0], marco: parciais[0][1], objetivoId: resolvedObj.id, objetivo: resolvedObj.objetivo };
  if (parciais.length > 1) return { error: 'marco_ambiguo', message: `Mais de um marco desse Objetivo bate com "${nome_marco}" — seja mais específico.` };
  return { error: 'marco_nao_encontrado', message: `Nenhum marco ativo de "${resolvedObj.objetivo.titulo}" bate com "${nome_marco}".` };
}

function makeEditarMarcoHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    const resolved = await resolveMarco(db, input);
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id: marcoId, marco } = resolved;
    const objetivoId = marco.objetivoId;
    const objetivoResolved = await resolveObjetivo(db, { objetivo_id: objetivoId });
    if (objetivoResolved.error) return { ok: false, error: objetivoResolved.error, message: objetivoResolved.message };
    if (!(await canEditObjetivo(db, requestingUid, objetivoResolved.objetivo))) {
      return { ok: false, error: 'sem_permissao', message: `Só quem é Responsável por "${objetivoResolved.objetivo.titulo}" (ou ADM) pode editar esse marco.` };
    }
    if (dryRun) return { ok: true, dryRun: true, tool: 'editar_marco', marco_id: marcoId, wouldHaveExecuted: input };

    const patch = {};
    const historicos = [];
    if (input.novo_nome) { patch.nome = input.novo_nome; historicos.push({ what: `renomeou o marco pra "${input.novo_nome}"`, tipo: 'campo' }); }
    if (input.progresso) { patch.progresso = input.progresso; historicos.push({ what: `alterou o status pra "${input.progresso}"`, tipo: 'status' }); }
    if (input.prazo) { patch.prazo = input.prazo; historicos.push({ what: `alterou o prazo pra ${input.prazo}`, tipo: 'campo' }); }
    if (!Object.keys(patch).length) return { ok: false, error: 'nada_pra_alterar', message: 'Nenhum campo válido foi informado pra alterar.' };

    patch.atualizadoEm = new Date().toISOString();
    patch.atualizadoPor = '🤖 Agente Ágil';
    await db.ref('kanban/okr/marcos/' + marcoId).update(patch);
    for (const h of historicos) await pushHistory(db, 'kanban/okr/marcos/' + marcoId, h);
    await pushHistory(db, 'kanban/okr/objetivos/' + objetivoId, { what: `atualizou o marco "${marco.nome}" (via chat)`, tipo: 'marco' });
    await notifyObjetivoEditado(db, objetivoId, requestingUid);
    return { ok: true, dryRun: false, tool: 'editar_marco', marco_id: marcoId, objetivo_id: objetivoId, campos_alterados: Object.keys(patch), message: `Marco "${marco.nome}" atualizado.` };
  };
}

function makeResponderHandler({ db, dryRun }) {
  return async (input) => {
    if (dryRun) return { ok: true, dryRun: true, tool: 'responder', wouldHaveExecuted: input };
    const ref = db.ref('kanban/okr/agente_chat').push();
    await ref.set({
      id: ref.key,
      uid: 'agente-agil',
      author: '🤖 Agente Ágil',
      init: '🤖',
      foto: '',
      text: input.texto,
      ts: new Date().toISOString(),
    });
    return { ok: true, dryRun: false, tool: 'responder', message_id: ref.key };
  };
}

// mode:'fake' (default) — nenhuma ferramenta toca o Firebase, usado por
// teste. mode:'real' — precisa de {db, requestingUid}; dryRun explícito
// (default true), mesma disciplina do orquestrador de card: nunca um
// default escondido pra escrita real.
function buildOkrTools(options = {}) {
  const { mode = 'fake', db, requestingUid, dryRun = true } = options;
  if (mode === 'real' && (!db || !requestingUid)) {
    throw new Error('buildOkrTools({mode:"real"}) precisa de db e requestingUid.');
  }

  const defs = [
    {
      name: 'listar_objetivos',
      description: 'Lista os Objetivos ATIVOS (não arquivados), com id/título/gerência/trimestres/pilar. Aceita area_id opcional pra filtrar por gerência. Use pra descobrir o id de um Objetivo antes de editar/adicionar marco, ou pra responder "quais OKRs a gente tem".',
      input_schema: zodToJsonSchema(listarObjetivosSchema),
      handler: mode === 'real' ? makeListarObjetivosHandler({ db }) : fake('listar_objetivos'),
    },
    {
      name: 'ler_objetivo',
      description: 'Lê um Objetivo específico por id ou por título (busca aproximada) — todos os campos (Objetivo, Indicadores, Progressos, Próximos Passos, Riscos, Planos de Ação) e a lista de Marcos com status/prazo. Use antes de editar, pra saber o que já existe e não repetir conteúdo.',
      input_schema: zodToJsonSchema(lerObjetivoSchema),
      handler: mode === 'real' ? makeLerObjetivoHandler({ db }) : fake('ler_objetivo'),
    },
    {
      name: 'criar_objetivo',
      description: `Cria um Objetivo (OKR) novo. SÓ ADM pode usar esta ferramenta — se quem pediu não for ADM, a ferramenta recusa e explica. ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE em kanban/okr/objetivos.'}`,
      input_schema: zodToJsonSchema(criarObjetivoSchema),
      handler: mode === 'real' ? makeCriarObjetivoHandler({ db, requestingUid, dryRun }) : fake('criar_objetivo'),
    },
    {
      name: 'editar_campos_okr',
      description: `Edita campos de um Objetivo já existente (identifique por objetivo_id ou titulo_objetivo). Campos de lista (indicadores_adicionar, progressos_adicionar, proximos_passos_adicionar, riscos_adicionar, planos_acao_adicionar) só SOMAM item novo — nunca apagam o que já tinha. Só quem é Responsável do Objetivo (ou ADM) pode editar. ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE.'}`,
      input_schema: zodToJsonSchema(editarCamposOkrSchema),
      handler: mode === 'real' ? makeEditarCamposOkrHandler({ db, requestingUid, dryRun }) : fake('editar_campos_okr'),
    },
    {
      name: 'criar_marco',
      description: `Cria um Marco (atividade macro) dentro de um Objetivo já existente (identifique por objetivo_id ou titulo_objetivo). Só quem é Responsável do Objetivo (ou ADM) pode usar. ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE.'}`,
      input_schema: zodToJsonSchema(criarMarcoSchema),
      handler: mode === 'real' ? makeCriarMarcoHandler({ db, requestingUid, dryRun }) : fake('criar_marco'),
    },
    {
      name: 'editar_marco',
      description: `Edita um Marco já existente (identifique por marco_id, ou por objetivo_id/titulo_objetivo + nome_marco). Muda status (progresso), prazo ou nome. Só quem é Responsável do Objetivo pai (ou ADM) pode usar. ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE.'}`,
      input_schema: zodToJsonSchema(editarMarcoSchema),
      handler: mode === 'real' ? makeEditarMarcoHandler({ db, requestingUid, dryRun }) : fake('editar_marco'),
    },
    {
      name: 'responder',
      description: 'Posta a resposta final pra pessoa, no mesmo chat. SEMPRE termine a conversa chamando esta ferramenta com um texto explicando o que foi feito (ou por que não deu, se faltou permissão/informação) — sem isso, sua resposta nunca chega até quem perguntou.',
      input_schema: zodToJsonSchema(responderSchema),
      handler: mode === 'real' ? makeResponderHandler({ db, dryRun }) : fake('responder'),
    },
  ];

  return defs;
}

module.exports = {
  OKR_GERENCIA_IDS,
  OKR_STATUS_IDS,
  buildOkrTools,
  resolveMarco,
};
