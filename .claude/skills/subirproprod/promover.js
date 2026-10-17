#!/usr/bin/env node
/**
 * .claude/skills/subirproprod/promover.js
 *
 * Utilitário determinístico e ultra-rápido para promover arquivos `-dev` para
 * produção (`prod`) no repositório Maré Digital / Oceano, preservando 100% das
 * linhas de ambiente de produção, atualizando `version.json` e validando a
 * sintaxe JS de todos os blocos <script> antes do commit.
 *
 * Uso:
 *   node .claude/skills/subirproprod/promover.js --status
 *     Confere TODOS os pares (kanban, okr, oceano, escala, intake, painel e os mare-*.js), lista os hunks pendentes
 *     e avisa se existir algum arquivo -dev na raiz sem alvo aqui. O painel é promovido por merge de 3 vias.
 *
 *   node .claude/skills/subirproprod/promover.js [alvos...]
 *     Promove os alvos informados (ex.: `kanban okr intake mare-notif`) ou, se
 *     nenhum alvo for passado, promove automaticamente todos os pares sincronizados
 *     que estiverem com mudanças pendentes em `-dev`.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const VERSION_FILE = path.join(ROOT, 'version.json');

const TARGETS = {
  kanban: {
    dev: 'kanban-dev.html',
    prod: 'kanban.html',
    versionProdKey: 'kanban',
    versionDevKey: 'kanban_dev',
    mode: 'sync',
  },
  okr: {
    dev: 'okr-dev.html',
    prod: 'okr.html',
    versionProdKey: 'okr',
    versionDevKey: 'okr_dev',
    mode: 'sync',
  },
  oceano: {
    dev: 'oceano-dev.html',
    prod: 'oceano.html',
    versionProdKey: 'oceano',
    versionDevKey: 'oceano_dev',
    mode: 'sync',
  },
  escala: {
    dev: 'escala-dev.html',
    prod: 'escala.html',
    versionProdKey: 'escala',
    versionDevKey: 'escala_dev',
    mode: 'sync',
  },
  intake: {
    dev: 'intake-dev.html',
    prod: 'intake.html',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'sync',
  },
  painel: {
    dev: 'painel-dev.html',
    prod: 'painel.html',
    versionProdKey: 'painel',
    versionDevKey: 'painel_dev',
    mode: 'merge3', // painel-dev.html tem instrumentação de debug própria: promove só o que mudou no dev desde a última promoção (merge de 3 vias)
  },
  'mare-notif': {
    dev: 'mare-notif-dev.js',
    prod: 'mare-notif.js',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'copy',
  },
  'mare-dicas': {
    dev: 'mare-dicas-dev.js',
    prod: 'mare-dicas.js',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'copy',
  },
  'mare-metas': {
    dev: 'mare-metas-dev.js',
    prod: 'mare-metas.js',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'copy',
  },
  'mare-login': {
    dev: 'mare-login-dev.js',
    prod: 'mare-login.js',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'copy',
  },
  'mare-plantao': {
    dev: 'mare-plantao-dev.js',
    prod: 'mare-plantao.js',
    versionProdKey: null,
    versionDevKey: null,
    mode: 'copy',
  },
};

/**
 * Normaliza tokens de ambiente (-dev / _dev) numa linha para comparar se
 * uma divergência entre prod e dev é apenas de identidade de ambiente.
 */
