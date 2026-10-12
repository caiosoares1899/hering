// functions/metas/__tests__/lembretes.test.js
//
// 🐟 Lembretes de preenchimento das metas (functions/metas/lembretes.js): horários (a cada N h / 1× por dia / horários exatos) no fuso de Brasília,
// janela de 15 min (1 disparo por horário), dedupe por `lembreteUltimo`, quando NÃO avisa (inativa, fora do período, batida, atualizada agora, desligada),
// quem recebe (responsáveis · PO/Organizador da squad · ADM no Digital), formato da notificação, dev + produção e a paridade da matemática com mare-metas-dev.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const L = require('../lembretes');
const M = require(path.join(__dirname, '..', '..', '..', 'mare-metas-dev.js'));   // o módulo do navegador (matemática pura) — paridade

// 2026-11-27 é uma sexta; 14:00 em Brasília = 17:00 UTC (sem horário de verão desde 2019).
const AT = (hhmm, dia = '2026-11-27') => Date.parse(`${dia}T${hhmm}:00-03:00`);
const meta = o => Object.assign({ titulo: 'Black Friday — Site Hering', emoji: '🛒', tipo: 'meta', fmt: 'brl', alvo: 2000000, inicial: 0, atual: 840000, ativo: true, lembrete: { modo: 'cada', cada: 2, de: '08:00', ate: '20:00' } }, o || {});
const pubs = () => ({
  po: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'po' } }, org: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'organizador' } },
  mem: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'membro' } }, conv: { role: 'convidado', squads: { dev: true }, squads_roles: { dev: 'convidado' } },
  poOutra: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } }, adm1: { role: 'adm' }, adm2: { role: 'adm', squads: { dev: true } },
});
const novoDb = (extra) => makeFakeDb({ kanban: Object.assign({ usuarios_publicos: pubs(), metas_squads: { dev: { m1: meta() } } }, extra || {}) });
const notifsDe = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {});

