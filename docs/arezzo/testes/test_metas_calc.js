// 🐟 Metas e desafios — matemática pura de mare-metas-dev.js (sem navegador): pct, ritmo, situação, marcos de 20 %, falta, validação, Black Friday.
// MODULO=mare-metas.js testa a prod depois da promoção.
const assert = require('node:assert/strict');
const M = require('../../../' + (process.env.MODULO || 'mare-metas-dev.js'));
let ok = true; const t = (n, f) => { try { f(); console.log('✅ ' + n); } catch (e) { ok = false; console.log('❌ ' + n + '  ← ' + e.message); } };
const base = { fmt: 'brl', alvo: 1000000, inicial: 0, inicio: '2026-11-23', fim: '2026-11-30' };

t('pct: valor/alvo, nulo sem valor, passa de 100, ponto de partida e meta de DESCER', () => {
  assert.equal(M.pct({ ...base, atual: 250000 }), 25);
  assert.equal(M.pct({ ...base }), null);
  assert.equal(M.pct({ ...base, atual: 1500000 }), 150);
  assert.equal(M.pct({ alvo: 200, inicial: 100, atual: 150 }), 50);
  assert.equal(M.pct({ alvo: 5, inicial: 10, atual: 7.5 }), 50);          // reduzir de 10 pra 5
  assert.equal(M.pct({ alvo: 100, inicial: 100, atual: 100 }), null);     // alvo = partida: sem sentido
});
t('esperado: dia a dia, fim do dia (último dia = 100), antes = 0, sem período = null', () => {
  assert.equal(M.esperado(base, '2026-11-22'), 0);
  assert.equal(M.esperado(base, '2026-11-23'), 12.5);                       // 1 de 8 dias
  assert.equal(M.esperado(base, '2026-11-26'), 50);
  assert.equal(M.esperado(base, '2026-11-30'), 100);
  assert.equal(M.esperado(base, '2026-12-05'), 100);
  assert.equal(M.esperado({ alvo: 10 }, '2026-11-26'), null);
  assert.equal(M.esperado({ inicio: '2026-11-27', fim: '2026-11-27' }, '2026-11-27'), null);   // um dia só: não há ritmo
});
t('situação: no ritmo ≥95 % do esperado · atenção ≥70 % · atrasada abaixo · batida · futura · encerrada · sem valor', () => {
  const st = (atual, hoje, extra) => M.status({ ...base, atual, ...(extra || {}) }, hoje).id;
  assert.equal(st(500000, '2026-11-26'), 'no_ritmo');
  assert.equal(st(480000, '2026-11-26'), 'no_ritmo');      // 96 % do esperado
  assert.equal(st(420000, '2026-11-26'), 'atencao');       // 84 %
  assert.equal(st(300000, '2026-11-26'), 'atrasada');      // 60 %
  assert.equal(st(1000000, '2026-11-24'), 'batida');
  assert.equal(st(900000, '2026-12-02'), 'encerrada');
  assert.equal(M.status({ ...base }, '2026-11-20').id, 'futura');
  assert.equal(M.status({ ...base }, '2026-11-25').id, 'sem_dado');
  assert.equal(M.status({ ...base }, '2026-12-02').id, 'encerrada');
  assert.equal(M.status({ alvo: 10, atual: 3 }, '2026-11-26').id, 'andamento');   // sem período: só acompanha
});
t('marcos de 20 em 20: 0,20,40,60,80,100 — e o valor de cada degrau', () => {
  [[null, 0], [0, 0], [19.9, 0], [20, 20], [39.99, 20], [40, 40], [79, 60], [80, 80], [99.9, 80], [100, 100], [250, 100]].forEach(([p, e]) => assert.equal(M.marcoDe(p), e, 'pct ' + p));
  assert.equal(M.valorDoMarco({ inicial: 0, alvo: 1000 }, 60), 600);
  assert.equal(M.valorDoMarco({ inicial: 100, alvo: 200 }, 40), 140);
});
t('próximo peixe: degrau seguinte e quanto falta; rede cheia = null', () => {
  assert.deepEqual(M.proximoMarco({ ...base, atual: 420000 }), { marco: 60, valor: 600000, falta: 180000 });
  assert.equal(M.proximoMarco({ ...base, atual: 1000000 }), null);
  assert.equal(M.proximoMarco({ ...base }).marco, 20);
});
t('falta, dias restantes e ritmo necessário por dia (contando hoje)', () => {
  assert.equal(M.falta({ ...base, atual: 400000 }), 600000);
  assert.equal(M.falta({ ...base, atual: 1100000 }), 0);
  assert.equal(M.falta({ ...base }), 1000000);
  assert.equal(M.falta({ alvo: 5, inicial: 10, atual: 8 }), 3);                        // meta de descer
  assert.equal(M.diasRestantes(base, '2026-11-26'), 4);
  assert.equal(M.diasRestantes({ alvo: 1 }, '2026-11-26'), null);
  assert.equal(M.ritmoNecessario({ ...base, atual: 420000 }, '2026-11-26'), 116000);   // 580 mil em 5 dias (hoje + 4)
  assert.equal(M.ritmoNecessario({ ...base, atual: 1000000 }, '2026-11-26'), 0);
});
t('registrar valor: sobe o marco e carimba; NUNCA desce o marco se o valor for corrigido pra baixo', () => {
  const p1 = M.patchDeRegistro({ ...base, atual: 100000, marco: 0 }, 650000, { uid: 'u1', nome: 'Ana Lima' }, 1700000000000);
  assert.deepEqual(p1, { atual: 650000, atualizadoEm: 1700000000000, atualizadoPor: 'u1', atualizadoNome: 'Ana Lima', marco: 60, marcoTs: 1700000000000 });
  const p2 = M.patchDeRegistro({ ...base, atual: 650000, marco: 60, marcoTs: 5 }, 300000, { uid: 'u1', nome: 'Ana' }, 9);
  assert.equal(p2.marco, undefined); assert.equal(p2.marcoTs, undefined); assert.equal(p2.atual, 300000);
  const p3 = M.patchDeRegistro({ ...base, atual: 650000, marco: 60 }, 700000, { uid: 'u1', nome: 'Ana' }, 9);
  assert.equal(p3.marco, undefined);                                                  // ainda no mesmo degrau: sem popup novo
});
t('formatação: R$ curto (mil / mi), quantidade com unidade, percentual', () => {
  assert.equal(M.fmtVal({ fmt: 'brl' }, 4800), 'R$ 4.800');
  assert.equal(M.fmtVal({ fmt: 'brl' }, 420000), 'R$ 420 mil');
  assert.equal(M.fmtVal({ fmt: 'brl' }, 1250000), 'R$ 1,25 mi');
  assert.equal(M.fmtVal({ fmt: 'brl' }, 1250000, true), 'R$ 1.250.000');
  assert.equal(M.fmtVal({ fmt: 'num', sufixo: 'camisetas' }, 1250), '1.250 camisetas');
  assert.equal(M.fmtVal({ fmt: 'pct' }, 42), '42%');
  assert.equal(M.fmtVal({ fmt: 'brl' }, null), '—');
});
t('"atualizado há…": agora há pouco / min / h / d', () => {
  const n = 1e12;
  assert.equal(M.ago(n - 30e3, n), 'agora há pouco'); assert.equal(M.ago(n - 5 * 60e3, n), 'há 5 min'); assert.equal(M.ago(n - 3 * 3600e3, n), 'há 3 h'); assert.equal(M.ago(n - 2 * 86400e3, n), 'há 2 d');
});
t('desatualizada: passou de 2× o intervalo do lembrete (1h → 2h; sem lembrete → 2 dias); fora do período ou batida não conta', () => {
  const hoje = M.hojeSP(), agora = Date.now();
  const m = { alvo: 100, atual: 10, lembrete: { modo: 'cada', cada: 1 } };
  assert.equal(M.desatualizada({ ...m, atualizadoEm: agora - 30 * 60e3 }, agora), false);
  assert.equal(M.desatualizada({ ...m, atualizadoEm: agora - 3 * 3600e3 }, agora), true);
  assert.equal(M.desatualizada({ ...m }, agora), true);                                  // nunca atualizada
  assert.equal(M.desatualizada({ ...m, atual: 100, atualizadoEm: 1 }, agora), false);    // batida
  assert.equal(M.desatualizada({ ...m, inicio: '2099-01-01', fim: '2099-01-02' }, agora), false);   // ainda não começou
  assert.equal(M.desatualizada({ alvo: 100, atual: 10, atualizadoEm: agora - 30 * 3600e3 }, agora), false);   // sem lembrete: 24h×2 = 48h
  assert.equal(M.desatualizada({ alvo: 100, atual: 10, atualizadoEm: agora - 50 * 3600e3 }, agora), true);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(hoje));
});
t('validar: obrigatórios, normalização, um dia só, lembretes (cada/diário/horários), responsáveis, squad', () => {
  const v = o => M.validar({ escopo: 'squad', squad: 'dados', titulo: 'X', alvo: 10, ...o });
  assert.equal(v({ titulo: '  ' }).ok, false);
  assert.equal(v({ alvo: '' }).ok, false);
  assert.equal(v({ alvo: 0 }).ok, false);
  assert.equal(v({ inicial: 10 }).ok, false);                                            // partida = alvo
  assert.equal(M.validar({ escopo: 'squad', squad: '../x', titulo: 'a', alvo: 1 }).ok, false);
  assert.equal(v({ inicio: '2026-11-30', fim: '2026-11-23' }).ok, false);
  const d = v({ inicio: '2026-11-27' }).meta; assert.equal(d.fim, '2026-11-27');           // só o início = um dia só
  assert.equal(v({}).meta.tipo, 'meta'); assert.equal(v({ tipo: 'desafio' }).meta.emoji, '🏆'); assert.equal(v({}).meta.emoji, '🎯');
  assert.equal(v({ fmt: 'num', sufixo: 'camisetas' }).meta.sufixo, 'camisetas'); assert.equal(v({ fmt: 'brl', sufixo: 'x' }).meta.sufixo, '');
  assert.equal(v({ submarca: 'tag_sm_kids_com', canal: 'tag_cv_dafiti' }).meta.submarca, 'tag_sm_kids_com'); assert.equal(v({ submarca: 'invasor' }).meta.submarca, '');
  assert.equal(v({ global: true }).meta.global, true); assert.equal(M.validar({ escopo: 'digital', titulo: 'a', alvo: 1, global: true }).meta.global, false);
  assert.deepEqual(v({ lembrete: { modo: 'cada', cada: 2, de: '09:00', ate: '18:00' } }).meta.lembrete, { modo: 'cada', cada: 2, de: '09:00', ate: '18:00' });
  assert.equal(v({ lembrete: { modo: 'cada', cada: 9 } }).meta.lembrete.cada, 1);
  assert.equal(v({ lembrete: { modo: 'cada', de: '20:00', ate: '08:00' } }).ok, false);
  assert.deepEqual(v({ lembrete: { modo: 'diario', hora: '25:00' } }).meta.lembrete, { modo: 'diario', hora: '09:00' });
  assert.deepEqual(v({ lembrete: { modo: 'horarios', horas: ['15:30', '09:00', 'x', '09:00'] } }).meta.lembrete.horas, ['09:00', '15:30']);
  assert.equal(v({ lembrete: { modo: 'horarios', horas: [] } }).ok, false);
  assert.equal(v({ lembrete: { modo: 'horarios', horas: ['01:00', '02:00', '03:00', '04:00', '05:00'] } }).meta.lembrete.horas.length, 4);
  assert.deepEqual(v({ responsaveis: ['a', 'b', 'a', 7] }).meta.responsaveis, ['a', 'b']);
});
t('Black Friday: sexta depois da 4ª quinta de novembro; do ano seguinte quando já passou há mais de uma semana', () => {
  assert.deepEqual(M.blackFriday('2026-10-12'), { dia: '2026-11-27', ini: '2026-11-23', fim: '2026-11-30' });
  assert.equal(M.blackFriday('2025-10-01').dia, '2025-11-28');
  assert.equal(M.blackFriday('2026-12-10').dia, '2027-11-26');
  assert.equal(M.blackFriday('2026-12-02').dia, '2026-11-27');     // ainda dentro de 7 dias depois? 27/11 + 7 = 04/12 → ainda é a deste ano
});
t('ordenar: metas antes de desafios, depois por ordem', () => {
  const o = M.ordenar([{ id: 'd1', tipo: 'desafio', ordem: 1 }, { id: 'm2', tipo: 'meta', ordem: 5 }, { id: 'm1', tipo: 'meta', ordem: 2 }]).map(x => x.id);
  assert.deepEqual(o, ['m1', 'm2', 'd1']);
});
t('lembreteTxt legível', () => {
  assert.equal(M.lembreteTxt({ modo: 'off' }), 'sem lembrete'); assert.equal(M.lembreteTxt({ modo: 'cada', cada: 2, de: '08:00', ate: '20:00' }), 'a cada 2h (08:00–20:00)');
  assert.equal(M.lembreteTxt({ modo: 'diario', hora: '09:00' }), '1× por dia às 09:00'); assert.equal(M.lembreteTxt({ modo: 'horarios', horas: ['09:00', '15:00'] }), 'às 09:00, 15:00');
});
t('serieDiaria e graficoHtml: curva diária (não acumulada), pontos interativos (mm-pt) e botão expandir', () => {
  const m = { id: 'm1', titulo: 'Outubro', fmt: 'brl', alvo: 1000, inicial: 0, atual: 350, inicio: '2026-10-01', fim: '2026-10-03', curva: { '2026-10-01': 200, '2026-10-02': 300, '2026-10-03': 500 } };
  const pts = [
    { t: M.spParaMs('2026-10-01', '12:00'), v: 180, d: 180, nota: 'Dia 1' },
    { t: M.spParaMs('2026-10-02', '12:00'), v: 530, d: 350, nota: 'Dia 2' },
  ];
  const s = M.serieDiaria(m, pts);
  assert.ok(Array.isArray(s) && s.length === 3);
  assert.equal(s[0].meta, 200); assert.equal(s[1].meta, 300); assert.equal(s[2].meta, 500);
  assert.equal(s[0].real, 180); assert.equal(s[1].real, 350); assert.equal(s[2].real, null);
  // Gráfico modo acumulado (default) e modo diário
  const gAcum = M.graficoHtml(m, pts);
  assert.ok(/<polyline[^>]*stroke-dasharray="3 4"/.test(gAcum) && /diarização/.test(gAcum));
  assert.ok(/class="mm-pt"/.test(gAcum) && /data-mm-act="graf-exp"/.test(gAcum));
  const gDia = M.graficoHtml(m, pts, { modo: 'dia' });
  assert.ok(/meta do dia \(diarização\)/.test(gDia) && /realizado no dia/.test(gDia));
  assert.ok(/class="mm-pt"/.test(gDia) && /data-sub="Meta do dia:/.test(gDia));
  const gGrande = M.graficoHtml(m, pts, { modo: 'dia', grande: true });
  assert.ok(/viewBox="0 0 780 320"/.test(gGrande) && !/data-mm-act="graf-exp"/.test(gGrande));
});
console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);

