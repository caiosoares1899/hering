// functions/okr/__tests__/agenteTools.test.js
//
// Cobertura do vocabulário de ferramentas do Agente Ágil no domínio OKR
// (buildOkrTools) — mode:'real' com fake db, mesmo padrão de
// realHandlers.test.js do orquestrador de card. Cobre principalmente
// permissão (ADM/Responsável, mesma regra client-side de painel.html) e
// os campos de lista SÓ somando (nunca substituindo).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildOkrTools, resolveMarco } = require('../agenteTools');

const ADM_UID = 'uid-adm';
const RESP_UID = 'uid-responsavel';
const OUTRO_UID = 'uid-qualquer';

function seedDb(extra) {
  return makeFakeDb({
    kanban: {
      usuarios: {
        [ADM_UID]: { email: 'caio.soares@ciahering.com.br' },
        [RESP_UID]: { email: 'resp@ciahering.com.br' },
        [OUTRO_UID]: { email: 'outro@ciahering.com.br' },
      },
      okr: {
        objetivos: {
          o1: {
            id: 'o1',
            titulo: 'Reduzir custo Firebase',
            areaId: 'dadosia',
            pilar: '',
            descricao: '',
            trimestres: ['2026-Q3'],
            indicadores: ['Indicador base'],
            progressos: [],
            proximosPassos: [],
            riscos: [],
            planosAcao: [],
            responsaveis: [RESP_UID],
            arquivado: false,
          },
          o2: {
            id: 'o2',
            titulo: 'Objetivo arquivado',
            areaId: 'tech',
            responsaveis: [],
            arquivado: true,
          },
        },
        marcos: {
          m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', progresso: 'no_prazo', arquivado: false },
        },
      },
      ...extra,
    },
  });
}

function toolByName(tools, name) {
  return tools.find((t) => t.name === name);
}

// ── buildOkrTools() — validação de montagem ─────────────────────────────

test('buildOkrTools: mode "real" sem db/requestingUid lança erro (nunca escrita real sem identificar quem pediu)', () => {
  assert.throws(() => buildOkrTools({ mode: 'real' }), /precisa de db e requestingUid/);
});

test('buildOkrTools: mode "fake" (default) nunca toca o Firebase — handler simula', async () => {
  const tools = buildOkrTools();
  const result = await toolByName(tools, 'criar_objetivo').handler({ titulo: 'X', area_id: 'tech' });
  assert.equal(result.simulated, true);
  assert.equal(result.tool, 'criar_objetivo');
});

// ── listar_objetivos / ler_objetivo (leitura, sem permissão especial) ──

test('listar_objetivos: só retorna ativos, nunca arquivado', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID });
  const result = await toolByName(tools, 'listar_objetivos').handler({});
  assert.equal(result.total, 1);
  assert.equal(result.objetivos[0].id, 'o1');
});

test('listar_objetivos: filtra por area_id quando informado', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID });
  const result = await toolByName(tools, 'listar_objetivos').handler({ area_id: 'tech' });
  assert.equal(result.total, 0); // o único ativo é área dadosia
});

test('ler_objetivo: por id, inclui marcos ativos do objetivo', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID });
  const result = await toolByName(tools, 'ler_objetivo').handler({ objetivo_id: 'o1' });
  assert.equal(result.ok, true);
  assert.equal(result.titulo, 'Reduzir custo Firebase');
  assert.equal(result.marcos.length, 1);
  assert.equal(result.marcos[0].nome, 'Marco A');
});

test('ler_objetivo: objetivo arquivado não é encontrado', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID });
  const result = await toolByName(tools, 'ler_objetivo').handler({ objetivo_id: 'o2' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'objetivo_nao_encontrado');
});

// ── criar_objetivo — só ADM ──────────────────────────────────────────────

test('criar_objetivo: ADM consegue criar (dryRun:false)', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: ADM_UID, dryRun: false });
  const result = await toolByName(tools, 'criar_objetivo').handler({ titulo: 'Novo Objetivo', area_id: 'tech' });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  const gravado = (await db.ref('kanban/okr/objetivos/' + result.objetivo_id).get()).val();
  assert.equal(gravado.titulo, 'Novo Objetivo');
  assert.equal(gravado.criadoPor, '🤖 Agente Ágil');
});

test('criar_objetivo: não-ADM é recusado, mesmo sendo Responsável de outro Objetivo', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'criar_objetivo').handler({ titulo: 'Não deveria criar', area_id: 'tech' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'sem_permissao');
});

test('criar_objetivo: dryRun:true nunca grava, mesmo ADM', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: ADM_UID, dryRun: true });
  const result = await toolByName(tools, 'criar_objetivo').handler({ titulo: 'Simulado', area_id: 'tech' });
  assert.equal(result.dryRun, true);
  const todos = (await db.ref('kanban/okr/objetivos').get()).val();
  assert.equal(Object.keys(todos).length, 2); // só o1/o2 originais, nada novo
});

// ── editar_campos_okr — ADM ou Responsável, listas só SOMAM ────────────