test('agoraSP: converte pro horário de Brasília (inclui virada de dia)', () => {
  assert.deepEqual(L.agoraSP(Date.parse('2026-11-27T17:05:00Z')), { data: '2026-11-27', min: 14 * 60 + 5 });
  assert.deepEqual(L.agoraSP(Date.parse('2026-11-27T02:30:00Z')), { data: '2026-11-26', min: 23 * 60 + 30 });   // 23:30 de ontem em Brasília
  assert.deepEqual(L.agoraSP(Date.parse('2026-11-27T03:00:00Z')), { data: '2026-11-27', min: 0 });
});
test('horários do lembrete: a cada N h na janela, 1× por dia, horários exatos (máx. 4, ordenados, só HH:MM válidos)', () => {
  assert.deepEqual(L.horariosDoLembrete({ modo: 'cada', cada: 2, de: '08:00', ate: '20:00' }), ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']);
  assert.deepEqual(L.horariosDoLembrete({ modo: 'cada', cada: 1, de: '09:30', ate: '12:00' }), ['09:30', '10:30', '11:30']);
  assert.deepEqual(L.horariosDoLembrete({ modo: 'cada', cada: 1 }).length, 13);                          // padrão 08:00–20:00
  assert.deepEqual(L.horariosDoLembrete({ modo: 'cada', de: '20:00', ate: '08:00' }), []);               // janela invertida
  assert.deepEqual(L.horariosDoLembrete({ modo: 'diario', hora: '09:00' }), ['09:00']);
  assert.deepEqual(L.horariosDoLembrete({ modo: 'diario' }), ['09:00']);
  assert.deepEqual(L.horariosDoLembrete({ modo: 'horarios', horas: ['15:30', '09:00', 'x', '25:00', '12:00', '13:00', '14:00'] }), ['09:00', '12:00', '13:00', '15:30']);
  assert.deepEqual(L.horariosDoLembrete({ modo: 'off' }), []); assert.deepEqual(L.horariosDoLembrete(null), []);
});
test('janela de 15 min: o horário vale no tick certo e só nele (1 disparo por horário)', () => {
  const l = { modo: 'diario', hora: '09:00' };
  assert.equal(L.horarioDevido(l, 8 * 60 + 59), null);
  assert.equal(L.horarioDevido(l, 9 * 60), '09:00'); assert.equal(L.horarioDevido(l, 9 * 60 + 14), '09:00');
  assert.equal(L.horarioDevido(l, 9 * 60 + 15), null);
  assert.equal(L.horarioDevido({ modo: 'horarios', horas: ['09:10'] }, 9 * 60 + 15), '09:10');           // horário quebrado cai no tick das 09:15
});

test('avalia: quando NÃO avisa', () => {
  const ag = (hhmm, dia) => { const ms = AT(hhmm, dia); return [L.agoraSP(ms), ms]; };
  const dev = (m, hhmm, dia) => L.avalia(m, ...ag(hhmm, dia));
  assert.equal(dev(meta(), '14:00').devido, true);
  assert.equal(dev(meta(), '14:30').motivo, 'fora_do_horario');
  assert.equal(dev(meta(), '13:00').motivo, 'fora_do_horario');                                             // a cada 2h: 13h não é horário
  assert.equal(dev(meta({ ativo: false }), '14:00').motivo, 'inativa');
  assert.equal(dev(meta({ lembrete: { modo: 'off' } }), '14:00').motivo, 'sem_lembrete'); assert.equal(dev(meta({ lembrete: undefined }), '14:00').motivo, 'sem_lembrete');
  assert.equal(dev(meta({ inicio: '2026-11-28', fim: '2026-11-30' }), '14:00').motivo, 'fora_do_periodo');
  assert.equal(dev(meta({ inicio: '2026-11-20', fim: '2026-11-26' }), '14:00').motivo, 'fora_do_periodo');
  assert.equal(dev(meta({ inicio: '2026-11-27', fim: '2026-11-27' }), '14:00').devido, true, 'um dia só: no próprio dia avisa');
  assert.equal(dev(meta({ atual: 2000000 }), '14:00').motivo, 'batida');
  assert.equal(dev(meta({ atual: 2500000 }), '14:00').motivo, 'batida');
  assert.equal(dev(meta({ atual: undefined }), '14:00').devido, true, 'sem valor ainda: avisa');
  assert.equal(dev(meta({ lembreteUltimo: '2026-11-27T14:00' }), '14:00').motivo, 'ja_avisado');
  assert.equal(dev(meta({ lembreteUltimo: '2026-11-27T12:00' }), '14:00').devido, true, 'o aviso das 12h não bloqueia o das 14h');
  assert.equal(dev(meta({ lembreteUltimo: '2026-11-26T14:00' }), '14:00').devido, true, 'o de ontem não bloqueia o de hoje');
  // atualizada há pouco: a cada 2h = 110 min de folga; diário/horários = 30 min
  assert.equal(L.avalia(meta({ atualizadoEm: AT('12:30') }), L.agoraSP(AT('14:00')), AT('14:00')).motivo, 'atualizada_agora');      // 90 min atrás
  assert.equal(L.avalia(meta({ atualizadoEm: AT('11:50') }), L.agoraSP(AT('14:00')), AT('14:00')).devido, true);                       // 130 min atrás
  assert.equal(L.avalia(meta({ lembrete: { modo: 'diario', hora: '09:00' }, atualizadoEm: AT('08:45') }), L.agoraSP(AT('09:00')), AT('09:00')).motivo, 'atualizada_agora');
  assert.equal(L.avalia(meta({ lembrete: { modo: 'diario', hora: '09:00' }, atualizadoEm: AT('08:20') }), L.agoraSP(AT('09:00')), AT('09:00')).devido, true);
});

test('destinatários: responsáveis marcados; senão PO/Organizadores da squad (nunca membro, convidado ou PO de outra squad); no Digital, os ADMs', () => {
  const p = pubs();
  assert.deepEqual(L.destinatarios({ responsaveis: ['mem', 'mem', 'x'] }, 'squad', 'dev', p).sort(), ['mem', 'x']);
  assert.deepEqual(L.destinatarios({}, 'squad', 'dev', p).sort(), ['org', 'po']);
  assert.deepEqual(L.destinatarios({}, 'squad', 'dados', p), ['poOutra']);
  assert.deepEqual(L.destinatarios({}, 'digital', null, p).sort(), ['adm1', 'adm2']);
  assert.deepEqual(L.destinatarios({ responsaveis: ['adm1'] }, 'digital', null, p), ['adm1']);
  assert.deepEqual(L.destinatarios({ responsaveis: { a: 'po' } }, 'squad', 'dev', p), ['po'], 'responsáveis como objeto (Firebase pode devolver assim)');
});

test('runMetasLembretes: manda a notificação certa (tipo, título, resumo, escopo) pros gestores da squad e marca o horário', async () => {
  const db = novoDb();
  const r = await L.runMetasLembretes(db, AT('14:00'));
  assert.equal(r.enviados, 2); assert.equal(r.metas, 1);
  for (const uid of ['po', 'org']) {
    const n = await notifsDe(db, uid); assert.equal(n.length, 1, uid);
    assert.equal(n[0].type, 'meta_lembrete'); assert.equal(n[0].title, '🐟 Atualize a meta: Black Friday — Site Hering');
    assert.match(n[0].sub, /🛒/); assert.match(n[0].sub, /ainda sem valor informado/); assert.match(n[0].sub, /hoje R\$ 840 mil de R\$ 2 mi \(42%\)/);
    assert.equal(n[0].squad, 'dev'); assert.equal(n[0].okrObjId, 'squad'); assert.equal(n[0].metaId, 'm1'); assert.equal(n[0].read, false); assert.ok(n[0].ts);
  }
  assert.equal((await notifsDe(db, 'mem')).length, 0); assert.equal((await notifsDe(db, 'conv')).length, 0); assert.equal((await notifsDe(db, 'poOutra')).length, 0);
  assert.equal((await db.ref('kanban/metas_squads/dev/m1/lembreteUltimo').get()).val(), '2026-11-27T14:00');
});
test('runMetasLembretes: o mesmo tick (retry do scheduler) NÃO manda em dobro; o próximo horário manda de novo', async () => {
  const db = novoDb();
  await L.runMetasLembretes(db, AT('14:00')); const r2 = await L.runMetasLembretes(db, AT('14:05'));
  assert.equal(r2.enviados, 0); assert.equal((await notifsDe(db, 'po')).length, 1);
  const r3 = await L.runMetasLembretes(db, AT('16:00')); assert.equal(r3.enviados, 2); assert.equal((await notifsDe(db, 'po')).length, 2);
});
test('runMetasLembretes: meta do Digital vai pros ADMs (ou pros responsáveis), com "Digital" no resumo e escopo digital', async () => {
  const db = makeFakeDb({ kanban: { usuarios_publicos: pubs(), metas_digital: { g1: meta({ titulo: 'BF Digital', emoji: '🔥', lembrete: { modo: 'horarios', horas: ['09:00', '14:00'] } }), g2: meta({ titulo: 'Dia 27', responsaveis: ['mem'], lembrete: { modo: 'diario', hora: '14:00' } }) } } });
  const r = await L.runMetasLembretes(db, AT('14:00')); assert.equal(r.enviados, 3);
  const a = (await notifsDe(db, 'adm1')); assert.equal(a.length, 1); assert.match(a[0].sub, /🔥 Digital/); assert.equal(a[0].okrObjId, 'digital'); assert.equal(a[0].squad, null);
  assert.equal((await notifsDe(db, 'adm2')).length, 1); assert.equal((await notifsDe(db, 'mem')).length, 1);
  assert.equal((await db.ref('kanban/metas_digital/g1/lembreteUltimo').get()).val(), '2026-11-27T14:00');
});
test('runMetasLembretes: escaneia também os nós _dev (dados de teste do dev)', async () => {
  const db = makeFakeDb({ kanban: { usuarios_publicos: pubs(), metas_squads_dev: { dev: { t1: meta({ titulo: 'Teste dev' }) } }, metas_digital_dev: { g: meta({ titulo: 'Teste digital' }) } } });
  const r = await L.runMetasLembretes(db, AT('14:00')); assert.equal(r.enviados, 4);   // po + org (squad) + adm1 + adm2 (digital)
});
test('runMetasLembretes: interruptor geral (kanban/config/metas_lembretes_off) desliga tudo', async () => {
  const db = novoDb({ config: { metas_lembretes_off: true } });
  const r = await L.runMetasLembretes(db, AT('14:00')); assert.equal(r.enviados, 0); assert.equal(r.desligado, true); assert.equal((await notifsDe(db, 'po')).length, 0);
  assert.equal((await db.ref('kanban/metas_squads/dev/m1/lembreteUltimo').get()).val(), null);
});
test('runMetasLembretes: várias metas na mesma varredura — só as devidas; sem destinatário não quebra', async () => {
  const db = novoDb({ metas_squads: { dev: { a: meta(), b: meta({ lembrete: { modo: 'diario', hora: '09:00' } }), c: meta({ ativo: false }), d: meta({ atual: 2000000 }) }, vazia: { z: meta() } } });
  const r = await L.runMetasLembretes(db, AT('14:00')); assert.equal(r.metas, 5); assert.equal(r.enviados, 2);   // só 'a' em dev (po+org); squad 'vazia' não tem gestor
  assert.equal((await notifsDe(db, 'po')).length, 1);
});

test('paridade: pct e formatação da função == mare-metas-dev.js (mesma meta mostra o mesmo número no sino e na tela)', () => {
  const casos = [
    meta(), meta({ atual: 420000 }), meta({ atual: 1250000 }), meta({ atual: 4800, alvo: 10000 }), meta({ fmt: 'num', sufixo: 'camisetas', alvo: 500, atual: 180 }), meta({ fmt: 'num', alvo: 8, atual: 7.4 }),
    meta({ fmt: 'pct', alvo: 4, atual: 0.9 }), meta({ fmt: 'pct', alvo: 100, atual: 42 }), meta({ alvo: 100, inicial: 100 }), meta({ atual: undefined }), meta({ alvo: 5, inicial: 10, atual: 7.5, fmt: 'num' }),
    meta({ atual: 99999 }), meta({ atual: 100000 }), meta({ atual: 1000000 }), meta({ atual: 12 }),
  ];
  for (const m of casos) {
    assert.equal(L.pct(m), M.pct(m), 'pct ' + JSON.stringify(m));
    [m.atual, m.alvo, 0, 3.5, 99999, 100000, 1e6, 1250000].forEach(v => assert.equal(L.fmtVal(m, v), M.fmtVal(m, v), `fmt ${m.fmt} ${v}`));
  }
  assert.equal(L.folgaMs({ modo: 'cada', cada: 2 }), 110 * 60e3); assert.equal(L.folgaMs({ modo: 'cada', cada: 1 }), 50 * 60e3); assert.equal(L.folgaMs({ modo: 'diario' }), 30 * 60e3);
});
test('paridade: os horários que o formulário aceita (validar) são os que a função entende', () => {
  ['cada', 'diario', 'horarios'].forEach(modo => {
    const v = M.validar({ escopo: 'squad', squad: 'dev', titulo: 'x', alvo: 1, lembrete: modo === 'cada' ? { modo, cada: 3, de: '07:30', ate: '19:00' } : modo === 'diario' ? { modo, hora: '10:15' } : { modo, horas: ['08:00', '13:45'] } });
    assert.equal(v.ok, true); assert.ok(L.horariosDoLembrete(v.meta.lembrete).length >= 1, modo);
  });
});
