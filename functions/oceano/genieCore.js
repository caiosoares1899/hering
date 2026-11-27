// functions/oceano/genieCore.js
//
// 🐙 Polvo · Pergunte aos dados — núcleo puro (sem Firebase) da ponte com a Databricks Genie Conversation API.
// Desenho: docs/ideias/genie-oceano.md. A Cloud Function (genie.js) apenas autentica, checa ADM,
// controla cota/posse no RTDB e delega as chamadas HTTP para cá.
//
// SEGURANÇA:
// - Host, space_id, client_id e client_secret nunca são fixados no código nem logados.
// - Qualquer erro de rede/HTTP/parse do fetch é convertido em ErroGenie com código fixo (nunca vaza URL, token, pergunta ou SQL).
// - Nenhuma constante fixa de RPM do Genie é assumida aqui; 429 usa backoff exponencial curto e devolve 'genie_ocupado'.

const LIMITE_PESSOA_H = 30;
const TETO_CASA_H = 200;
const MIN_PERGUNTA = 2;
const MAX_PERGUNTA = 1000;
const MAX_LINHAS = 200;
const MAX_SUGESTOES = 6;
const MAX_GRAFICO_BYTES = 8 * 1024 * 1024;
const TOKEN_MARGEM_MS = 60 * 1000;
const TIMEOUT_MS = 20000;
const BACKOFF_429_MS = [350, 800];
const MAX_RETRY_AFTER_MS = 2000;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class ErroGenie extends Error {
  constructor(status, codigo) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
  }
}

function normalizarConfig(secrets) {
  const s = secrets && typeof secrets === 'object' ? secrets : {};
  const rawHost = String(s.host || '').trim();
  const spaceId = String(s.spaceId || '').trim();
  const clientId = String(s.clientId || '').trim();
  const clientSecret = String(s.clientSecret || '').trim();

  if (!rawHost || rawHost.length > 256 || CTRL_RE.test(rawHost)) throw new ErroGenie(500, 'config_ausente');
  let u;
  try { u = new URL(rawHost); } catch (e) { throw new ErroGenie(500, 'config_ausente'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== '/')) {
    throw new ErroGenie(500, 'config_ausente');
  }
  if (!ID_RE.test(spaceId)) throw new ErroGenie(500, 'config_ausente');
  if (!clientId || clientId.length > 512 || CTRL_RE.test(clientId) || clientId.includes(':')) {
    throw new ErroGenie(500, 'config_ausente');
  }
  if (!clientSecret || clientSecret.length > 512 || CTRL_RE.test(clientSecret)) {
    throw new ErroGenie(500, 'config_ausente');
  }
  return { host: u.origin, spaceId, clientId, clientSecret };
}

function normalizarPergunta(p) {
  if (typeof p !== 'string') throw new ErroGenie(400, 'pergunta_invalida');
  if (CTRL_RE.test(p)) throw new ErroGenie(400, 'pergunta_invalida');
  const limpa = p.replace(/\r\n?/g, '\n').trim();
  if (limpa.length < MIN_PERGUNTA || limpa.length > MAX_PERGUNTA) {
    throw new ErroGenie(400, 'pergunta_invalida');
  }
  return limpa;
}

function normalizarId(v, codigo = 'entrada') {
  if (typeof v !== 'string') throw new ErroGenie(400, codigo);
  const s = v.trim();
  if (!ID_RE.test(s)) throw new ErroGenie(400, codigo);
  return s;
}

const horaChave = (agora = new Date()) => agora.toISOString().slice(0, 13).replace(/[-T]/g, '');

function contar(atual, hora, limite) {
  const n = atual && atual.h === hora && typeof atual.n === 'number' ? atual.n : 0;
  if (n >= limite) return undefined;
  return { h: hora, n: n + 1 };
}

function conferirPosse(regConversa, mid, aid) {
  if (!regConversa || typeof regConversa !== 'object') {
    throw new ErroGenie(403, 'conversa_alheia');
  }
  if (mid !== undefined) {
    if (!ID_RE.test(String(mid)) || !regConversa.msgs || regConversa.msgs[mid] !== true) {
      throw new ErroGenie(403, 'conversa_alheia');
    }
  }
  if (aid !== undefined) {
    if (!ID_RE.test(String(aid)) || !regConversa.anexos || regConversa.anexos[aid] !== mid) {
      throw new ErroGenie(403, 'conversa_alheia');
    }
  }
}

