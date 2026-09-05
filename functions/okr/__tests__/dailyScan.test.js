// functions/okr/__tests__/dailyScan.test.js
//
// Cobertura de runOkrDailyScan() — os 2 gatilhos ambientais do módulo OKR
// (prazo de marco chegando, véspera de reunião de bloco quinzenal). Não
// testa o wrapper onSchedule em si (mesmo raciocínio de
// dueOverdueTrigger.test.js: exigiria mockar firebase-functions/v2/
// scheduler, a lógica que importa já está toda em runOkrDailyScan()).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { todaySP, diasAte, runOkrDailyScan, blocoDaArea, ehDiaDeReuniao } = require('../dailyScan');

const HOJE = todaySP();
function addDias(n) {
  return new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function seedDb({ objetivos, marcos } = {}) {
  return makeFakeDb({
    kanban: {
      okr: { objetivos: objetivos || {}, marcos: marcos || {} },
    },
  });
}

async function notifsDe(db, uid) {
  const snap = await db.ref(`kanban/usuarios/${uid}/notificacoes`).get();
  return Object.values(snap.val() || {});
}

// ── diasAte() ────────────────────────────────────────────────────────────

test('diasAte: data de hoje retorna 0', () => {
  assert.equal(diasAte(HOJE), 0);
});
test('diasAte: 3 dias no futuro retorna 3', () => {
  assert.equal(diasAte(addDias(3)), 3);
});
test('diasAte: data ausente retorna null', () => {
  assert.equal(diasAte(''), null);
  assert.equal(diasAte(null), null);
});

// ── 1) Prazo de marco chegando ──────────────────────────────────────────

test('marco com prazo em 3 dias notifica o responsável do marco', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo X', responsaveis: ['uidResp'] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(3), progresso: 'no_prazo', responsavel: 'uidMarco' } },
  });
  await runOkrDailyScan(db);
  const notifsMarco = await notifsDe(db, 'uidMarco');
  const notifsObj = await notifsDe(db, 'uidResp');
  assert.equal(notifsMarco.length, 1);
  assert.equal(notifsMarco[0].type, 'okr_prazo');
  assert.match(notifsMarco[0].title, /Marco A/);
  assert.equal(notifsObj.length, 0, 'responsável do OBJETIVO não devia ser notificado quando o marco já tem responsável próprio');
});

test('marco sem responsável próprio cai pros responsaveis[] do Objetivo', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo X', responsaveis: ['uidResp1', 'uidResp2'] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'no_prazo' } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidResp1')).length, 1);
  assert.equal((await notifsDe(db, 'uidResp2')).length, 1);
});

test('marco concluído NÃO notifica mesmo com prazo batendo', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'concluido', responsavel: 'uidMarco' } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidMarco')).length, 0);
});

test('marco arquivado NÃO notifica', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'no_prazo', responsavel: 'uidMarco', arquivado: true } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidMarco')).length, 0);
});

test('marco com prazo fora da janela (2 ou 5 dias) NÃO notifica', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: {
      m1: { id: 'm1', objetivoId: 'o1', nome: 'A', prazo: addDias(2), progresso: 'no_prazo', responsavel: 'uid2d' },
      m2: { id: 'm2', objetivoId: 'o1', nome: 'B', prazo: addDias(5), progresso: 'no_prazo', responsavel: 'uid5d' },
      m3: { id: 'm3', objetivoId: 'o1', nome: 'C', prazo: addDias(0), progresso: 'no_prazo', responsavel: 'uidHoje' },
    },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uid2d')).length, 0);
  assert.equal((await notifsDe(db, 'uid5d')).length, 0);
  assert.equal((await notifsDe(db, 'uidHoje')).length, 0);
});

// ── 2) Véspera de reunião de bloco quinzenal ────────────────────────────
//
// Testes de blocoDaArea()/ehDiaDeReuniao() usam datas ABSOLUTAS fixas (não
// addDias/HOJE) porque são funções puras de uma string de data — o
// resultado nunca depende de quando o teste roda. As 8 datas abaixo saem
// direto do screenshot da agenda real que originou a feature (confirmado
// pelo usuário: 03/09/2026 é semana do bloco 1), alternando toda quinta.

test('blocoDaArea: as 4 gerências do bloco 1', () => {
  assert.equal(blocoDaArea('geral'), 1);
  assert.equal(blocoDaArea('comercial'), 1);
  assert.equal(blocoDaArea('performance'), 1);
  assert.equal(blocoDaArea('dadosia'), 1);
});
test('blocoDaArea: as 3 gerências do bloco 2', () => {
  assert.equal(blocoDaArea('cx'), 2);
  assert.equal(blocoDaArea('tech'), 2);
  assert.equal(blocoDaArea('crm'), 2);
});
test('blocoDaArea: área desconhecida cai no bloco 2 (fallback seguro)', () => {
  assert.equal(blocoDaArea('inexistente'), 2);
  assert.equal(blocoDaArea(undefined), 2);
});