test('editar_campos_okr: Responsável do Objetivo pode editar', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'editar_campos_okr').handler({ objetivo_id: 'o1', progressos_adicionar: ['Validamos viabilidade'] });
  assert.equal(result.ok, true);
  const gravado = (await db.ref('kanban/okr/objetivos/o1').get()).val();
  assert.deepEqual(gravado.progressos, ['Validamos viabilidade']);
});

test('editar_campos_okr: quem NÃO é Responsável nem ADM é recusado', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID, dryRun: false });
  const result = await toolByName(tools, 'editar_campos_okr').handler({ objetivo_id: 'o1', progressos_adicionar: ['Não deveria gravar'] });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'sem_permissao');
});

test('editar_campos_okr: campos de lista SOMAM ao que já existe, nunca substituem', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  await toolByName(tools, 'editar_campos_okr').handler({ objetivo_id: 'o1', indicadores_adicionar: ['Indicador novo'] });
  const gravado = (await db.ref('kanban/okr/objetivos/o1').get()).val();
  assert.deepEqual(gravado.indicadores, ['Indicador base', 'Indicador novo']); // base preservado
});

test('editar_campos_okr: não duplica item de lista já existente', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'editar_campos_okr').handler({ objetivo_id: 'o1', indicadores_adicionar: ['Indicador base'] });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'nada_pra_alterar');
});

test('editar_campos_okr: registra Histórico com autoria do agente', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: ADM_UID, dryRun: false });
  await toolByName(tools, 'editar_campos_okr').handler({ objetivo_id: 'o1', riscos_adicionar: ['Atraso do fornecedor'] });
  const hist = (await db.ref('kanban/okr/objetivos/o1/history').get()).val();
  assert.equal(hist.length, 1);
  assert.equal(hist[0].uid, 'agente-agil');
  assert.match(hist[0].what, /Atraso do fornecedor/);
});

// ── criar_marco / editar_marco — mesma regra de permissão do Objetivo pai ─

test('criar_marco: Responsável do Objetivo consegue criar', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'criar_marco').handler({ objetivo_id: 'o1', nome: 'Marco B', progresso: 'risco' });
  assert.equal(result.ok, true);
  const gravado = (await db.ref('kanban/okr/marcos/' + result.marco_id).get()).val();
  assert.equal(gravado.nome, 'Marco B');
  assert.equal(gravado.progresso, 'risco');
});

test('criar_marco: quem não pode editar o Objetivo pai é recusado', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: OUTRO_UID, dryRun: false });
  const result = await toolByName(tools, 'criar_marco').handler({ objetivo_id: 'o1', nome: 'Não deveria criar' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'sem_permissao');
});

test('editar_marco: por nome_marco dentro do objetivo, muda status e registra Histórico no Marco E no Objetivo pai', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'editar_marco').handler({ objetivo_id: 'o1', nome_marco: 'Marco A', progresso: 'concluido' });
  assert.equal(result.ok, true);
  const gravado = (await db.ref('kanban/okr/marcos/m1').get()).val();
  assert.equal(gravado.progresso, 'concluido');
  const histMarco = (await db.ref('kanban/okr/marcos/m1/history').get()).val();
  assert.equal(histMarco.length, 1);
  const histObjetivo = (await db.ref('kanban/okr/objetivos/o1/history').get()).val();
  assert.equal(histObjetivo.length, 1);
  assert.match(histObjetivo[0].what, /Marco A/);
});

test('editar_marco: marco inexistente devolve erro, não quebra', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: RESP_UID, dryRun: false });
  const result = await toolByName(tools, 'editar_marco').handler({ objetivo_id: 'o1', nome_marco: 'Não existe', progresso: 'concluido' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'marco_nao_encontrado');
});

// ── resolveMarco() — ambiguidade ────────────────────────────────────────

test('resolveMarco: nome ambíguo (2 marcos batem) devolve erro específico', async () => {
  const db = seedDb({
    okr: {
      objetivos: { o1: { id: 'o1', titulo: 'X', areaId: 'tech', responsaveis: [], arquivado: false } },
      marcos: {
        m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco Alfa', arquivado: false },
        m2: { id: 'm2', objetivoId: 'o1', nome: 'Marco Alfa Beta', arquivado: false },
      },
    },
  });
  const result = await resolveMarco(db, { objetivo_id: 'o1', nome_marco: 'Alfa' }); // substring de ambos, exato de nenhum
  assert.equal(result.error, 'marco_ambiguo');
});

// ── responder — sempre a última palavra ─────────────────────────────────

test('responder: grava mensagem no chat com autoria do agente', async () => {
  const db = seedDb();
  const tools = buildOkrTools({ mode: 'real', db, requestingUid: ADM_UID, dryRun: false });
  const result = await toolByName(tools, 'responder').handler({ texto: 'Feito, adicionei o progresso.' });
  assert.equal(result.ok, true);
  const msg = (await db.ref('kanban/okr/agente_chat/' + result.message_id).get()).val();
  assert.equal(msg.uid, 'agente-agil');
  assert.equal(msg.text, 'Feito, adicionei o progresso.');
});
