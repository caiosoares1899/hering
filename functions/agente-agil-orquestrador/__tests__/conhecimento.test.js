// functions/agente-agil-orquestrador/__tests__/conhecimento.test.js
//
// ANTI-DRIFT do conhecimento do Agente Ágil: ajudaMare.json é GERADO a partir do HELP_CONTENT de kanban.html (npm run conhecimento). Se alguém
// mexer na Central de Ajuda do Maré e esquecer de regenerar, este teste falha — o agente ficaria falando do produto de ontem.
// (Cloud Functions não leem o repositório em runtime: depois de regenerar, republicar as funções do orquestrador.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { htmlParaTexto, gerarAjudaMare, gerarAjudaRadar, gerarAjudaOceano, gerarNovidades, RAIZ } = require('../conhecimento/gerar');
const ajudaGerada = require('../conhecimento/ajudaMare.json');
const radarGerada = require('../conhecimento/ajudaRadar.json');
const oceanoGerada = require('../conhecimento/ajudaOceano.json');
const novidadesGeradas = require('../conhecimento/novidades.json');

const temRepo = fs.existsSync(path.join(RAIZ, 'kanban.html')) && fs.existsSync(path.join(RAIZ, 'CHANGELOG.md'));

test('htmlParaTexto tira tags, mantém quebras de linha e decodifica entidades', () => {
  assert.equal(htmlParaTexto('<b>Oi</b> &amp; tchau<br>linha 2<div>bloco</div><ul><li>um</li><li>dois</li></ul>'), 'Oi & tchau\nlinha 2\nbloco\n• um\n• dois');
  assert.equal(htmlParaTexto(null), '');
});

test('gerarNovidades ignora "SÓ DEV", pega a data do título e respeita o limite', () => {
  const md = '# Changelog\n\n## kanban.html (produção)\n\n### 🚀 A — 2026-10-02 · v1\n- **ok** `x` (#12)\n\n### Coisa — 2026-10-01 (SÓ DEV)\n- dev\n\n### B — 2026-09-30\ncorpo\n\n## Outra seção\n\n### Fora — 2026-01-01\n';
  const r = gerarNovidades(md, 5);
  assert.deepEqual(r.map((x) => x.data), ['2026-10-02', '2026-09-30']);
  assert.equal(r[0].texto, '- ok x');
  assert.equal(gerarNovidades(md, 1).length, 1);
});

test('ajudaMare.json está em dia com o HELP_CONTENT de kanban.html (se falhar: cd functions && npm run conhecimento)', { skip: !temRepo && 'repo raiz indisponível' }, () => {
  const html = fs.readFileSync(path.join(RAIZ, 'kanban.html'), 'utf8');
  assert.deepEqual(ajudaGerada, gerarAjudaMare(html), 'conhecimento/ajudaMare.json está DESATUALIZADO em relação ao HELP_CONTENT de kanban.html — rode `npm run conhecimento` e commite');
});

test('novidades.json tem as entradas mais recentes de produção do CHANGELOG (a mais nova já está lá)', { skip: !temRepo && 'repo raiz indisponível' }, () => {
  const md = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
  const fresco = gerarNovidades(md);
  assert.equal(novidadesGeradas[0].titulo, fresco[0].titulo, 'a entrada mais recente do CHANGELOG (produção) não está em novidades.json — rode `npm run conhecimento`');
});

test('ajudaRadar.json e ajudaOceano.json estão em dia com okr.html / oceano.html', { skip: !temRepo && 'repo raiz indisponível' }, () => {
  assert.deepEqual(radarGerada, gerarAjudaRadar(fs.readFileSync(path.join(RAIZ, 'okr.html'), 'utf8')), 'ajudaRadar.json DESATUALIZADO — rode `npm run conhecimento` e commite');
  assert.deepEqual(oceanoGerada, gerarAjudaOceano(fs.readFileSync(path.join(RAIZ, 'oceano.html'), 'utf8')), 'ajudaOceano.json DESATUALIZADO — rode `npm run conhecimento` e commite');
});

test('Ajuda do Radar: respeita o modo só Hering (sem as entradas de torres) e não vaza HTML; Oceano tem as perguntas esperadas', () => {
  assert.ok(radarGerada.length >= 35 && oceanoGerada.length >= 10);
  assert.ok(!radarGerada.some((v) => /^Torres e gerências|Minha torre está errada/.test(v.titulo)), 'entradas escondidas no modo só Hering não podem chegar ao agente');
  [...radarGerada, ...oceanoGerada].forEach((v) => {
    assert.ok(v.titulo && v.texto);
    assert.doesNotMatch(v.texto, /<[a-z][\s\S]*>/i, `"${v.titulo}" com HTML`);
    assert.doesNotMatch(v.titulo, /^[^\p{L}\p{N}]/u, `título "${v.titulo}" começa com emoji/símbolo`);
  });
});
