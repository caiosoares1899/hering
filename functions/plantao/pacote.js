// functions/plantao/pacote.js — o PACOTE ANÔNIMO no servidor. Espelho EXATO de feriasSanitizarTexto/feriasMontarPacoteAnonimo (oceano-dev.html):
// só o bug (app, arquivo, impacto, descrição, trecho de console), sem autor/e-mail/uid/link/print. O teste pacote.test.js roda as duas
// versões lado a lado sobre os mesmos textos — mudou uma, mude a outra.
function sanitizarTexto(t, max) {
  let x = String(t == null ? '' : t);
  x = x.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[token]')
    .replace(/\s+/g, ' ').trim();
  return max ? x.slice(0, max) : x;
}
function montarPacote(b) {
  b = b || {};
  const alvo = String(b.arquivoAlvo || 'kanban-dev.html').replace(/[^\w.\-]/g, '');
  const app = sanitizarTexto(b.app || '', 40);
  const imp = sanitizarTexto(b.impacto || '', 40);
  const desc = sanitizarTexto(b.texto || b.msg || '', 900);
  const cons = sanitizarTexto(b.erroConsole || '', 400);
  return '/plantaobug em ' + alvo + ' — Bug reportado no Oceano' + (app || imp ? ' (' + [app, imp].filter(Boolean).join(' · ') + ')' : '') + ': ' + desc
    + (cons ? ' [Console(F12), trecho sem dados pessoais: ' + cons + ']' : '');
}
module.exports = { sanitizarTexto, montarPacote };
