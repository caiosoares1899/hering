// Testa extractImagesForUpload/replacePlaceholders como funções puras —
// parseamento de string, sem tocar Storage nem emulador.

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractImagesForUpload, replacePlaceholders } = require('../outputs/relatorioHtml');

// PNG 1x1 transparente — não precisa ser uma imagem "de verdade" pra testar
// o parseamento, só precisa ser base64 válido.
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const FIXTURE_HTML = `<html><body>
<h1>Relatório</h1>
<img src="data:image/png;base64,${PNG_1PX}">
<p>texto no meio</p>
<img src='data:image/jpeg;base64,${PNG_1PX}'>
</body></html>`;

test('extractImagesForUpload acha as duas imagens, decodifica e tira o base64 do html', () => {
  const { html, images } = extractImagesForUpload(FIXTURE_HTML);
  assert.equal(images.length, 2);
  assert.equal(images[0].filename, 'imagem-1.png');
  assert.equal(images[0].contentType, 'image/png');
  assert.ok(Buffer.isBuffer(images[0].buffer));
  assert.equal(images[0].buffer.length, Buffer.from(PNG_1PX, 'base64').length);
  assert.equal(images[1].filename, 'imagem-2.jpg');
  assert.equal(images[1].contentType, 'image/jpeg');
  assert.ok(!html.includes('base64'), 'html final não deve sobrar nenhum base64');
  assert.ok(html.includes(images[0].placeholder));
  assert.ok(html.includes(images[1].placeholder));
});

test('extractImagesForUpload devolve igual quando não tem imagem embutida', () => {
  const { html, images } = extractImagesForUpload('<html><body>sem imagem</body></html>');
  assert.equal(images.length, 0);
  assert.equal(html, '<html><body>sem imagem</body></html>');
});

test('replacePlaceholders troca cada placeholder pela URL final', () => {
  const { html, images } = extractImagesForUpload(FIXTURE_HTML);
  const urlByPlaceholder = {};
  images.forEach((img, i) => {
    urlByPlaceholder[img.placeholder] = `https://storage.example/img${i}.png`;
  });
  const final = replacePlaceholders(html, urlByPlaceholder);
  assert.ok(final.includes('https://storage.example/img0.png'));
  assert.ok(final.includes('https://storage.example/img1.png'));
  assert.ok(!final.includes('__AGENTE_AGIL_IMG_'));
});
