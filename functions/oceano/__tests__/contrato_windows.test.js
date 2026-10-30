// functions/oceano/__tests__/contrato_windows.test.js — o ícone da bandeja do Windows (windows/oceano-bandeja.ps1) lê o JSON do oceanoResumo SÓ por `Campo <obj> 'caminho'`:
// todo caminho precisa existir no JSON REAL da função. Também confere o que costuma quebrar um .ps1 escrito fora do Windows: o BOM UTF-8 (sem ele o PowerShell 5 lê os acentos errado)
// e o lançador .cmd apontando para o script certo. Não substitui rodar no Windows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('../../backup/__tests__/fakeBucket');
const R = require('../resumo');

const RAIZ = path.join(__dirname, '..', '..', '..', 'windows');
const AGORA = Date.parse('2026-10-30T15:00:00Z');
const iso = (m) => new Date(AGORA - m * 60000).toISOString();
function comConsulta(fake) {
  const ref = (p) => { const r = fake.ref(p); r.orderByChild = (c) => ({ equalTo: (v) => ({ async get() { const x = (await r.get()).val() || {}; const a = Array.isArray(x) ? x : Object.values(x); return { val: () => a.filter((i) => i && i[c] === v) }; } }) }); return r; };
  return { ref, _data: fake._data };
}
const card = (id, e) => Object.assign({ id, title: 'Card ' + id, owner: 'CO', col: 'doing', due: '2026-11-20' }, e || {});
const todasAsChaves = (v, acc = new Set()) => { if (Array.isArray(v)) v.forEach((x) => todasAsChaves(x, acc)); else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { acc.add(k); todasAsChaves(x, acc); }); return acc; };
const resolve = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

async function jsonReal() {
  const db = comConsulta(makeFakeDb({ kanban: {
    usuarios_publicos: { dono: { init: 'CO', squads: { dados: true } } },
    vtex_saude: { ok: true, ultimoOkEm: iso(1), verificadoEm: iso(1), abertos: 1, incidentes: [{ titulo: 'x' }] }, github_saude: { ok: true, verificadoEm: iso(1), indicador: 'none' }, firebase_saude: { ok: true, verificadoEm: iso(1), servicosDegradados: [] },
    plantao: { b1: { estado: 'testando' }, b2: { estado: 'escalado' } },
    squads: { dados: { dados: { columns: [{ id: 'doing' }], cards: [card('a1', { due: '2026-10-20' }), card('a2', { due: '2026-10-30' }), card('a3', { blocker: true })], cards_incidentes_sumico: { i1: { cardId: 'c1', detectadoEm: iso(30) } } } } } } }));
  const b = fakeBucket({ 'backups-completos/diario/2026-10-30/manifesto.json': '{"erros":[]}', 'backups-completos/semanal/2026-10-25/manifesto.json': '{"erros":[]}', 'backups/dados/2026-10-30.json': '{}' });
  return JSON.parse(JSON.stringify(await R.montarResumo({ db, bucket: b, agora: AGORA, resolverUid: async () => 'dono', memo: R.criarMemo() })));
}

test('todo caminho lido pelo script da bandeja (Campo … \'x.y\' e os pares do menu) existe no JSON da função', async () => {
  const ps = fs.readFileSync(path.join(RAIZ, 'oceano-bandeja.ps1'), 'utf8');
  const caminhos = new Set();
  for (const m of ps.matchAll(/Campo\s+\$\w+\s+'([\w.]+)'/g)) caminhos.add(m[1]);
  for (const m of ps.matchAll(/@\('[A-Za-z]+',\s*'([\w.]+)'\)/g)) caminhos.add(m[1]);
  assert.ok(caminhos.size >= 10, 'o parser achou os caminhos (' + caminhos.size + ')');
  const json = await jsonReal(); const chaves = todasAsChaves(json);
  const raizes = new Set(Object.keys(json));
  const faltam = [...caminhos].filter((c) => { const primeiro = c.split('.')[0]; return raizes.has(primeiro) && c.includes('.') ? resolve(json, c) === undefined : !chaves.has(c.split('.').pop()); });
  assert.deepEqual(faltam, [], 'o script lê campos que a função não devolve: ' + faltam.join(', '));
});

test('o .ps1 é UTF-8 com BOM (PowerShell 5 lê sem BOM como ANSI e estraga os acentos) e o lançador .cmd aponta para ele', () => {
  const b = fs.readFileSync(path.join(RAIZ, 'oceano-bandeja.ps1'));
  assert.deepEqual([...b.slice(0, 3)], [0xef, 0xbb, 0xbf], 'falta o BOM no início do oceano-bandeja.ps1');
  const cmd = fs.readFileSync(path.join(RAIZ, 'iniciar-oceano.cmd'), 'latin1');
  assert.match(cmd, /-File "%~dp0oceano-bandeja\.ps1"/); assert.match(cmd, /-NoProfile/); assert.ok(fs.existsSync(path.join(RAIZ, 'oceano-bandeja.ps1')));
  assert.ok(cmd.includes('\r\n'), 'o .cmd usa CRLF');
});

test('o script usa a mesma função/endereço/chave que a página web e não leva chave no código', () => {
  const ps = fs.readFileSync(path.join(RAIZ, 'oceano-bandeja.ps1'), 'utf8');
  assert.match(ps, /cloudfunctions\.net\/oceanoResumo/); assert.match(ps, /chave-oceano\.txt/); assert.match(ps, /minipainel\.html/);
  assert.ok(!/[0-9a-f]{40,}/i.test(ps), 'parece haver uma chave embutida');
});

test('o script não compila C# na hora (Add-Type com DllImport/MemberDefinition falha em Windows corporativo) e registra todo erro em log', () => {
  const ps = fs.readFileSync(path.join(RAIZ, 'oceano-bandeja.ps1'), 'utf8');
  assert.ok(!/Add-Type\s+-MemberDefinition|Add-Type\s+-TypeDefinition|DllImport/i.test(ps), 'Add-Type com C# trava o script em máquinas onde o compilador é bloqueado (visto em 30/10)');
  assert.match(ps, /oceano-bandeja\.log/); assert.match(ps, /\btrap\s*\{/); assert.match(ps, /function Registrar/);
});
