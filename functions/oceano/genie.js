// functions/oceano/genie.js
//
// 🐙 Polvo · Pergunte aos dados — ponte HTTP autenticada entre o Oceano e a Databricks Genie Conversation API.
// Desenho: docs/ideias/genie-oceano.md. Núcleo testável: genieCore.js.
//
// AUTH: onRequest + Authorization: Bearer <idToken> (padrão do projeto, como conchaGif.js).
//       verifyIdToken + contaDaEmpresa (domínio @ciahering.com.br, e-mail verificado e Google) + piloto exclusivo ADM
//       (kanban/usuarios/{uid}/role === 'adm' ou e-mail em kanban/config/adm_emails / DEFAULT_ADM_EMAILS).
//       CORS só da origem do Pages. Limites no POST: 30/h por pessoa e 200/h na casa (kanban/genie/uso, fechado nas regras).
// Ações:
//   - POST (perguntar): { acao?:'perguntar', pergunta, conversa? } → { conversa, mensagem, status }
//   - GET  (estado):    ?acao=estado&conversa=&mensagem=             → { conversa, mensagem, status, ... }
//   - GET  (grafico):   ?acao=grafico&conversa=&mensagem=&anexo=     → image/png binário
// Deploy isolado: firebase deploy --only functions:oceanoGenie (antes: rules + 4 secrets DATABRICKS_HOST, GENIE_SPACE_ID, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET).
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { contaDaEmpresa } = require('../common/contaEmpresa');
const { DEFAULT_ADM_EMAILS } = require('../common/admsDestino');
const core = require('./genieCore');

const DATABRICKS_HOST = defineSecret('DATABRICKS_HOST');
const GENIE_SPACE_ID = defineSecret('GENIE_SPACE_ID');
const DATABRICKS_CLIENT_ID = defineSecret('DATABRICKS_CLIENT_ID');
const DATABRICKS_CLIENT_SECRET = defineSecret('DATABRICKS_CLIENT_SECRET');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

async function contarNaHora(db, caminho, limite, agora) {
  const r = await db.ref(caminho).transaction((atual) => core.contar(atual, core.horaChave(agora), limite));
  return !!(r && r.committed);
}

async function estornarNaHora(db, caminho, agora) {
  const hora = core.horaChave(agora);
  await db.ref(caminho).transaction((atual) => {
    if (!atual || atual.h !== hora || typeof atual.n !== 'number' || atual.n <= 0) return atual;
    return { h: hora, n: atual.n - 1 };
  });
}

async function usuarioEhAdm(db, decoded) {
  const email = String((decoded && decoded.email) || '').trim().toLowerCase();
  const [roleSnap, admSnap] = await Promise.all([
    db.ref(`kanban/usuarios/${decoded.uid}/role`).get(),
    db.ref('kanban/config/adm_emails').get(),
  ]);
  if (roleSnap && roleSnap.val() === 'adm') return true;
  const raw = admSnap ? admSnap.val() : null;
  const lista = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : DEFAULT_ADM_EMAILS);
  return lista.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean).includes(email);
}

function lerSegredos(deps) {
  if (deps && deps.secrets) return deps.secrets;
  return {
    host: DATABRICKS_HOST.value(),
    spaceId: GENIE_SPACE_ID.value(),
    clientId: DATABRICKS_CLIENT_ID.value(),
    clientSecret: DATABRICKS_CLIENT_SECRET.value(),
  };
}

function setHeader(res, nome, valor) {
  if (typeof res.set === 'function') res.set(nome, valor);
  else if (typeof res.setHeader === 'function') res.setHeader(nome, valor);
}

function logar(acao, uid, codigo, inicioMs, ehErro, fnAgoraMs = Date.now) {
  const ms = Math.max(0, fnAgoraMs() - inicioMs);
  const linha = `[oceanoGenie] acao=${acao} uid=${uid || '-'} codigo=${codigo} ms=${ms}`;
  if (ehErro) console.error(linha);
  else console.log(linha);
}

