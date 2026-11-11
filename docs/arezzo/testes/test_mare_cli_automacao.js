'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../..');
const CLI_PATH = path.join(ROOT, 'scripts', 'mare-cli.js');
const cli = require(CLI_PATH);

test('incrementVersionString preserva semver -dev e formato curto das páginas', () => {
  assert.equal(cli.incrementVersionString('v8.30.938-dev'), 'v8.30.939-dev');
  assert.equal(cli.incrementVersionString('v5.102 · painel-dev'), 'v5.103 · painel-dev');
  assert.equal(cli.incrementVersionString('v1.76 · oceano-dev'), 'v1.77 · oceano-dev');
});

test('scanSymbolsInSource ignora strings <style> no JS e extrai ranges, consts e funções', () => {
  const sample = [
    '<!doctype html>',
    '<style>',
    '.a { color: red; }',
    '</style>',
    '<script src="mare-notif-dev.js?v=18"></script>',
    '<script>',
    'const VERSION = "v1.0";',
    'const fake = "<style>nao eh bloco css</style>";',
    '// ═══ Seção Teste ═══',
    'function alpha() { const localVar = 1; return localVar; }',
    'async function beta() {}',
    'window._gamma = () => 42;',
    '</script>',
  ];
  const res = cli.scanSymbolsInSource('exemplo-dev.html', sample);
  assert.deepEqual(res.styles, ['L2–L4']);
  assert.deepEqual(res.scripts, ['L6–L13 (classic)']);
  assert.equal(res.extModules.length, 1);
  assert.ok(res.consts.includes('VERSION:L7'));
  assert.ok(!res.consts.some((c) => c.startsWith('localVar:')));
  assert.equal(res.fnCount, 3);
  assert.deepEqual(res.sections[0].fns, ['alpha:L10', 'beta:L11', 'gamma:L12'].map((x, i) => i === 2 ? '_gamma:L12' : x));
});

test('docs/CODE_SYMBOLS.md existe e indexa todas as páginas -dev principais e módulos mare-*', () => {
  const symPath = path.join(ROOT, 'docs', 'CODE_SYMBOLS.md');
  assert.ok(fs.existsSync(symPath), 'docs/CODE_SYMBOLS.md deve existir');
  const txt = fs.readFileSync(symPath, 'utf8');
  for (const expected of [
    '## `kanban-dev.html`',
    '## `painel-dev.html`',
    '## `okr-dev.html`',
    '## `oceano-dev.html`',
    '## `travessia-dev.html`',
    '## `mare-notif-dev.js`',
    '## `mare-sonar-dev.js`',
    '## `mare-timer-dev.js`',
  ]) {
    assert.ok(txt.includes(expected), `docs/CODE_SYMBOLS.md deve conter ${expected}`);
  }
});

test('CLI slice lê trechos numerados de kanban-dev.html (> 2,6 MB) rapidamente', () => {
  const r = spawnSync(process.execPath, [CLI_PATH, 'slice', 'kanban-dev.html', '1', '5'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /kanban-dev\.html \(L1–L5 de \d+\)/);
  assert.match(r.stdout, /1: <!DOCTYPE html>/i);
});

test('CLI find encontra função com número de linha em arquivo específico', () => {
  const r = spawnSync(process.execPath, [CLI_PATH, 'find', 'function _finishPainelLogin', '--file', 'painel-dev.html'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /painel-dev\.html:L\d+:/);
});

test('CLI check-script aceita --code inline e barra função inexistente ou escrita no banco', () => {
  const validCode = 'window._resultadosTeste = [{ ok: typeof esc === "function" }]; console.table(window._resultadosTeste);';
  const okRes = spawnSync(process.execPath, [CLI_PATH, 'check-script', '--page', 'painel-dev.html', '--code', validCode], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(okRes.status, 0, okRes.stderr);

  const badFnCode = 'window._resultadosTeste = [{ ok: funcaoQueNaoExisteJamais() }]; console.table(window._resultadosTeste);';
  const badRes = spawnSync(process.execPath, [CLI_PATH, 'check-script', '--page', 'painel-dev.html', '--code', badFnCode], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(badRes.status, 0, 'check-script deve reprovar função inexistente');
  assert.match(badRes.stderr, /Linha Vermelha #4/);
});

test('CLI brief executa sem erro e resume versões e Quadro', () => {
  const r = spawnSync(process.execPath, [CLI_PATH, 'brief'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Resumo Instantâneo/);
  assert.match(r.stdout, /Versões\s*:/);
});
