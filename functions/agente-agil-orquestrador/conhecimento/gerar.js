// functions/agente-agil-orquestrador/conhecimento/gerar.js
//
// Gera a base de conhecimento do Agente Ágil a partir das MESMAS fontes que as pessoas leem, pra ela nunca mais ficar pra trás:
//   • ajudaMare.json  ← HELP_CONTENT de kanban.html (PRODUÇÃO: o agente fala do que as pessoas têm), HTML tirado, uma entrada por verbete da Central de Ajuda.
//   • ajudaRadar.json ← okr.html: os <details class="hlp-it"> da Ajuda do Radar (título = <summary>, corpo = .hlp-bd).
//   • ajudaOceano.json← oceano.html: o array FAQ (q/a) da Ajuda do Oceano.
//   • novidades.json  ← CHANGELOG.md, seção "kanban.html (produção)": o que mudou e quando (as entradas "SÓ DEV" ficam de fora — ainda não chegaram às pessoas).
// Rodar:  cd functions && npm run conhecimento      (e commitar os 2 JSON). O teste `conhecimento.test.js` falha se ajudaMare.json ficar diferente do HELP_CONTENT.
// IMPORTANTE: Cloud Functions não leem o repositório em tempo de execução — os JSON entram no pacote do deploy. Depois de regenerar, é preciso
// republicar as funções que usam o orquestrador (agenteAgilMencao, agenteAgilMencaoDados, agenteAgilIntake, agenteAgilAnalisePO).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '../../..');
const ABAS = {
  board: 'Board e ferramentas',
  cards: 'Cards',
  agente: 'Agente Ágil',
  config: 'Configurações',
  comunicacao: 'Comunicação e notificações',
  kudos: 'Estrelas do Mar (Kudos)',
  automacoes: 'Automações',
};
// 'agil' (conceitos) já existe na biblioteca estática; 'spotify' está pausado; 'ui' são textos de botão, não ajuda.
const ABAS_FORA = new Set(['agil', 'spotify', 'ui']);

function htmlParaTexto(s) {
  return String(s || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<(div|p|ul|ol|h[1-6]|tr)(\s[^>]*)?>/gi, '\n')
    .replace(/<\/(div|p|li|ul|ol|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n\n(• )/g, '\n$1').trim();
}

function extrairHelpContent(html) {
  const i = html.indexOf('const HELP_CONTENT');
  if (i < 0) throw new Error('HELP_CONTENT não encontrado');
  const j = html.indexOf('\n}\n', i);
  if (j < 0) throw new Error('fim de HELP_CONTENT não encontrado');
  const src = html.slice(i, j + 2).replace('const HELP_CONTENT', 'HELP_CONTENT');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { timeout: 3000 });
  return ctx.HELP_CONTENT;
}

function gerarAjudaMare(html) {
  const H = extrairHelpContent(html);
  const out = [];
  Object.keys(ABAS).forEach((aba) => {
    (H[aba] || []).forEach((e) => {
      if (!e || !e.title || !e.text) return;
      // modo "só Hering": a entrada "Sua torre…" não existe pra ninguém (HELP_CONTENT já a tira em runtime)
      if (/^Sua torre/.test(e.title)) return;
      out.push({ aba, titulo: htmlParaTexto(e.title), texto: htmlParaTexto(e.text) });
    });
  });
  return out;
}

