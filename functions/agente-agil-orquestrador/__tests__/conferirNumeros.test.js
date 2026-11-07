const test = require('node:test');
const assert = require('node:assert/strict');
const { conferir, numerosDe } = require('../painel/conferirNumeros');

const saida = { cards: 11, limiteWip: 7, comparacao: { atual: 4.3, anterior: 2.1, texto: 'subiu de 2,1 para 4,3 dias' }, squads: [{ nome: 'Mídia Criativa', parado: 5.2, emRevisao: 6 }] };

test('números que existem nas ferramentas conferem (inclusive o texto pt-BR já formatado pela ferramenta)', () => {
  const r = conferir('Em Revisão há 11 cards (limite 7); o tempo médio subiu de 2,1 para 4,3 dias. Mídia Criativa: 6 cards, 5,2 d.', [saida], '');
  assert.deepEqual(r, { ok: true, naoConferidos: [] });
});

test('número que NÃO está em nenhuma ferramenta é apontado (modelo inventou ou calculou de cabeça)', () => {
  const r = conferir('Há 12 cards em revisão e o gargalo é de 4,3 dias.', [saida], '');
  assert.equal(r.ok, false);
  assert.deepEqual(r.naoConferidos, ['12']);
});

test('arredondamento: o texto "4,3" confere com 4.27 vindo da ferramenta, mas "4,4" não', () => {
  assert.equal(conferir('média de 4,3 dias', [{ m: 4.27 }], '').ok, true);
  assert.equal(conferir('média de 4,4 dias', [{ m: 4.27 }], '').ok, false);
});

test('milhar pt-BR e JSON: "1.234" = 1234; "70%" confere com 70', () => {
  assert.equal(conferir('foram 1.234 eventos', [{ n: 1234 }], '').ok, true);
  assert.equal(conferir('atingimento de 70%', [{ pct: 70 }], '').ok, true);
  assert.equal(conferir('atingimento de 71%', [{ pct: 70 }], '').ok, false);
});

test('números da própria pergunta valem (a pessoa disse "últimos 15 dias")', () => {
  assert.equal(conferir('Nos últimos 15 dias, 3 cards venceram.', [{ vencidos: 3 }], 'o que venceu nos últimos 15 dias?').ok, true);
});

test('ignora datas, horas, anos, ordinais e numeração de lista (não são dado)', () => {
  const t = '1. Revisão\n2) Dados\nLido às 14:02 de 06/11/2026 (2026-11-06T10:00:00.000Z), 1ª prioridade, em 2026.';
  assert.deepEqual(numerosDe(t), []);
  assert.equal(conferir(t, [], '').ok, true);
});

test('sem número no texto, nada a conferir', () => assert.deepEqual(conferir('Tudo tranquilo por aqui.', [saida], ''), { ok: true, naoConferidos: [] }));
