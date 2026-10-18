#!/usr/bin/env node
'use strict';

/**
 * scripts/checar.js — checagens rápidas e SEM dependências que a CI roda em todo PR (e que qualquer agente pode rodar antes de abrir o PR):
 *
 *   node scripts/checar.js
 *
 *   1. JSON válidos ............ version.json, database.rules.json, functions/package.json, functions/**\/conhecimento/*.json
 *   2. version.json × HTML ..... cada chave tem a mesma versão no <div class="version"> da página (kanban_dev -> kanban-dev.html ...)
 *   3. Sintaxe das páginas ..... o maior <script> de cada página compila (equivale ao `node --check` que já usamos à mão)
 *   4. Referências nas docs .... entradas NOVAS de BUGS_E_CORRECOES.md (a partir de REFS_A_PARTIR_DE) só citam arquivos que existem
 *                                (nasceu de um caso real: entradas citando radar-dev.html / maredigital-dev.html, que não existem)
 *   6. Biblioteca .............. todo arquivo/pasta da RAIZ é citado em docs/BIBLIOTECA.md (o "bibliotecário" do repo) — raiz não vira bagunça
 *   7. Mapa .................... docs/MAPA_DO_REPOSITORIO.md: bloco automático em dia (`node scripts/mapa.js`) e todo caminho da tabela "Por pasta" existe
 *
 * Os testes de functions/ (inclui as regras do banco) rodam à parte: `cd functions && npm test`.
 * Sai com código 1 se algo falhar; no GitHub Actions também emite anotações (::error) no PR.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REFS_A_PARTIR_DE = '2026-10-16';   // entradas anteriores têm referências antigas já conhecidas (ex.: armadilha 2); só as novas são cobradas
const PAGINAS = [
  'kanban', 'painel', 'okr', 'oceano', 'escala', 'intake',
].flatMap((n) => [`${n}.html`, `${n}-dev.html`]).concat(['okr-apresentacao.slide.html']);

const erros = [];
const ok = [];
const emCI = !!process.env.GITHUB_ACTIONS;
const falha = (grupo, msg, file) => {
  erros.push(`${grupo}: ${msg}`);
  if (emCI) console.log(`::error${file ? ` file=${file}` : ''}::${grupo}: ${msg.replace(/\n/g, ' ')}`);
};
const lê = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const existe = (rel) => fs.existsSync(path.join(ROOT, rel));

// ── 1. JSON válidos ──
function jsonValidos() {
  const lista = ['version.json', 'database.rules.json', 'functions/package.json'];
  const varre = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) varre(rel);
      else if (e.name.endsWith('.json') && /\/conhecimento\//.test('/' + rel)) lista.push(rel);
    }
  };
  varre('functions');
  let n = 0;
  for (const rel of lista) {
    try { JSON.parse(lê(rel)); n++; } catch (e) { falha('JSON inválido', `${rel} — ${e.message}`, rel); }
  }
  ok.push(`JSON válidos: ${n}/${lista.length}`);
}

// ── 2. version.json × HTML ──
function versoes() {
  const v = JSON.parse(lê('version.json'));
  let n = 0;
  for (const [chave, valor] of Object.entries(v)) {
    const arq = chave.replace(/_dev$/, '-dev') + '.html';
    if (!existe(arq)) { falha('Versão', `version.json tem "${chave}", mas ${arq} não existe`, 'version.json'); continue; }
    const html = lê(arq);
    // Maré/Painel/Radar mostram a versão num <div class="version">; Oceano/Escala/Intake a guardam em `const VERSION = '...'`
    if (!html.includes(`<div class="version">${valor}</div>`) && !html.includes(`VERSION = '${valor}'`)) {
      falha('Versão', `${arq} não tem "${valor}" (version.json["${chave}"]) nem no <div class="version"> nem em const VERSION — esqueceu o bump de um dos dois?`, arq);
      continue;
    }
    n++;
  }
  ok.push(`version.json × HTML: ${n}/${Object.keys(v).length}`);
}

// ── 3. Sintaxe das páginas ──
function sintaxe() {
  let n = 0, total = 0;
  for (const arq of PAGINAS) {
    if (!existe(arq)) continue;
    total++;
    const blocos = [...lê(arq).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length);
    if (!blocos.length) { n++; continue; }
    const ehModulo = /^\s*(import|export)\s/m.test(blocos[0]);
    try {
      if (ehModulo) {
        const tmp = path.join(os.tmpdir(), `checar_${process.pid}_${path.basename(arq)}.mjs`);
        fs.writeFileSync(tmp, blocos[0]);
        const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
        fs.unlinkSync(tmp);
        if (r.status !== 0) throw new Error((r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'erro de sintaxe (módulo)');
      } else {
        new vm.Script(blocos[0], { filename: arq });
      }
      n++;
    } catch (e) { falha('Sintaxe', `${arq} — ${e.message}`, arq); }
  }
  ok.push(`Sintaxe das páginas: ${n}/${total}`);
}

// ── 4. Referências a arquivos nas entradas novas do BUGS_E_CORRECOES.md ──
function referencias() {
  const arq = 'BUGS_E_CORRECOES.md';
  if (!existe(arq)) return;
  const txt = lê(arq);
  const i = txt.indexOf('## 🐛 Histórico de Bugs e Correções');
  const entradas = (i < 0 ? '' : txt.slice(i)).split(/\n(?=### )/).slice(1);
  let conferidas = 0;
  for (const e of entradas) {
    const data = (e.match(/^### (\d{4}-\d{2}-\d{2})/) || [])[1];
    if (!data || data < REFS_A_PARTIR_DE) continue;
    const titulo = e.split('\n')[0].slice(0, 90);
    for (const m of e.matchAll(/`([A-Za-z0-9_./-]+\.(?:html|js|json|md|yml))`/g)) {
      const ref = m[1].replace(/^\.\//, '');
      if (/^(\.\.|\/)/.test(ref) || ref.includes('*')) continue;
      const cands = [ref, `functions/${ref}`, `docs/${ref}`, `scripts/${ref}`, `.claude/skills/${ref}`];
      if (!cands.some(existe)) falha('Referência', `${arq} (“${titulo}…”) cita \`${ref}\`, que não existe no repositório — confira o nome real com ls/grep`, arq);
    }
    conferidas++;
  }
  ok.push(`Referências em ${arq} (entradas a partir de ${REFS_A_PARTIR_DE}): ${conferidas} conferida(s)`);
}

// ── 5. Linhas vermelhas (AGENTS.md): automação que obedece a texto de terceiros + dados pessoais em issue pública ──
function linhasVermelhas() {
  const dir = path.join(ROOT, '.github', 'workflows');
  let n = 0;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      const rel = `.github/workflows/${f}`;
      const txt = lê(rel).replace(/^\s*#.*$/gm, '');   // comentários não contam
      const m = txt.match(/\b(issues|issue_comment|pull_request_target)\s*:/);
      if (m) falha('Linha vermelha', `${rel} reage a "${m[1]}" — qualquer pessoa pode abrir issue/comentar e disparar o robô. Proibido (AGENTS.md, "Linhas vermelhas")`, rel);
      n++;
    }
  }
  const proibidos = [
    [/github\.com\/[\w.-]+\/[\w.-]+\/issues\/new/, 'abre issue PÚBLICA (vaza nome/e-mail de quem reportou)'],
    [/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/issues/, 'lê issues/comentários sem autenticação e confia no texto de qualquer pessoa'],
  ];
  for (const arq of PAGINAS) {
    if (!existe(arq)) continue;
    const html = lê(arq);
    for (const [re, porque] of proibidos) if (re.test(html)) falha('Linha vermelha', `${arq} ${porque} (AGENTS.md, "Linhas vermelhas")`, arq);
  }
  ok.push(`Linhas vermelhas: ${n} workflow(s) e ${PAGINAS.length} página(s) conferidos`);
}

// ── 6. Biblioteca: tudo que está na raiz tem que estar descrito em docs/BIBLIOTECA.md ──
function biblioteca() {
  const arq = 'docs/BIBLIOTECA.md';
  if (!existe(arq)) { falha('Biblioteca', `${arq} não existe`, arq); return; }
  const txt = lê(arq);
  const git = spawnSync('git', ['ls-files', '--', ':!*/*'], { cwd: ROOT, encoding: 'utf8' });
  let itens = git.status === 0
    ? git.stdout.split('\n').filter(Boolean)
    : fs.readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  itens = itens.concat(fs.readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name));
  let n = 0;
  for (const nome of new Set(itens)) {
    if (nome.startsWith('.') || nome === 'node_modules') continue;   // dotfiles e pastas de ferramenta não são cobrados
    // `mare-notif(-dev).js` cobre o par; aceita o nome exato, a forma com "(-dev)" ou a base entre crases
    const par = /-dev\.[a-z]+$/.test(nome) ? nome.replace(/-dev(?=\.[a-z]+$)/, '(-dev)') : nome.replace(/(?=\.[a-z]+$)/, '(-dev)');
    const base = nome.replace(/\.(html|js|webmanifest)$/, '');
    if (txt.includes(nome) || txt.includes(par) || txt.includes('`' + base + '`') || txt.includes('`' + base + '/`')) { n++; continue; }
    falha('Biblioteca', `"${nome}" está na raiz do repositório mas não aparece em ${arq} — descreva-o lá (ou, se for solto, mova-o para uma pasta de docs/)`, nome);
  }
  ok.push(`Biblioteca: ${n} item(ns) da raiz descritos em ${arq}`);
}

