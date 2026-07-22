// functions/agente-agil/outputs/relatorioHtml.js
//
// Traduz um output {type:'relatorio_html', html, titulo} num write step. O
// Databricks manda o HTML completo com imagens embutidas em base64 (ex.:
// report_diario.html de 940KB, 85% disso são 4 PNGs embutidos) — NUNCA
// guardamos esse HTML bruto no Realtime Database (um relatório de ~1MB
// seria baixado por inteiro toda vez que alguém abrisse o card, mesmo sem
// clicar). Em vez disso:
//
//   1. extractImagesForUpload (função pura) acha as imagens embutidas,
//      decodifica pra buffer binário e tira elas do HTML, deixando
//      placeholders no lugar.
//   2. cada imagem sobe pro Storage, e o placeholder vira a URL final.
//   3. o HTML resultante (já sem base64, bem mais leve) sobe também.
//   4. o link do relatório no Storage vira o mesmo write step que o output
//      "link" produziria — reaproveita buildLinkStep de link.js, não
//      duplica a lógica de escrita no card.
//
// dryRun não faz upload nenhum (efeito colateral no Storage não é "sem
// sujar o board" de verdade) — só roda a extração pura e devolve um
// preview com o que seria enviado.
//
// uploadAndSign/reportBasePath vêm de ctx (injetados por board.js, default
// storage.js de verdade) — assim dá pra testar build() com um fake, sem
// tocar Storage nem emulador.

const { buildLinkStep } = require('./link');

const MIME_EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', webp: 'webp' };
const MIME_CONTENT_TYPE = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};
const DATA_URI_RE = /src=(["'])data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)\1/g;

// Função pura: acha <img src="data:image/TIPO;base64,DADOS">, decodifica
// cada uma pra Buffer binário e devolve o HTML com um placeholder no lugar
// do data URI (sem I/O nenhum — testável com fixture, sem emulador).
function extractImagesForUpload(html) {
  const images = [];
  let n = 0;
  const htmlWithPlaceholders = html.replace(DATA_URI_RE, (match, quote, mime, base64) => {
    n += 1;
    const ext = MIME_EXT[mime] || 'png';
    const placeholder = `__AGENTE_AGIL_IMG_${n}__`;
    images.push({
      placeholder,
      filename: `imagem-${n}.${ext}`,
      contentType: MIME_CONTENT_TYPE[mime] || 'image/png',
      buffer: Buffer.from(base64, 'base64'),
    });
    return `src=${quote}${placeholder}${quote}`;
  });
  return { html: htmlWithPlaceholders, images };
}

// Função pura: troca cada placeholder pela URL final já hospedada.
function replacePlaceholders(html, urlByPlaceholder) {
  let out = html;
  for (const [placeholder, url] of Object.entries(urlByPlaceholder)) {
    out = out.split(placeholder).join(url);
  }
  return out;
}

async function build(out, ctx) {
  const { html: htmlSemBase64, images } = extractImagesForUpload(out.html);

  if (ctx.dryRun) {
    return {
      kind: 'noop',
      preview: {
        titulo: out.titulo,
        imagensDetectadas: images.length,
        tamanhoTotalImagensBytes: images.reduce((sum, img) => sum + img.buffer.length, 0),
        htmlBytesAntes: Buffer.byteLength(out.html, 'utf8'),
        htmlBytesDepois: Buffer.byteLength(htmlSemBase64, 'utf8'),
      },
    };
  }

  const basePath = ctx.reportBasePath(ctx.squadId, ctx.cardId);
  const urlByPlaceholder = {};
  for (const img of images) {
    urlByPlaceholder[img.placeholder] = await ctx.uploadAndSign(`${basePath}/${img.filename}`, img.buffer, img.contentType);
  }
  const finalHtml = replacePlaceholders(htmlSemBase64, urlByPlaceholder);
  const reportUrl = await ctx.uploadAndSign(
    `${basePath}/relatorio.html`,
    Buffer.from(finalHtml, 'utf8'),
    'text/html; charset=utf-8'
  );

  return buildLinkStep({ url: reportUrl, titulo: out.titulo }, ctx);
}

module.exports = { extractImagesForUpload, replacePlaceholders, build };
