#!/usr/bin/env node
'use strict';

/**
 * scripts/mapa.js — mantém o bloco AUTOMÁTICO do mapa do repositório (docs/MAPA_DO_REPOSITORIO.md).
 *
 *   node scripts/mapa.js           reescreve o bloco entre <!-- mapa:auto:inicio --> e <!-- mapa:auto:fim -->
 *   node scripts/mapa.js --check   só confere (a CI roda isso via scripts/checar.js); sai com 1 se o bloco estiver velho
 *
 * O que é gerado (sempre do código, nunca à mão): quais módulos mare-*.js cada página carrega (e a versão do cache `?v=`),
 * as Cloud Functions por pasta (de functions/index.js) e os nós de primeiro nível de kanban/ nas regras do banco.
 * O resto do mapa (árvore comentada e diagramas) é texto escrito por gente — este bloco é o que não pode envelhecer.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOC = path.join(ROOT, 'docs', 'MAPA_DO_REPOSITORIO.md');
const INI = '<!-- mapa:auto:inicio -->';
const FIM = '<!-- mapa:auto:fim -->';
const lê = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PAGINAS = [
  ['Maré Digital', 'kanban'], ['Painel', 'painel'], ['Radar', 'okr'], ['Oceano', 'oceano'], ['Escala', 'escala'], ['Intake', 'intake'],
];

function modulosDe(arq) {
  if (!fs.existsSync(path.join(ROOT, arq))) return [];
  const html = lê(arq);
  const achados = [...html.matchAll(/<script[^>]*\ssrc="(mare-[a-z]+)(?:-dev)?\.js(?:\?v=(\d+))?"/g)];
  return achados.map((m) => ({ nome: m[1], v: m[2] || '—' }));
}

function gera() {
  const versoes = JSON.parse(lê('version.json'));
  const linhas = [];

  // 1. página → módulos
  linhas.push('### Páginas × módulos compartilhados (lido do HTML)', '');
  linhas.push('| Produto | Prod (versão) | Dev (versão) | Módulos que a página carrega (`?v=` no dev) |', '|---|---|---|---|');
  for (const [nome, base] of PAGINAS) {
    const dev = modulosDe(`${base}-dev.html`);
    const prod = modulosDe(`${base}.html`).map((m) => m.nome);
    const mods = dev.map((m) => `\`${m.nome}\` v${m.v}`).join(' · ') || '— (nenhum)';
    const vp = versoes[base] || '—';
    const vd = versoes[`${base}_dev`] || '—';
    const aviso = JSON.stringify(dev.map((m) => m.nome)) === JSON.stringify(prod) ? '' : ' ⚠️ prod difere';
    linhas.push(`| ${nome} | \`${base}.html\` ${vp} | \`${base}-dev.html\` ${vd} | ${mods}${aviso} |`);
  }
  const semPar = ['okr-apresentacao.slide.html', 'onboarding.html'].filter((f) => fs.existsSync(path.join(ROOT, f)));
  linhas.push('', `Sem módulos compartilhados: ${semPar.map((f) => `\`${f}\``).join(', ')} (e as páginas avulsas — ver a Biblioteca).`, '');

  // 2. Cloud Functions por pasta
  const idx = lê('functions/index.js');
  const porPasta = {};
  for (const m of idx.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=\s*require\('\.\/([^']+)'\)/gm)) {
    const pasta = m[2].split('/')[0];
    (porPasta[pasta] = porPasta[pasta] || []).push(m[1]);
  }
  // exports definidos no próprio index.js (ex.: sendPushOnNotification) não têm require — entram numa linha à parte
  const todos = [...idx.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)].map((m) => m[1]);
  const mapeados = new Set(Object.values(porPasta).flat());
  const proprios = todos.filter((n) => !mapeados.has(n));
  if (proprios.length) porPasta['index.js (definidas no próprio arquivo)'] = proprios;
  const total = todos.length;
  linhas.push(`### Cloud Functions por pasta (${total} exports em \`functions/index.js\`)`, '');
  linhas.push('| Pasta (`functions/…`) | Exports |', '|---|---|');
  for (const [pasta, nomes] of Object.entries(porPasta).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    linhas.push(`| \`${pasta.includes(' ') ? pasta : pasta + '/'}\` | ${nomes.map((n) => `\`${n}\``).join(' · ')} |`);
  }

  // 3. nós do banco
  const regras = JSON.parse(lê('database.rules.json')).rules;
  const nos = Object.keys((regras.kanban || {})).filter((k) => !k.startsWith('$') && !k.startsWith('.'));
  linhas.push('', `### Nós de primeiro nível em \`kanban/\` nas regras do banco (${nos.length})`, '');
  linhas.push(nos.map((n) => `\`${n}\``).join(' · '), '');
  linhas.push('_Nó novo no banco = regra nova em `database.rules.json` (+ teste em `functions/rules/__tests__/`) e, se for dado que importa, entrada em `NOS_GLOBAIS` de `functions/backup/completo.js`._');
  return linhas.join('\n');
}

function aplica(doc, bloco) {
  const i = doc.indexOf(INI), j = doc.indexOf(FIM);
  if (i < 0 || j < 0 || j < i) throw new Error(`marcadores ${INI} / ${FIM} não encontrados em docs/MAPA_DO_REPOSITORIO.md`);
  return doc.slice(0, i + INI.length) + '\n' + bloco + '\n' + doc.slice(j);
}

// a tabela "Por pasta": todo caminho citado na 1ª coluna tem que existir (separa por · e ignora o que não for caminho)
function caminhosInexistentes(doc) {
  const i = doc.indexOf('<!-- mapa:caminhos:inicio -->'), j = doc.indexOf('<!-- mapa:caminhos:fim -->');
  if (i < 0 || j < 0) return ['(marcadores mapa:caminhos não encontrados)'];
  const faltam = [];
  for (const linha of doc.slice(i, j).split('\n')) {
    const cel = (linha.match(/^\|\s*([^|]+?)\s*\|/) || [])[1];
    if (!cel || /^-+$/.test(cel) || cel === 'Caminho') continue;
    for (const m of cel.matchAll(/`([^`]+)`/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) faltam.push(m[1]);
  }
  return faltam;
}

const doc = fs.readFileSync(DOC, 'utf8');
const faltam = caminhosInexistentes(doc);
if (faltam.length) { console.error('docs/MAPA_DO_REPOSITORIO.md cita caminho(s) que não existem: ' + faltam.join(', ')); process.exit(1); }
const novo = aplica(doc, gera());
if (process.argv.includes('--check')) {
  if (novo !== doc) { console.error('docs/MAPA_DO_REPOSITORIO.md: o bloco automático está desatualizado — rode `node scripts/mapa.js` e commite.'); process.exit(1); }
  console.log('mapa: bloco automático em dia.');
} else {
  fs.writeFileSync(DOC, novo);
  console.log(novo === doc ? 'mapa: nada mudou.' : 'mapa: bloco automático atualizado em docs/MAPA_DO_REPOSITORIO.md');
}
