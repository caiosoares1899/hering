// functions/okr/__tests__/atingimento.test.js
//
// O motor de atingimento do servidor (okr/atingimento.js) é uma CÓPIA do painel — o agente tem que dizer o MESMO % que a barra.
// Estes testes (1) comparam o bloco ATING-ENGINE texto a texto com painel-dev.html e painel.html e (2) rodam o motor do painel
// (extraído do HTML) contra o do servidor em centenas de casos aleatórios.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const A = require('../atingimento');
const ROOT = path.join(__dirname, '..', '..', '..');
const BEGIN = '/* ATING-ENGINE-BEGIN */';
const END = '/* ATING-ENGINE-END */';
const blocoDe = (arquivo) => {
  const s = fs.readFileSync(path.join(ROOT, arquivo), 'utf8');
  const a = s.indexOf(BEGIN), b = s.indexOf(END);
  assert.ok(a >= 0 && b > a, arquivo + ': marcadores do motor não encontrados');
  return s.slice(a, b + END.length);
};

test('motor do servidor: bloco idêntico ao de painel-dev.html', () => {
  const srv = fs.readFileSync(path.join(__dirname, '..', 'atingimento.js'), 'utf8');
  assert.ok(srv.includes(blocoDe('painel-dev.html')), 'okr/atingimento.js divergiu do motor de painel-dev.html — copie o bloco ATING-ENGINE de novo');
});

test('motor do servidor: bloco idêntico ao de painel.html (prod)', () => {
  const srv = fs.readFileSync(path.join(__dirname, '..', 'atingimento.js'), 'utf8');
  assert.ok(srv.includes(blocoDe('painel.html')), 'okr/atingimento.js divergiu do motor de painel.html');
});

// motor do painel, avaliado a partir do HTML (nunca uma reimplementação)
const painel = new Function(blocoDe('painel-dev.html') + '\nreturn {_okrAtingPctDe,_okrAtingPctObj,_okrAtingAtual,_okrParseNum,_okrFmtNum};')();

test('paridade: 1000 atingimentos aleatórios (8 tipos) dão o mesmo % no painel e no servidor', () => {
  let seed = 4242;
  const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const tipos = A.OKR_ATING_TIPOS.map((t) => t.id);
  const dia = (n) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
  const dif = [];
  for (let i = 0; i < 1000; i++) {
    const tipo = tipos[Math.floor(r() * tipos.length)];
    const at = { tipo, moeda: 'BRL', inicial: Math.round(r() * 100), meta: Math.round(r() * 300), datas: [{ de: dia(2), ate: dia(9), pct: 100 }, { de: dia(10), ate: dia(20), pct: Math.round(r() * 100) }], lancamentos: [] };
    const n = Math.floor(r() * 5);
    for (let k = 0; k < n; k++) at.lancamentos.push({ id: 'l' + k, em: dia(Math.floor(r() * 30)), valor: Math.round(r() * 350 - 20), atingido: r() > 0.5, criadoEm: '2026-10-0' + (1 + k) });
    const esperado = painel._okrAtingPctObj({ atingimento: at });
    const got = A._okrAtingPctObj({ atingimento: at });
    if (got !== esperado) dif.push([i, tipo, got, esperado]);
    at.lancamentos.forEach((l) => { if (A._okrAtingPctDe(at, l) !== painel._okrAtingPctDe(at, l)) dif.push(['reg', i, tipo]); });
  }
  assert.deepEqual(dif, []);
});

test('parse/format pt-BR: iguais ao painel', () => {
  for (const v of ['1.234,56', '1234,5', '1234.5', 'R$ 100,00', '50 %', '1.000', '1.000.000', '0.5', '-12,5', '', 'abc', 42]) {
    const a = A._okrParseNum(v), b = painel._okrParseNum(v);
    assert.ok(Object.is(a, b), `parse(${JSON.stringify(v)}): ${a} × ${b}`);
  }
  assert.equal(A._okrFmtNum(48000, 'BRL').replace(/\s/g, ' '), 'R$ 48.000,00');
  assert.equal(A._okrFmtNum(50, 'PCT'), painel._okrFmtNum(50, 'PCT'));
});