function normalizeEnvLine(line) {
  return line
    .replace(/\r$/, '')
    .replace(/favicon-dev\.png/g, 'favicon.png')
    .replace(/favicon-dev-monochrome\.png/g, 'favicon-monochrome.png')
    .replace(/oceano-dev\.webmanifest/g, 'oceano.webmanifest')
    .replace(/mare-(notif|dicas|metas|login|plantao)-dev\.js/g, 'mare-$1.js')
    .replace(/force_logout_after_dev/g, 'force_logout_after')
    .replace(/fb_(apiKey|authDomain|databaseURL|projectId|storageBucket|messagingSenderId|appId)(kanban|painel|okr|oceano|escala|intake)_dev/g, 'fb_$1$2')
    .replace(/\b(kanban|painel|okr|oceano|escala|intake)_dev\b/g, '$1')
    .replace(/\b(kanban|painel|okr|oceano|escala|intake)-dev\b/g, '$1')
    .replace(/(v\d+\.\d+(?:\.\d+)?(?:\s*·\s*[a-z]+)?)-dev\b/g, '$1')
    .replace(/\s*·\s*Dev<\/title>/g, '</title>')
    .replace(/🧪\s*Radar\s*·\s*Oceano\s*·\s*Dev/g, '🎯 Radar · Oceano')
    .replace(/\s*<span class="devtag">dev<\/span>/gi, '');
}

/**
 * Verifica se duas linhas (uma de prod, uma de dev) são equivalentes como
 * linha de ambiente (incluindo bumps de versão ou ?v=N em mare-*.js).
 */
function isSameEnvSlot(prodLine, devLine) {
  const pNorm = normalizeEnvLine(prodLine);
  const dNorm = normalizeEnvLine(devLine);
  if (pNorm === dNorm) return true;
  // Caso em que a versão subiu (ex.: <div class="version">v8.30.858</div> vs <div class="version">v8.30.863-dev</div>)
  const stripVer = s => s
    .replace(/v\d+\.\d+(?:\.\d+)?/g, 'vX')
    .replace(/(mare-(?:notif|dicas|metas|login|plantao)\.js\?v=)\d+/g, '$1N');
  return stripVer(pNorm) === stripVer(dNorm) && (
    /class="version"|const VERSION\b|mare-(notif|dicas|metas|login|plantao)/.test(dNorm)
  );
}

/**
 * Verifica se um hunk inteiro é apenas o banner exclusivo de ambiente dev
 * (ex.: #dev-banner ou faixa "🧪 RADAR DEV" + espaçador <div style="height:24px;"></div> em okr-dev.html).
 */
function isDevOnlyBannerHunk(prodSlice, devSlice) {
  if (devSlice.length === 0) return false;
  if (!prodSlice.every(l => l.replace(/\r$/, '').trim() === '')) return false;
  const hasBanner = devSlice.some(l => /id="dev-banner"|id="devbar"|🧪\s*RADAR\s*DEV|AMBIENTE\s*DEV/i.test(l));
  if (!hasBanner) return false;
  return devSlice.every(l => {
    const t = l.replace(/\r$/, '').trim();
    return (
      t === '' ||
      /id="dev-banner"|id="devbar"|🧪\s*RADAR\s*DEV|AMBIENTE\s*DEV/i.test(t) ||
      /^<div style="height:\d+px;"><\/div>$/i.test(t)
    );
  });
}

/**
 * Verifica se um hunk de mesmo tamanho é inteiramente de ambiente (incluindo
 * comentários explicativos adjacentes sobre favicon-dev.png / kanban-dev.html).
 */
function isEnvHunk(prodSlice, devSlice) {
  if (prodSlice.length !== devSlice.length || prodSlice.length === 0) return false;
  if (prodSlice.every((pLine, idx) => isSameEnvSlot(pLine, devSlice[idx]))) return true;
  // Comentários de bloco explicando favicon.png vs favicon-dev.png junto de linha de ambiente
  const hasEnvLine = prodSlice.some((pLine, idx) =>
    !pLine.trim().startsWith('//') && isSameEnvSlot(pLine, devSlice[idx])
  );
  if (!hasEnvLine) return false;
  if (!/favicon|kanban/.test(prodSlice.join('\n') + devSlice.join('\n'))) return false;
  return prodSlice.every((pLine, idx) => {
    const dLine = devSlice[idx];
    if (isSameEnvSlot(pLine, dLine)) return true;
    return pLine.trim().startsWith('//') && dLine.trim().startsWith('//');
  });
}

