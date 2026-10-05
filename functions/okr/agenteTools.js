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
const { resolveObjetivo, canEditObjetivo, isAdmUid, pushHistory, notifyObjetivoEditado, AGENTE_UID, AGENTE_NOME } = require('./agenteHelpers');
const ating = require('./atingimento');

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

// ── 📈 Atingimento ───────────────────────────────────────────────────────
const ATING_TIPO_IDS = ating.OKR_ATING_TIPOS.map((t) => t.id);
const dataIso = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato YYYY-MM-DD');
const numeroOuTexto = () => z.union([z.number(), z.string().min(1)]); // aceita "1.234,56", "R$ 100", "50 %" (mesmo parse do painel)

const resumoAtingimentosSchema = z.object({
  area_id: z.enum(OKR_GERENCIA_IDS).optional(),
  sem_registro_ha_dias: z.number().int().min(1).max(365).optional(),
});

const registrarAtingimentoSchema = z.object({
  objetivo_id: z.string().min(1).optional(),
  titulo_objetivo: z.string().min(1).optional(),
  valor: numeroOuTexto().optional(),
  atingido: z.boolean().optional(),
  data: dataIso().optional(),
  nota: z.string().min(1).max(200).optional(),
});

const configurarAtingimentoSchema = z.object({
  objetivo_id: z.string().min(1).optional(),
  titulo_objetivo: z.string().min(1).optional(),
  tipo: z.enum(ATING_TIPO_IDS),
  moeda: z.enum(ating.MOEDAS_IDS).optional(),
  valor_inicial: numeroOuTexto().optional(),
  meta: numeroOuTexto().optional(),
  faixas: z.array(z.object({ de: dataIso(), ate: dataIso(), pct: z.number().min(0).max(100) })).max(12).optional(),
  confirmar_recalculo: z.boolean().optional(),
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
    const [snap, marcosSnap] = await Promise.all([db.ref('kanban/okr/objetivos').get(), db.ref('kanban/okr/marcos').get()]);
    const todos = snap.val() || {};
    const marcos = Object.values(marcosSnap.val() || {}).filter((m) => m && !m.arquivado);
    let ativos = Object.entries(todos).filter(([, o]) => o && !o.arquivado);
    if (input?.area_id) ativos = ativos.filter(([, o]) => o.areaId === input.area_id);
    const lista = ativos.map(([id, o]) => {
      const prog = ating.progressoDoObjetivo(o, marcos.filter((m) => m.objetivoId === id));
      const resumo = ating.resumoAtingimento(o);
      return {
        id,
        titulo: o.titulo || '',
        area_id: o.areaId || 'geral',
        trimestres: Array.isArray(o.trimestres) && o.trimestres.length ? o.trimestres : o.trimestre ? [o.trimestre] : [],
        pilar: o.pilar || '',
        progresso_pct: prog.pct,
        progresso_origem: prog.origem,
        atingimento_tipo: resumo ? resumo.tipo : null,
      };
    });
    return { ok: true, total: lista.length, objetivos: lista };
  };
}

function makeLerObjetivoHandler({ db }) {
  return async (input) => {
    const resolved = await resolveObjetivo(db, input);
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id, objetivo: o } = resolved;
    const marcosSnap = await db.ref('kanban/okr/marcos').get();
    const marcosAtivos = Object.entries(marcosSnap.val() || {}).filter(([, m]) => m && m.objetivoId === id && !m.arquivado);
    const marcos = marcosAtivos.map(([mid, m]) => ({ id: mid, nome: m.nome || '', progresso: m.progresso || 'nao_iniciado', prazo: m.prazo || '' }));
    const prog = ating.progressoDoObjetivo(o, marcosAtivos.map(([, m]) => m));
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
      progresso_pct: prog.pct,
      progresso_origem: prog.origem,
      atingimento: ating.resumoAtingimento(o, todaySP()),
    };
  };
}