// Cache do token OAuth M2M na memória da instância, indexado por (host + clientId).
const tokenCache = new Map();
const tokenEmVoo = new Map();

function chaveToken(cfg) {
  return `${cfg.host}|${cfg.clientId}`;
}

function limparCacheToken(cfg) {
  if (!cfg) {
    tokenCache.clear();
    tokenEmVoo.clear();
    return;
  }
  const k = chaveToken(cfg);
  tokenCache.delete(k);
  tokenEmVoo.delete(k);
}

async function pedirNovoTokenM2M({ cfg, fetchImpl, agoraFn = Date.now, timeoutMs = TIMEOUT_MS }) {
  const url = `${cfg.host}/oidc/v1/token`;
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, 'utf8').toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'all-apis' }).toString();
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const r = await (fetchImpl || fetch)(url, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r || !r.ok) throw new ErroGenie(502, 'genie_auth');
    let json;
    try { json = await r.json(); } catch (e) { throw new ErroGenie(502, 'genie_auth'); }
    const token = json && typeof json.access_token === 'string' ? json.access_token.trim() : '';
    if (!token) throw new ErroGenie(502, 'genie_auth');
    const expSec = typeof json.expires_in === 'number' && Number.isFinite(json.expires_in) && json.expires_in > 0 ? json.expires_in : 3600;
    const margem = Math.min(TOKEN_MARGEM_MS, Math.floor((expSec * 1000) / 2));
    const expiraEm = agoraFn() + Math.max(1000, expSec * 1000 - margem);
    tokenCache.set(chaveToken(cfg), { token, expiraEm });
    return token;
  } catch (e) {
    if (e instanceof ErroGenie) throw e;
    throw new ErroGenie(502, 'genie_auth');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function obterTokenM2M({ cfg, fetchImpl, agoraFn = Date.now, timeoutMs = TIMEOUT_MS, forcar = false }) {
  const k = chaveToken(cfg);
  if (!forcar) {
    const emCache = tokenCache.get(k);
    if (emCache && agoraFn() < emCache.expiraEm) return emCache.token;
  } else {
    tokenCache.delete(k);
  }
  const pAtual = tokenEmVoo.get(k);
  if (pAtual) return pAtual;
  const p = pedirNovoTokenM2M({ cfg, fetchImpl, agoraFn, timeoutMs }).finally(() => {
    tokenEmVoo.delete(k);
  });
  tokenEmVoo.set(k, p);
  return p;
}

const esperarPadrao = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function atraso429(res, tentativa) {
  const base = BACKOFF_429_MS[tentativa] || BACKOFF_429_MS[BACKOFF_429_MS.length - 1];
  const ra = res && res.headers && typeof res.headers.get === 'function' ? Number(res.headers.get('retry-after')) : NaN;
  if (Number.isFinite(ra) && ra > 0) return Math.min(MAX_RETRY_AFTER_MS, Math.round(ra * 1000));
  return base;
}

async function requisitarGenie({ cfg, metodo, caminho, corpo, binario = false, fetchImpl, sleepImpl = esperarPadrao, agoraFn = Date.now, timeoutMs = TIMEOUT_MS }) {
  const fnFetch = fetchImpl || fetch;
  const url = `${cfg.host}${caminho}`;
  let renovou = false;
  let tent429 = 0;

  while (true) {
    const token = await obterTokenM2M({ cfg, fetchImpl: fnFetch, agoraFn, timeoutMs, forcar: renovou });
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let r;
    try {
      const headers = {
        authorization: `Bearer ${token}`,
        accept: binario ? 'image/png, application/octet-stream' : 'application/json',
      };
      if (corpo !== undefined) headers['content-type'] = 'application/json';
      r = await fnFetch(url, {
        method: metodo,
        headers,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        signal: ctl ? ctl.signal : undefined,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ErroGenie(502, 'genie_tempo');
      throw new ErroGenie(502, 'genie_falhou');
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (r && r.status === 401 && !renovou) {
      limparCacheToken(cfg);
      renovou = true;
      continue;
    }
    if (r && (r.status === 401 || r.status === 403)) {
      throw new ErroGenie(502, 'genie_auth');
    }
    if (r && r.status === 429) {
      if (tent429 < BACKOFF_429_MS.length) {
        await sleepImpl(atraso429(r, tent429));
        tent429++;
        continue;
      }
      throw new ErroGenie(429, 'genie_ocupado');
    }
    if (!r || !r.ok) {
      const err = new ErroGenie(502, 'genie_falhou');
      err.httpStatus = r ? r.status : 0;
      throw err;
    }

    if (binario) {
      try {
        const ab = await r.arrayBuffer();
        const buf = Buffer.from(ab);
        if (!buf.length || buf.length > MAX_GRAFICO_BYTES) throw new ErroGenie(502, 'genie_resposta');
        if (buf.length < PNG_MAGIC.length || !buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
          throw new ErroGenie(502, 'genie_resposta');
        }
        return buf;
      } catch (e) {
        if (e instanceof ErroGenie) throw e;
        throw new ErroGenie(502, 'genie_resposta');
      }
    }

    try {
      return await r.json();
    } catch (e) {
      throw new ErroGenie(502, 'genie_resposta');
    }
  }
}

function extrairIdsInicio(json, conversaEsperada) {
  if (!json || typeof json !== 'object') throw new ErroGenie(502, 'genie_resposta');
  const cid = String(
    conversaEsperada ||
    json.conversation_id ||
    (json.conversation && json.conversation.id) ||
    (json.message && json.message.conversation_id) ||
    ''
  ).trim();
  const mid = String(
    json.message_id ||
    (json.message && (json.message.message_id || json.message.id)) ||
    json.id ||
    ''
  ).trim();
  if (!ID_RE.test(cid) || !ID_RE.test(mid)) throw new ErroGenie(502, 'genie_resposta');
  const status = String(json.status || (json.message && json.message.status) || 'SUBMITTED');
  return { conversa: cid, mensagem: mid, status };
}

async function iniciarOuContinuar({ secrets, pergunta, conversaId, fetchImpl, sleepImpl, agoraFn, timeoutMs }) {
  const cfg = normalizarConfig(secrets);
  const texto = normalizarPergunta(pergunta);
  const cid = conversaId ? normalizarId(conversaId, 'entrada') : null;
  const base = `/api/2.0/genie/spaces/${encodeURIComponent(cfg.spaceId)}`;
  const caminho = cid
    ? `${base}/conversations/${encodeURIComponent(cid)}/messages`
    : `${base}/start-conversation`;

  let json;
  try {
    json = await requisitarGenie({
      cfg,
      metodo: 'POST',
      caminho,
      corpo: { content: texto, enable_visualization: true },
      fetchImpl,
      sleepImpl,
      agoraFn,
      timeoutMs,
    });
  } catch (e) {
    if (e instanceof ErroGenie && e.httpStatus === 400) {
      // Fallback caso o endpoint/workspace rejeite o campo opcional enable_visualization
      json = await requisitarGenie({
        cfg,
        metodo: 'POST',
        caminho,
        corpo: { content: texto },
        fetchImpl,
        sleepImpl,
        agoraFn,
        timeoutMs,
      });
    } else {
      throw e;
    }
  }
  return extrairIdsInicio(json, cid);
}

function extrairAnexos(msg, regConversa, mid) {
  const atts = Array.isArray(msg && msg.attachments) ? msg.attachments : [];
  const textos = [];
  const sugestoes = [];
  const graficos = [];
  const _anexos = {};
  let queryInfo = null;

  for (const att of atts) {
    if (!att || typeof att !== 'object') continue;
    const aidRaw = att.attachment_id || att.id || '';
    const aid = typeof aidRaw === 'string' && ID_RE.test(aidRaw.trim()) ? aidRaw.trim() : null;
    if (aid) {
      if (regConversa && regConversa.anexos && regConversa.anexos[aid] && regConversa.anexos[aid] !== mid) {
        throw new ErroGenie(403, 'conversa_alheia');
      }
      _anexos[aid] = mid;
    }

    if (att.text && typeof att.text.content === 'string' && att.text.content.trim()) {
      textos.push(att.text.content.trim());
    }
    if (att.query && typeof att.query === 'object') {
      const sql = typeof att.query.query === 'string' ? att.query.query : null;
      const desc = typeof att.query.description === 'string' ? att.query.description : null;
      if (!queryInfo) queryInfo = { aid, sql, descricao: desc };
    }
    const viz = att.viz || att.visualization;
    if (viz && typeof viz === 'object' && aid) {
      const desc = typeof viz.description === 'string' ? viz.description : (typeof viz.title === 'string' ? viz.title : '');
      graficos.push({ anexo: aid, descricao: desc });
    }
    if (att.suggested_questions && Array.isArray(att.suggested_questions.questions)) {
      for (const q of att.suggested_questions.questions) {
        if (typeof q === 'string' && q.trim() && sugestoes.length < MAX_SUGESTOES) {
          sugestoes.push(q.trim());
        }
      }
    }
  }

  return {
    texto: textos.join('\n\n'),
    queryInfo,
    graficos,
    sugestoes,
    _anexos,
  };
}

function normalizarCelula(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

function extrairTabela(payload) {
  const sr = payload && (payload.statement_response || payload);
  if (!sr || typeof sr !== 'object') {
    return { estado: '', colunas: [], linhas: [], cortado: false, totalLinhas: null };
  }
  const estado = sr.status && typeof sr.status.state === 'string' ? sr.status.state : '';
  const manifest = sr.manifest && typeof sr.manifest === 'object' ? sr.manifest : {};
  const schemaCols = manifest.schema && Array.isArray(manifest.schema.columns) ? manifest.schema.columns : [];
  const colunas = schemaCols.map((c, idx) => ({
    nome: String((c && c.name) != null ? c.name : `col_${idx + 1}`),
    tipo: String((c && (c.type_name || c.type_text)) || 'STRING'),
  }));
  const result = sr.result && typeof sr.result === 'object' ? sr.result : {};
  const rawRows = Array.isArray(result.data_array) ? result.data_array : [];
  const totalManifest = typeof manifest.total_row_count === 'number' && Number.isFinite(manifest.total_row_count)
    ? manifest.total_row_count
    : null;
  const totalLinhas = totalManifest != null ? totalManifest : rawRows.length;
  const cortado = Boolean(
    rawRows.length > MAX_LINHAS ||
    (totalManifest != null && totalManifest > MAX_LINHAS) ||
    manifest.truncated === true ||
    result.next_chunk_index != null
  );
  const linhas = rawRows.slice(0, MAX_LINHAS).map((row) =>
    Array.isArray(row) ? row.map(normalizarCelula) : []
  );
  return { estado, colunas, linhas, cortado, totalLinhas };
}

async function consultarEstado({ secrets, conversaId, mensagemId, regConversa, fetchImpl, sleepImpl, agoraFn, timeoutMs }) {
  const cfg = normalizarConfig(secrets);
  const cid = normalizarId(conversaId, 'entrada');
  const mid = normalizarId(mensagemId, 'entrada');
  conferirPosse(regConversa, mid);

  const base = `/api/2.0/genie/spaces/${encodeURIComponent(cfg.spaceId)}/conversations/${encodeURIComponent(cid)}/messages/${encodeURIComponent(mid)}`;
  const msg = await requisitarGenie({ cfg, metodo: 'GET', caminho: base, fetchImpl, sleepImpl, agoraFn, timeoutMs });
  if (!msg || typeof msg !== 'object') throw new ErroGenie(502, 'genie_resposta');

  const status = String(msg.status || '');
  const anexos = extrairAnexos(msg, regConversa, mid);

  const montarCompleto = (tab) => ({
    conversa: cid,
    mensagem: mid,
    status: 'COMPLETED',
    texto: anexos.texto,
    sql: anexos.queryInfo ? anexos.queryInfo.sql : null,
    descricao: anexos.queryInfo ? anexos.queryInfo.descricao : null,
    colunas: tab.colunas,
    linhas: tab.linhas,
    cortado: tab.cortado,
    totalLinhas: tab.totalLinhas,
    graficos: anexos.graficos,
    sugestoes: anexos.sugestoes,
    _anexos: anexos._anexos,
  });

  const reexecutar = async (aid) => {
    const respExec = await requisitarGenie({
      cfg,
      metodo: 'POST',
      caminho: `${base}/attachments/${encodeURIComponent(aid)}/execute-query`,
      corpo: {},
      fetchImpl,
      sleepImpl,
      agoraFn,
      timeoutMs,
    });
    const tab = extrairTabela(respExec);
    if (tab.estado === 'SUCCEEDED') return montarCompleto(tab);
    if (tab.estado === 'FAILED' || tab.estado === 'CANCELED' || tab.estado === 'CLOSED') {
      return { conversa: cid, mensagem: mid, status: 'FAILED', _anexos: anexos._anexos };
    }
    return { conversa: cid, mensagem: mid, status: 'EXECUTING_QUERY', _anexos: anexos._anexos };
  };

  if (status === 'QUERY_RESULT_EXPIRED') {
    if (anexos.queryInfo && anexos.queryInfo.aid) {
      return reexecutar(anexos.queryInfo.aid);
    }
    return { conversa: cid, mensagem: mid, status: 'FAILED', _anexos: anexos._anexos };
  }

  if (status === 'COMPLETED') {
    let tab = { estado: 'SUCCEEDED', colunas: [], linhas: [], cortado: false, totalLinhas: null };
    if (anexos.queryInfo && anexos.queryInfo.aid) {
      const qr = await requisitarGenie({
        cfg,
        metodo: 'GET',
        caminho: `${base}/attachments/${encodeURIComponent(anexos.queryInfo.aid)}/query-result`,
        fetchImpl,
        sleepImpl,
        agoraFn,
        timeoutMs,
      });
      tab = extrairTabela(qr);
      if (tab.estado === 'CLOSED' || tab.estado === 'QUERY_RESULT_EXPIRED') {
        return reexecutar(anexos.queryInfo.aid);
      }
      if (tab.estado === 'PENDING' || tab.estado === 'RUNNING') {
        return { conversa: cid, mensagem: mid, status: 'EXECUTING_QUERY', _anexos: anexos._anexos };
      }
      if (tab.estado === 'FAILED' || tab.estado === 'CANCELED') {
        return { conversa: cid, mensagem: mid, status: 'FAILED', _anexos: anexos._anexos };
      }
    }
    return montarCompleto(tab);
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return { conversa: cid, mensagem: mid, status, _anexos: anexos._anexos };
  }

  return { conversa: cid, mensagem: mid, status: status || 'SUBMITTED', _anexos: anexos._anexos };
}

async function baixarGrafico({ secrets, conversaId, mensagemId, anexoId, regConversa, fetchImpl, sleepImpl, agoraFn, timeoutMs }) {
  const cfg = normalizarConfig(secrets);
  const cid = normalizarId(conversaId, 'entrada');
  const mid = normalizarId(mensagemId, 'entrada');
  const aid = normalizarId(anexoId, 'entrada');
  conferirPosse(regConversa, mid, aid);

  const caminho = `/api/2.0/genie/spaces/${encodeURIComponent(cfg.spaceId)}/conversations/${encodeURIComponent(cid)}/messages/${encodeURIComponent(mid)}/attachments/${encodeURIComponent(aid)}/download-visualization`;
  return requisitarGenie({
    cfg,
    metodo: 'GET',
    caminho,
    binario: true,
    fetchImpl,
    sleepImpl,
    agoraFn,
    timeoutMs,
  });
}

module.exports = {
  LIMITE_PESSOA_H,
  TETO_CASA_H,
  MIN_PERGUNTA,
  MAX_PERGUNTA,
  MAX_LINHAS,
  MAX_SUGESTOES,
  MAX_GRAFICO_BYTES,
  TOKEN_MARGEM_MS,
  TIMEOUT_MS,
  BACKOFF_429_MS,
  ID_RE,
  PNG_MAGIC,
  ErroGenie,
  normalizarConfig,
  normalizarPergunta,
  normalizarId,
  horaChave,
  contar,
  conferirPosse,
  obterTokenM2M,
  limparCacheToken,
  requisitarGenie,
  iniciarOuContinuar,
  consultarEstado,
  baixarGrafico,
  extrairTabela,
};
