// functions/vtex/traduzir.js — tradução inglês → português dos avisos da VTEX (Google Cloud Translation API v2 "Basic", 2026-10-21).
//
// Por que Google: o texto do incidente é público (status.vtex.com), então privacidade não pesa; o que pesa é NÃO abrir um fornecedor novo — o projeto já é do
// Google Cloud e a chamada usa a conta de serviço da própria função (sem chave guardada em lugar nenhum). Custo: as primeiras 500 mil letras por mês são grátis; o
// monitor traduz só o que mudou (statusVtex.js guarda o resultado), algumas dezenas de textos por mês.
// Pré-requisito (uma vez, no console): ativar a "Cloud Translation API" no projeto hering-onboarding. A conta de serviço padrão das funções já costuma ter permissão.
//
// Nomes de produto/termos de plataforma NÃO são traduzidos (ver PROTEGIDOS): sem isso "Checkout" viraria "Finalizar compra" e "Storefront" "Vitrine", e ninguém
// que usa a VTEX reconheceria. A tradução é automática — o aviso diz isso e guarda o original em inglês.
const URL_V2 = 'https://translation.googleapis.com/language/translate/v2';
const ESCOPO = 'https://www.googleapis.com/auth/cloud-translation';

const PROTEGIDOS = ['VTEX IO', 'VTEX', 'Master Data', 'Checkout', 'Storefront', 'FastStore', 'Admin', 'API', 'APIs', 'Marketplace', 'Gateway', 'CDN', 'DNS', 'SLA', 'webhook', 'webhooks', 'cache'];
const RE_PROTEGIDOS = new RegExp('\\b(' + PROTEGIDOS.slice().sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');

const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeHtml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, '&');

// Texto puro → HTML com os termos protegidos (translate="no"); o Google respeita isso em format:'html'.
const protege = (txt) => escHtml(txt).replace(RE_PROTEGIDOS, '<span translate="no">$1</span>');
// HTML devolvido pelo Google → texto puro (tira os spans e desfaz as entidades).
const desprotege = (html) => decodeHtml(String(html || '').replace(/<\/?span(?:\s[^>]*)?>/gi, ''));

let _auth = null;
async function tokenPadrao() {
  if (!_auth) { const { GoogleAuth } = require('google-auth-library'); _auth = new GoogleAuth({ scopes: [ESCOPO] }); }
  const t = await _auth.getAccessToken();
  if (!t) throw new Error('sem token do Google para a Cloud Translation API');
  return t;
}

// Traduz uma lista de textos (inglês → português) numa só chamada. Devolve as traduções na mesma ordem; lança em qualquer falha
// (quem chama decide cair no inglês — o alerta nunca espera por tradução).
async function traduzirEnPt(textos, { fetchImpl, token, timeoutMs = 6000 } = {}) {
  const lista = (textos || []).map((t) => String(t == null ? '' : t));
  if (!lista.length) return [];
  const f = fetchImpl || fetch;
  const bearer = token || (await tokenPadrao());
  const r = await f(URL_V2, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + bearer, 'content-type': 'application/json' },
    body: JSON.stringify({ q: lista.map(protege), source: 'en', target: 'pt', format: 'html' }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error('Cloud Translation respondeu HTTP ' + r.status + ' ' + String(await r.text().catch(() => '')).slice(0, 160));
  const j = await r.json();
  const out = ((j && j.data && j.data.translations) || []).map((t) => desprotege(t && t.translatedText));
  if (out.length !== lista.length) throw new Error('Cloud Translation devolveu ' + out.length + ' de ' + lista.length + ' textos');
  return out;
}

module.exports = { traduzirEnPt, _test: { protege, desprotege, PROTEGIDOS, URL_V2 } };