// Mesmo formato (YYYY-MM-DD) de dailyScan.js/weeklySnapshot.js, fuso de São Paulo.
function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function makeResumoAtingimentosHandler({ db }) {
  return async (input) => {
    const parsed = resumoAtingimentosSchema.safeParse(input || {});
    if (!parsed.success) return { ok: false, error: 'entrada_invalida', message: parsed.error.issues.map((i) => i.message).join('; ') };
    const { area_id, sem_registro_ha_dias } = parsed.data;
    const [snap, marcosSnap] = await Promise.all([db.ref('kanban/okr/objetivos').get(), db.ref('kanban/okr/marcos').get()]);
    const marcos = Object.values(marcosSnap.val() || {}).filter((m) => m && !m.arquivado);
    const hoje = todaySP();
    let ativos = Object.entries(snap.val() || {}).filter(([, o]) => o && !o.arquivado);
    if (area_id) ativos = ativos.filter(([, o]) => o.areaId === area_id);
    const linhas = [];
    let semAtingimento = 0;
    for (const [id, o] of ativos) {
      const resumo = ating.resumoAtingimento(o, hoje);
      if (!resumo) { semAtingimento += 1; continue; }
      if (sem_registro_ha_dias && !resumo.perene) {
        const dias = resumo.dias_desde_ultimo_registro;
        if (dias !== undefined && dias !== null && dias < sem_registro_ha_dias) continue; // tem registro recente — não é o que foi pedido
      }
      const linha = { id, titulo: o.titulo || '', area_id: o.areaId || 'geral', tipo: resumo.tipo, tipo_rotulo: resumo.tipo_rotulo, perene: resumo.perene };
      if (resumo.perene) {
        const prog = ating.progressoDoObjetivo(o, marcos.filter((m) => m.objetivoId === id));
        linha.progresso_pct_por_marcos = prog.pct;
      } else {
        linha.pct = resumo.pct;
        if (resumo.meta_texto) linha.meta = resumo.meta_texto;
        linha.atual = resumo.atual ? resumo.atual.texto : null;
        linha.ultimo_registro = resumo.atual ? resumo.atual.data : null;
        linha.dias_desde_ultimo_registro = resumo.dias_desde_ultimo_registro ?? null;
        linha.total_registros = resumo.total_registros;
      }
      linhas.push(linha);
    }
    return { ok: true, total: linhas.length, objetivos_sem_atingimento: semAtingimento, atingimentos: linhas };
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

const msgZod = (parsed) => parsed.error.issues.map((i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message).join('; ');

// Registra um valor/entrega no atingimento de um Objetivo (mesma ação de "+ Registrar" do painel). O registro entra
// numa TRANSAÇÃO sobre a lista — alguém registrando pelo painel ao mesmo tempo não é sobrescrito.
function makeRegistrarAtingimentoHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    const parsed = registrarAtingimentoSchema.safeParse(input || {});
    if (!parsed.success) return { ok: false, error: 'entrada_invalida', message: msgZod(parsed) };
    const inp = parsed.data;
    const resolved = await resolveObjetivo(db, { objetivo_id: inp.objetivo_id, titulo: inp.titulo_objetivo });
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id, objetivo } = resolved;
    if (!(await canEditObjetivo(db, requestingUid, objetivo))) {
      return { ok: false, error: 'sem_permissao', message: `Só quem é Responsável por "${objetivo.titulo}" (ou ADM) pode registrar atingimento nele.` };
    }
    const at = ating.normalizar(objetivo).atingimento;
    if (!ating._okrAtingConfigurado(at)) {
      return { ok: false, error: 'sem_atingimento', message: `"${objetivo.titulo}" ainda não tem atingimento configurado. Use configurar_atingimento (tipo e meta) antes de registrar um valor.` };
    }
    if (at.tipo === 'perene') {
      return { ok: false, error: 'atingimento_perene', message: `"${objetivo.titulo}" é perene: não tem registros de valor, a barra anda pelos marcos. Atualize os marcos (editar_marco) em vez disso.` };
    }

    const agora = new Date().toISOString();
    const l = { id: 'at_' + Date.now() + Math.random().toString(36).slice(2, 6), em: inp.data || todaySP(), criadoEm: agora, por: AGENTE_NOME, uid: AGENTE_UID, pedidoPor: requestingUid };
    if (at.tipo === 'binario') {
      if (typeof inp.atingido !== 'boolean') return { ok: false, error: 'faltou_valor', message: 'Esse atingimento é "Atingido/Não atingido": informe atingido = true ou false.' };
      l.atingido = inp.atingido;
      l.valor = inp.atingido ? 100 : 0;
    } else if (at.tipo === 'data') {
      if (!inp.data) return { ok: false, error: 'faltou_data', message: 'Esse atingimento é "Data de entrega": informe a data em que foi entregue (YYYY-MM-DD).' };
    } else {
      if (inp.valor === undefined) return { ok: false, error: 'faltou_valor', message: 'Preciso do valor atual (número) pra registrar.' };
      const v = ating._okrParseNum(inp.valor);
      if (isNaN(v)) return { ok: false, error: 'valor_invalido', message: `"${inp.valor}" não é um número válido.` };
      l.valor = v;
    }
    if (inp.nota) l.nota = inp.nota.slice(0, 200);

    const pctRegistro = ating._okrAtingPctDe(at, l);
    const texto = ating.lancamentoTexto(at, l);
    if (dryRun) return { ok: true, dryRun: true, tool: 'registrar_atingimento', objetivo_id: id, wouldHaveExecuted: { data: l.em, texto, pct: pctRegistro } };

    await db.ref('kanban/okr/objetivos/' + id + '/atingimento/lancamentos').transaction((cur) => [...ating.lancamentosDe({ lancamentos: cur }), l]);
    await db.ref('kanban/okr/objetivos/' + id).update({ atualizadoEm: agora, atualizadoPor: AGENTE_NOME });
    await pushHistory(db, 'kanban/okr/objetivos/' + id, { what: `registrou atingimento de ${ating.dataBR(l.em)}: ${texto} → ${pctRegistro}% (via chat)`, tipo: 'ating' });
    await notifyObjetivoEditado(db, id, requestingUid);

    const depois = { ...at, lancamentos: [...at.lancamentos, l] };
    return {
      ok: true,
      dryRun: false,
      tool: 'registrar_atingimento',
      objetivo_id: id,
      registro: { id: l.id, data: l.em, texto, pct: pctRegistro },
      atingimento_pct_do_objetivo: ating._okrAtingPctObj({ atingimento: depois }),
      message: `Atingimento de "${objetivo.titulo}" registrado: ${texto} em ${ating.dataBR(l.em)} (${pctRegistro}%).`,
    };
  };
}