/**
 * Decide qual linha deve ficar no arquivo de produção para um par (prodLine, devLine)
 * que já foi identificado como slot de ambiente:
 * - Se for linha de versão ou script mare-*.js?v=N, usa a versão nova vinda do dev (sem -dev).
 * - Caso contrário, preserva exatamente a linha original do prod.
 */
function resolveEnvLineForProd(prodLine, devLine) {
  if (/class="version"|const VERSION\b|mare-(notif|dicas|metas|login|plantao)-dev\.js/.test(devLine)) {
    const eol = prodLine.endsWith('\r') ? '\r' : '';
    return normalizeEnvLine(devLine) + eol;
  }
  return prodLine;
}

/**
 * Executa `git diff --no-index -U0 <prodPath> <devPath>` e parseia os hunks.
 */
function getDiffHunks(prodPath, devPath) {
  let raw = '';
  try {
    raw = execFileSync('git', ['diff', '--no-index', '-U0', prodPath, devPath], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    if (err.status === 1 && typeof err.stdout === 'string') {
      raw = err.stdout;
    } else {
      throw err;
    }
  }
  if (!raw.trim()) return [];

  const lines = raw.split('\n');
  const hunks = [];
  let cur = null;

  for (const line of lines) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m) {
      if (cur) hunks.push(cur);
      cur = {
        pStart: parseInt(m[1], 10),
        pCount: m[2] === undefined ? 1 : parseInt(m[2], 10),
        dStart: parseInt(m[3], 10),
        dCount: m[4] === undefined ? 1 : parseInt(m[4], 10),
        minus: [],
        plus: [],
      };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('-') && !line.startsWith('---')) {
      cur.minus.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      cur.plus.push(line.slice(1));
    }
  }
  if (cur) hunks.push(cur);
  return hunks;
}

/**
 * Analisa os hunks entre prod e dev de um alvo `sync`, separando o que é
 * diferença permanente de ambiente do que é mudança real (feature/fix/versão).
 */
function analyzeSyncTarget(targetKey) {
  const cfg = TARGETS[targetKey];
  const prodPath = path.join(ROOT, cfg.prod);
  const devPath = path.join(ROOT, cfg.dev);
  const hunks = getDiffHunks(prodPath, devPath);

  const envHunks = [];
  const versionOrAssetHunks = [];
  const featureHunks = [];

  for (const h of hunks) {
    if (isDevOnlyBannerHunk(h.minus, h.plus)) {
      envHunks.push({ ...h, kind: 'dev-only-banner' });
      continue;
    }
    if (isEnvHunk(h.minus, h.plus)) {
      const updatedProdLines = h.minus.map((pLine, idx) =>
        resolveEnvLineForProd(pLine, h.plus[idx])
      );
      const changed = updatedProdLines.some((l, idx) => l !== h.minus[idx]);
      if (changed) {
        versionOrAssetHunks.push({ ...h, updatedProdLines });
      } else {
        envHunks.push({ ...h, kind: 'permanent-env' });
      }
      continue;
    }
    featureHunks.push(h);
  }

  return { hunks, envHunks, versionOrAssetHunks, featureHunks };
}

/**
 * Promove um alvo `sync` (kanban, okr, oceano, escala, intake) partindo do
 * conteúdo de `-dev` e restaurando todas as linhas permanentes de ambiente de `prod`.
 */
