#!/usr/bin/env node
'use strict';

/**
 * mare-cli.js — CLI de Governança, Índice de Símbolos, Busca Cirúrgica e Ship do Maré Digital
 * Zero dependências externas (Node.js puro / CommonJS).
 *
 * Divisão de papéis sem sobreposição com `promover.js`:
 * - `scripts/mare-cli.js` cuida de `status`, `brief` (/seatualizar instantâneo), `daily` (rotina diária),
 *   `bump` (-dev + version.json + ?v=N), `log` (CHANGELOG.md / BUGS_E_CORRECOES.md),
 *   `map` / `symbols` (CODE_MAP.md + CODE_MAP_FAST.md + docs/CODE_SYMBOLS.md),
 *   `slice` / `find` (leitura e busca cirúrgica em HTMLs > 2,6 MB sem travar read_file),
 *   `check-script` (--file ou --code) e `ship` (pipeline declarativo em 1 clique via .mare-ship.json).
 * - `.claude/skills/subirproprod/promover.js` cuida exclusivamente da promoção dev → prod (`--status` e `<alvos>`),
 *   preservando as divergências permanentes de produção.
 *
 * Subcomandos:
 *   node scripts/mare-cli.js status
 *   node scripts/mare-cli.js brief
 *   node scripts/mare-cli.js daily
 *   node scripts/mare-cli.js bump [alvos...]
 *   node scripts/mare-cli.js log --type <feature|bug> --title "<titulo>" [--body "<itens>"] [--body-file <caminho>]
 *   node scripts/mare-cli.js map [--deep]
 *   node scripts/mare-cli.js symbols
 *   node scripts/mare-cli.js slice <arquivo> <linha_inicio> [linha_fim]
 *   node scripts/mare-cli.js find <padrao> [--file <arquivo>] [--max <N>]
 *   node scripts/mare-cli.js check-script --page <arquivo-dev.html> (--file <script.js> | --code "<js>")
 *   node scripts/mare-cli.js ship [--manifest <caminho>]
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const DEV_HTML_FILES = [
  'kanban-dev.html',
  'painel-dev.html',
  'okr-dev.html',
  'oceano-dev.html',
  'escala-dev.html',
  'intake-dev.html',
  'travessia-dev.html',
];

const SHARED_MODULES = [
  'mare-notif-dev',
  'mare-metas-dev',
  'mare-dicas-dev',
  'mare-login-dev',
  'mare-plantao-dev',
  'mare-sonar-dev',
  'mare-timer-dev',
];

const PAGE_TARGET_MAP = {
  'kanban-dev': { versionKey: 'kanban_dev', htmlFile: 'kanban-dev.html' },
  'kanban_dev': { versionKey: 'kanban_dev', htmlFile: 'kanban-dev.html' },
  'kanban':     { versionKey: 'kanban_dev', htmlFile: 'kanban-dev.html' },
  'painel-dev': { versionKey: 'painel_dev', htmlFile: 'painel-dev.html' },
  'painel_dev': { versionKey: 'painel_dev', htmlFile: 'painel-dev.html' },
  'painel':     { versionKey: 'painel_dev', htmlFile: 'painel-dev.html' },
  'okr-dev':    { versionKey: 'okr_dev',    htmlFile: 'okr-dev.html' },
  'okr_dev':    { versionKey: 'okr_dev',    htmlFile: 'okr-dev.html' },
  'okr':        { versionKey: 'okr_dev',    htmlFile: 'okr-dev.html' },
  'oceano-dev': { versionKey: 'oceano_dev', htmlFile: 'oceano-dev.html' },
  'oceano_dev': { versionKey: 'oceano_dev', htmlFile: 'oceano-dev.html' },
  'oceano':     { versionKey: 'oceano_dev', htmlFile: 'oceano-dev.html' },
  'escala-dev': { versionKey: 'escala_dev', htmlFile: 'escala-dev.html' },
  'escala_dev': { versionKey: 'escala_dev', htmlFile: 'escala-dev.html' },
  'escala':     { versionKey: 'escala_dev', htmlFile: 'escala-dev.html' },
  'intake-dev': { versionKey: 'intake_dev', htmlFile: 'intake-dev.html' },
  'intake_dev': { versionKey: 'intake_dev', htmlFile: 'intake-dev.html' },
  'intake':     { versionKey: 'intake_dev', htmlFile: 'intake-dev.html' },
};

const MODULE_TARGET_MAP = {
  'mare-notif-dev':      'mare-notif-dev',
  'mare-notif-dev.js':   'mare-notif-dev',
  'mare-notif':          'mare-notif-dev',
  'notif':               'mare-notif-dev',
  'mare-metas-dev':      'mare-metas-dev',
  'mare-metas-dev.js':   'mare-metas-dev',
  'mare-metas':          'mare-metas-dev',
  'metas':               'mare-metas-dev',
  'mare-dicas-dev':      'mare-dicas-dev',
  'mare-dicas-dev.js':   'mare-dicas-dev',
  'mare-dicas':          'mare-dicas-dev',
  'dicas':               'mare-dicas-dev',
  'mare-login-dev':      'mare-login-dev',
  'mare-login-dev.js':   'mare-login-dev',
  'mare-login':          'mare-login-dev',
  'login':               'mare-login-dev',
  'mare-plantao-dev':    'mare-plantao-dev',
  'mare-plantao-dev.js': 'mare-plantao-dev',
  'mare-plantao':        'mare-plantao-dev',
  'plantao':             'mare-plantao-dev',
  'mare-sonar-dev':      'mare-sonar-dev',
  'mare-sonar-dev.js':   'mare-sonar-dev',
  'mare-sonar':          'mare-sonar-dev',
  'sonar':               'mare-sonar-dev',
  'mare-timer-dev':      'mare-timer-dev',
  'mare-timer-dev.js':   'mare-timer-dev',
  'mare-timer':          'mare-timer-dev',
  'timer':               'mare-timer-dev',
};

// ---------------------------------------------------------------------------
// Helpers de versão e cache-buster
// ---------------------------------------------------------------------------

function readVersionJson() {
  const p = path.join(ROOT, 'version.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeVersionJson(data) {
  const p = path.join(ROOT, 'version.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Incrementa a string de versão preservando o formato:
 * - "v8.30.865-dev" -> "v8.30.866-dev"
 * - "v5.75 · painel-dev" -> "v5.76 · painel-dev"
 */
function incrementVersionString(verStr) {
  const semverMatch = verStr.match(/^(v\d+\.\d+\.)(\d+)(.*)$/);
  if (semverMatch) {
    const nextPatch = parseInt(semverMatch[2], 10) + 1;
    return `${semverMatch[1]}${nextPatch}${semverMatch[3]}`;
  }
  const minorMatch = verStr.match(/^(v\d+\.)(\d+)(.*)$/);
  if (minorMatch) {
    const nextMinor = parseInt(minorMatch[2], 10) + 1;
    return `${minorMatch[1]}${nextMinor}${minorMatch[3]}`;
  }
  throw new Error(`Formato de versão não reconhecido: "${verStr}"`);
}

/**
 * Escaneia os arquivos -dev.html em busca de `<script src="<mod>.js?v=N">`
 */