// ── 7. Mapa do repositório: o bloco gerado (páginas × módulos, functions, nós do banco) e os caminhos citados têm que estar em dia ──
function mapa() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'mapa.js'), '--check'], { encoding: 'utf8' });
  if (r.status !== 0) falha('Mapa', ((r.stderr || r.stdout || '').trim() || 'scripts/mapa.js --check falhou'), 'docs/MAPA_DO_REPOSITORIO.md');
  else ok.push('Mapa do repositório: bloco automático em dia e caminhos conferidos');
}

// ── 8. Identidade de produção: a página de prod não pode carregar nada de dev (título "· Dev"/🧪, favicon/manifest/módulo -dev) ──
// (v2.87 do Radar foi ao ar com o título "🧪 Radar · Oceano · Dev" porque a promoção normalizava o título para outro texto)
function identidadeProd() {
  const prods = fs.readdirSync(ROOT).filter((f) => /\.html$/.test(f) && !/-dev\.html$/.test(f) && existe(f.replace(/\.html$/, '-dev.html')));
  for (const arq of prods) {
    const html = lê(arq);
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/);
    if (t && /(·\s*dev\b|🧪)/i.test(t[1])) falha('Identidade de produção', `${arq}: o <title> diz "${t[1]}" (marca de dev em página de produção)`, arq);
    const head = html.split('</head>')[0];
    for (const m of head.matchAll(/<(?:link|script)[^>]*(?:href|src)="([^"]*-dev[^"]*)"/g)) falha('Identidade de produção', `${arq}: o <head> aponta para "${m[1]}" (arquivo de dev em página de produção)`, arq);
  }
  ok.push(`Identidade de produção: ${prods.length} página(s) de prod sem título/favicon/módulo de dev`);
}