test('ehDiaDeReuniao: alterna bloco 1/2 a cada quinta, batendo com a agenda real', () => {
  // Datas em múltiplos exatos de 7 dias a partir do anchor (2026-09-03) —
  // o screenshot original tinha 2 datas de agosto caindo numa sexta em vez
  // de quinta (exceção pontual da agenda real), então usa aqui as quintas
  // exatas que a fórmula por período garante (ver comentário do anchor).
  const bloco1 = ['2026-08-06', '2026-08-20', '2026-09-03', '2026-09-17'];
  const bloco2 = ['2026-08-13', '2026-08-27', '2026-09-10', '2026-09-24'];
  for (const d of bloco1) {
    assert.equal(ehDiaDeReuniao(d, 1), true, `${d} deveria ser bloco 1`);
    assert.equal(ehDiaDeReuniao(d, 2), false, `${d} não deveria ser bloco 2`);
  }
  for (const d of bloco2) {
    assert.equal(ehDiaDeReuniao(d, 2), true, `${d} deveria ser bloco 2`);
    assert.equal(ehDiaDeReuniao(d, 1), false, `${d} não deveria ser bloco 1`);
  }
});

test('ehDiaDeReuniao: dia que não é quinta nunca bate, nenhum bloco', () => {
  assert.equal(ehDiaDeReuniao('2026-09-02', 1), false); // quarta
  assert.equal(ehDiaDeReuniao('2026-09-02', 2), false);
  assert.equal(ehDiaDeReuniao('2026-09-04', 1), false); // sexta
  assert.equal(ehDiaDeReuniao('2026-09-04', 2), false);
});

test('ehDiaDeReuniao: funciona também pra datas ANTES do anchor (paridade negativa)', () => {
  // 2026-08-06 é 4 semanas antes do anchor (03/09) — período negativo,
  // exercita a normalização ((periodo%2)+2)%2 do módulo `%` de JS.
  assert.equal(ehDiaDeReuniao('2026-08-06', 1), true);
});

test('véspera do bloco 1 notifica os responsaveis de um objetivo do bloco 1', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj Geral', areaId: 'geral', responsaveis: ['u1', 'u2'] } },
  });
  // hoje=2026-09-02 (quarta) → amanhã=2026-09-03, confirmado bloco 1.
  await runOkrDailyScan(db, '2026-09-02');
  const n1 = await notifsDe(db, 'u1'), n2 = await notifsDe(db, 'u2');
  assert.equal(n1.length, 1); assert.equal(n1[0].type, 'okr_reuniao');
  assert.match(n1[0].title, /Obj Geral/);
  assert.equal(n2.length, 1);
});

test('véspera do bloco 1 NÃO notifica objetivo de gerência do bloco 2', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj CX', areaId: 'cx', responsaveis: ['u1'] } },
  });
  await runOkrDailyScan(db, '2026-09-02'); // amanhã = bloco 1
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('véspera do bloco 2 notifica objetivo de gerência do bloco 2, não do bloco 1', async () => {
  const db = seedDb({
    objetivos: {
      o1: { id: 'o1', titulo: 'Obj Tech', areaId: 'tech', responsaveis: ['u1'] },
      o2: { id: 'o2', titulo: 'Obj Comercial', areaId: 'comercial', responsaveis: ['u2'] },
    },
  });
  // hoje=2026-09-09 (quarta) → amanhã=2026-09-10, confirmado bloco 2.
  await runOkrDailyScan(db, '2026-09-09');
  assert.equal((await notifsDe(db, 'u1')).length, 1);
  assert.equal((await notifsDe(db, 'u2')).length, 0);
});

test('dia sem reunião amanhã (não é quinta de bloco nenhum) NÃO notifica', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj Geral', areaId: 'geral', responsaveis: ['u1'] } },
  });
  // hoje=2026-09-03 (quinta, dia DA reunião, não véspera) → amanhã=04/09 (sexta).
  await runOkrDailyScan(db, '2026-09-03');
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('objetivo arquivado NÃO notifica mesmo na véspera do seu bloco', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', areaId: 'geral', responsaveis: ['u1'], arquivado: true } },
  });
  await runOkrDailyScan(db, '2026-09-02');
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('objetivo sem responsaveis[] NÃO notifica (nada pra notificar)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', areaId: 'geral', responsaveis: [] } },
  });
  await runOkrDailyScan(db, '2026-09-02');
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('notificação escrita tem o formato esperado (ts ISO, read false, okrObjId presente)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj', areaId: 'geral', responsaveis: ['u1'] } },
  });
  await runOkrDailyScan(db, '2026-09-02');
  const [n] = await notifsDe(db, 'u1');
  assert.equal(n.read, false);
  assert.equal(n.okrObjId, 'o1');
  assert.equal(n.type, 'okr_reuniao');
  assert.equal(typeof n.ts, 'string');
  assert.ok(n.ts.includes('T'), 'ts deve ser ISO string, nunca Date.now()');
});
