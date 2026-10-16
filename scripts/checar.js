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

jsonValidos();
versoes();
sintaxe();
referencias();

for (const l of ok) console.log('✅', l);
if (erros.length) {
  console.log(`\n❌ ${erros.length} problema(s):`);
  for (const e of erros) console.log('  -', e);
  process.exit(1);
}
console.log('\nTudo certo.');