// Cria ou ajusta o atingimento de um Objetivo (tipo, moeda, valor inicial, meta, faixas de data) — NUNCA mexe nos registros
// já lançados. Trocar o tipo com registros exige confirmação explícita (confirmar_recalculo), igual ao diálogo do painel.
function makeConfigurarAtingimentoHandler({ db, requestingUid, dryRun }) {
  return async (input) => {
    const parsed = configurarAtingimentoSchema.safeParse(input || {});
    if (!parsed.success) return { ok: false, error: 'entrada_invalida', message: msgZod(parsed) };
    const inp = parsed.data;
    const resolved = await resolveObjetivo(db, { objetivo_id: inp.objetivo_id, titulo: inp.titulo_objetivo });
    if (resolved.error) return { ok: false, error: resolved.error, message: resolved.message };
    const { id, objetivo } = resolved;
    if (!(await canEditObjetivo(db, requestingUid, objetivo))) {
      return { ok: false, error: 'sem_permissao', message: `Só quem é Responsável por "${objetivo.titulo}" (ou ADM) pode configurar o atingimento dele.` };
    }
    const antes = ating.normalizar(objetivo).atingimento;
    const cfgAntes = ating._okrAtingConfigurado(antes);
    const tipo = inp.tipo;
    const tl = (t) => ating._okrAtingTipoLabel(t);

    // moeda — mesmas regras de _okrAtingAplicarTipo() do painel
    let moeda;
    if (tipo === 'financeira') {
      moeda = inp.moeda || (cfgAntes && ['BRL', 'USD', 'EUR'].includes(antes.moeda) ? antes.moeda : 'BRL');
      if (!['BRL', 'USD', 'EUR'].includes(moeda)) return { ok: false, error: 'moeda_invalida', message: 'Atingimento financeiro aceita só BRL, USD ou EUR.' };
    } else if (tipo === 'porcentagem') moeda = 'PCT';
    else if (tipo === 'acima' || tipo === 'abaixo') moeda = inp.moeda || (cfgAntes && ating.MOEDAS_IDS.includes(antes.moeda) ? antes.moeda : 'PCT');
    else moeda = 'NUM';

    // valor inicial e meta
    let inicial = cfgAntes ? Number(antes.inicial) || 0 : 0;
    if (inp.valor_inicial !== undefined) {
      inicial = ating._okrParseNum(inp.valor_inicial);
      if (isNaN(inicial)) return { ok: false, error: 'valor_invalido', message: `valor_inicial "${inp.valor_inicial}" não é um número válido.` };
    }
    const precisaMeta = ating.TIPOS_COM_META_NUMERICA.includes(tipo);
    let meta = cfgAntes && isFinite(Number(antes.meta)) ? Number(antes.meta) : null;
    if (inp.meta !== undefined) {
      meta = ating._okrParseNum(inp.meta);
      if (isNaN(meta)) return { ok: false, error: 'valor_invalido', message: `meta "${inp.meta}" não é um número válido.` };
    } else if (precisaMeta && !(cfgAntes && ating.TIPOS_COM_META_NUMERICA.includes(antes.tipo))) {
      meta = null; // não herdar o 100 de enfeite de um tipo que não tinha meta de verdade
    }
    if (precisaMeta && meta === null) return { ok: false, error: 'faltou_meta', message: 'Preciso da meta (o valor alvo) pra esse tipo de atingimento.' };
    if (!precisaMeta && meta === null) meta = 100; // mesmo valor de enfeite que o painel grava (binário/data/perene não usam)

    // faixas (Data de entrega)
    let datas = [];
    if (tipo === 'data') {
      datas = inp.faixas ? inp.faixas.map((f) => ({ de: f.de, ate: f.ate, pct: Math.round(f.pct) })) : cfgAntes && antes.tipo === 'data' ? ating.datasDe(antes).map((f) => ({ de: f.de || '', ate: f.ate || '', pct: Number(f.pct) || 0 })) : [];
      if (!datas.length) return { ok: false, error: 'faltou_faixas', message: 'Pra "Data de entrega" preciso das faixas: cada uma com de, ate (YYYY-MM-DD) e pct (0 a 100) — ex.: entregue entre 01/10 e 15/10 vale 100%.' };
      const ruim = datas.find((f) => !f.de || !f.ate || f.de > f.ate);
      if (ruim) return { ok: false, error: 'faixa_invalida', message: `A faixa ${ruim.de || '?'} → ${ruim.ate || '?'} está invertida ou incompleta (de deve ser antes de ate).` };
    }

    const nRegistros = ating.lancamentosDe(antes).length;
    const trocouTipo = cfgAntes && antes.tipo !== tipo;
    if (trocouTipo && nRegistros > 0 && !inp.confirmar_recalculo) {
      return {
        ok: false,
        error: 'precisa_confirmar',
        message: `Trocar o tipo de "${tl(antes.tipo)}" para "${tl(tipo)}" recalcula o % dos ${nRegistros} registro(s) já lançado(s) pelas regras do novo tipo${tipo === 'perene' ? ' (em Perene eles ficam guardados, mas a barra passa a andar pelos marcos)' : ''}. Pergunte pra pessoa e, se ela confirmar, chame de novo com confirmar_recalculo = true.`,
      };
    }

    // o que mudou (pro histórico) — mesmos textos de _okrDiffAtingimento() do painel
    const historicos = [];
    const mesmaFaixa = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!cfgAntes) historicos.push(`configurou o atingimento (${tl(tipo)}) (via chat)`);
    else if (trocouTipo) historicos.push(`alterou o tipo do atingimento: ${tl(antes.tipo)} → ${tl(tipo)} (via chat)`);
    else {
      const un = ating._okrAtingUnidade({ tipo, moeda });
      if (precisaMeta && Number(antes.meta) !== meta) historicos.push(`alterou a meta do atingimento: ${ating._okrFmtNum(Number(antes.meta), un)} → ${ating._okrFmtNum(meta, un)} (via chat)`);
      else if (moeda !== antes.moeda || (precisaMeta && tipo !== 'acima' && tipo !== 'abaixo' && (Number(antes.inicial) || 0) !== inicial) || (tipo === 'data' && !mesmaFaixa(datas, ating.datasDe(antes).map((f) => ({ de: f.de || '', ate: f.ate || '', pct: Number(f.pct) || 0 })))))
        historicos.push('ajustou a configuração do atingimento (via chat)');
    }
    if (!historicos.length) return { ok: false, error: 'nada_pra_alterar', message: `O atingimento de "${objetivo.titulo}" já está exatamente assim.` };

    if (dryRun) return { ok: true, dryRun: true, tool: 'configurar_atingimento', objetivo_id: id, wouldHaveExecuted: { tipo, moeda, inicial, meta, datas } };

    // update() (não set) — preserva `lancamentos`, que outra pessoa pode estar registrando agora
    await db.ref('kanban/okr/objetivos/' + id + '/atingimento').update({ tipo, moeda, inicial, meta, datas: tipo === 'data' ? datas : null });
    await db.ref('kanban/okr/objetivos/' + id).update({ atualizadoEm: new Date().toISOString(), atualizadoPor: AGENTE_NOME });
    for (const what of historicos) await pushHistory(db, 'kanban/okr/objetivos/' + id, { what, tipo: 'ating' });
    await notifyObjetivoEditado(db, id, requestingUid);

    const novo = { ...(antes || {}), tipo, moeda, inicial, meta, datas, lancamentos: ating.lancamentosDe(antes) };
    return { ok: true, dryRun: false, tool: 'configurar_atingimento', objetivo_id: id, atingimento: ating.resumoAtingimento({ atingimento: novo }, todaySP()), message: `Atingimento de "${objetivo.titulo}" configurado como "${tl(tipo)}".` };
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
      description: 'Lista os Objetivos ATIVOS (não arquivados), com id/título/gerência/trimestres/pilar e o % de progresso da barra (progresso_pct) + tipo de atingimento, se houver. Aceita area_id opcional pra filtrar por gerência. Use pra descobrir o id de um Objetivo antes de editar/adicionar marco, ou pra responder "quais OKRs a gente tem".',
      input_schema: zodToJsonSchema(listarObjetivosSchema),
      handler: mode === 'real' ? makeListarObjetivosHandler({ db }) : fake('listar_objetivos'),
    },
    {
      name: 'ler_objetivo',
      description: 'Lê um Objetivo específico por id ou por título (busca aproximada) — todos os campos (Objetivo, Indicadores, Progressos, Próximos Passos, Riscos, Planos de Ação), a lista de Marcos com status/prazo, o % de progresso da barra (progresso_pct, e se vem do atingimento ou dos marcos) e o ATINGIMENTO (tipo, meta, valor atual, % e últimos registros; null se não tiver). Use antes de editar, pra saber o que já existe e não repetir conteúdo.',
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
      name: 'resumo_atingimentos',
      description: 'Visão geral dos ATINGIMENTOS (metas com % de cumprimento) dos Objetivos ativos: tipo, % atual, meta, valor atual, data do último registro e há quantos dias foi. Filtros opcionais: area_id (gerência) e sem_registro_ha_dias (só os que estão sem registro há N dias ou mais — ou que nunca tiveram). Use pra responder "como estão os atingimentos", "quem está desatualizado", "qual Objetivo está mais perto/longe da meta". Objetivos perenes aparecem com o % dos marcos.',
      input_schema: zodToJsonSchema(resumoAtingimentosSchema),
      handler: mode === 'real' ? makeResumoAtingimentosHandler({ db }) : fake('resumo_atingimentos'),
    },
    {
      name: 'registrar_atingimento',
      description: `Registra um valor no atingimento de um Objetivo (identifique por objetivo_id ou titulo_objetivo) — o mesmo que "+ Registrar" no painel. valor: número ("48000", "R$ 48.000", "75 %"); no tipo Atingido/Não atingido use atingido (true/false); no tipo Data de entrega informe data (YYYY-MM-DD) da entrega. data = data do registro (padrão: hoje). nota opcional. O Objetivo precisa já ter atingimento configurado (senão use configurar_atingimento) e não pode ser perene. Só quem é Responsável (ou ADM). NUNCA invente o valor — se a pessoa não disse, pergunte. ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE.'}`,
      input_schema: zodToJsonSchema(registrarAtingimentoSchema),
      handler: mode === 'real' ? makeRegistrarAtingimentoHandler({ db, requestingUid, dryRun }) : fake('registrar_atingimento'),
    },
    {
      name: 'configurar_atingimento',
      description: `Cria ou ajusta o atingimento (a meta) de um Objetivo. tipo: financeira (moeda BRL/USD/EUR), porcentagem, numero, binario (atingido/não atingido), acima ("manter acima de"), abaixo ("manter abaixo de"), data (faixas de data de entrega) ou perene (sem meta, a barra anda pelos marcos). Tipos financeira/porcentagem/numero/acima/abaixo exigem meta (e opcionalmente valor_inicial, só nos 3 primeiros); data exige faixas [{de, ate, pct}]. Nunca apaga registros já lançados; trocar o tipo de um atingimento que já tem registros exige confirmar_recalculo = true DEPOIS de perguntar pra pessoa. Só quem é Responsável (ou ADM). ${dryRun ? 'Em dryRun, monta o plano mas nunca grava.' : 'Escreve DE VERDADE.'}`,
      input_schema: zodToJsonSchema(configurarAtingimentoSchema),
      handler: mode === 'real' ? makeConfigurarAtingimentoHandler({ db, requestingUid, dryRun }) : fake('configurar_atingimento'),
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
