#!/usr/bin/env node
'use strict';

/**
 * mare-cli.js — CLI de Governança de Versão (-dev), Cache-Buster, Logs e Code Map do Maré Digital
 * Zero dependências externas (Node.js puro / CommonJS).
 *
 * Divisão de papéis sem sobreposição com `promover.js`:
 * - `scripts/mare-cli.js` cuida de `status` (versões e `?v=N`), `bump` (incremento em `-dev` + `version.json` + `?v=N`),
 *   `log` (inserção padronizada em `CHANGELOG.md` ou `BUGS_E_CORRECOES.md`) e `map` (revalidação de `CODE_MAP.md` + geração de `CODE_MAP_FAST.md`).
 * - `.claude/skills/subirproprod/promover.js` cuida exclusivamente da promoção dev → prod (`--status` e `<alvos>`),
 *   preservando as divergências permanentes de produção.
 *
 * Subcomandos:
 *   node scripts/mare-cli.js status
 *   node scripts/mare-cli.js bump [alvos...]
 *   node scripts/mare-cli.js log --type <feature|bug> --title "<titulo>" [--body "<itens>"] [--body-file <caminho>]
 *   node scripts/mare-cli.js map
 *   node scripts/mare-cli.js check-script --page <arquivo-dev.html> (--file <script.js> | --code "<js>")
 *   node scripts/mare-cli.js ship [--manifest <caminho>]
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const DEV_HTML_FILES = [
  'kanban-dev.html',
  'painel-dev.html',
  'okr-dev.html',
  'oceano-dev.html',
  'escala-dev.html',
  'intake-dev.html',
];

const SHARED_MODULES = [
  'mare-notif-dev',
  'mare-metas-dev',
  'mare-dicas-dev',
  'mare-login-dev',
  'mare-plantao-dev',
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
  // Caso 1: vX.Y.Z-dev ou vX.Y.Z
  const semverMatch = verStr.match(/^(v\d+\.\d+\.)(\d+)(.*)$/);
  if (semverMatch) {
    const nextPatch = parseInt(semverMatch[2], 10) + 1;
    return `${semverMatch[1]}${nextPatch}${semverMatch[3]}`;
  }
  // Caso 2: vX.Y · sufixo
  const minorMatch = verStr.match(/^(v\d+\.)(\d+)(.*)$/);
  if (minorMatch) {
    const nextMinor = parseInt(minorMatch[2], 10) + 1;
    return `${minorMatch[1]}${nextMinor}${minorMatch[3]}`;
  }
  throw new Error(`Formato de versão não reconhecido: "${verStr}"`);
}

/**
 * Escaneia os arquivos -dev.html em busca de `<script src="<mod>.js?v=N">`
 * Retorna { [mod]: { max: number, byFile: { [htmlFile]: number[] } } }
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
// 2. Subcomando: bump [alvos...]
// ---------------------------------------------------------------------------

function cmdBump(targets) {
  if (!targets || targets.length === 0) {
    console.error('Uso: node scripts/mare-cli.js bump <alvo1> [alvo2 ...]');
    console.error('  Módulos: mare-notif-dev, mare-metas-dev, mare-dicas-dev, mare-login-dev');
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
        console.error(`[bump] Chave "${versionKey}" não encontrada em version.json`);
        process.exit(1);
      }
      const newVer = incrementVersionString(oldVer);
      ver[versionKey] = newVer;
      versionJsonDirty = true;

      // Atualiza no arquivo HTML correspondente
      const htmlPath = path.join(ROOT, htmlFile);
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        let replacedInHtml = false;

        // Padrão 1: <div class="version">oldVer</div> (kanban-dev, painel-dev, okr-dev)
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

        // Padrão 2: const VERSION = 'oldVer' (oceano-dev, escala-dev)
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
    const bfPath = path.resolve( process.cwd(), opts.bodyFile );
    bodyText = fs.readFileSync(bfPath, 'utf8');
  } else if (opts.body) {
    // Converte "\n" escapado em quebras reais se necessário
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
      console.error('Erro: cabeçalho "## 🐛 Histórico de Bugs e Correções" não encontrado em BUGS_E_CORRECOES.md (nunca inserir antes da seção de Armadilhas).');
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
// 4. Subcomando: map (Revalidação de âncoras Lxxxx + geração do CODE_MAP_FAST.md)
// ---------------------------------------------------------------------------

const MAP_TARGET_FILES = [
  'kanban-dev.html',
  'painel-dev.html',
  'okr-dev.html',
  'oceano-dev.html',
  'escala-dev.html',
  'okr-apresentacao.slide.html',
  'mare-notif-dev.js',
  'mare-metas-dev.js',
  'mare-dicas-dev.js',
  'mare-login-dev.js',
  'mare-plantao-dev.js',
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

/**
 * Detecta a qual arquivo pertence uma linha do CODE_MAP.md baseando-se nos
 * cabeçalhos `## ` e `### ` atuais do documento (nunca depende de números fixos de linha).
 */
