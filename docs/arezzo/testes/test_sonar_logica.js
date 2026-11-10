// Sonar — contrato das funções puras reais, em Node, sem navegador ou dependências.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let total = 0, falhas = 0;
const t = (nome, testar) => {
  total++;
  try { testar(); console.log('✅ ' + nome); }
  catch (e) { falhas++; console.log('❌ ' + nome + ' ← ' + e.message); }
};

const memoria = new Map();
const contexto = vm.createContext({
  navigator: { platform: 'MacIntel', userAgent: '' },
  document: {},
  localStorage: {
    getItem: k => memoria.has(String(k)) ? memoria.get(String(k)) : null,
    setItem: (k, v) => memoria.set(String(k), String(v)),
    removeItem: k => memoria.delete(String(k)),
    clear: () => memoria.clear()
  },
  console
});
contexto.window = contexto;
let M;
t('IIFE carrega e expõe as cinco funções puras', () => {
  const arquivo = path.resolve(__dirname, '../../../mare-sonar-dev.js');
  vm.runInContext(fs.readFileSync(arquivo, 'utf8'), contexto, { filename: arquivo, timeout: 1000 });
  M = contexto.MareSonar;
  for (const nome of ['_norm', '_pontua', '_separaMeus', '_paginaOk', '_linkOk']) {
    assert.equal(typeof M[nome], 'function', nome);
  }
});

t('1: normaliza acento e maiúsculas', () => assert.equal(M._norm('Conversão'), 'conversao'));
t('2: uma palavra ausente elimina o resultado', () => assert.equal(M._pontua('Conversão do app', ['conversao', 'banana']), 0));
t('2: todas as palavras casando dão pontuação positiva', () => assert.ok(M._pontua('Conversão do app', ['conversao', 'app']) > 0));
// Mesmo começo neutro nos três títulos: o bônus de início não interfere na hierarquia.
t('2: palavra igual pontua mais que prefixo', () => assert.ok(M._pontua('taxa meta', ['meta']) > M._pontua('taxa metas', ['meta'])));
t('2: prefixo pontua mais que contém', () => assert.ok(M._pontua('taxa metas', ['meta']) > M._pontua('taxa supermeta', ['meta'])));
t('2: aceita uma letra omitida em termo longo', () => assert.ok(M._pontua('conversão', ['conersao']) > 0));
t('2: aceita uma letra trocada com quatro letras', () => assert.ok(M._pontua('meta', ['meto']) > 0));
t('2: aceita uma letra extra em termo longo', () => assert.ok(M._pontua('conversão', ['conveersao']) > 0));
t('2: recusa dois erros no termo', () => assert.equal(M._pontua('conversão', ['conxersxo']), 0));
t('2: termo curto cnv não acha conversão', () => assert.equal(M._pontua('conversão', ['cnv']), 0));
t('2: não tolera erro em termo de três letras', () => assert.equal(M._pontua('sol', ['sal']), 0));
t('2: código com número não aceita erro (T426 não acha T126)', () => assert.equal(M._pontua('Objetivo T126', ['t426']), 0));
t('2: busca sem termos devolve 1', () => assert.equal(M._pontua('qualquer título', []), 1));
t('2: título começando pela busca ganha bônus', () => assert.ok(M._pontua('conversao do app', ['conversao']) > M._pontua('app de conversao', ['conversao'])));
t('2: bônus considera a busca inteira', () => assert.ok(M._pontua('conversao do app', ['conversao', 'do']) > M._pontua('conversao app do', ['conversao', 'do'])));

for (const palavra of ['meu', 'meus', 'minha', 'minhas']) {
  t('3: separa ' + palavra + ' e mantém meta', () => {
    // Objetos do vm têm protótipos de outro contexto; comparamos os campos e o array convertido.
    const r = M._separaMeus([palavra, 'meta']);
    assert.equal(r.meus, true);
    assert.deepEqual(Array.from(r.toks), ['meta']);
  });
}
t('3: preserva outras palavras e sua ordem', () => {
  const r = M._separaMeus(['meta', 'do', 'app']);
  assert.equal(r.meus, false);
  assert.deepEqual(Array.from(r.toks), ['meta', 'do', 'app']);
});
t('3: remove todas as formas juntas', () => {
  const r = M._separaMeus(['meu', 'meus', 'minha', 'minhas']);
  assert.equal(r.meus, true);
  assert.deepEqual(Array.from(r.toks), []);
});

for (const url of ['kanban-dev.html?squad=x&card=y', 'okr.html?okr=o1', 'onboarding.html', 'painel-dev.html', 'oceano.html']) {
  t('4: aceita página ' + url, () => assert.equal(M._paginaOk(url), true));
}
for (const url of ['javascript:alert(1)', 'https://evil.com/kanban.html', 'kanban.html#x"onmouseover', '//evil.com', 'kanban.html?x=<script>', 'fora.html']) {
  t('4: recusa página ' + url, () => assert.equal(M._paginaOk(url), false));
}

for (const url of ['http://a.com', 'https://a.com/caminho?x=1&y=2']) {
  t('5: aceita link ' + url, () => assert.equal(M._linkOk(url), url));
}
for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://a.com/"x', "https://a.com/'x", 'https://a.com/x y', 'https://a.com/<x>', 'https://a.com/x\ny']) {
  t('5: recusa link ' + JSON.stringify(url), () => assert.equal(M._linkOk(url), ''));
}
const link600 = 'https://a.com/' + 'x'.repeat(600 - 'https://a.com/'.length);
t('5: aceita link com exatamente 600 caracteres', () => assert.equal(M._linkOk(link600), link600));
t('5: recusa link com 601 caracteres', () => assert.equal(M._linkOk(link600 + 'x'), ''));

console.log('\n' + (falhas ? 'FALHOU' : 'TUDO OK') + ' — ' + total + ' verificações, ' + falhas + ' falhas');
process.exitCode = falhas ? 1 : 0;