function promoteSyncTarget(targetKey) {
  const cfg = TARGETS[targetKey];
  const prodPath = path.join(ROOT, cfg.prod);
  const devPath = path.join(ROOT, cfg.dev);

  const prodContent = fs.readFileSync(prodPath, 'utf8');
  const devContent = fs.readFileSync(devPath, 'utf8');
  const prodLines = prodContent.split('\n');
  const outLines = devContent.split('\n');

  const hunks = getDiffHunks(prodPath, devPath);
  let featureCount = 0;
  let versionUpdates = 0;

  // Itera de baixo para cima em outLines (índices de dev: dStart, dCount)
  for (let i = hunks.length - 1; i >= 0; i--) {
    const h = hunks[i];
    const prodSlice = h.pCount > 0 ? prodLines.slice(h.pStart - 1, h.pStart - 1 + h.pCount) : [];
    const devSlice = h.dCount > 0 ? outLines.slice(h.dStart - 1, h.dStart - 1 + h.dCount) : [];

    // Caso 1: banner exclusivo do dev (ex.: #dev-banner ou faixa RADAR DEV em okr-dev.html)
    if (isDevOnlyBannerHunk(prodSlice, devSlice)) {
      outLines.splice(h.dStart - 1, h.dCount, ...prodSlice);
      continue;
    }

    // Caso 2: hunk inteiramente de ambiente
    if (isEnvHunk(prodSlice, devSlice)) {
      const replacement = prodSlice.map((pLine, idx) =>
        resolveEnvLineForProd(pLine, devSlice[idx])
      );
      if (replacement.some((l, idx) => l !== prodSlice[idx])) versionUpdates++;
      outLines.splice(h.dStart - 1, h.dCount, ...replacement);
      continue;
    }

    // Caso 3: hunk de feature/fix que pode ter linha de ambiente colada na borda
    let pLo = 0;
    let pHi = prodSlice.length;
    let dLo = 0;
    let dHi = devSlice.length;
    const prefixProd = [];
    const suffixProd = [];

    while (
      pLo < pHi &&
      dLo < dHi &&
      isSameEnvSlot(prodSlice[pLo], devSlice[dLo])
    ) {
      prefixProd.push(resolveEnvLineForProd(prodSlice[pLo], devSlice[dLo]));
      pLo++;
      dLo++;
    }
    while (
      pHi > pLo &&
      dHi > dLo &&
      isSameEnvSlot(prodSlice[pHi - 1], devSlice[dHi - 1])
    ) {
      suffixProd.unshift(resolveEnvLineForProd(prodSlice[pHi - 1], devSlice[dHi - 1]));
      pHi--;
      dHi--;
    }

    const middleDev = devSlice.slice(dLo, dHi).map(line => {
      if (/class="version"|const VERSION\b|mare-(notif|dicas|metas|login|plantao)-dev\.js/.test(line)) {
        const eol = line.endsWith('\r') ? '\r' : '';
        return normalizeEnvLine(line) + eol;
      }
      return line;
    });

    featureCount++;
    outLines.splice(h.dStart - 1, h.dCount, ...prefixProd, ...middleDev, ...suffixProd);
  }

  fs.writeFileSync(prodPath, outLines.join('\n'), 'utf8');
  return { featureCount, versionUpdates };
}

/**
 * Valida a sintaxe JS de todos os blocos <script> de um arquivo HTML ou JS.
 */
/** Módulos mare-*.js: o -dev aponta para páginas -dev e tem o nome no cabeçalho; a cópia de prod usa os nomes de prod. */
function copiaParaProd(devRaw) {
  return devRaw
    .replace(/mare-(notif|dicas|metas|login|plantao)-dev\.js/g, 'mare-$1.js')
    .replace(/(n\s*\+\s*')-dev(\.html')/g, '$1$2');
}

function validateSyntax(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.js')) {
    new vm.Script(content, { filename: path.basename(filePath) });
    return { scriptsChecked: 1 };
  }

  const noStyle = content.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const scriptRe = /^[ \t]*<script\b([^><\r\n]*)>([\s\S]*?)<\/script>/gim;
  let match;
  let count = 0;
  while ((match = scriptRe.exec(noStyle)) !== null) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    let code = match[2];
    const isModule = /\btype\s*=\s*["']module["']/i.test(attrs);
    if (isModule) {
      // Substitui import/export estáticos no topo por comentários do mesmo número de linhas para checar sintaxe no vm.Script
      code = code.replace(
        /^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm,
        m => m.replace(/[^\n]/g, ' ')
      );
    }
    new vm.Script(code, { filename: `${path.basename(filePath)}#script${count + 1}` });
    count++;
  }
  return { scriptsChecked: count };
}

