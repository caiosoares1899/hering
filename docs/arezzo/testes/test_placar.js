'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const SCRIPT = path.resolve(__dirname, '../../../scripts/placar.js');
const { classificar, mediana } = require(SCRIPT);

test('classificar reconhece merge pelo prefixo e squash pelo trailer', () => {
  for (const agente of ['claude', 'antigravity', 'codex']) {
    assert.deepEqual(classificar(`Merge pull request #42 from owner/${agente}/tarefa`, 'Agent: outro'),
      { numero: 42, agente, tipo: 'merge' });
    assert.deepEqual(classificar('feat: tarefa (#43)', `Descrição\n\nAgent: ${agente}\n`),
      { numero: 43, agente, tipo: 'squash' });
  }
  assert.deepEqual(classificar('Merge pull request #44 from owner/dependabot/npm/pkg'),
    { numero: 44, agente: 'outros', tipo: 'merge' });
  assert.deepEqual(classificar('Merge pull request #45 from owner/sem-prefixo'),
    { numero: 45, agente: 'outros', tipo: 'merge' });
  for (const corpo of ['', 'Agent: humano']) {
    assert.deepEqual(classificar('tarefa (#46)', corpo), { numero: 46, agente: 'outros', tipo: 'squash' });
  }
  assert.deepEqual(classificar('fix: sem PR', 'Agent: codex'), { numero: null, agente: 'outros', tipo: null });
  assert.equal(classificar('texto (#2) no meio').tipo, null);
});

test('mediana cobre vazio, pares, ímpares e não altera entrada', () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([7]), 7);
  assert.equal(mediana([8, 2]), 5);
  const valores = [9, 1, 3];
  assert.equal(mediana(valores), 3);
  assert.deepEqual(valores, [9, 1, 3]);
});

test('placar --json mede histórico local, deduplica PR e tolera gh indisponível', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'placar-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'scripts'));
  const script = path.join(dir, 'scripts/placar.js');
  fs.copyFileSync(SCRIPT, script);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  // gh controlado: o teste nunca consulta a rede.
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}
if (process.env.PLACAR_TEST_GH !== 'ok') process.exit(1);
console.log(process.argv.includes('--version') ? 'gh test' : JSON.stringify([{workflow_runs: [
  {head_branch: 'codex/tarefa', created_at: '2026-11-06T12:00:00Z'},
  {head_branch: 'main', created_at: '2026-11-07T12:00:00Z'},
  {head_branch: 'claude/tarefa', created_at: '2026-11-12T00:00:00Z'}
]}]));
`, { mode: 0o755 });
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, PLACAR_TEST_GH: '' };
  function git(args, data = '2026-11-04T12:00:00Z') {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe',
      env: { ...env, GIT_AUTHOR_DATE: data, GIT_COMMITTER_DATE: data } }).trim();
  }
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Teste']);
  git(['config', 'user.email', 'teste@example.invalid']);
  git(['commit', '--allow-empty', '-m', 'base']);
  git(['checkout', '-b', 'codex/tarefa']);
  git(['commit', '--allow-empty', '-m', 'fix: primeiro não conta como retrabalho'], '2026-11-05T10:00:00Z');
  git(['commit', '--allow-empty', '-m', 'corrige caso vizinho'], '2026-11-05T12:00:00Z');
  git(['checkout', 'main']);
  git(['merge', '--no-ff', 'codex/tarefa', '-m', 'Merge pull request #1 from owner/codex/tarefa'], '2026-11-05T14:00:00Z');
  // O mesmo número aparece duas vezes, mas deve contar uma única entrega.
  git(['commit', '--allow-empty', '-m', 'registro duplicado (#1)\n\nAgent: codex'], '2026-11-05T13:00:00Z');
  git(['commit', '--allow-empty', '-m', 'feat: squash (#2)\n\nAgent: claude'], '2026-11-06T12:00:00Z');
  git(['commit', '--allow-empty', '-m', 'feat: sem trailer (#3)'], '2026-11-07T12:00:00Z');
  git(['checkout', '-b', 'antigravity/tarefa']);
  git(['commit', '--allow-empty', '-m', 'fix: só o primeiro'], '2026-11-08T10:00:00Z');
  git(['checkout', 'main']);
  git(['merge', '--no-ff', 'antigravity/tarefa', '-m', 'Merge pull request #4 from owner/antigravity/tarefa'], '2026-11-08T12:00:00Z');
  git(['commit', '--allow-empty', '-m', 'fora da janela (#5)'], '2026-11-12T00:00:00Z');
  git(['remote', 'add', 'origin', 'https://github.com/owner/repo.git']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  function executar(extraEnv = {}) {
    const r = spawnSync(process.execPath, [script, '--desde', '2026-11-05', '--ate', '2026-11-12', '--json'],
      { cwd: dir, encoding: 'utf8', timeout: 20000, env: { ...env, ...extraEnv } });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  }
  const r = executar();
  assert.equal(r.total.prs, 4);
  assert.equal(r.total.merges, 2);
  assert.equal(r.total.squash, 2);
  assert.equal(r.agentes.codex.medianaHoras, 4);
  assert.equal(r.agentes.codex.medianaCommitsPorPR, 2);
  assert.equal(r.agentes.codex.prsComCorrecao, 1);
  assert.equal(r.agentes.antigravity.prsComCorrecao, 0);
  assert.equal(r.agentes.claude.medianaHoras, null);
  assert.equal(r.agentes.claude.prsSemMetricas, 1);
  assert.equal(r.agentes.outros.prs, 1);
  assert.equal(r.agentes.codex.distribuicaoPercentual, 25);
  assert.equal(r.total.ciVermelha, 'a medir (sem gh)');
  const comGh = executar({ PLACAR_TEST_GH: 'ok' });
  assert.equal(comGh.total.ciVermelha, 2);
  assert.equal(comGh.agentes.codex.ciVermelha, 1);
  assert.equal(comGh.agentes.outros.ciVermelha, 1);
  const invalido = spawnSync(process.execPath, [script, '--desde', '2026-02-30', '--json'],
    { encoding: 'utf8', env });
  assert.notEqual(invalido.status, 0);
  assert.match(invalido.stderr, /Data inválida/);
});