async function tratar(req, res, deps = {}) {
  const fnAgoraMs = deps.agoraFn || Date.now;
  const inicioMs = fnAgoraMs();
  const prazoEm = inicioMs + (typeof deps.prazoMs === 'number' ? deps.prazoMs : core.PRAZO_TOTAL_MS);
  const auth = deps.auth || getAuth();
  const db = deps.db || getDatabase();
  const agora = typeof deps.agora === 'function' ? deps.agora() : new Date();
  const erro = (status, codigo, acao = '-', uid = '-') => {
    logar(acao, uid, codigo, inicioMs, status >= 500, fnAgoraMs);
    return res.status(status).json({ erro: codigo });
  };

  if (req.method !== 'POST' && req.method !== 'GET') return erro(405, 'metodo');

  const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return erro(401, 'sem_token');

  let decoded;
  try { decoded = await auth.verifyIdToken(m[1]); } catch (e) { return erro(401, 'token_invalido'); }
  if (!contaDaEmpresa(decoded) || !UID_RE.test(String(decoded.uid || ''))) return erro(403, 'conta');

  const uid = decoded.uid;
  let acao = req.method === 'POST' ? 'perguntar' : String((req.query && req.query.acao) || 'estado').trim();
  if (req.method === 'POST') {
    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    if (corpo.acao != null && String(corpo.acao).trim() !== 'perguntar') {
      return erro(400, 'entrada', 'perguntar', uid);
    }
  } else if (acao !== 'estado' && acao !== 'grafico') {
    return erro(400, 'entrada', acao || '-', uid);
  }

  try {
    if (!(await usuarioEhAdm(db, decoded))) return erro(403, 'sem_acesso', acao, uid);

    const secrets = lerSegredos(deps);

    if (req.method === 'POST') {
      const corpo = req.body && typeof req.body === 'object' ? req.body : {};
      const pergunta = core.normalizarPergunta(corpo.pergunta);
      let conversaId = null;
      if (corpo.conversa != null && String(corpo.conversa).trim() !== '') {
        conversaId = core.normalizarId(String(corpo.conversa), 'entrada');
        const reg = (await db.ref(`kanban/genie/conversas/${uid}/${conversaId}`).get()).val();
        core.conferirPosse(reg);
      }

      if (!(await contarNaHora(db, `kanban/genie/uso/${uid}`, core.LIMITE_PESSOA_H, agora))) {
        return erro(429, 'limite_pessoa', acao, uid);
      }
      if (!(await contarNaHora(db, 'kanban/genie/uso/_casa', core.TETO_CASA_H, agora))) {
        await estornarNaHora(db, `kanban/genie/uso/${uid}`, agora);
        return erro(429, 'limite_casa', acao, uid);
      }

      const r = await core.iniciarOuContinuar({
        secrets,
        pergunta,
        conversaId,
        fetchImpl: deps.fetch,
        sleepImpl: deps.sleep,
        agoraFn: fnAgoraMs,
        timeoutMs: deps.timeoutMs,
        prazoEm,
      });

      const patch = { ts: agora.toISOString(), ultima_msg: r.mensagem };
      patch[`msgs/${r.mensagem}`] = true;
      await db.ref(`kanban/genie/conversas/${uid}/${r.conversa}`).update(patch);

      logar(acao, uid, r.status, inicioMs, false, fnAgoraMs);
      return res.status(200).json(r);
    }

    const q = req.query || {};
    const conversaId = core.normalizarId(q.conversa, 'entrada');
    const mensagemId = core.normalizarId(q.mensagem, 'entrada');
    const regConversa = (await db.ref(`kanban/genie/conversas/${uid}/${conversaId}`).get()).val();

    if (acao === 'grafico') {
      const anexoId = core.normalizarId(q.anexo, 'entrada');
      const buf = await core.baixarGrafico({
        secrets,
        conversaId,
        mensagemId,
        anexoId,
        regConversa,
        fetchImpl: deps.fetch,
        sleepImpl: deps.sleep,
        agoraFn: fnAgoraMs,
        timeoutMs: deps.timeoutMs,
        prazoEm,
      });
      setHeader(res, 'Content-Type', 'image/png');
      setHeader(res, 'X-Content-Type-Options', 'nosniff');
      setHeader(res, 'Cache-Control', 'private, max-age=300');
      logar(acao, uid, 'ok', inicioMs, false, fnAgoraMs);
      if (typeof res.send === 'function') return res.status(200).send(buf);
      return res.status(200).end(buf);
    }

    const r = await core.consultarEstado({
      secrets,
      conversaId,
      mensagemId,
      regConversa,
      fetchImpl: deps.fetch,
      sleepImpl: deps.sleep,
      agoraFn: fnAgoraMs,
      timeoutMs: deps.timeoutMs,
      prazoEm,
    });

    const { _anexos, ...saida } = r;
    if (_anexos && Object.keys(_anexos).length) {
      await db.ref(`kanban/genie/conversas/${uid}/${conversaId}/anexos`).update(_anexos);
    }

    logar(acao, uid, saida.status || 'ok', inicioMs, false, fnAgoraMs);
    return res.status(200).json(saida);
  } catch (e) {
    const codigo = e instanceof core.ErroGenie ? e.codigo : 'interno';
    const status = e instanceof core.ErroGenie ? e.status : 500;
    return erro(status, codigo, acao, uid);
  }
}

exports.oceanoGenie = onRequest(
  {
    region: 'us-central1',
    cors: SITE_ORIGIN,
    secrets: [DATABRICKS_HOST, GENIE_SPACE_ID, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET],
    timeoutSeconds: 60,
    maxInstances: 3,
  },
  (req, res) => tratar(req, res)
);
exports._tratar = tratar;
exports._CONFIG = { timeoutSeconds: 60 };