function buildSectionFileResolver(mapLines) {
  const lineToFile = new Array(mapLines.length + 1).fill(null);
  let currentFile = null;

  for (let i = 0; i < mapLines.length; i++) {
    const line = mapLines[i];
    if (/^##\s+/.test(line)) {
      if (line.includes('mare-notif.js') || line.includes('mare-notif-dev.js')) {
        currentFile = 'mare-notif-dev.js';
      } else if (line.includes('mare-metas.js') || line.includes('mare-metas-dev.js')) {
        currentFile = 'mare-metas-dev.js';
      } else if (line.includes('mare-dicas.js') || line.includes('mare-dicas-dev.js')) {
        currentFile = 'mare-dicas-dev.js';
      } else if (line.includes('mare-login.js') || line.includes('mare-login-dev.js')) {
        currentFile = 'mare-login-dev.js';
      } else if (line.includes('mare-plantao.js') || line.includes('mare-plantao-dev.js')) {
        currentFile = 'mare-plantao-dev.js';
      } else if (line.includes('kanban.html') || line.includes('kanban-dev.html')) {
        currentFile = 'kanban-dev.html';
      } else if (line.includes('painel.html') || line.includes('painel-dev.html')) {
        currentFile = 'painel-dev.html';
      } else if (line.includes('okr.html') || line.includes('okr-dev.html')) {
        currentFile = 'okr-dev.html';
      } else if (line.includes('oceano.html') || line.includes('oceano-dev.html')) {
        currentFile = 'oceano-dev.html';
      } else if (line.includes('escala.html') || line.includes('escala-dev.html')) {
        currentFile = 'escala-dev.html';
      } else if (line.includes('okr-apresentacao.slide.html')) {
        currentFile = 'okr-apresentacao.slide.html';
      } else {
        currentFile = null;
      }
    } else if (/^###\s+/.test(line)) {
      // Na seção "Páginas Secundárias", cada ### define uma página diferente
      if (line.includes('painel.html') || line.includes('painel-dev.html')) {
        currentFile = 'painel-dev.html';
      } else if (line.includes('okr.html') || line.includes('okr-dev.html')) {
        currentFile = 'okr-dev.html';
      } else if (line.includes('oceano.html') || line.includes('oceano-dev.html')) {
        currentFile = 'oceano-dev.html';
      } else if (line.includes('escala.html') || line.includes('escala-dev.html')) {
        currentFile = 'escala-dev.html';
      } else if (line.includes('okr-apresentacao.slide.html')) {
        currentFile = 'okr-apresentacao.slide.html';
      } else if (line.includes('maredigital.html') || line.includes('intake.html')) {
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
  candidates.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return Math.abs(a[1] - hintLine) - Math.abs(b[1] - hintLine);
  });
  return candidates[0][1];
}

function generateCodeMapFast(mapLines) {
  const fastLines = [];
  const today = new Date().toISOString().slice(0, 10);

  fastLines.push('# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida');
  fastLines.push('');
  fastLines.push(`> Gerado automaticamente por \`node scripts/mare-cli.js map\` em ${today}.`);
  fastLines.push('> Use este índice para localizar rapidamente a linha no `CODE_MAP.md` ou as âncoras `Lxxxx` diretas nos arquivos `-dev`.');
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
  fastLines.push('## 2. Principais Âncoras por Arquivo (`-dev`)');
  fastLines.push('');

  // Coleta as primeiras âncoras de cada seção/arquivo no CODE_MAP.md
  const lineToFile = buildSectionFileResolver(mapLines);
  const anchorsByFile = {};
  for (const f of MAP_TARGET_FILES) anchorsByFile[f] = [];

  const anchorExtractRe = /`([a-zA-Z_$][\w$]*)\([^`]*\)`\s*\(L(\d+)(?:[–-]\d+)?\)|\*\*`([a-zA-Z_$][\w$]*)`\*\*\s*\(L(\d+)\)/g;

  for (let i = 0; i < mapLines.length; i++) {
    const f = lineToFile[i + 1];
    if (!f || !anchorsByFile[f]) continue;
    const line = mapLines[i];
    let m;
    anchorExtractRe.lastIndex = 0;
    while ((m = anchorExtractRe.exec(line)) !== null) {
      const fnName = m[1] || m[3];
      const lineNum = m[2] || m[4];
      const token = `\`${fnName}\` (L${lineNum})`;
      if (!anchorsByFile[f].includes(token)) {
        anchorsByFile[f].push(token);
      }
    }
  }

  for (const f of MAP_TARGET_FILES) {
    const list = anchorsByFile[f];
    if (!list || list.length === 0) continue;
    const maxItems = f === 'kanban-dev.html' ? 45 : 18;
    const sliced = list.slice(0, maxItems);
    const more = list.length > maxItems ? ` ... (+${list.length - maxItems} em CODE_MAP.md)` : '';
    fastLines.push(`### \`${f}\` (${list.length} símbolos mapeados)`);
    // Agrupa em linhas de até 6 símbolos para manter < 350 linhas com alta densidade
    for (let j = 0; j < sliced.length; j += 6) {
      fastLines.push('- ' + sliced.slice(j, j + 6).join(' · '));
    }
    if (more) fastLines.push(`- *${more.trim()}*`);
    fastLines.push('');
  }

  return fastLines.join('\n');
}

