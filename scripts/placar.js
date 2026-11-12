'use strict';

// Placar local: início inclusivo, fim exclusivo, em dias UTC. Não faz fetch.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const AGENTES = ['claude', 'antigravity', 'codex', 'outros'];
const agenteValido = (nome) => AGENTES.includes(nome) ? nome : 'outros';

function classificar(assunto, corpo = '') {
  const merge = assunto.match(/^Merge pull request #(\d+) from [^/\s]+\/(\S+)/);
  if (merge) return { numero: Number(merge[1]), agente: agenteValido(merge[2].split('/')[0]), tipo: 'merge' };
  const squash = assunto.match(/\(#(\d+)\)\s*$/);
  if (squash) {
    const trailer = corpo.match(/^Agent:\s*(\S+)\s*$/mi);
    return { numero: Number(squash[1]), agente: agenteValido((trailer?.[1] || '').toLowerCase()), tipo: 'squash' };
  }
  return { numero: null, agente: 'outros', tipo: null };
}

function mediana(lista) {
  if (!lista.length) return null;
  const sorted = [...lista].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function periodo(args) {
  const hoje = new Date().toISOString().slice(0, 10);
  let desde = new Date(Date.parse(hoje) - 7 * 86400000).toISOString().slice(0, 10);
  let ate = hoje;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--desde' && args[i + 1]) desde = args[++i];
    else if (args[i] === '--ate' && args[i + 1]) ate = args[++i];
    else throw new Error('Uso: node scripts/placar.js [--desde AAAA-MM-DD] [--ate AAAA-MM-DD] [--json]');
  }
  for (const data of [desde, ate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data)) ||
        new Date(data).toISOString().slice(0, 10) !== data) throw new Error('Data inválida: use AAAA-MM-DD.');
  }
  if (desde >= ate) throw new Error('--desde deve ser anterior a --ate.');
  return { desde, ate, json };
}

function ciVermelha(desde, ate) {
  try {
    execFileSync('gh', ['--version'], { encoding: 'utf8', timeout: 3000, stdio: 'pipe' });
    const remote = git(['remote', 'get-url', 'origin']);
    const repo = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
    if (!repo) return 'a medir (sem gh)';
    const pages = execFileSync('gh', ['api', '--paginate', '--slurp',
      `repos/${repo}/actions/runs?created=>=${desde}&status=failure&per_page=100`],
    { encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const runs = JSON.parse(pages).flatMap((p) => p.workflow_runs);
    const contagem = Object.fromEntries(AGENTES.map((a) => [a, 0]));
    for (const run of runs) {
      if (run.created_at >= desde && run.created_at < ate) {
        contagem[agenteValido((run.head_branch || '').split('/')[0])]++;
      }
    }
    return contagem;
  } catch {
    return 'a medir (sem gh)';
  }
}

function placar({ desde, ate }) {
  let ref = 'origin/main';
  try { git(['rev-parse', '--verify', ref]); } catch { ref = 'main'; }
  // Todos os ancestrais já incorporados à main; o número do PR elimina duplicatas.
  const registros = git(['log', ref, '--since-as-filter=' + desde + 'T00:00:00Z',
    '--until=' + ate + 'T00:00:00Z', '--format=%H%x00%cI%x00%s%x00%b%x00%x1e']);
  const prs = new Map();
  for (const registro of registros.split('\x1e')) {
    const [hash, data, assunto, corpo] = registro.trim().split('\x00');
    if (!assunto || Date.parse(data) < Date.parse(desde) || Date.parse(data) >= Date.parse(ate)) continue;
    const pr = classificar(assunto, corpo);
    if (!pr.tipo) continue;
    // Havendo também um merge real, ele preserva as métricas que o squash não tem.
    const anterior = prs.get(pr.numero);
    if (anterior && (anterior.tipo === 'merge' || pr.tipo !== 'merge')) continue;
    let horas = null, commits = null, correcao = null;
    if (pr.tipo === 'merge') {
      const linhas = git(['log', '--reverse', '--format=%cI%x00%s', `${hash}^1..${hash}^2`])
        .split('\n').filter(Boolean).map((l) => l.split('\x00')).sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
      commits = linhas.length;
      if (linhas.length) {
        const primeiraData = Math.min(...linhas.map(([d]) => Date.parse(d)));
        horas = (Date.parse(data) - primeiraData) / 3600000;
      }
      correcao = linhas.slice(1).some(([, s]) => /^fix/i.test(s) || /corrige|correção/i.test(s));
    }
    prs.set(pr.numero, { ...pr, horas, commits, correcao });
  }
  const lista = [...prs.values()];
  const ci = ciVermelha(desde, ate);
  function resumir(itens, agente) {
    return {
      prs: itens.length,
      merges: itens.filter((p) => p.tipo === 'merge').length,
      squash: itens.filter((p) => p.tipo === 'squash').length,
      distribuicaoPercentual: lista.length ? Number((100 * itens.length / lista.length).toFixed(2)) : 0,
      medianaHoras: mediana(itens.map((p) => p.horas).filter((v) => v !== null)),
      medianaCommitsPorPR: mediana(itens.map((p) => p.commits).filter((v) => v !== null)),
      prsComCorrecao: itens.filter((p) => p.correcao).length,
      prsSemMetricas: itens.filter((p) => p.tipo === 'squash').length,
      ciVermelha: typeof ci === 'string' ? ci : agente ? ci[agente] : Object.values(ci).reduce((a, b) => a + b, 0),
    };
  }
  return { desde, ate, referencia: ref, agentes: Object.fromEntries(AGENTES.map((a) =>
    [a, resumir(lista.filter((p) => p.agente === a), a)])), total: resumir(lista),
  observacao: 'Fim exclusivo (UTC). Medianas e correções apenas de merges; squash: a medir. CI conta runs falhos por prefixo da branch.' };
}

function texto(resultado) {
  console.log(`Placar ${resultado.desde} a ${resultado.ate} (fim exclusivo, UTC) · ${resultado.referencia}`);
  console.log('| Agente | PRs | Merge | Squash | Distribuição | Mediana horas | Commits/PR | PRs c/ correção | CI vermelha |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---|');
  const valor = (n) => n === null ? 'a medir' : Number(n.toFixed(2));
  for (const [nome, r] of [...Object.entries(resultado.agentes), ['total', resultado.total]]) {
    console.log(`| ${nome} | ${r.prs} | ${r.merges} | ${r.squash} | ${r.distribuicaoPercentual}% | ${valor(r.medianaHoras)} | ${valor(r.medianaCommitsPorPR)} | ${r.prsComCorrecao} | ${r.ciVermelha} |`);
  }
  console.log(resultado.observacao);
}

if (require.main === module) {
  try {
    const opcoes = periodo(process.argv.slice(2));
    const resultado = placar(opcoes);
    if (opcoes.json) console.log(JSON.stringify(resultado, null, 2));
    else texto(resultado);
  } catch (erro) {
    console.error('Erro no placar: ' + erro.message);
    process.exitCode = 1;
  }
}

module.exports = { classificar, mediana };
