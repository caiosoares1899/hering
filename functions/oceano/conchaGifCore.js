// functions/oceano/conchaGifCore.js
//
// 🐚 GIF na Concha — núcleo puro (sem Firebase) da busca na KLIPY. Desenho: docs/ideias/cardume-v0-banco.md › "GIF na Concha".
// A função (conchaGif.js) só autentica, conta e chama `buscar()`. Tudo o que decide o que sai daqui está neste arquivo, testável.
//
// SEGURANÇA:
// - A chave da KLIPY vai no CAMINHO da URL (`api/v1/{app_key}/…`). A URL é montada só em `urlKlipy()` e nunca vai para log, erro ou resposta:
//   `buscar()` troca qualquer falha por um ErroGif com código fixo (o teste lança um erro com a URL dentro e confere).
// - Só sai daqui mídia de host fixo da KLIPY (HOST_RE — a MESMA regex das regras do banco), com tamanho entre 1 e 4096 e até MAX_BYTES.
// - Anúncio (`type: "ad"`) é descartado mesmo que a chave venha com anúncio ligado.
// - Nada da pessoa vai para a KLIPY: sem customer_id, só a busca (q), a página e parâmetros fixos (filtro de conteúdo `high`).

const HOST_RE = /^https:\/\/static[12]?\.klipy\.com\/[A-Za-z0-9/_.-]{1,300}$/;
const BASE = 'https://api.klipy.com/api/v1/';
const LIMITE_PESSOA_H = 60;   // buscas por pessoa por hora (cache incluído: protege contra clique repetido)
const TETO_CASA_H = 90;       // buscas NOVAS na KLIPY por hora, a casa toda (chave de teste = 100/h)
const MAX_BYTES = 2.5e6;      // cada pessoa que vê a mensagem baixa o GIF
const POR_PAGINA = 24;
const TTL_BUSCA_MS = 10 * 60000, TTL_ALTA_MS = 30 * 60000, CACHE_MAX = 200, TIMEOUT_MS = 6000;

class ErroGif extends Error {
  constructor(status, codigo) { super(codigo); this.status = status; this.codigo = codigo; }
}

// Busca normalizada: espaços colapsados, minúsculas (cache), 2 a 50 caracteres; vazio = em alta.
function normalizarBusca(q) {
  const s = String(q == null ? '' : q).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return '';
  if (s.length < 2 || s.length > 50) throw new ErroGif(400, 'busca_invalida');
  return s;
}
function normalizarPagina(p) {
  const n = Number(p == null || p === '' ? 1 : p);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new ErroGif(400, 'pagina_invalida');
  return n;
}

function urlKlipy(chave, q, pagina) {
  if (typeof chave !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(chave)) throw new ErroGif(500, 'chave_ausente');
  const ps = new URLSearchParams({ page: String(pagina), per_page: String(POR_PAGINA), locale: 'br', content_filter: 'high', format_filter: 'gif,webp,jpg' });
  if (q) ps.set('q', q);
  return BASE + chave + '/gifs/' + (q ? 'search' : 'trending') + '?' + ps.toString();
}

