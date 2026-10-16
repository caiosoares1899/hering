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
 */

const fs = require('fs');
const path = require('path');

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
  'mare-notif-dev':    'mare-notif-dev',
  'mare-notif-dev.js': 'mare-notif-dev',
  'mare-notif':        'mare-notif-dev',
  'notif':             'mare-notif-dev',
  'mare-metas-dev':    'mare-metas-dev',
  'mare-metas-dev.js': 'mare-metas-dev',
  'mare-metas':        'mare-metas-dev',
  'metas':             'mare-metas-dev',
  'mare-dicas-dev':    'mare-dicas-dev',
  'mare-dicas-dev.js': 'mare-dicas-dev',
  'mare-dicas':        'mare-dicas-dev',
  'dicas':             'mare-dicas-dev',
  'mare-login-dev':    'mare-login-dev',
  'mare-login-dev.js': 'mare-login-dev',
  'mare-login':        'mare-login-dev',
  'login':             'mare-login-dev',
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
  if (type === 'bug' && !/^\d{4}-\d{2}-\d{2}\s*·/.test(cleanTitle)) {
    const today = new Date().toISOString().slice(0, 10);
    cleanTitle = `${today} · ${cleanTitle}`;
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
    default:
      console.log('Uso: node scripts/mare-cli.js <status|bump|log|map|archive-changelog> [opções]');
      console.log('  status                                  Mostra versões (version.json) e ?v=N dos módulos');
      console.log('  bump [alvos...]                         Incrementa versão de páginas -dev ou ?v=N de módulos');
      console.log('  log --type <feature|bug> --title "..."  Insere entrada em CHANGELOG.md ou BUGS_E_CORRECOES.md');
      console.log('  map                                     Revalida âncoras Lxxxx em CODE_MAP.md e gera CODE_MAP_FAST.md');
      console.log('  archive-changelog                       Arquiva entradas 2026-07..09 em docs/changelog-archive-2026-07-a-09.md');
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
};