/**
 * Atualiza `version.json` sincronizando a chave de prod com a chave `_dev` (sem `-dev`).
 */
function syncVersionJson(promotedTargets) {
  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  const updatedKeys = [];

  for (const key of promotedTargets) {
    const cfg = TARGETS[key];
    if (!cfg || !cfg.versionProdKey || !cfg.versionDevKey) continue;
    const devVer = versionData[cfg.versionDevKey];
    if (!devVer) continue;
    const expectedProdVer = devVer.replace(/-dev$/, '');
    if (versionData[cfg.versionProdKey] !== expectedProdVer) {
      versionData[cfg.versionProdKey] = expectedProdVer;
      updatedKeys.push(`${cfg.versionProdKey}: "${expectedProdVer}"`);
    }
  }

  if (updatedKeys.length > 0) {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  }
  return updatedKeys;
}


/**
 * Pares -dev/prod que existem na raiz mas não estão em TARGETS (a skill nunca os verificaria).
 * Exceções conhecidas: arquivos de ambiente que não se promovem.
 */
const SEM_PROMOCAO = new Set(['oceano-dev.webmanifest']);
function paresNaoCobertos() {
  const cobertos = new Set(Object.values(TARGETS).flatMap(c => [c.dev, c.prod]));
  const out = [];
  for (const f of fs.readdirSync(ROOT)) {
    const m = /^(.*)-dev(\.[a-z]+)$/.exec(f);
    if (!m || cobertos.has(f) || SEM_PROMOCAO.has(f) || /\.(png|webmanifest|mp3)$/.test(f)) continue;   // ícones/manifestos de ambiente não se promovem
    const prod = m[1] + m[2];
    out.push(fs.existsSync(path.join(ROOT, prod)) ? `${f} ↔ ${prod}` : `${f} (sem par de produção)`);
  }
  return out;
}

/**
 * Painel (merge de 3 vias): base = painel-dev.html no commit da última promoção do painel (o que já está em prod);
 * mescla  prod + (dev − base). As linhas de versão são neutralizadas antes (a de prod fica a de prod) e reescritas depois.
 * Devolve { pending, conflicts, merged }.
 */
