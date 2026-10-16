// functions/plantao/__tests__/pacote.test.js — o pacote anônimo do SERVIDOR tem que ser idêntico ao do Oceano (oceano-dev.html).
// Extrai as duas funções do HTML e roda as duas versões sobre os mesmos relatos; se alguém mudar uma e esquecer a outra, falha aqui.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizarTexto, montarPacote } = require('../pacote');

const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'oceano-dev.html'), 'utf8');
const pega = (nome) => { const i = html.indexOf('function ' + nome); let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && !--d) return html.slice(i, k + 1); } };
const cliente = new Function(pega('feriasSanitizarTexto') + '\n' + pega('feriasMontarPacoteAnonimo') + '\nreturn { sanitizar: feriasSanitizarTexto, montar: feriasMontarPacoteAnonimo };')();

const RELATOS = [
  { arquivoAlvo: 'kanban-dev.html', app: 'Maré Digital', impacto: '🟡 Dá pra contornar', texto: 'TESTE — Card com prazo na sexta passada (09/10) mostra "⚠ 6d atrasado".' },
  { arquivoAlvo: 'oceano-dev.html', app: 'Oceano', impacto: '🔴 Bloqueia a operação', texto: 'Falei com maria.silva@ciahering.com.br fone 11 98888-7777 cpf 123.456.789-09 veja https://drive.google.com/x?token=abc', erroConsole: 'TypeError at eve@ciahering.com.br AIzaSyD0nTL3akThisKeyAbcdefghijk123456' },
  { arquivoAlvo: 'x.html; rm -rf /', msg: 'só msg, sem texto', autor: 'Eve Souza', email: 'eve@x.com', uid: 'eve', evidenciaImg: 'data:image/png;base64,AAAA' },
  { texto: 'a'.repeat(2000), erroConsole: 'b'.repeat(900) }, {}, { texto: '   espaços   \n\n quebras   ' },
];

test('servidor e Oceano geram o MESMO pacote e a MESMA sanitização (paridade)', () => {
  for (const r of RELATOS) assert.equal(montarPacote(r), cliente.montar(r), JSON.stringify(r).slice(0, 80));
  for (const t of ['a@b.com', 'http://x.y/z', '(11) 98888-7777', '123.456.789-09', 'A'.repeat(40), null, undefined, 42]) assert.equal(sanitizarTexto(t, 50), cliente.sanitizar(t, 50));
});

test('o pacote nunca leva autor, e-mail, uid, link nem print', () => {
  const p = montarPacote(RELATOS[2]);
  assert.doesNotMatch(p, /Eve|Souza|@x\.com|"eve"|data:image|AAAA/); assert.match(p, /^\/plantaobug em /);
});
