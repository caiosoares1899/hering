// functions/oceano/conchaGif.js
//
// 🐚 GIF na Concha — busca na KLIPY intermediada pelo servidor (a chave fica num secret; decisão do Caio, 24/11/2026).
// Desenho: docs/ideias/cardume-v0-banco.md › "GIF na Concha". Núcleo testável: conchaGifCore.js.
//
// AUTH: onRequest + Authorization: Bearer <idToken> (padrão do projeto, como spotifyRadioSearch — nenhuma página carrega o SDK de Functions).
//       verifyIdToken + contaDaEmpresa (domínio, e-mail verificado e Google) + membro de ao menos um canal da Concha (kanban/cardume/meus/{uid}).
//       CORS só da origem do Pages. Limites: 60 buscas/h por pessoa e 90 buscas NOVAS/h na casa toda (kanban/cardume/gif_uso, fechado nas regras).
// Entrada: GET ?q=(0 ou 2–50 caracteres; vazio = em alta)&p=(1–5). Saída: {itens:[{id,t,u,s?,w,h,p}], temMais}. Erro: {erro:'<código fixo>'}.
// Deploy isolado: firebase deploy --only functions:conchaGifBusca (antes: firebase functions:secrets:set KLIPY_API_KEY).
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { contaDaEmpresa } = require('../common/contaEmpresa');
const core = require('./conchaGifCore');

const KLIPY_API_KEY = defineSecret('KLIPY_API_KEY');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

async function contarNaHora(db, caminho, limite) {
  const r = await db.ref(caminho).transaction(atual => core.contar(atual, core.horaChave(), limite));
  return !!(r && r.committed);
}

async function tratar(req, res, deps = {}) {
  const auth = deps.auth || getAuth(), db = deps.db || getDatabase();
  const erro = (status, codigo) => res.status(status).json({ erro: codigo });
  if (req.method !== 'GET') return erro(405, 'metodo');
  const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return erro(401, 'sem_token');
  let decoded;
  try { decoded = await auth.verifyIdToken(m[1]); } catch (e) { return erro(401, 'token_invalido'); }
  if (!contaDaEmpresa(decoded) || !UID_RE.test(String(decoded.uid || ''))) return erro(403, 'conta');
  const uid = decoded.uid;
  let q, pagina;
  try { q = core.normalizarBusca(req.query.q); pagina = core.normalizarPagina(req.query.p); } catch (e) { return erro(e.status || 400, e.codigo || 'entrada'); }
  try {
    const meus = (await db.ref('kanban/cardume/meus/' + uid).get()).val() || {};
    if (!Object.values(meus).some(v => v === true)) return erro(403, 'fora_da_concha');
    if (!(await contarNaHora(db, 'kanban/cardume/gif_uso/' + uid, core.LIMITE_PESSOA_H))) return erro(429, 'limite_pessoa');
    const chaveCache = (q || '~alta') + '|' + pagina;
    const emCache = core.doCache(chaveCache);
    if (emCache) return res.status(200).json(emCache);
    if (!(await contarNaHora(db, 'kanban/cardume/gif_uso/_casa', core.TETO_CASA_H))) return erro(429, 'limite_casa');
    const v = await core.chamarKlipy({ chave: (deps.chave != null ? deps.chave : KLIPY_API_KEY.value()), q, pagina, fetchImpl: deps.fetch });
    core.guardar(chaveCache, v, q ? core.TTL_BUSCA_MS : core.TTL_ALTA_MS);
    return res.status(200).json(v);
  } catch (e) {
    const codigo = e instanceof core.ErroGif ? e.codigo : 'interno';
    console.error('[conchaGifBusca] falhou:', codigo);   // só o código fixo: o erro original pode conter a URL com a chave
    return erro(e instanceof core.ErroGif ? e.status : 500, codigo);
  }
}

exports.conchaGifBusca = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [KLIPY_API_KEY], timeoutSeconds: 15, maxInstances: 3 },
  (req, res) => tratar(req, res)
);
exports._tratar = tratar;