function analisarPainel() {
  const cfg = TARGETS.painel;
  const prodPath = path.join(ROOT, cfg.prod);
  const devPath = path.join(ROOT, cfg.dev);
  const prod = fs.readFileSync(prodPath, 'utf8');
  const dev = fs.readFileSync(devPath, 'utf8');
  const sha = execFileSync('git', ['log', '-1', '--format=%H', '-G"painel":', '--', 'version.json'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!sha) throw new Error('não achei o commit da última promoção do painel (version.json)');
  const base = execFileSync('git', ['show', `${sha}:${cfg.dev}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const verRe = /<div class="version">[^<]*<\/div>/;
  const prodVerLine = (verRe.exec(prod) || [])[0];
  if (!prodVerLine) throw new Error('painel.html sem <div class="version">');
  const neutro = t => t.replace(verRe, prodVerLine);
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'painel3-'));
  const fP = path.join(dir, 'prod.html'), fB = path.join(dir, 'base.html'), fD = path.join(dir, 'dev.html');
  fs.writeFileSync(fP, prod); fs.writeFileSync(fB, neutro(base)); fs.writeFileSync(fD, neutro(dev));
  let merged, conflicts = 0;
  try {
    merged = execFileSync('git', ['merge-file', '-p', fP, fB, fD], { encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch (e) {
    if (typeof e.status === 'number' && e.status > 0 && e.stdout) { merged = e.stdout; conflicts = e.status; }
    else throw e;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  const newVer = (versionData[cfg.versionDevKey] || '').replace(/-dev$/, '');
  if (newVer) merged = merged.replace(verRe, `<div class="version">${newVer}</div>`);
  return { pending: merged !== prod, conflicts, merged };
}

function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status') || args.includes('--check') || args.includes('--diff');
  const requestedTargets = args.filter(a => !a.startsWith('--'));

  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));

  if (statusOnly) {
    console.log('=== Status de Promoção (dev -> prod) ===');
    for (const [key, cfg] of Object.entries(TARGETS)) {
      if (requestedTargets.length && !requestedTargets.includes(key)) continue;
      const prodPath = path.join(ROOT, cfg.prod);
      const devPath = path.join(ROOT, cfg.dev);
      if (!fs.existsSync(prodPath) || !fs.existsSync(devPath)) continue;

      const verInfo = cfg.versionProdKey
        ? ` [prod: "${versionData[cfg.versionProdKey]}" | dev: "${versionData[cfg.versionDevKey]}"]`
        : '';

      if (cfg.mode === 'copy') {
        const stripHeader = s => copiaParaProd(s).replace(/\r\n/g, '\n').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
        const same =
          stripHeader(fs.readFileSync(prodPath, 'utf8')) ===
          stripHeader(fs.readFileSync(devPath, 'utf8'));
        console.log(`- ${key}${verInfo}: ${same ? 'EM DIA (idênticos)' : 'PENDENTE (código difere)'}`);
      } else if (cfg.mode === 'sync') {
        const info = analyzeSyncTarget(key);
        const pending = info.featureHunks.length + info.versionOrAssetHunks.length;
        console.log(
          `- ${key}${verInfo}: ${
            pending === 0
              ? `EM DIA (${info.envHunks.length} hunks fixos de ambiente preservados)`
              : `PENDENTE (${info.featureHunks.length} hunks de código, ${info.versionOrAssetHunks.length} hunks de versão/asset, ${info.envHunks.length} hunks de ambiente)`
          }`
        );
        for (const fh of info.featureHunks) {
          console.log(`    • Hunk prod L${fh.pStart} (${fh.pCount}) <-> dev L${fh.dStart} (${fh.dCount})`);
        }
      } else if (cfg.mode === 'merge3') {
        const a = analisarPainel();
        console.log(`- ${key}${verInfo}: ${a.conflicts ? `PENDENTE com ${a.conflicts} CONFLITO(S) — resolver à mão` : a.pending ? 'PENDENTE (merge de 3 vias limpo)' : 'EM DIA'}`);
      }
    }
    const nc = paresNaoCobertos();
    if (nc.length) console.log(`⚠ Pares -dev sem alvo no promover.js (a skill NÃO os confere): ${nc.join(', ')}`);
    else console.log('✔ Cobertura: todo arquivo -dev da raiz tem alvo no promover.js.');
    return;
  }

  // Determina quais alvos promover
  const targetsToPromote = [];
  if (requestedTargets.length > 0) {
    for (const t of requestedTargets) {
      if (!TARGETS[t]) {
        console.error(`Alvo desconhecido: "${t}". Opções: ${Object.keys(TARGETS).join(', ')}`);
        process.exit(1);
      }
      targetsToPromote.push(t);
    }
  } else {
    // Modo automático: detecta todos os alvos sync/copy que possuem diferenças pendentes
    for (const [key, cfg] of Object.entries(TARGETS)) {
      const prodPath = path.join(ROOT, cfg.prod);
      const devPath = path.join(ROOT, cfg.dev);
      if (!fs.existsSync(prodPath) || !fs.existsSync(devPath)) continue;
      if (cfg.mode === 'copy') {
        const stripHeader = s => copiaParaProd(s).replace(/\r\n/g, '\n').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
        if (
          stripHeader(fs.readFileSync(prodPath, 'utf8')) !==
          stripHeader(fs.readFileSync(devPath, 'utf8'))
        ) {
          targetsToPromote.push(key);
        }
      } else if (cfg.mode === 'sync') {
        const info = analyzeSyncTarget(key);
        const verDiff =
          cfg.versionProdKey &&
          versionData[cfg.versionProdKey] !== (versionData[cfg.versionDevKey] || '').replace(/-dev$/, '');
        if (info.featureHunks.length > 0 || info.versionOrAssetHunks.length > 0 || verDiff) {
          targetsToPromote.push(key);
        }
      } else if (cfg.mode === 'merge3') {
        if (analisarPainel().pending) targetsToPromote.push(key);
      }
    }
  }

  if (targetsToPromote.length === 0) {
    console.log('Nenhum alvo com diferenças pendentes para promover.');
    return;
  }

  for (const key of targetsToPromote) {
    const cfg = TARGETS[key];
    const prodPath = path.join(ROOT, cfg.prod);
    const devPath = path.join(ROOT, cfg.dev);

    if (cfg.mode === 'copy') {
      const prodRaw = fs.readFileSync(prodPath, 'utf8');
      const devRaw = fs.readFileSync(devPath, 'utf8');
      const prodHeaderMatch = /^\/\*[\s\S]*?\*\/\r?\n/.exec(prodRaw);
      const devBody = devRaw.replace(/^\/\*[\s\S]*?\*\/\r?\n/, '');
      const merged = copiaParaProd(prodHeaderMatch ? prodHeaderMatch[0] + devBody : devRaw);
      fs.writeFileSync(prodPath, merged, 'utf8');
      const { scriptsChecked } = validateSyntax(prodPath);
      console.log(`✔ ${key}: sincronizado ${cfg.dev} -> ${cfg.prod} (cabeçalho de prod preservado, sintaxe OK, ${scriptsChecked} script)`);
    } else if (cfg.mode === 'sync') {
      const { featureCount, versionUpdates } = promoteSyncTarget(key);
      const after = analyzeSyncTarget(key);
      if (after.featureHunks.length > 0 || after.versionOrAssetHunks.length > 0) {
        console.error(
          `✖ Erro pós-promoção em ${key}: restaram ${after.featureHunks.length} feature hunks / ${after.versionOrAssetHunks.length} version hunks!`
        );
        process.exit(1);
      }
      const { scriptsChecked } = validateSyntax(prodPath);
      console.log(
        `✔ ${key}: promovido ${cfg.dev} -> ${cfg.prod} (${featureCount} hunks de código, ${versionUpdates} hunks de versão/asset, ${after.envHunks.length} hunks de ambiente preservados, ${scriptsChecked} blocos <script> validados)`
      );
    } else if (cfg.mode === 'merge3') {
      const a = analisarPainel();
      if (a.conflicts) {
        console.error(`✖ ${key}: o merge de 3 vias teve ${a.conflicts} conflito(s) — nada foi gravado. Resolva à mão (git merge-file) e rode de novo.`);
        process.exit(1);
      }
      fs.writeFileSync(prodPath, a.merged, 'utf8');
      const { scriptsChecked } = validateSyntax(prodPath);
      console.log(`✔ ${key}: promovido ${cfg.dev} -> ${cfg.prod} por merge de 3 vias (só o que mudou no dev desde a última promoção; ${scriptsChecked} blocos <script> validados)`);
    }
  }

  const updatedVer = syncVersionJson(targetsToPromote);
  if (updatedVer.length > 0) {
    console.log(`✔ version.json atualizado: ${updatedVer.join(', ')}`);
  }
  const nc = paresNaoCobertos();
  if (nc.length) console.log(`⚠ Pares -dev sem alvo no promover.js (NÃO conferidos): ${nc.join(', ')}`);
}

main();