function cmdMap() {
  const codeMapPath = path.join(ROOT, 'CODE_MAP.md');
  const originalContent = fs.readFileSync(codeMapPath, 'utf8');
  const mapLines = originalContent.split(/\r?\n/);
  const srcFiles = loadSourceLines();
  const lineToFile = buildSectionFileResolver(mapLines);

  let updatesPass1 = 0;
  let updatesPass2 = 0;
  let updatesPass3 = 0;

  // Passo 1: Padrões `fnName(...)` (L1234) ou **`CONST_NAME`** (L1234)
  const pass1Patterns = [
    new RegExp('(`([a-zA-Z_$][\\w$]*)\\([^`]*\\)`\\s*\\(\\s*(?:aprox\\.\\s*)?L)(\\d+)([–-]\\d+)?(\\))', 'g'),
    new RegExp('(\\*\\*`([a-zA-Z_$][\\w$]*)`\\*\\*\\s*\\(L)(\\d+)(\\))', 'g'),
    new RegExp('(`([a-zA-Z_$][\\w$]*)`\\s*\\(L)(\\d+)([–-]\\d+)?(\\))', 'g'),
  ];

  for (let idx = 0; idx < mapLines.length; idx++) {
    const f = lineToFile[idx + 1];
    if (!f || !srcFiles[f]) continue;
    let line = mapLines[idx];

    for (const pat of pass1Patterns) {
      pat.lastIndex = 0;
      line = line.replace(pat, (...args) => {
        // Ajusta grupos conforme o padrão (5 ou 4 grupos)
        const hasRangeGroup = args.length >= 8;
        const prefix = args[1];
        const name = args[2];
        const oldLineStr = args[3];
        const rangePart = hasRangeGroup ? (args[4] || '') : '';
        const suffix = hasRangeGroup ? args[5] : args[4];

        const oldLine = parseInt(oldLineStr, 10);
        const found = findDecl(srcFiles[f], name, oldLine);
        if (found === null || found === oldLine) {
          return args[0];
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

  const fastContent = generateCodeMapFast(mapLines);
  const fastPath = path.join(ROOT, 'CODE_MAP_FAST.md');
  fs.writeFileSync(fastPath, fastContent, 'utf8');
  const fastLineCount = fastContent.split('\n').length;

  console.log(
    `[map] CODE_MAP.md revalidado (Pass1: ${updatesPass1}, Pass2: ${updatesPass2}, Pass3: ${updatesPass3} atualizações).`
  );
  console.log(
    `[map] CODE_MAP_FAST.md gerado com sucesso (${fastLineCount} linhas).`
  );
}

// ---------------------------------------------------------------------------
// 5. Subcomando: archive-changelog (Enxuga CHANGELOG.md movendo 2026-07..09)
// ---------------------------------------------------------------------------

function cmdArchiveChangelog() {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const archivePath = path.join(ROOT, 'docs', 'changelog-archive-2026-07-a-09.md');
  const content = fs.readFileSync(changelogPath, 'utf8');

  // Divide o arquivo pelas seções de nível 2 (`\n## `)
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

      // Mantém tudo de 2026-10 em diante (e garante pelo menos 35 entradas de prod em kanban.html para o gerar.js)
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
  // Keywords / statements
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof',
  'instanceof', 'void', 'in', 'of', 'function', 'async', 'await', 'class',
  'extends', 'super', 'import', 'export', 'default', 'const', 'let', 'var',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'this', 'arguments',
  // Standard Browser & JS Globals
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
  'XMLSerializer', 'CSS', ' parseInt', 'parseInt', 'parseFloat', 'isNaN',
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

  // function foo(...) / function(a, b) / (a, b) => / a =>
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

  // catch (e)
  const catchRe = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
  while ((m = catchRe.exec(cleanCode)) !== null) {
    locals.add(m[1]);
  }

  // const / let / var declarations (including simple destructuring)
  const varRe = /\b(?:const|let|var)\s+([^;=\n]+)/g;
  while ((m = varRe.exec(cleanCode)) !== null) {
    const chunk = m[1];
    const idRe = /\b([A-Za-z_$][\w$]*)\b/g;
    let im;
    while ((im = idRe.exec(chunk)) !== null) {
      if (!JS_KEYWORDS_AND_GLOBALS.has(im[1])) locals.add(im[1]);
    }
  }

  // Also check rawCode for local function declarations that might be near template strings
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

/**
 * Valida se um script de teste de console:
 * 1. Tem sintaxe JS válida (`new vm.Script`)
 * 2. É estritamente read-only (não chama _set, _update, _remove, saveCard, etc.)
 * 3. Não reatribui variáveis `const` da página (ex.: `today = ...`)
 * 4. Só chama funções/símbolos e IDs que realmente existem no arquivo `-dev` alvo (Linha Vermelha #4)
 * 5. Preenche `_resultadosTeste` e chama `console.table`
 */
function verifyConsoleTestScript(pageFile, scriptCode) {
  const errors = [];
  const resolvedPage = pageFile.endsWith('.html') || pageFile.endsWith('.js')
    ? pageFile
    : `${pageFile.replace(/-dev$/, '')}-dev.html`;
  const pagePath = path.join(ROOT, resolvedPage);

  if (!fs.existsSync(pagePath)) {
    return { ok: false, errors: [`Arquivo alvo não encontrado: ${resolvedPage}`] };
  }

  // 1. Sintaxe JS válida
  try {
    new vm.Script(scriptCode, { filename: 'console-test-script.js' });
  } catch (err) {
    errors.push(`Erro de sintaxe JS no script de teste: ${err.message}`);
    return { ok: false, errors };
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

  // 2. Proibição de escrita no Firebase / mutação persistente (read-only)
  const forbiddenCalls = ['_set', '_update', '_remove', 'saveCard', 'deleteCard', 'saveComunicado', 'excluirComunicado'];
  for (const fn of forbiddenCalls) {
    const re = new RegExp(`(?:^|[^\\w$])${escapeRegExp(fn)}\\s*\\(`, 'm');
    if (re.test(cleanScript)) {
      errors.push(`Violação Read-Only: o script de teste chama "${fn}(" (proibido gravar no Firebase ou salvar estado).`);
    }
  }

  // 3. Proibição de reatribuir `const` global da página (ex.: `today = new Date(...)`)
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

  // 4. Verificação de existência de todas as funções livres chamadas no script (Linha Vermelha #4 — caso fmtDate)
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

  // 5. Verificação de IDs buscados via document.getElementById('...')
  const getByIdRe = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let im;
  while ((im = getByIdRe.exec(scriptCode)) !== null) {
    const idVal = im[1];
    // Se o próprio script cria esse ID dinamicamente, ignora
    const createdLocally = new RegExp(`id\\s*=\\s*['"]${escapeRegExp(idVal)}['"]`).test(scriptCode);
    if (!createdLocally && !combinedSource.includes(idVal)) {
      errors.push(`Elemento DOM inexistente: getElementById('${idVal}') chamado no script, mas "${idVal}" não consta em ${resolvedPage}.`);
    }
  }

  // 6. Estrutura padrão (_resultadosTeste e console.table)
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
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--page' && args[i + 1]) page = args[++i];
    else if (args[i] === '--file' && args[i + 1]) file = args[++i];
  }
  if (!page || !file) {
    console.error('Uso: node scripts/mare-cli.js check-script --page <arquivo-dev.html> --file <script.js>');
    process.exit(1);
  }
  const scriptPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(scriptPath)) {
    console.error(`Erro: arquivo de script não encontrado: ${file}`);
    process.exit(1);
  }
  const code = fs.readFileSync(scriptPath, 'utf8');
  const res = verifyConsoleTestScript(page, code);
  if (!res.ok) {
    console.error(`❌ [check-script] Falha na validação contra ${res.page}:`);
    res.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`✅ [check-script] Script de console validado com sucesso contra ${res.page} (sintaxe, read-only, consts e existência de símbolos OK).`);
}

// ---------------------------------------------------------------------------
// 7. Subcomando: ship (Pipeline Zero-Approval em 1 único clique via .mare-ship.json)
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

function cmdShip(args) {
  let manifestRel = '.mare-ship.json';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manifest' && args[i + 1]) manifestRel = args[++i];
  }
  const manifestPath = path.isAbsolute(manifestRel) ? manifestRel : path.join(ROOT, manifestRel);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Erro: manifesto ${manifestRel} não encontrado. Crie-o com write_to_file antes de rodar "node scripts/mare-cli.js ship".`);
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

  // Monta prBody automaticamente se prSummary/testScript forem passados
  let prBody = manifest.prBody || '';
  if (!prBody && manifest.prSummary) {
    prBody = `## Resumo\n${manifest.prSummary.trim()}\n`;
    if (manifest.testScript && manifest.testScript.code) {
      prBody += `\n## Script de teste\n\`\`\`javascript\n${manifest.testScript.code.trim()}\n\`\`\`\n`;
    }
  }

  // 1. Validação obrigatória do script de teste (explícito ou extraído de ## Script de teste no prBody)
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
  if (testCode && testPage) {
    const check = verifyConsoleTestScript(testPage, testCode);
    if (!check.ok) {
      console.error(`❌ [ship] Abortado! O script de teste falhou na validação contra ${check.page}:`);
      check.errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
    console.log(`✅ [ship] Script de teste validado contra ${check.page}.`);
  }

  // Remove o manifesto após validação do script para manter a árvore git limpa
  if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);

  // 2. Salva em memória os arquivos editados antes do checkout para nunca ter conflito de stash em version.json/CHANGELOG
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

  // 3. Sincroniza origin e posiciona a branch sem conflito
  console.log(`[ship] Sincronizando git e preparando branch ${branch}...`);
  runCmdOrThrow('git', ['fetch', 'origin']);
  if (reuseBranch) {
    runCmdOrThrow('git', ['checkout', branch]);
  } else {
    runCmdOrThrow('git', ['checkout', '-f', '-B', branch, baseRef]);
  }

  // Restaura as edições feitas nos arquivos-alvo sobre a base atualizada
  for (const [rel, buf] of savedFiles.entries()) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }

  // 4. Executa passos declarativos (promote, bump, log, map, conhecimento, tests)
  if (Array.isArray(manifest.promote) && manifest.promote.length > 0) {
    console.log(`[ship] Promovendo dev -> prod: ${manifest.promote.join(', ')}...`);
    runCmdOrThrow(process.execPath, [path.join(ROOT, '.claude/skills/subirproprod/promover.js'), ...manifest.promote]);
  }

  if (Array.isArray(manifest.bump) && manifest.bump.length > 0) {
    cmdBump(manifest.bump);
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
  }

  if (manifest.conhecimento) {
    console.log('[ship] Gerando functions/conhecimento.json...');
    runCmdOrThrow(process.execPath, [path.join(ROOT, 'scripts/gerar-conhecimento.js')]);
  }

  if (Array.isArray(manifest.tests)) {
    for (const testFile of manifest.tests) {
      console.log(`[ship] Rodando teste: ${testFile}...`);
      runCmdOrThrow(process.execPath, ['--test', testFile]);
    }
  }

  // 5. Roda node scripts/checar.js obrigatoriamente antes de commitar
  console.log('[ship] Executando node scripts/checar.js...');
  runCmdOrThrow(process.execPath, [path.join(ROOT, 'scripts/checar.js')]);

  // 6. Stage, commit com trailer Agent: antigravity e push
  runCmdOrThrow('git', ['add', '-A']);
  const fullCommitMsg = /Agent:\s*antigravity/i.test(commitMessage)
    ? commitMessage
    : `${commitMessage}\n\nAgent: antigravity`;
  runCmdOrThrow('git', ['commit', '-m', fullCommitMsg]);
  runCmdOrThrow('git', ['push', '-u', 'origin', branch]);

  // 7. Cria ou atualiza a PR via gh com GH_TOKEN extraído do git credential fill
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
    case 'bump':
      cmdBump(args.slice(1));
      break;
    case 'log':
      cmdLog(args.slice(1));
      break;
    case 'map':
      cmdMap();
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
      console.log('Uso: node scripts/mare-cli.js <status|bump|log|map|archive-changelog|check-script|ship> [opções]');
      console.log('  status                                  Mostra versões (version.json) e ?v=N dos módulos');
      console.log('  bump [alvos...]                         Incrementa versão de páginas -dev ou ?v=N de módulos');
      console.log('  log --type <feature|bug> --title "..."  Insere entrada em CHANGELOG.md ou BUGS_E_CORRECOES.md');
      console.log('  map                                     Revalida âncoras Lxxxx em CODE_MAP.md e gera CODE_MAP_FAST.md');
      console.log('  archive-changelog                       Arquiva entradas 2026-07..09 em docs/changelog-archive-2026-07-a-09.md');
      console.log('  check-script --page <arq> --file <js>   Valida sintaxe, read-only, consts e símbolos do script de teste');
      console.log('  ship [--manifest .mare-ship.json]       Executa check-script + checkout + bump/log/map + checar + commit + PR');
      process.exit(cmd ? 1 : 0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  incrementVersionString,
  scanModuleCacheBusters,
  cmdStatus,
  cmdBump,
  cmdLog,
  cmdMap,
  cmdArchiveChangelog,
  verifyConsoleTestScript,
  cmdCheckScript,
  cmdShip,
};