function scanModuleCacheBusters() {
  const result = {};
  for (const mod of SHARED_MODULES) {
    result[mod] = { max: 0, byFile: {} };
  }

  for (const htmlFile of DEV_HTML_FILES) {
    const fullPath = path.join(ROOT, htmlFile);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const mod of SHARED_MODULES) {
      const re = new RegExp(`${mod}\\.js\\?v=(\\d+)`, 'g');
      let m;
      while ((m = re.exec(content)) !== null) {
        const v = parseInt(m[1], 10);
        if (!result[mod].byFile[htmlFile]) result[mod].byFile[htmlFile] = [];
        result[mod].byFile[htmlFile].push(v);
        if (v > result[mod].max) result[mod].max = v;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. Subcomando: status
// ---------------------------------------------------------------------------

function cmdStatus() {
  const ver = readVersionJson();
  const modules = scanModuleCacheBusters();

  console.log('=== Maré Digital · Status de Versões (version.json) ===');
  const pairs = [
    ['kanban', ver.kanban, 'kanban_dev', ver.kanban_dev],
    ['painel', ver.painel, 'painel_dev', ver.painel_dev],
    ['okr',    ver.okr,    'okr_dev',    ver.okr_dev],
    ['oceano', ver.oceano, 'oceano_dev', ver.oceano_dev],
    ['escala', ver.escala, 'escala_dev', ver.escala_dev],
    ['slide',  ver.okr_apresentacao, null, null],
  ];
  for (const [prodKey, prodVal, devKey, devVal] of pairs) {
    if (!prodVal && !devVal) continue;
    if (devKey) {
      console.log(`  ${prodKey.padEnd(8)} prod: ${String(prodVal).padEnd(22)} | ${devKey.padEnd(10)} dev: ${devVal}`);
    } else {
      console.log(`  ${prodKey.padEnd(8)} prod: ${String(prodVal)}`);
    }
  }

  console.log('\n=== Módulos Compartilhados (?v=N nos *-dev.html) ===');
  for (const mod of SHARED_MODULES) {
    const info = modules[mod];
    const filesDesc = Object.entries(info.byFile)
      .map(([f, vals]) => `${f.replace('-dev.html', '')}:v=${vals.join(',')}`)
      .join(', ');
    console.log(`  ${(mod + '.js').padEnd(20)} max: ?v=${String(info.max).padEnd(4)} (${filesDesc || 'nenhum'})`);
  }
}

// ---------------------------------------------------------------------------
// 1-B. Subcomandos rápidos: brief (/seatualizar <0.15s) e daily (rotina diária)
// ---------------------------------------------------------------------------

function normalizeCompareVer(v) {
  return String(v || '')
    .replace(/-dev\b/g, '')
    .replace(/\s*·\s*[a-z0-9_-]+$/i, '')
    .trim();
}

function cmdBrief() {
  console.log('=== ⚡ /seatualizar · Resumo Instantâneo (mare-cli brief) ===');

  // 1. Git local
  const branchRes = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const headRes = spawnSync('git', ['log', '-1', '--oneline'], { cwd: ROOT, encoding: 'utf8' });
  console.log(`Git local : ${(branchRes.stdout || '').trim()} @ ${(headRes.stdout || '').trim()}`);

  // 2. Versões (destaca onde dev > prod)
  const ver = readVersionJson();
  const verSummary = [];
  for (const base of ['kanban', 'painel', 'okr', 'oceano', 'escala']) {
    const p = ver[base];
    const d = ver[`${base}_dev`];
    if (!p && !d) continue;
    const ahead = normalizeCompareVer(p) !== normalizeCompareVer(d);
    verSummary.push(`${base}: ${ahead ? `⚡ ${d} (prod ${p})` : `= ${p}`}`);
  }
  console.log(`Versões   : ${verSummary.join(' | ')}`);

  // 3. Quadro de coordenação
  const coordPath = path.join(ROOT, 'docs', 'COORDENACAO_AGENTES.md');
  if (fs.existsSync(coordPath)) {
    const coord = fs.readFileSync(coordPath, 'utf8');
    const secMatch = coord.match(/##\s+6\.\s+Quadro[\s\S]*?(?=\n##\s+7\.|$)/);
    if (secMatch) {
      const lines = secMatch[0].split(/\r?\n/);
      console.log('\n--- Quadro de Coordenação (docs/COORDENACAO_AGENTES.md) ---');
      let currentSub = '';
      for (const l of lines) {
        if (/^###\s+/.test(l)) {
          currentSub = l.replace(/^###\s+/, '').trim();
          if (/Backlog/i.test(currentSub)) continue;
          console.log(`[${currentSub}]`);
          continue;
        }
        if (/Backlog/i.test(currentSub)) continue;
        if (l.startsWith('|') && !l.startsWith('|---') && !/\|\s*Agente\s*\|/.test(l) && !/\|\s*Quem\s/.test(l)) {
          console.log('  ' + l.slice(0, 180) + (l.length > 180 ? '…' : ''));
        }
      }
    }
  }

  // 4. Topo de CHANGELOG.md e BUGS_E_CORRECOES.md
  const clPath = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(clPath)) {
    const clHeads = fs.readFileSync(clPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.startsWith('### '))
      .slice(0, 5);
    console.log('\n--- Últimas Features (CHANGELOG.md) ---');
    clHeads.forEach((h) => console.log('  ' + h.replace(/^###\s+/, '• ')));
  }

  const bugsPath = path.join(ROOT, 'BUGS_E_CORRECOES.md');
  if (fs.existsSync(bugsPath)) {
    const bugsTxt = fs.readFileSync(bugsPath, 'utf8');
    const histIdx = bugsTxt.indexOf('## 🐛 Histórico de Bugs e Correções');
    const bugHeads = (histIdx >= 0 ? bugsTxt.slice(histIdx) : bugsTxt)
      .split(/\r?\n/)
      .filter((l) => l.startsWith('### '))
      .slice(0, 5);
    console.log('\n--- Últimos Bugs/Correções (BUGS_E_CORRECOES.md) ---');
    bugHeads.forEach((h) => console.log('  ' + h.replace(/^###\s+/, '• ')));
  }
}

function cmdDaily() {
  cmdBrief();

  console.log('\n=== 🔄 Status de Promoção dev → prod (promover.js --status) ===');
  const promPath = path.join(ROOT, '.claude/skills/subirproprod/promover.js');
  if (fs.existsSync(promPath)) {
    spawnSync(process.execPath, [promPath, '--status'], { cwd: ROOT, stdio: 'inherit' });
  }

  console.log('\n=== 🛡️ Checagens da CI (scripts/checar.js) ===');
  const checarRes = spawnSync(process.execPath, [path.join(ROOT, 'scripts/checar.js')], { cwd: ROOT, stdio: 'inherit' });

  console.log('\n=== 🧪 Testes de Cloud Functions e Regras (functions) ===');
  const fnRes = spawnSync('npm', ['--prefix', 'functions', 'test'], { cwd: ROOT, encoding: 'utf8' });
  const tailLines = `${fnRes.stdout || ''}\n${fnRes.stderr || ''}`
    .split(/\r?\n/)
    .filter((l) => /^ℹ\s+(tests|pass|fail|skipped)|not ok /i.test(l));
  tailLines.forEach((l) => console.log('  ' + l));

  if (checarRes.status !== 0 || fnRes.status !== 0) {
    console.error('\n❌ [daily] Falha detectada em checar.js ou nos testes de functions/.');
    process.exit(1);
  }
  console.log('\n✅ [daily] Ecossistema 100% verde (checar.js + functions test OK).');
}

// ---------------------------------------------------------------------------
// 2. Subcomando: bump [alvos...]
// ---------------------------------------------------------------------------

function cmdBump(targets) {
  if (!targets || targets.length === 0) {
    console.error('Uso: node scripts/mare-cli.js bump <alvo1> [alvo2 ...]');
    console.error('  Módulos: mare-notif-dev, mare-metas-dev, mare-dicas-dev, mare-login-dev, mare-plantao-dev, mare-sonar-dev, mare-timer-dev');
    console.error('  Páginas: kanban-dev, painel-dev, okr-dev, oceano-dev, escala-dev');
    process.exit(1);
  }

  const ver = readVersionJson();
  let versionJsonDirty = false;
  const modulesScan = scanModuleCacheBusters();

  const bumpedModules = new Set();
  const bumpedPages = new Set();

  for (const rawTarget of targets) {
    const cleanTarget = rawTarget.trim().replace(/\.html$/i, '');

    if (MODULE_TARGET_MAP[cleanTarget]) {
      const mod = MODULE_TARGET_MAP[cleanTarget];
      if (bumpedModules.has(mod)) continue;
      bumpedModules.add(mod);

      const currentMax = modulesScan[mod] ? modulesScan[mod].max : 0;
      const nextV = currentMax + 1;
      const re = new RegExp(`(${mod}\\.js\\?v=)\\d+`, 'g');
      const updatedFiles = [];

      for (const htmlFile of DEV_HTML_FILES) {
        const fullPath = path.join(ROOT, htmlFile);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (re.test(content)) {
          re.lastIndex = 0;
          const updated = content.replace(re, `$1${nextV}`);
          if (updated !== content) {
            fs.writeFileSync(fullPath, updated, 'utf8');
          }
          updatedFiles.push(htmlFile);
        }
      }
      console.log(`[bump] ${mod}.js: ?v=${currentMax} -> ?v=${nextV} (${updatedFiles.join(', ')})`);
      continue;
    }

    if (PAGE_TARGET_MAP[cleanTarget]) {
      const { versionKey, htmlFile } = PAGE_TARGET_MAP[cleanTarget];
      if (bumpedPages.has(versionKey)) continue;
      bumpedPages.add(versionKey);

      const oldVer = ver[versionKey];
      if (!oldVer) {
        console.warn(`[bump] Aviso: "${htmlFile}" não possui chave "${versionKey}" em version.json (sem versão própria).`);
        continue;
      }
      const newVer = incrementVersionString(oldVer);
      ver[versionKey] = newVer;
      versionJsonDirty = true;

      const htmlPath = path.join(ROOT, htmlFile);
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        let replacedInHtml = false;

        const divTarget = `<div class="version">${oldVer}</div>`;
        if (html.includes(divTarget)) {
          html = html.replace(divTarget, `<div class="version">${newVer}</div>`);
          replacedInHtml = true;
        } else {
          const divRegex = /(<div\s+class="version">)([^<]+)(<\/div>)/;
          if (divRegex.test(html)) {
            html = html.replace(divRegex, `$1${newVer}$3`);
            replacedInHtml = true;
          }
        }

        const constTarget = `const VERSION = '${oldVer}'`;
        if (html.includes(constTarget)) {
          html = html.replace(constTarget, `const VERSION = '${newVer}'`);
          replacedInHtml = true;
        } else {
          const constRegex = /(const\s+VERSION\s*=\s*['"])([^'"]+)(['"])/;
          if (constRegex.test(html)) {
            html = html.replace(constRegex, `$1${newVer}$3`);
            replacedInHtml = true;
          }
        }

        if (replacedInHtml) {
          fs.writeFileSync(htmlPath, html, 'utf8');
        } else {
          console.warn(`[bump] Aviso: padrão de versão não encontrado dentro de ${htmlFile}`);
        }
      }

      console.log(`[bump] ${htmlFile} (${versionKey}): "${oldVer}" -> "${newVer}"`);
      continue;
    }

    console.error(`[bump] Alvo desconhecido: "${rawTarget}"`);
    process.exit(1);
  }

  if (versionJsonDirty) {
    writeVersionJson(ver);
    console.log('[bump] version.json atualizado com sucesso.');
  }
}

// ---------------------------------------------------------------------------
// 3. Subcomando: log
// ---------------------------------------------------------------------------

function parseCliFlags(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type' && i + 1 < args.length) {
      opts.type = args[++i];
    } else if (a.startsWith('--type=')) {
      opts.type = a.slice('--type='.length);
    } else if (a === '--title' && i + 1 < args.length) {
      opts.title = args[++i];
    } else if (a.startsWith('--title=')) {
      opts.title = a.slice('--title='.length);
    } else if (a === '--body' && i + 1 < args.length) {
      opts.body = args[++i];
    } else if (a.startsWith('--body=')) {
      opts.body = a.slice('--body='.length);
    } else if (a === '--body-file' && i + 1 < args.length) {
      opts.bodyFile = args[++i];
    } else if (a.startsWith('--body-file=')) {
      opts.bodyFile = a.slice('--body-file='.length);
    }
  }
  return opts;
}

function cmdLog(args) {
  const opts = parseCliFlags(args);
  const type = (opts.type || '').toLowerCase();
  if (type !== 'feature' && type !== 'bug') {
    console.error('Uso: node scripts/mare-cli.js log --type <feature|bug> --title "<titulo>" [--body "<itens>"] [--body-file <caminho>]');
    process.exit(1);
  }
  if (!opts.title || !opts.title.trim()) {
    console.error('Erro: --title "<titulo>" é obrigatório.');
    process.exit(1);
  }

  let bodyText = '';
  if (opts.bodyFile) {
    const bfPath = path.resolve(process.cwd(), opts.bodyFile);
    bodyText = fs.readFileSync(bfPath, 'utf8');
  } else if (opts.body) {
    bodyText = opts.body.replace(/\\n/g, '\n');
  } else {
    console.error('Erro: informe --body "<itens>" ou --body-file <caminho>.');
    process.exit(1);
  }

  let cleanTitle = opts.title.trim().replace(/^###\s+/, '');
  const today = new Date().toISOString().slice(0, 10);
  if (type === 'bug' && !/^\d{4}-\d{2}-\d{2}\s*·/.test(cleanTitle)) {
    cleanTitle = `${today} · ${cleanTitle}`;
  } else if (type === 'feature') {
    if (!/\d{4}-\d{2}-\d{2}/.test(cleanTitle)) {
      cleanTitle = `${cleanTitle} — ${today}`;
    }
    if (!/SÓ DEV|\(PROD\)/i.test(cleanTitle)) {
      cleanTitle = `SÓ DEV — ${cleanTitle}`;
    }
  }
  const cleanBody = bodyText.trim();
  const entryBlock = `### ${cleanTitle}\n\n${cleanBody}\n\n`;

  if (type === 'feature') {
    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf8');
    const marker = '## kanban.html (produção)';
    const idx = content.indexOf(marker);
    if (idx === -1) {
      console.error(`Erro: cabeçalho "${marker}" não encontrado em CHANGELOG.md`);
      process.exit(1);
    }
    const lineEnd = content.indexOf('\n', idx);
    const before = content.slice(0, lineEnd + 1);
    const after = content.slice(lineEnd + 1).replace(/^\r?\n/, '');
    const updated = `${before}\n${entryBlock}${after}`;
    fs.writeFileSync(changelogPath, updated, 'utf8');
    console.log(`[log] Entrada (feature) adicionada no topo de CHANGELOG.md: "### ${cleanTitle}"`);
  } else {
    const bugsPath = path.join(ROOT, 'BUGS_E_CORRECOES.md');
    if (!fs.existsSync(bugsPath)) {
      console.error('Erro: arquivo BUGS_E_CORRECOES.md não encontrado na raiz do repositório.');
      process.exit(1);
    }
    const content = fs.readFileSync(bugsPath, 'utf8');
    const headingMatch = content.match(/^##\s+(?:🐛\s+)?Histórico de Bugs e Correções[^\r\n]*$/m);
    if (!headingMatch) {
      console.error('Erro: cabeçalho "## 🐛 Histórico de Bugs e Correções" não encontrado em BUGS_E_CORRECOES.md.');
      process.exit(1);
    }
    const idx = headingMatch.index;
    const lineEnd = content.indexOf('\n', idx);
    const splitPos = lineEnd === -1 ? content.length : lineEnd + 1;
    const before = content.slice(0, splitPos);
    const after = content.slice(splitPos).replace(/^\r?\n/, '');
    const updated = `${before}\n${entryBlock}${after}`;
    fs.writeFileSync(bugsPath, updated, 'utf8');
    console.log(`[log] Entrada (bug) adicionada abaixo de "${headingMatch[0].trim()}" em BUGS_E_CORRECOES.md: "### ${cleanTitle}"`);
  }
}

// ---------------------------------------------------------------------------
// 4. Subcomandos: map & symbols (CODE_MAP.md + CODE_MAP_FAST.md + docs/CODE_SYMBOLS.md)
// ---------------------------------------------------------------------------

const MAP_TARGET_FILES = [
  'kanban-dev.html',
  'painel-dev.html',
  'okr-dev.html',
  'oceano-dev.html',
  'escala-dev.html',
  'intake-dev.html',
  'travessia-dev.html',
  'okr-apresentacao.slide.html',
  'mare-notif-dev.js',
  'mare-metas-dev.js',
  'mare-dicas-dev.js',
  'mare-login-dev.js',
  'mare-plantao-dev.js',
  'mare-sonar-dev.js',
  'mare-timer-dev.js',
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadSourceLines() {
  const files = {};
  for (const f of MAP_TARGET_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) {
      files[f] = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    }
  }
  return files;
}

function detectFileFromHeading(line) {
  if (line.includes('mare-notif.js') || line.includes('mare-notif-dev.js')) return 'mare-notif-dev.js';
  if (line.includes('mare-metas.js') || line.includes('mare-metas-dev.js')) return 'mare-metas-dev.js';
  if (line.includes('mare-dicas.js') || line.includes('mare-dicas-dev.js')) return 'mare-dicas-dev.js';
  if (line.includes('mare-login.js') || line.includes('mare-login-dev.js')) return 'mare-login-dev.js';
  if (line.includes('mare-plantao.js') || line.includes('mare-plantao-dev.js')) return 'mare-plantao-dev.js';
  if (line.includes('mare-sonar.js') || line.includes('mare-sonar-dev.js')) return 'mare-sonar-dev.js';
  if (line.includes('mare-timer.js') || line.includes('mare-timer-dev.js')) return 'mare-timer-dev.js';
  if (line.includes('okr-apresentacao.slide.html')) return 'okr-apresentacao.slide.html';
  if (line.includes('kanban.html') || line.includes('kanban-dev.html')) return 'kanban-dev.html';
  if (line.includes('painel.html') || line.includes('painel-dev.html')) return 'painel-dev.html';
  if (line.includes('okr.html') || line.includes('okr-dev.html')) return 'okr-dev.html';
  if (line.includes('oceano.html') || line.includes('oceano-dev.html')) return 'oceano-dev.html';
  if (line.includes('escala.html') || line.includes('escala-dev.html')) return 'escala-dev.html';
  if (line.includes('intake.html') || line.includes('intake-dev.html')) return 'intake-dev.html';
  if (line.includes('travessia.html') || line.includes('travessia-dev.html')) return 'travessia-dev.html';
  return undefined;
}

function buildSectionFileResolver(mapLines) {
  const lineToFile = new Array(mapLines.length + 1).fill(null);
  let currentFile = null;

  for (let i = 0; i < mapLines.length; i++) {
    const line = mapLines[i];
    if (/^##\s+/.test(line)) {
      const detected = detectFileFromHeading(line);
      currentFile = detected !== undefined ? detected : null;
    } else if (/^###\s+/.test(line)) {
      const detected = detectFileFromHeading(line);
      if (detected !== undefined) {
        currentFile = detected;
      } else if (/\b(?:functions\/|agent[e]?-agil\/|intake\/\s*e\s*backup\/|okr\/\s*—|spotify\/|maredigital\.html|guia-okr\.html)/.test(line)) {
        currentFile = null;
      }
    }
    lineToFile[i + 1] = currentFile;
  }

  return lineToFile;
}

function findDecl(srcLines, name, hintLine) {
  const esc = escapeRegExp(name);
  const patterns = [
    new RegExp(`^\\s*(?:async\\s+)?function\\s+${esc}\\s*\\(`),
    new RegExp(`^\\s*(?:const|let|var)\\s+${esc}\\s*=`),
    new RegExp(`(?:^|[\\s;{(])(?:async\\s+)?function\\s+${esc}\\s*\\(`),
    new RegExp(`(?:^|[\\s;{(])(?:const|let|var)\\s+${esc}\\s*=`),
    new RegExp(`window\\.${esc}\\s*=`),
    new RegExp(`^\\s*${esc}\\s*:\\s*(?:async\\s*)?function`),
  ];

  const candidates = [];
  for (let i = 0; i < srcLines.length; i++) {
    const line = srcLines[i];
    for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
      if (patterns[pIdx].test(line)) {
        candidates.push([pIdx, i + 1]);
        break;
      }
    }
  }

  if (candidates.length === 0) return null;
  const h = Number.isFinite(hintLine) ? hintLine : 1;
  candidates.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return Math.abs(a[1] - h) - Math.abs(b[1] - h);
  });
  return candidates[0][1];
}

function generateCodeMapFast(mapLines, srcFiles) {
  const fastLines = [];
  const today = new Date().toISOString().slice(0, 10);

  fastLines.push('# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida');
  fastLines.push('');
  fastLines.push(`> Gerado automaticamente por \`node scripts/mare-cli.js map\` em ${today}.`);
  fastLines.push('> Para o índice **completo** de todos os `<style>`, `<script>`, `const`s e funções de cada página `-dev` e módulo `mare-*-dev.js`, consulte [`docs/CODE_SYMBOLS.md`](docs/CODE_SYMBOLS.md).');
  fastLines.push('');
  fastLines.push('## 1. Sumário de Seções (`CODE_MAP.md`)');
  fastLines.push('');

  for (let i = 0; i < mapLines.length; i++) {
    const line = mapLines[i];
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      const level = m[1] === '##' ? '-' : '  -';
      const title = m[2].trim();
      fastLines.push(`${level} **L${i + 1}**: ${title}`);
    }
  }

  fastLines.push('');
  fastLines.push('## 2. Principais Âncoras Curadas por Arquivo (`-dev`)');
  fastLines.push('');

  const lineToFile = buildSectionFileResolver(mapLines);
  const anchorsByFile = {};
  const seenNamesByFile = {};
  for (const f of MAP_TARGET_FILES) {
    anchorsByFile[f] = [];
    seenNamesByFile[f] = new Set();
  }

  const addAnchor = (file, fnName, rawLine) => {
    if (!file || !anchorsByFile[file] || !fnName) return;
    if (['if', 'for', 'while', 'return', 'const', 'let', 'var', 'function', 'async'].includes(fnName)) return;
    if (seenNamesByFile[file].has(fnName)) return;
    const hint = parseInt(rawLine, 10) || 1;
    const realLine = srcFiles && srcFiles[file] ? (findDecl(srcFiles[file], fnName, hint) || hint) : hint;
    seenNamesByFile[file].add(fnName);
    anchorsByFile[file].push(`\`${fnName}\` (L${realLine})`);
  };

  // Suporta `(L1234)`, `— L1234`, `— \`arq\` L1234` e tabelas `| \`fn\` | L1234 |`
  const parenOrDashRe = /`([a-zA-Z_$][\w$]*)(?:\([^`]*\))?`(?:\s*\((?:let|const|var)\))?\s*(?:\(\s*(?:aprox\.\s*)?L(\d+)(?:[–-]\d+)?\)|[—–-]\s*(?:`([a-zA-Z0-9_.-]+\.(?:html|js))`\s*)?L(\d+))/g;
  const boldParenRe = /\*\*`([a-zA-Z_$][\w$]*)`\*\*\s*\(L(\d+)\)/g;
  const tableRowRe = /^\|\s*`([a-zA-Z_$][\w$]*)(?:\([^`]*\))?`\s*\|\s*L(\d+)/;

  for (let i = 0; i < mapLines.length; i++) {
    const sectionFile = lineToFile[i + 1];
    const line = mapLines[i];
    let m;

    parenOrDashRe.lastIndex = 0;
    while ((m = parenOrDashRe.exec(line)) !== null) {
      const fnName = m[1];
      const explicitFile = m[3] ? detectFileFromHeading(m[3]) : undefined;
      if (m[3] && explicitFile === undefined) continue; // ex.: functions/okr/agendaAgente.js
      const targetFile = explicitFile || sectionFile;
      const lineNum = m[2] || m[4];
      addAnchor(targetFile, fnName, lineNum);
    }

    boldParenRe.lastIndex = 0;
    while ((m = boldParenRe.exec(line)) !== null) {
      addAnchor(sectionFile, m[1], m[2]);
    }

    const tm = line.match(tableRowRe);
    if (tm && sectionFile) {
      addAnchor(sectionFile, tm[1], tm[2]);
    }
  }

  for (const f of MAP_TARGET_FILES) {
    const list = anchorsByFile[f];
    if (!list || list.length === 0) continue;
    const maxItems = f === 'kanban-dev.html' ? 48 : 24;
    const sliced = list.slice(0, maxItems);
    const more = list.length > maxItems ? ` ... (+${list.length - maxItems} em docs/CODE_SYMBOLS.md)` : '';
    fastLines.push(`### \`${f}\` (${list.length} âncoras curadas)`);
    for (let j = 0; j < sliced.length; j += 6) {
      fastLines.push('- ' + sliced.slice(j, j + 6).join(' · '));
    }
    if (more) fastLines.push(`- *${more.trim()}*`);
    fastLines.push('');
  }

  return fastLines.join('\n');
}

/**
 * Escaneia diretamente o código-fonte de um arquivo `.html` ou `.js` e extrai:
 * - faixas `<style>` e `<script>` (imune a strings '<style>' dentro do JS)
 * - módulos `mare-*` importados
 * - constantes globais/topo (`const NOME =` na coluna 0 ou `UPPER_CASE` até 2 espaços)
 * - todas as funções de topo/IIFE (`function foo`, `async function foo`, `window.foo =`)
 */
function scanSymbolsInSource(relFile, srcLines) {
  const isHtml = relFile.endsWith('.html');
  const styles = [];
  const scripts = [];
  const extModules = [];
  const consts = [];
  const constSeen = new Set();
  const sections = [];
  let currentSection = { title: 'Topo', fns: [] };
  sections.push(currentSection);
  const fnSeen = new Set();

  let inStyle = false;
  let styleStart = 0;
  let inScript = !isHtml;
  let scriptStart = isHtml ? 0 : 1;
  let scriptKind = 'classic';
  let inBlockComment = false;

  for (let i = 0; i < srcLines.length; i++) {
    const line = srcLines[i];
    const ln = i + 1;

    if (isHtml && !inScript) {
      if (!inStyle) {
        if (/^\s*<style\b/i.test(line)) {
          if (/<\/style\s*>/i.test(line)) {
            styles.push(`L${ln}`);
          } else {
            inStyle = true;
            styleStart = ln;
          }
          continue;
        }
        const extMatch = line.match(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
        if (extMatch) {
          if (/mare-[a-z0-9_-]+\.js/i.test(extMatch[1])) {
            extModules.push(`${extMatch[1]} (L${ln})`);
          }
          continue;
        }
        if (/^\s*<script\b/i.test(line)) {
          scriptKind = /\btype\s*=\s*["']module["']/i.test(line) ? 'module' : 'classic';
          if (/<\/script\s*>/i.test(line)) {
            scripts.push(`L${ln} (${scriptKind})`);
          } else {
            inScript = true;
            scriptStart = ln;
          }
          continue;
        }
      } else {
        if (/<\/style\s*>/i.test(line)) {
          styles.push(`L${styleStart}–L${ln}`);
          inStyle = false;
        }
        continue;
      }
      continue;
    }

    if (isHtml && inScript && /<\/script\s*>/i.test(line)) {
      scripts.push(`L${scriptStart}–L${ln} (${scriptKind})`);
      inScript = false;
      inBlockComment = false;
      continue;
    }

    if (!inScript) continue;

    // Comentários de bloco /* ... */
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (/^\s*\/\*/.test(line) && !line.includes('*/')) {
      inBlockComment = true;
      continue;
    }

    // Banner de seção: // ═══ Título ═══
    const secMatch = line.match(/^\s*\/\/\s*(?:═{3,}|─{4,})\s*([^═─\r\n]+?)\s*(?:═{2,}|─{2,})?\s*$/);
    if (secMatch) {
      const cleanSec = secMatch[1].trim().slice(0, 60);
      if (cleanSec.length >= 3) {
        if (currentSection.fns.length === 0) {
          currentSection.title = cleanSec;
        } else {
          currentSection = { title: cleanSec, fns: [] };
          sections.push(currentSection);
        }
      }
      continue;
    }

    // Constantes globais/topo (evita pegar const locais dentro de funções indentadas)
    const cMatch = line.match(/^const\s+([A-Za-z_$][\w$]*)\s*=/) ||
                   line.match(/^\s{1,2}const\s+([A-Z_$][A-Z0-9_$]{1,})\s*=/);
    if (cMatch && !constSeen.has(cMatch[1])) {
      constSeen.add(cMatch[1]);
      consts.push(`${cMatch[1]}:L${ln}`);
    }

    // Declarações de função de topo / IIFE / exports window.*
    const fnMatch = line.match(/^\s{0,2}(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/) ||
                    line.match(/^\s{0,2}window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\(|[A-Za-z_$][\w$]*\s*=>|\{)/);
    if (fnMatch && !fnSeen.has(fnMatch[1])) {
      fnSeen.add(fnMatch[1]);
      currentSection.fns.push(`${fnMatch[1]}:L${ln}`);
    }
  }

  if (!isHtml && srcLines.length > 0) {
    scripts.push(`L1–L${srcLines.length} (js)`);
  }

  return {
    totalLines: srcLines.length,
    styles,
    scripts,
    extModules,
    consts,
    sections: sections.filter((s) => s.fns.length > 0),
    fnCount: fnSeen.size,
  };
}

function generateCodeSymbols(srcFiles) {
  const files = srcFiles || loadSourceLines();
  const out = [];
  const today = new Date().toISOString().slice(0, 10);

  out.push('# CODE_SYMBOLS.md — Índice Automático Completo de Símbolos, Blocos e `const`s');
  out.push('');
  out.push(`> Gerado automaticamente do código-fonte por \`node scripts/mare-cli.js map\` (ou \`symbols\`) em ${today}.`);
  out.push('> **Como usar (Zero Buscas Cegas):** leia este arquivo com `read_file` para obter a linha exata `Lxxxx` de qualquer `<style>`, `<script>`, `const` global ou função em todos os apps `-dev` e módulos `mare-*-dev.js`.');
  out.push('> Em arquivos > 2,5 MB onde `read_file` acusa binário (`kanban-dev.html`, `kanban.html`, `guia-okr.html`), use `node scripts/mare-cli.js slice <arquivo> <inicio> <fim>` para ler o trecho exato e `"patches"` no `.mare-ship.json` para editar.');
  out.push('');

  for (const relFile of MAP_TARGET_FILES) {
    const lines = files[relFile];
    if (!lines) continue;
    const info = scanSymbolsInSource(relFile, lines);

    out.push(`## \`${relFile}\` (${info.totalLines} linhas · ${info.fnCount} funções)`);
    const metaParts = [];
    if (info.styles.length) metaParts.push(`**CSS:** ${info.styles.join(', ')}`);
    if (info.scripts.length) metaParts.push(`**JS:** ${info.scripts.join(', ')}`);
    if (info.extModules.length) metaParts.push(`**Módulos:** ${info.extModules.join(', ')}`);
    if (metaParts.length) out.push(`- ${metaParts.join(' | ')}`);

    if (info.consts.length) {
      const maxConsts = 40;
      const shownConsts = info.consts.slice(0, maxConsts);
      const extraC = info.consts.length > maxConsts ? ` (+${info.consts.length - maxConsts})` : '';
      out.push(`- **Consts (${info.consts.length}):** ${shownConsts.join(' · ')}${extraC}`);
    }

    for (const sec of info.sections) {
      const chunkSize = 10;
      for (let j = 0; j < sec.fns.length; j += chunkSize) {
        const prefix = j === 0 && sec.title !== 'Topo' ? `**[${sec.title}]** ` : '';
        out.push(`- ${prefix}${sec.fns.slice(j, j + chunkSize).join(' · ')}`);
      }
    }
    out.push('');
  }

  return out.join('\n');
}

function cmdSymbols() {
  const srcFiles = loadSourceLines();
  const symbolsContent = generateCodeSymbols(srcFiles);
  const symbolsPath = path.join(ROOT, 'docs', 'CODE_SYMBOLS.md');
  fs.mkdirSync(path.dirname(symbolsPath), { recursive: true });
  fs.writeFileSync(symbolsPath, symbolsContent, 'utf8');
  console.log(`[symbols] docs/CODE_SYMBOLS.md gerado com sucesso (${symbolsContent.split('\n').length} linhas).`);
}

function cmdMap(args = []) {
  const deepMode = args.includes('--deep');
  const codeMapPath = path.join(ROOT, 'CODE_MAP.md');
  const originalContent = fs.readFileSync(codeMapPath, 'utf8');
  const mapLines = originalContent.split(/\r?\n/);
  const srcFiles = loadSourceLines();
  const lineToFile = buildSectionFileResolver(mapLines);

  let updatesPass1 = 0;
  let updatesPass2 = 0;
  let updatesPass3 = 0;

  const pass1Patterns = [
    new RegExp('(`([a-zA-Z_$][\\w$]*)\\([^`]*\\)`\\s*\\(\\s*(?:aprox\\.\\s*)?L)(\\d+)([–-]\\d+)?(\\))', 'g'),
    new RegExp('(\\*\\*`([a-zA-Z_$][\\w$]*)`\\*\\*\\s*\\(L)(\\d+)(\\))', 'g'),
    new RegExp('(`([a-zA-Z_$][\\w$]*)`\\s*\\(L)(\\d+)([–-]\\d+)?(\\))', 'g'),
  ];
  if (deepMode) {
    pass1Patterns.push(
      new RegExp('(`([a-zA-Z_$][\\w$]*)(?:\\([^`]*\\))?`(?:\\s*\\((?:let|const|var)\\))?\\s*[—–-]\\s*L)(\\d+)([–-]\\d+)?(\\b)', 'g')
    );
  }

  for (let idx = 0; idx < mapLines.length; idx++) {
    const f = lineToFile[idx + 1];
    if (!f || !srcFiles[f]) continue;
    let line = mapLines[idx];

    for (const pat of pass1Patterns) {
      pat.lastIndex = 0;
      line = line.replace(pat, (...mArgs) => {
        const hasRangeGroup = mArgs.length >= 8;
        const prefix = mArgs[1];
        const name = mArgs[2];
        const oldLineStr = mArgs[3];
        const rangePart = hasRangeGroup ? (mArgs[4] || '') : '';
        const suffix = hasRangeGroup ? mArgs[5] : mArgs[4];

        const oldLine = parseInt(oldLineStr, 10);
        const found = findDecl(srcFiles[f], name, oldLine);
        if (found === null || found === oldLine || (deepMode && Math.abs(found - oldLine) > 600)) {
          return mArgs[0];
        }
        updatesPass1++;
        if (rangePart) {
          const oldEnd = parseInt(rangePart.slice(1), 10);
          const span = oldEnd - oldLine;
          const newEnd = found + span;
          if (span > 0 && span < 500) {
            return `${prefix}${found}${rangePart[0]}${newEnd}${suffix}`;
          }
        }
        return `${prefix}${found}${rangePart}${suffix}`;
      });
    }
    mapLines[idx] = line;
  }

  // Passo 2: Tabelas markdown `| \`fn(...)\` | L1234 |`
  const rowPat = /^(\|\s*`([a-zA-Z_$][\w$]*)(?:\([^`]*\))?`\s*\|\s*L)(\d+)([–-]\d+)?(\s*\|.*)$/;
  for (let idx = 0; idx < mapLines.length; idx++) {
    const f = lineToFile[idx + 1];
    if (!f || !srcFiles[f]) continue;
    const m = mapLines[idx].match(rowPat);
    if (!m) continue;
    const prefix = m[1];
    const name = m[2];
    const oldL = parseInt(m[3], 10);
    const rng = m[4] || '';
    const rest = m[5];

    const found = findDecl(srcFiles[f], name, oldL);
    if (found && found !== oldL) {
      updatesPass2++;
      let newRng = rng;
      if (rng) {
        const oldEnd = parseInt(rng.slice(1), 10);
        const span = oldEnd - oldL;
        if (span > 0 && span < 500) {
          newRng = `${rng[0]}${found + span}`;
        }
      }
      mapLines[idx] = `${prefix}${found}${newRng}${rest}`;
    }
  }

  // Passo 3: Sub-bullets `- L1234: \`symbol\``
  const bulletPat = /^(\s*-\s*L)(\d+)(:\s*(?:`(?:const|let|var)?\s*)?`?([a-zA-Z_$][\w$]*).*)$/;
  for (let idx = 0; idx < mapLines.length; idx++) {
    const f = lineToFile[idx + 1];
    if (!f || !srcFiles[f]) continue;
    const m = mapLines[idx].match(bulletPat);
    if (!m) continue;
    const prefix = m[1];
    const oldL = parseInt(m[2], 10);
    const rest = m[3];
    const name = m[4];
    if (['if', 'for', 'while', 'return', 'const', 'let', 'var', 'function', 'async'].includes(name)) {
      continue;
    }
    const found = findDecl(srcFiles[f], name, oldL);
    if (found && found !== oldL && Math.abs(found - oldL) < 500) {
      updatesPass3++;
      mapLines[idx] = `${prefix}${found}${rest}`;
    }
  }

  const updatedContent = mapLines.join('\n');
  if (updatedContent !== originalContent) {
    fs.writeFileSync(codeMapPath, updatedContent, 'utf8');
  }

  const fastContent = generateCodeMapFast(mapLines, srcFiles);
  const fastPath = path.join(ROOT, 'CODE_MAP_FAST.md');
  fs.writeFileSync(fastPath, fastContent, 'utf8');

  const symbolsContent = generateCodeSymbols(srcFiles);
  const symbolsPath = path.join(ROOT, 'docs', 'CODE_SYMBOLS.md');
  fs.mkdirSync(path.dirname(symbolsPath), { recursive: true });
  fs.writeFileSync(symbolsPath, symbolsContent, 'utf8');

  console.log(
    `[map] CODE_MAP.md revalidado (Pass1: ${updatesPass1}, Pass2: ${updatesPass2}, Pass3: ${updatesPass3} atualizações).`
  );
  console.log(
    `[map] CODE_MAP_FAST.md (${fastContent.split('\n').length} linhas) e docs/CODE_SYMBOLS.md (${symbolsContent.split('\n').length} linhas) gerados.`
  );
}

// ---------------------------------------------------------------------------
// 4-B. Subcomandos cirúrgicos: slice e find (leitura rápida para HTMLs > 2,6 MB)
// ---------------------------------------------------------------------------

function cmdSlice(args) {
  if (args.length < 2) {
    console.error('Uso: node scripts/mare-cli.js slice <arquivo> <linha_inicio> [linha_fim]');
    process.exit(1);
  }
  const relFile = args[0];
  const fullPath = path.isAbsolute(relFile) ? relFile : path.join(ROOT, relFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`Erro [slice]: arquivo não encontrado: ${relFile}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const start = Math.max(1, parseInt(args[1], 10) || 1);
  const endReq = args[2] ? parseInt(args[2], 10) : start + 80;
  const end = Math.min(lines.length, Math.max(start, Math.min(endReq, start + 600)));

  console.log(`=== ${relFile} (L${start}–L${end} de ${lines.length}) ===`);
  for (let i = start; i <= end; i++) {
    console.log(`${String(i).padStart(5)}: ${lines[i - 1]}`);
  }
}

function cmdFind(args) {
  let pattern = '';
  let fileFilter = '';
  let maxHits = 40;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) fileFilter = args[++i];
    else if (args[i] === '--max' && args[i + 1]) maxHits = parseInt(args[++i], 10) || 40;
    else if (!pattern) pattern = args[i];
  }
  if (!pattern) {
    console.error('Uso: node scripts/mare-cli.js find <padrao> [--file <arquivo>] [--max <N>]');
    process.exit(1);
  }

  let re;
  try {
    re = new RegExp(pattern);
  } catch (_) {
    re = new RegExp(escapeRegExp(pattern));
  }

  const candidates = [];
  if (fileFilter) {
    candidates.push(fileFilter);
  } else {
    candidates.push(...MAP_TARGET_FILES);
    const walkJs = (dir) => {
      const absDir = path.join(ROOT, dir);
      if (!fs.existsSync(absDir)) return;
      for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const rel = path.posix.join(dir, e.name);
        if (e.isDirectory()) walkJs(rel);
        else if (/\.(js|md|json)$/.test(e.name)) candidates.push(rel);
      }
    };
    walkJs('functions');
    walkJs('scripts');
  }

  let hits = 0;
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const snippet = lines[i].length > 180 ? lines[i].slice(0, 180) + '…' : lines[i];
        console.log(`${rel}:L${i + 1}: ${snippet}`);
        hits++;
        if (hits >= maxHits) {
          console.log(`... (limite de ${maxHits} ocorrências atingido; use --file ou --max para refinar)`);
          return;
        }
      }
    }
  }
  if (hits === 0) {
    console.log(`[find] Nenhuma ocorrência para /${re.source}/.`);
  }
}

// ---------------------------------------------------------------------------
// 5. Subcomando: archive-changelog (Enxuga CHANGELOG.md movendo 2026-07..09)
// ---------------------------------------------------------------------------

function cmdArchiveChangelog() {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const archivePath = path.join(ROOT, 'docs', 'changelog-archive-2026-07-a-09.md');
  const content = fs.readFileSync(changelogPath, 'utf8');

  const parts = content.split(/\n(?=## )/);
  const headerPart = parts[0];
  const keptSections = [headerPart];
  const archivedSections = [
    '# Arquivo Histórico do Changelog (Julho a Setembro de 2026)',
    '',
    '> Entradas históricas de `2026-07` a `2026-09` movidas do [`CHANGELOG.md`](../CHANGELOG.md) principal para manter a leitura e indexação rápidas.',
    '',
  ];

  let archivedCount = 0;
  let keptCount = 0;

  for (let s = 1; s < parts.length; s++) {
    const sec = parts[s];
    const entries = sec.split(/\n(?=### )/);
    const secHeader = entries[0];
    const keptEntries = [secHeader];
    const archEntries = [secHeader];
    let prodKeptInKanban = 0;
    const isKanbanProd = secHeader.startsWith('## kanban.html (produção)');

    for (let e = 1; e < entries.length; e++) {
      const entry = entries[e];
      const firstLine = entry.split('\n')[0] || '';
      const dateMatch = firstLine.match(/\b(2026-\d{2})-\d{2}\b/);
      const yearMonth = dateMatch ? dateMatch[1] : '2026-10';
      const isSoDev = /SÓ DEV/i.test(firstLine);

      if (yearMonth >= '2026-10' || (isKanbanProd && !isSoDev && prodKeptInKanban < 35)) {
        keptEntries.push(entry);
        keptCount++;
        if (isKanbanProd && !isSoDev) prodKeptInKanban++;
      } else {
        archEntries.push(entry);
        archivedCount++;
      }
    }

    keptSections.push(keptEntries.join('\n'));
    if (archEntries.length > 1) {
      archivedSections.push(archEntries.join('\n'));
    }
  }

  if (archivedCount === 0) {
    console.log('[archive-changelog] Nenhuma entrada antiga (2026-07..09) para arquivar.');
    return;
  }

  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(archivePath, archivedSections.join('\n\n') + '\n', 'utf8');
  fs.writeFileSync(changelogPath, keptSections.join('\n\n') + '\n', 'utf8');

  const newLines = fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/).length;
  const archLines = fs.readFileSync(archivePath, 'utf8').split(/\r?\n/).length;
  console.log(`[archive-changelog] ${archivedCount} entradas movidas para docs/changelog-archive-2026-07-a-09.md (${archLines} linhas).`);
  console.log(`[archive-changelog] CHANGELOG.md enxugado: ${keptCount} entradas recentes mantidas (${newLines} linhas).`);
}

// ---------------------------------------------------------------------------
// 6. Subcomando: check-script (Validação estática e de escopo de script de console)
// ---------------------------------------------------------------------------

const JS_KEYWORDS_AND_GLOBALS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof',
  'instanceof', 'void', 'in', 'of', 'function', 'async', 'await', 'class',
  'extends', 'super', 'import', 'export', 'default', 'const', 'let', 'var',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'this', 'arguments',
  'window', 'document', 'console', 'location', 'history', 'navigator',
  'localStorage', 'sessionStorage', 'performance', 'screen', 'crypto',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Proxy', 'Reflect',
  'JSON', 'Intl', 'Error', 'TypeError', 'ReferenceError', 'SyntaxError',
  'RangeError', 'URIError', 'EvalError', 'ArrayBuffer', 'Uint8Array',
  'Int32Array', 'Float64Array', 'DataView', 'Blob', 'File', 'FileReader',
  'FormData', 'URL', 'URLSearchParams', 'Headers', 'Request', 'Response',
  'AbortController', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent',
  'FocusEvent', 'InputEvent', 'MutationObserver', 'IntersectionObserver',
  'ResizeObserver', 'Node', 'Element', 'HTMLElement', 'NodeFilter', 'DOMParser',
  'XMLSerializer', 'CSS', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURI', 'decodeURI', 'encodeURIComponent',
  'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'structuredClone', 'atob', 'btoa', 'fetch',
  'getComputedStyle', 'matchMedia', 'alert', 'confirm', 'prompt',
]);

function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '""')
    .replace(/'(?:\\.|[^\\'])*'/g, '""')
    .replace(/"(?:\\.|[^\\"])*"/g, '""');
}

function collectLocalDeclarations(cleanCode, rawCode) {
  const locals = new Set();
  let m;

  const fnDeclRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  while ((m = fnDeclRe.exec(cleanCode)) !== null) {
    locals.add(m[1]);
    m[2].split(',').forEach((p) => {
      const id = p.split('=')[0].replace(/[{}\[\]\.]/g, ' ').trim().split(/\s+/).pop();
      if (id && /^[A-Za-z_$][\w$]*$/.test(id)) locals.add(id);
    });
  }

  const anonFnRe = /\bfunction\s*\(([^)]*)\)/g;
  while ((m = anonFnRe.exec(cleanCode)) !== null) {
    m[1].split(',').forEach((p) => {
      const id = p.split('=')[0].replace(/[{}\[\]\.]/g, ' ').trim().split(/\s+/).pop();
      if (id && /^[A-Za-z_$][\w$]*$/.test(id)) locals.add(id);
    });
  }

  const arrowParenRe = /\(([^()]*)\)\s*=>/g;
  while ((m = arrowParenRe.exec(cleanCode)) !== null) {
    m[1].split(',').forEach((p) => {
      const id = p.split('=')[0].replace(/[{}\[\]\.]/g, ' ').trim().split(/\s+/).pop();
      if (id && /^[A-Za-z_$][\w$]*$/.test(id)) locals.add(id);
    });
  }

  const arrowSingleRe = /\b([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = arrowSingleRe.exec(cleanCode)) !== null) {
    locals.add(m[1]);
  }

  const catchRe = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
  while ((m = catchRe.exec(cleanCode)) !== null) {
    locals.add(m[1]);
  }

  const varRe = /\b(?:const|let|var)\s+([^;=\n]+)/g;
  while ((m = varRe.exec(cleanCode)) !== null) {
    const chunk = m[1];
    const idRe = /\b([A-Za-z_$][\w$]*)\b/g;
    let im;
    while ((im = idRe.exec(chunk)) !== null) {
      if (!JS_KEYWORDS_AND_GLOBALS.has(im[1])) locals.add(im[1]);
    }
  }

  const rawFnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = rawFnRe.exec(rawCode)) !== null) {
    locals.add(m[1]);
  }
  const rawVarRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
  while ((m = rawVarRe.exec(rawCode)) !== null) {
    locals.add(m[1]);
  }

  return locals;
}

function symbolExistsInPage(sym, combinedPageSource) {
  const esc = escapeRegExp(sym);
  const patterns = [
    new RegExp(`\\bfunction\\s+${esc}\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+${esc}\\b`),
    new RegExp(`\\bwindow\\.${esc}\\s*=`),
    new RegExp(`\\b${esc}\\s*=\\s*(?:async\\s*)?(?:function|\\()`),
    new RegExp(`\\b${esc}\\s*:\\s*(?:async\\s*)?function\\b`),
  ];
  return patterns.some((re) => re.test(combinedPageSource));
}

function verifyConsoleTestScript(pageFile, scriptCode) {
  const errors = [];
  const resolvedPage = pageFile.endsWith('.html') || pageFile.endsWith('.js')
    ? pageFile
    : `${pageFile.replace(/-dev$/, '')}-dev.html`;
  const pagePath = path.join(ROOT, resolvedPage);

  if (!fs.existsSync(pagePath)) {
    return { ok: false, errors: [`Arquivo alvo não encontrado: ${resolvedPage}`] };
  }

  try {
    new vm.Script(scriptCode, { filename: 'console-test-script.js' });
  } catch (err) {
    errors.push(`Erro de sintaxe JS no script de teste: ${err.message}`);
    return { ok: false, errors, page: resolvedPage };
  }

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  let combinedSource = pageSource;
  for (const mod of SHARED_MODULES) {
    const modFile = `${mod}.js`;
    const modPath = path.join(ROOT, modFile);
    if (fs.existsSync(modPath) && pageSource.includes(modFile)) {
      combinedSource += '\n' + fs.readFileSync(modPath, 'utf8');
    }
  }

  const cleanScript = stripCommentsAndStrings(scriptCode);

  const forbiddenCalls = ['_set', '_update', '_remove', 'saveCard', 'deleteCard', 'saveComunicado', 'excluirComunicado'];
  for (const fn of forbiddenCalls) {
    const re = new RegExp(`(?:^|[^\\w$])${escapeRegExp(fn)}\\s*\\(`, 'm');
    if (re.test(cleanScript)) {
      errors.push(`Violação Read-Only: o script de teste chama "${fn}(" (proibido gravar no Firebase ou salvar estado).`);
    }
  }

  const pageConsts = new Set();
  const constRe = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let cm;
  while ((cm = constRe.exec(pageSource)) !== null) {
    pageConsts.add(cm[1]);
  }
  const locals = collectLocalDeclarations(cleanScript, scriptCode);
  for (const cName of pageConsts) {
    if (locals.has(cName)) continue;
    const assignRe = new RegExp(`(?:^|[^.\\w$])${escapeRegExp(cName)}\\s*=(?!=)`, 'm');
    if (assignRe.test(cleanScript)) {
      errors.push(`Reatribuição de const da página: "${cName}" é declarado como \`const\` em ${resolvedPage}. Use mutação reversível (ex.: ${cName}.setTime(...)) dentro de try/finally.`);
    }
  }

  const callRe = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let fm;
  const checkedFns = new Set();
  while ((fm = callRe.exec(cleanScript)) !== null) {
    const fnName = fm[2];
    if (checkedFns.has(fnName)) continue;
    checkedFns.add(fnName);
    if (JS_KEYWORDS_AND_GLOBALS.has(fnName)) continue;
    if (locals.has(fnName)) continue;
    if (!symbolExistsInPage(fnName, combinedSource)) {
      errors.push(`Símbolo/função inexistente (Linha Vermelha #4): "${fnName}(" foi chamado no script de teste, mas NÃO existe em ${resolvedPage} nem nos módulos compartilhados!`);
    }
  }

  const getByIdRe = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let im;
  while ((im = getByIdRe.exec(scriptCode)) !== null) {
    const idVal = im[1];
    const createdLocally = new RegExp(`id\\s*=\\s*['"]${escapeRegExp(idVal)}['"]`).test(scriptCode);
    if (!createdLocally && !combinedSource.includes(idVal)) {
      errors.push(`Elemento DOM inexistente: getElementById('${idVal}') chamado no script, mas "${idVal}" não consta em ${resolvedPage}.`);
    }
  }

  if (!scriptCode.includes('_resultadosTeste')) {
    errors.push('O script de teste deve gravar os resultados em `window._resultadosTeste`.');
  }
  if (!scriptCode.includes('console.table')) {
    errors.push('O script de teste deve finalizar exibindo `console.table(...)`.');
  }

  return { ok: errors.length === 0, errors, page: resolvedPage };
}

function cmdCheckScript(args) {
  let page = '';
  let file = '';
  let inlineCode = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--page' && args[i + 1]) page = args[++i];
    else if (args[i] === '--file' && args[i + 1]) file = args[++i];
    else if (args[i] === '--code' && args[i + 1]) inlineCode = args[++i];
  }
  if (!page || (!file && !inlineCode)) {
    console.error('Uso: node scripts/mare-cli.js check-script --page <arquivo-dev.html> (--file <script.js> | --code "<js>")');
    process.exit(1);
  }
  let code = inlineCode;
  if (file) {
    const scriptPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
    if (!fs.existsSync(scriptPath)) {
      console.error(`Erro: arquivo de script não encontrado: ${file}`);
      process.exit(1);
    }
    code = fs.readFileSync(scriptPath, 'utf8');
  }
  const res = verifyConsoleTestScript(page, code);
  if (!res.ok) {
    console.error(`❌ [check-script] Falha na validação contra ${res.page}:`);
    res.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`✅ [check-script] Script de console validado com sucesso contra ${res.page} (sintaxe, read-only, consts e existência de símbolos OK).`);
}

// ---------------------------------------------------------------------------
// 7. Subcomando: ship (Pipeline declarativo em 1 clique via .mare-ship.json)
// ---------------------------------------------------------------------------

function runCmdOrThrow(bin, cmdArgs, opts = {}) {
  const res = spawnSync(bin, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.capture ? 'pipe' : 'inherit',
    env: opts.env || process.env,
    input: opts.input,
  });
  if (res.status !== 0) {
    const detail = opts.capture ? `\n${res.stdout || ''}\n${res.stderr || ''}` : '';
    throw new Error(`Comando falhou (${bin} ${cmdArgs.join(' ')}): exit ${res.status}${detail}`);
  }
  return res;
}

function getGitHubTokenFromGitCredential() {
  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) {
    return process.env.GH_TOKEN.trim();
  }
  const res = spawnSync('git', ['credential', 'fill'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: 'protocol=https\nhost=github.com\n\n',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (res.status === 0 && res.stdout) {
    const m = res.stdout.match(/^password=(.+)$/m);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function applyManifestFilesAndPatches(manifest) {
  if (Array.isArray(manifest.files)) {
    for (const item of manifest.files) {
      if (!item || !item.path || typeof item.content !== 'string') {
        throw new Error('Entrada inválida em manifest.files (exige { path, content }).');
      }
      const abs = path.join(ROOT, item.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, item.content, 'utf8');
      console.log(`[ship:files] Gravado ${item.path} (${item.content.length} chars).`);
    }
  }

  if (Array.isArray(manifest.patches)) {
    for (const p of manifest.patches) {
      if (!p || !p.file || typeof p.target !== 'string' || typeof p.replacement !== 'string') {
        throw new Error('Entrada inválida em manifest.patches (exige { file, target, replacement }).');
      }
      const abs = path.join(ROOT, p.file);
      if (!fs.existsSync(abs)) {
        throw new Error(`[ship:patches] Arquivo não encontrado: ${p.file}`);
      }
      const original = fs.readFileSync(abs, 'utf8');
      if (!original.includes(p.target)) {
        throw new Error(`[ship:patches] Trecho target não encontrado em ${p.file}: "${p.target.slice(0, 80)}..."`);
      }
      const updated = p.all
        ? original.split(p.target).join(p.replacement)
        : original.replace(p.target, () => p.replacement);
      fs.writeFileSync(abs, updated, 'utf8');
      console.log(`[ship:patches] Patch aplicado em ${p.file}.`);
    }
  }
}

/**
 * Em ambientes Windows onde `.agents/skills` foi materializado como diretório físico
 * em vez de symlink, espelha automaticamente `.claude/skills/*\/SKILL.md` -> `.agents/skills/*\/SKILL.md`.
 */
function syncAgentSkillsMirror() {
  const claudeSkillsDir = path.join(ROOT, '.claude', 'skills');
  const agentsSkillsDir = path.join(ROOT, '.agents', 'skills');
  if (!fs.existsSync(claudeSkillsDir) || !fs.existsSync(agentsSkillsDir)) return;
  const lstat = fs.lstatSync(agentsSkillsDir);
  if (lstat.isSymbolicLink() || !lstat.isDirectory()) return;

  let synced = 0;
  for (const entry of fs.readdirSync(claudeSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcSkill = path.join(claudeSkillsDir, entry.name, 'SKILL.md');
    const dstSkill = path.join(agentsSkillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(srcSkill)) continue;
    const srcContent = fs.readFileSync(srcSkill, 'utf8');
    const dstContent = fs.existsSync(dstSkill) ? fs.readFileSync(dstSkill, 'utf8') : '';
    if (srcContent !== dstContent) {
      fs.mkdirSync(path.dirname(dstSkill), { recursive: true });
      fs.writeFileSync(dstSkill, srcContent, 'utf8');
      synced++;
    }
  }
  if (synced > 0) {
    console.log(`[ship] ${synced} skill(s) sincronizada(s) em .agents/skills/.`);
  }
}

function cmdShip(args) {
  let manifestRel = '.mare-ship.json';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manifest' && args[i + 1]) manifestRel = args[++i];
  }
  const manifestPath = path.isAbsolute(manifestRel) ? manifestRel : path.join(ROOT, manifestRel);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Erro: manifesto ${manifestRel} não encontrado. Crie-o com write_file antes de rodar "node scripts/mare-cli.js ship".`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const branch = (manifest.branch || '').trim();
  const commitMessage = (manifest.commitMessage || '').trim();
  const prTitle = (manifest.prTitle || commitMessage.split('\n')[0] || '').trim();
  const baseRef = (manifest.base || 'origin/main').trim();
  const reuseBranch = Boolean(manifest.reuseBranch);

  if (!branch || !branch.startsWith('antigravity/')) {
    console.error('Erro [ship]: "branch" é obrigatório e deve começar com "antigravity/".');
    process.exit(1);
  }
  if (!commitMessage) {
    console.error('Erro [ship]: "commitMessage" é obrigatório.');
    process.exit(1);
  }

  let prBody = manifest.prBody || '';
  if (!prBody && manifest.prSummary) {
    prBody = `## Resumo\n${manifest.prSummary.trim()}\n`;
    if (manifest.testScript && manifest.testScript.code) {
      prBody += `\n## Script de teste\n\`\`\`javascript\n${manifest.testScript.code.trim()}\n\`\`\`\n`;
    }
  }

  let testPage = manifest.testScript && manifest.testScript.page;
  let testCode = manifest.testScript && manifest.testScript.code;
  if (!testCode && prBody && prBody.includes('## Script de teste')) {
    const mBlock = prBody.match(/##\s+Script de teste[\s\S]*?```(?:javascript|js)\r?\n([\s\S]*?)```/i);
    if (mBlock && mBlock[1]) {
      testCode = mBlock[1].trim();
      if (!testPage && Array.isArray(manifest.bump) && manifest.bump.length === 1) {
        testPage = manifest.bump[0];
      }
    }
  }

  // Pré-validação rápida de sintaxe do testScript antes de tocar no Git
  if (testCode) {
    try {
      new vm.Script(testCode, { filename: 'console-test-script.js' });
    } catch (err) {
      console.error(`❌ [ship] Erro de sintaxe JS no script de teste: ${err.message}`);
      process.exit(1);
    }
  }

  // Remove o manifesto antes de inspecionar git status
  if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);

  // Salva em memória arquivos já editados na worktree antes do checkout
  const statusOut = runCmdOrThrow('git', ['status', '--porcelain'], { capture: true }).stdout;
  const savedFiles = new Map();
  for (const line of statusOut.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const rel = line.slice(3).trim().replace(/^"(.*)"$/, '$1');
    if (rel === '.mare-ship.json') continue;
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      savedFiles.set(rel, fs.readFileSync(abs));
    }
  }

  console.log(`[ship] Sincronizando git e preparando branch ${branch}...`);
  runCmdOrThrow('git', ['fetch', 'origin']);
  if (reuseBranch) {
    runCmdOrThrow('git', ['checkout', branch]);
  } else {
    runCmdOrThrow('git', ['checkout', '-f', '-B', branch, baseRef]);
  }

  for (const [rel, buf] of savedFiles.entries()) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }

  // Aplica files e patches declarativos sobre a base limpa
  applyManifestFilesAndPatches(manifest);
  syncAgentSkillsMirror();

  if (Array.isArray(manifest.promote) && manifest.promote.length > 0) {
    console.log(`[ship] Promovendo dev -> prod: ${manifest.promote.join(', ')}...`);
    runCmdOrThrow(process.execPath, [path.join(ROOT, '.claude/skills/subirproprod/promover.js'), ...manifest.promote]);
  }

  if (Array.isArray(manifest.bump) && manifest.bump.length > 0) {
    cmdBump(manifest.bump);
  }

  // Validação completa do script de teste contra o arquivo -dev JÁ atualizado
  if (testCode && testPage) {
    const check = verifyConsoleTestScript(testPage, testCode);
    if (!check.ok) {
      console.error(`❌ [ship] Abortado! O script de teste falhou na validação contra ${check.page}:`);
      check.errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
    console.log(`✅ [ship] Script de teste validado contra ${check.page}.`);
  }

  if (Array.isArray(manifest.log)) {
    for (const entry of manifest.log) {
      if (entry && entry.type && entry.title && entry.body) {
        cmdLog(['--type', entry.type, '--title', entry.title, '--body', entry.body]);
      }
    }
  } else if (manifest.log && manifest.log.type && manifest.log.title && manifest.log.body) {
    cmdLog(['--type', manifest.log.type, '--title', manifest.log.title, '--body', manifest.log.body]);
  }

  if (manifest.map) {
    cmdMap();
    if (fs.existsSync(path.join(ROOT, 'scripts/mapa.js'))) {
      runCmdOrThrow(process.execPath, [path.join(ROOT, 'scripts/mapa.js')]);
    }
  }

  const promotedConhecimentoTarget = Array.isArray(manifest.promote) &&
    manifest.promote.some((t) => ['kanban', 'okr', 'oceano'].includes(t));
  if (manifest.conhecimento || promotedConhecimentoTarget) {
    console.log('[ship] Gerando functions/agente-agil-orquestrador/conhecimento/*.json...');
    runCmdOrThrow(process.execPath, [path.join(ROOT, 'functions/agente-agil-orquestrador/conhecimento/gerar.js')]);
    runCmdOrThrow(process.execPath, ['--test', path.join(ROOT, 'functions/agente-agil-orquestrador/__tests__/conhecimento.test.js')]);
  }

  if (Array.isArray(manifest.tests)) {
    for (const testFile of manifest.tests) {
      console.log(`[ship] Rodando teste: ${testFile}...`);
      runCmdOrThrow(process.execPath, ['--test', testFile]);
    }
  }

  console.log('[ship] Executando node scripts/checar.js...');
  runCmdOrThrow(process.execPath, [path.join(ROOT, 'scripts/checar.js')]);

  runCmdOrThrow('git', ['add', '-A']);
  const fullCommitMsg = /Agent:\s*antigravity/i.test(commitMessage)
    ? commitMessage
    : `${commitMessage}\n\nAgent: antigravity`;
  runCmdOrThrow('git', ['commit', '-m', fullCommitMsg]);
  runCmdOrThrow('git', ['push', '-u', 'origin', branch]);

  if (manifest.skipPr) {
    console.log(`✅ [ship] Branch ${branch} enviada com sucesso (skipPr=true).`);
    return;
  }

  const ghToken = getGitHubTokenFromGitCredential();
  const ghEnv = { ...process.env };
  if (ghToken) ghEnv.GH_TOKEN = ghToken;

  const os = require('os');
  const bodyTmp = path.join(os.tmpdir(), `mare-pr-body-${Date.now()}.md`);
  fs.writeFileSync(bodyTmp, prBody || commitMessage, 'utf8');

  try {
    const viewRes = spawnSync('gh', ['pr', 'view', branch, '--json', 'number,url'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: ghEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (viewRes.status === 0 && viewRes.stdout) {
      const prInfo = JSON.parse(viewRes.stdout);
      runCmdOrThrow('gh', ['pr', 'edit', String(prInfo.number), '--title', prTitle, '--body-file', bodyTmp], { env: ghEnv });
      console.log(`✅ [ship] PR #${prInfo.number} atualizada com sucesso: ${prInfo.url}`);
    } else {
      const createRes = runCmdOrThrow(
        'gh',
        ['pr', 'create', '--base', 'main', '--head', branch, '--title', prTitle, '--body-file', bodyTmp],
        { env: ghEnv, capture: true }
      );
      console.log(`✅ [ship] PR criada com sucesso: ${(createRes.stdout || '').trim()}`);
    }
  } finally {
    if (fs.existsSync(bodyTmp)) fs.unlinkSync(bodyTmp);
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const cmd = (args[0] || '').toLowerCase();

  switch (cmd) {
    case 'status':
      cmdStatus();
      break;
    case 'brief':
      cmdBrief();
      break;
    case 'daily':
      cmdDaily();
      break;
    case 'bump':
      cmdBump(args.slice(1));
      break;
    case 'log':
      cmdLog(args.slice(1));
      break;
    case 'map':
      cmdMap(args.slice(1));
      break;
    case 'symbols':
      cmdSymbols();
      break;
    case 'slice':
      cmdSlice(args.slice(1));
      break;
    case 'find':
      cmdFind(args.slice(1));
      break;
    case 'archive-changelog':
      cmdArchiveChangelog();
      break;
    case 'check-script':
      cmdCheckScript(args.slice(1));
      break;
    case 'ship':
      cmdShip(args.slice(1));
      break;
    default:
      console.log('Uso: node scripts/mare-cli.js <status|brief|daily|bump|log|map|symbols|slice|find|archive-changelog|check-script|ship> [opções]');
      console.log('  status                                  Mostra versões (version.json) e ?v=N dos módulos');
      console.log('  brief                                   Resumo instantâneo (/seatualizar em <0,15s)');
      console.log('  daily                                   Monitoramento diário completo (brief + promover --status + checar + tests)');
      console.log('  bump [alvos...]                         Incrementa versão de páginas -dev ou ?v=N de módulos');
      console.log('  log --type <feature|bug> --title "..."  Insere entrada em CHANGELOG.md ou BUGS_E_CORRECOES.md');
      console.log('  map [--deep]                            Revalida âncoras e gera CODE_MAP_FAST.md + docs/CODE_SYMBOLS.md');
      console.log('  symbols                                 Regenera apenas docs/CODE_SYMBOLS.md');
      console.log('  slice <arq> <ini> [fim]                 Lê trecho numerado (essencial para HTMLs > 2,6 MB como kanban-dev.html)');
      console.log('  find <padrao> [--file <arq>] [--max N]  Busca rápida numerada em páginas -dev, módulos e functions/');
      console.log('  archive-changelog                       Arquiva entradas 2026-07..09 em docs/changelog-archive-2026-07-a-09.md');
      console.log('  check-script --page <arq> (--file|--code) Valida sintaxe, read-only, consts e símbolos do script de teste');
      console.log('  ship [--manifest .mare-ship.json]       Executa files/patches + bump/log/map + check-script + checar + commit + PR');
      process.exit(cmd ? 1 : 0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  incrementVersionString,
  scanModuleCacheBusters,
  scanSymbolsInSource,
  generateCodeSymbols,
  cmdStatus,
  cmdBrief,
  cmdDaily,
  cmdBump,
  cmdLog,
  cmdMap,
  cmdSymbols,
  cmdSlice,
  cmdFind,
  cmdArchiveChangelog,
  verifyConsoleTestScript,
  cmdCheckScript,
  applyManifestFilesAndPatches,
  cmdShip,
};