test('lancamentosDe/datasDe: aceita array e o objeto {idx:item} que o Realtime Database devolve com buracos', () => {
  assert.equal(A.lancamentosDe({ lancamentos: [{ id: 'a' }, { id: 'b' }] }).length, 2);
  assert.equal(A.lancamentosDe({ lancamentos: { 0: { id: 'a' }, 2: { id: 'c' } } }).length, 2);
  assert.deepEqual(A.lancamentosDe({}), []);
  assert.deepEqual(A.datasDe(null), []);
});

test('progressoDoObjetivo: atingimento manda; sem atingimento ou perene = marcos', () => {
  const ms = [{ progresso: 'concluido' }, { progresso: 'no_prazo' }, { progresso: 'concluido' }, { progresso: 'risco' }];
  const base = { tipo: 'numero', inicial: 0, meta: 10, lancamentos: [{ id: 'a', em: '2026-10-01', valor: 7, criadoEm: 'x' }] };
  assert.deepEqual(A.progressoDoObjetivo({ atingimento: base }, ms), { pct: 70, origem: 'atingimento' });
  assert.deepEqual(A.progressoDoObjetivo({}, ms), { pct: 50, origem: 'marcos' });
  assert.deepEqual(A.progressoDoObjetivo({ atingimento: { tipo: 'perene' } }, ms), { pct: 50, origem: 'marcos' });
  assert.deepEqual(A.progressoDoObjetivo({ atingimento: base }, []), { pct: 70, origem: 'atingimento' });
  assert.deepEqual(A.progressoDoObjetivo({ atingimento: { ...base, lancamentos: [] } }, ms), { pct: 0, origem: 'atingimento' }); // configurado, sem registro = 0%
});

test('resumoAtingimento: sem atingimento = null; perene sinalizado; registros recentes do mais novo ao mais velho; dias desde o último', () => {
  assert.equal(A.resumoAtingimento({}, '2026-10-05'), null);
  assert.equal(A.resumoAtingimento({ atingimento: { tipo: 'tipo_que_nao_existe' } }, '2026-10-05'), null);
  const per = A.resumoAtingimento({ atingimento: { tipo: 'perene' } }, '2026-10-05');
  assert.equal(per.perene, true);
  const o = { atingimento: { tipo: 'financeira', moeda: 'BRL', inicial: 0, meta: 100000, lancamentos: { 0: { id: 'a', em: '2026-09-01', valor: 20000, criadoEm: 'x' }, 1: { id: 'b', em: '2026-10-01', valor: 77500, criadoEm: 'y' } } } };
  const r = A.resumoAtingimento(o, '2026-10-05');
  assert.equal(r.pct, 78);
  assert.equal(r.atual.valor, 77500);
  assert.equal(r.dias_desde_ultimo_registro, 4);
  assert.deepEqual(r.registros_recentes.map((x) => x.id), ['b', 'a']);
  assert.equal(r.total_registros, 2);
});

test('resumoAtingimento: binário e data trazem texto legível (sem valor numérico)', () => {
  const b = A.resumoAtingimento({ atingimento: { tipo: 'binario', lancamentos: [{ id: 'a', em: '2026-10-01', atingido: true, valor: 100, criadoEm: 'x' }] } }, '2026-10-05');
  assert.equal(b.atual.texto, '✅ Atingido');
  assert.equal(b.pct, 100);
  const d = A.resumoAtingimento({ atingimento: { tipo: 'data', datas: [{ de: '2026-10-01', ate: '2026-10-15', pct: 80 }], lancamentos: [{ id: 'a', em: '2026-10-07', criadoEm: 'x' }] } }, '2026-10-20');
  assert.equal(d.atual.texto, '📦 Entregue em 07/10/2026');
  assert.equal(d.pct, 80);
  assert.equal(d.faixas.length, 1);
});