// Ajuda do Radar (okr.html): <details class="hlp-it" ... data-tab="faq" ...><summary>…<b>Título</b></summary><div class="hlp-bd">corpo</div></details>
function gerarAjudaRadar(html) {
  const i = html.indexOf('id="okr-help-ov"');
  if (i < 0) throw new Error('Ajuda do Radar não encontrada');
  // Modo "só Hering" (okr.html liga por padrão): o CSS esconde entradas inteiras (#hlp-torres, #hlp-faq13…) e blocos `.okr-so-hering-esconde`, e só mostra
  // `.okr-so-hering-so`. O agente tem que ver o mesmo que as pessoas veem — senão falaria de torres Comercial/Corporativa que não existem pra ninguém.
  const regraCss = /([^{}]*okr-so-hering-esconde[^{}]*)\{display:none/.exec(html);
  const ocultos = new Set(regraCss ? (regraCss[1].match(/#hlp-[a-z0-9-]+/g) || []).map((x) => x.slice(1)) : []);
  const soHeringEsconde = /<(\w+)[^>]*class="[^"]*\b(?:okr-so-hering-esconde|ms-login)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g;   // ms-login = login Microsoft/Arezzo (escondido no modo só Hering)
  const soHeringMostra = /(<[^>]*class="[^"]*)okr-so-hering-so([^"]*"[^>]*>)/g;
  const re = /<details([^>]*)>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="hlp-bd">([\s\S]*?)<\/div>\s*<\/details>/g;
  const out = [];
  let m;
  const resto = html.slice(i);
  while ((m = re.exec(resto))) {
    if (!/class="[^"]*\bhlp-it\b/.test(m[1])) continue;
    if (ocultos.has((/id="([^"]+)"/.exec(m[1]) || [])[1])) continue;
    const aba = (/data-tab="([^"]*)"/.exec(m[1]) || [])[1] || '';
    const bold = /<b>([\s\S]*?)<\/b>/.exec(m[2]);
    const titulo = htmlParaTexto(bold ? bold[1] : m[2]).replace(/^[^\p{L}\p{N}]+/u, '').trim();   // só o <b> (sem o emoji do ícone nem o subtítulo)
    const sub = bold ? htmlParaTexto(m[2].replace(bold[0], '').replace(/<span class="hlp-ic">[\s\S]*?<\/span>/, '')) : '';
    const corpo = htmlParaTexto(m[3].replace(soHeringEsconde, '').replace(soHeringMostra, '$1$2'));
    const texto = sub ? `(${sub})\n${corpo}` : corpo;
    if (titulo && texto) out.push({ aba, titulo, texto });
  }
  return out;
}

// Ajuda do Oceano (oceano.html): const FAQ = [{id:'…', q:'…', a:'<p>…</p>'}, …]
function gerarAjudaOceano(html) {
  const i = html.indexOf('const FAQ');
  if (i < 0) throw new Error('FAQ do Oceano não encontrado');
  const j = html.indexOf('\n];', i);
  const src = html.slice(i, j + 3).replace('const FAQ', 'FAQ');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { timeout: 3000 });
  return [...ctx.FAQ].map((f) => ({ id: f.id, titulo: htmlParaTexto(f.q), texto: htmlParaTexto(f.a) }));
}

function gerarNovidades(md, max = 30) {
  const ini = md.indexOf('## kanban.html (produção)');
  if (ini < 0) throw new Error('seção de produção do CHANGELOG não encontrada');
  const resto = md.slice(ini + 5);
  const fim = resto.search(/\n## /);
  const secao = fim < 0 ? resto : resto.slice(0, fim);
  const blocos = secao.split(/\n(?=### )/).filter((b) => b.startsWith('### '));
  const out = [];
  for (const b of blocos) {
    const [cab, ...corpo] = b.split('\n');
    const titulo = cab.replace(/^###\s*/, '').replace(/\*\*/g, '').trim();
    if (/SÓ DEV/i.test(titulo)) continue;
    const data = (/(\d{4}-\d{2}-\d{2})/.exec(titulo) || [])[1] || '';
    const texto = corpo.join('\n').replace(/\*\*/g, '').replace(/`/g, '').replace(/\(#\d+\)/g, '').replace(/\n{2,}/g, '\n').trim().slice(0, 1400);
    out.push({ data, titulo, texto });
    if (out.length >= max) break;
  }
  return out;
}

function gerarTudo() {
  const html = fs.readFileSync(path.join(RAIZ, 'kanban.html'), 'utf8');
  const md = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
  const radar = fs.readFileSync(path.join(RAIZ, 'okr.html'), 'utf8');
  const oceano = fs.readFileSync(path.join(RAIZ, 'oceano.html'), 'utf8');
  return { ajudaMare: gerarAjudaMare(html), ajudaRadar: gerarAjudaRadar(radar), ajudaOceano: gerarAjudaOceano(oceano), novidades: gerarNovidades(md) };
}

if (require.main === module) {
  const { ajudaMare, ajudaRadar, ajudaOceano, novidades } = gerarTudo();
  fs.writeFileSync(path.join(__dirname, 'ajudaMare.json'), JSON.stringify(ajudaMare, null, 1) + '\n');
  fs.writeFileSync(path.join(__dirname, 'ajudaRadar.json'), JSON.stringify(ajudaRadar, null, 1) + '\n');
  fs.writeFileSync(path.join(__dirname, 'ajudaOceano.json'), JSON.stringify(ajudaOceano, null, 1) + '\n');
  fs.writeFileSync(path.join(__dirname, 'novidades.json'), JSON.stringify(novidades, null, 1) + '\n');
  console.log(`ajudaMare.json: ${ajudaMare.length} · ajudaRadar.json: ${ajudaRadar.length} · ajudaOceano.json: ${ajudaOceano.length} verbetes · novidades.json: ${novidades.length} entradas`);
}

module.exports = { ABAS, htmlParaTexto, extrairHelpContent, gerarAjudaMare, gerarAjudaRadar, gerarAjudaOceano, gerarNovidades, gerarTudo, RAIZ };