const urlOk = u => typeof u === 'string' && HOST_RE.test(u);
const dimOk = n => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 4096;
function arquivo(f) {   // {url, width, height, size} válido → {u, w, h, b} ou null
  if (!f || typeof f !== 'object' || !urlOk(f.url) || !dimOk(f.width) || !dimOk(f.height)) return null;
  const b = typeof f.size === 'number' && f.size > 0 ? f.size : null;
  if (b != null && b > MAX_BYTES) return null;
  return { u: f.url, w: Math.round(f.width), h: Math.round(f.height), b };
}
// Animação: webp antes de gif; entre os tamanhos, o que tem largura de 200 a 400 px e é o mais leve; senão, o mais estreito acima de 120.
function escolher(file, formatos, faixa) {
  const cands = [];
  for (const tam of ['xs', 'sm', 'md', 'hd']) for (const fmt of formatos) { const a = arquivo(file && file[tam] && file[tam][fmt]); if (a) cands.push(a); }
  if (!cands.length) return null;
  const dentro = cands.filter(a => a.w >= faixa[0] && a.w <= faixa[1]);
  if (dentro.length) return dentro.sort((x, y) => (x.b == null ? Infinity : x.b) - (y.b == null ? Infinity : y.b) || x.w - y.w)[0];
  const acima = cands.filter(a => a.w >= 120).sort((x, y) => x.w - y.w);
  return acima[0] || null;
}
function normalizar(json) {
  const lista = json && json.data && Array.isArray(json.data.data) ? json.data.data : [];
  const itens = [];
  for (const it of lista) {
    if (!it || typeof it !== 'object' || it.type === 'ad' || !it.file) continue;
    const anim = escolher(it.file, ['webp', 'gif'], [200, 400]);
    const prev = escolher(it.file, ['webp', 'gif'], [100, 220]);
    const parado = escolher(it.file, ['jpg'], [200, 400]);
    if (!anim || !prev) continue;
    const id = String(it.id == null ? '' : it.id);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
    const item = { id, t: String(it.title || '').replace(/\s+/g, ' ').trim().slice(0, 100), u: anim.u, w: anim.w, h: anim.h, p: prev.u };
    if (parado) item.s = parado.u;
    itens.push(item);
  }
  const d = json && json.data;
  return { itens, temMais: !!(d && d.has_next) };
}

// Contador por hora (transação do Realtime Database): devolve o novo valor ou undefined (= aborta, estourou).
const horaChave = (agora = new Date()) => agora.toISOString().slice(0, 13).replace(/[-T]/g, '');   // AAAAMMDDHH (UTC)
function contar(atual, hora, limite) {
  const n = atual && atual.h === hora && typeof atual.n === 'number' ? atual.n : 0;
  if (n >= limite) return undefined;
  return { h: hora, n: n + 1 };
}

// Cache na memória da instância: busca 10 min, em alta 30 min. Só busca NOVA na KLIPY conta no teto da casa.
const cache = new Map();
function doCache(chaveCache, agora = Date.now()) {
  const c = cache.get(chaveCache);
  if (!c) return null;
  if (agora - c.t > c.ttl) { cache.delete(chaveCache); return null; }
  return c.v;
}
function guardar(chaveCache, v, ttl, agora = Date.now()) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(chaveCache, { t: agora, ttl, v });
}

// Chama a KLIPY. Qualquer falha vira ErroGif com código fixo — a mensagem original (que pode conter a URL com a chave) NUNCA sai daqui.
async function chamarKlipy({ chave, q, pagina, fetchImpl, timeoutMs = TIMEOUT_MS }) {
  let url;
  try { url = urlKlipy(chave, q, pagina); } catch (e) { throw e instanceof ErroGif ? e : new ErroGif(500, 'chave_ausente'); }
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const r = await (fetchImpl || fetch)(url, { method: 'GET', headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
    if (!r || !r.ok) throw new ErroGif(502, r && r.status === 429 ? 'klipy_cota' : 'klipy_falhou');
    let json; try { json = await r.json(); } catch (e) { throw new ErroGif(502, 'klipy_resposta'); }
    return normalizar(json);
  } catch (e) {
    if (e instanceof ErroGif) throw e;
    throw new ErroGif(502, e && e.name === 'AbortError' ? 'klipy_tempo' : 'klipy_falhou');
  } finally { if (timer) clearTimeout(timer); }
}

module.exports = {
  HOST_RE, LIMITE_PESSOA_H, TETO_CASA_H, MAX_BYTES, POR_PAGINA, TTL_BUSCA_MS, TTL_ALTA_MS,
  ErroGif, normalizarBusca, normalizarPagina, urlKlipy, normalizar, escolher, horaChave, contar, doCache, guardar, chamarKlipy, _cache: cache,
};