// ── 9. Segurança das páginas (dev e produção, e módulos): os dois buracos de XSS que a auditoria de 18/10/2026 achou não podem voltar ──
//   a) link com URL do banco CRUA no atributo (`href="${x.url}"`) — sem esc(_hrefOk(..))/safeUrl() um `javascript:` vira XSS por clique;
//   b) renderizador de markdown (renderMd/_renderMd) sem _mdAttr(): aspas na URL fecham o atributo e injetam `onmouseover=` (XSS armazenado).
function seguranca() {
  const alvos = fs.readdirSync(ROOT).filter((f) => /^(kanban|painel|okr|oceano|escala|intake)(-dev)?\.html$/.test(f) || /^mare-[a-z]+(-dev)?\.js$/.test(f) || f === 'okr-apresentacao.slide.html');
  const reHref = /href=\\?["'](?:\$\{|'?\s*\+\s*)\s*[A-Za-z_][A-Za-z0-9_.?\[\]]*(?:[uU]rl|[lL]ink|[hH]ref|shortlink)\b(?!\s*\()/;
  let n = 0;
  for (const arq of alvos) {
    const linhas = lê(arq).split('\n');
    linhas.forEach((l, i) => { if (reHref.test(l)) falha('Segurança', `${arq}:${i + 1} monta href com URL crua (use esc(_hrefOk(url)) ou safeUrl(url) — esc() sozinho não barra javascript:)`, arq); });
    const txt = linhas.join('\n');
    if (/function _?renderMd\(/.test(txt) && !/function _mdAttr\(/.test(txt)) falha('Segurança', `${arq} tem renderMd sem _mdAttr() — aspas na URL do markdown injetam atributo de evento`, arq);
    n++;
  }
  ok.push(`Segurança das páginas: ${n} arquivo(s) sem href cru e com markdown protegido`);
}

jsonValidos();
versoes();
sintaxe();
linhasVermelhas();
referencias();
biblioteca();
mapa();
identidadeProd();
seguranca();

for (const l of ok) console.log('✅', l);
if (erros.length) {
  console.log(`\n❌ ${erros.length} problema(s):`);
  for (const e of erros) console.log('  -', e);
  process.exit(1);
}
console.log('\nTudo certo.');
