// functions/oceano/__tests__/genie.test.js — 🐙 Polvo · Pergunte aos dados (núcleo + invólucro HTTP com fetch e DB falsos)
// Segurança: usa apenas host/IDs/credenciais falsos.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../genieCore');
const { _tratar, _CONFIG } = require('../genie');

const SECRETS = {
  host: 'https://exemplo.databricks.test',
  spaceId: 'space_falso_01',
  clientId: 'cli_falso',
  clientSecret: 'segredo_falso_xyz',
};

const PNG_OK = Buffer.concat([core.PNG_MAGIC, Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])]);

function fakeDb(estado) {
  const ler = (c) => c.split('/').reduce((a, k) => (a == null ? undefined : a[k]), estado);
  const gravar = (c, v) => {
    const ks = c.split('/');
    let o = estado;
    ks.slice(0, -1).forEach((k) => { o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o = o[k]; });
    if (v === null || v === undefined) delete o[ks[ks.length - 1]];
    else o[ks[ks.length - 1]] = v;
  };
  return {
    ref: (c) => ({
      get: async () => ({ val: () => ler(c) }),
      update: async (mapa) => {
        for (const [k, v] of Object.entries(mapa || {})) gravar(`${c}/${k}`, v);
      },
      transaction: async (fn) => {
        const atual = ler(c);
        const novo = fn(atual);
        if (novo === undefined) return { committed: false };
        gravar(c, novo);
        return { committed: true };
      },
    }),
  };
}

const tokenAdm = { uid: 'adm1', email: 'adm1@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const tokenEmailAdm = { uid: 'caio', email: 'caio.soares@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const tokenMembro = { uid: 'ana', email: 'ana@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const tokenFora = { uid: 'ext', email: 'ext@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const tokenSenha = { uid: 'ana2', email: 'ana2@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'password' } };

const dbBase = () => ({
  kanban: {
    usuarios: {
      adm1: { role: 'adm' },
      ana: { role: 'membro' },
      caio: { role: 'membro' },
    },
    config: { adm_emails: ['caio.soares@ciahering.com.br'] },
    genie: {},
  },
});

async function chamar({
  method = 'POST',
  body = {},
  query = {},
  token = 'tok',
  decoded = tokenAdm,
  estado = dbBase(),
  fetchImpl,
  sleepImpl = async () => {},
  agoraFn = () => 1764270000000,
  timeoutMs,
  prazoMs,
  agora = new Date('2026-11-27T15:00:00Z'),
  secrets = SECRETS,
}) {
  let status = 0;
  let corpo = null;
  let binario = null;
  const headers = {};
  const req = {
    method,
    body,
    query,
    get: (h) => (h === 'Authorization' && token ? `Bearer ${token}` : undefined),
  };
  const res = {
    status(s) { status = s; return this; },
    set(k, v) { headers[String(k).toLowerCase()] = v; return this; },
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; return this; },
    json(b) { corpo = b; return this; },
    send(b) { binario = b; return this; },
    end(b) { binario = b; return this; },
  };
  const auth = {
    verifyIdToken: async (t) => {
      if (t !== 'tok') throw new Error('token inválido');
      return decoded;
    },
  };
  await _tratar(req, res, {
    auth,
    db: fakeDb(estado),
    fetch: fetchImpl,
    sleep: sleepImpl,
    agoraFn,
    timeoutMs,
    prazoMs,
    agora: () => agora,
    secrets,
  });
  return { status, corpo, binario, headers, estado };
}

const jsonRes = (status, data, extraHeaders = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => extraHeaders[String(k).toLowerCase()] ?? null },
  json: async () => data,
});

const binRes = (status, buf) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
});

test('auth, domínio, provedor e piloto ADM', async () => {
  core.limparCacheToken();
  assert.equal((await chamar({ token: null })).status, 401);
  assert.equal((await chamar({ token: 'errado' })).status, 401);

  let r = await chamar({ decoded: tokenFora });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conta');

  r = await chamar({ decoded: tokenSenha });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conta');

  r = await chamar({ decoded: tokenMembro });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'sem_acesso');

  r = await chamar({ method: 'DELETE' });
  assert.equal(r.status, 405); assert.equal(r.corpo.erro, 'metodo');

  // ADM por adm_emails funciona mesmo sem role:'adm'
  const fetchOk = async (url) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_m2m_1', expires_in: 3600 });
    return jsonRes(200, { conversation_id: 'conv_caio_1', message_id: 'msg_1', status: 'SUBMITTED' });
  };
  r = await chamar({ decoded: tokenEmailAdm, body: { pergunta: 'Quantos pedidos hoje?' }, fetchImpl: fetchOk });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo, { conversa: 'conv_caio_1', mensagem: 'msg_1', status: 'SUBMITTED' });
});

test('validação da pergunta: vazia, curta, > 1000 chars, controle e zero-width', async () => {
  core.limparCacheToken();
  for (const ruim of ['', ' ', 'a', 'x'.repeat(1001), null, 123, 'oi\u0000mundo', 'oi\u200Bmundo', 'oi\u202Emundo']) {
    const r = await chamar({ body: { pergunta: ruim } });
    assert.equal(r.status, 400, `esperava 400 para ${JSON.stringify(ruim)}`);
    assert.equal(r.corpo.erro, 'pergunta_invalida');
  }
  assert.equal(core.normalizarPergunta('  Qual o total?\r\n '), 'Qual o total?');
  assert.equal(core.normalizarPergunta('x'.repeat(1000)).length, 1000);
});

test('posse estrita: conversation_id, message_id e attachment_id alheios dão 403 conversa_alheia sem gastar cota', async () => {
  core.limparCacheToken();
  const estado = dbBase();
  estado.kanban.genie = {
    conversas: {
      caio: {
        conv_do_caio: {
          ts: '2026-11-27T15:00:00Z',
          ultima_msg: 'msg_do_caio',
          msgs: { msg_do_caio: true },
          anexos: { att_do_caio: 'msg_do_caio' },
        },
      },
      adm1: {
        conv_adm1: {
          ts: '2026-11-27T15:00:00Z',
          ultima_msg: 'msg_adm1',
          msgs: { msg_adm1: true },
          anexos: { att_adm1: 'msg_adm1' },
        },
      },
    },
  };

  let chamouFetch = false;
  const fetchProibido = async () => { chamouFetch = true; return jsonRes(200, {}); };

  // Seguimento em conversa de outro ADM
  let r = await chamar({
    decoded: tokenAdm,
    body: { pergunta: 'Detalhar por canal', conversa: 'conv_do_caio' },
    estado,
    fetchImpl: fetchProibido,
  });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conversa_alheia');
  assert.equal(chamouFetch, false);
  assert.equal(estado.kanban.genie.uso, undefined, 'não gastou cota ao recusar conversa alheia');

  // GET estado em conversa de outro ADM
  r = await chamar({
    method: 'GET',
    decoded: tokenAdm,
    query: { acao: 'estado', conversa: 'conv_do_caio', mensagem: 'msg_do_caio' },
    estado,
    fetchImpl: fetchProibido,
  });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conversa_alheia');

  // GET estado com message_id inventado dentro da própria conversa
  r = await chamar({
    method: 'GET',
    decoded: tokenAdm,
    query: { acao: 'estado', conversa: 'conv_adm1', mensagem: 'msg_de_outro' },
    estado,
    fetchImpl: fetchProibido,
  });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conversa_alheia');

  // GET grafico com attachment_id que não pertence à mensagem/conversa
  r = await chamar({
    method: 'GET',
    decoded: tokenAdm,
    query: { acao: 'grafico', conversa: 'conv_adm1', mensagem: 'msg_adm1', anexo: 'att_do_caio' },
    estado,
    fetchImpl: fetchProibido,
  });
  assert.equal(r.status, 403); assert.equal(r.corpo.erro, 'conversa_alheia');
  assert.throws(() => core.conferirPosse(estado.kanban.genie.conversas.adm1.conv_adm1, 'msg_adm1', 'att_outro'), (e) => e.codigo === 'conversa_alheia');
});

test('limites: 30/h por pessoa, 200/h na casa; GET estado e grafico não consomem cota', async () => {
  core.limparCacheToken();
  const estado = dbBase();
  const hora = core.horaChave(new Date('2026-11-27T15:00:00Z'));
  estado.kanban.genie = {
    uso: {
      adm1: { h: hora, n: core.LIMITE_PESSOA_H },
      _casa: { h: hora, n: 10 },
    },
    conversas: {
      adm1: {
        c1: { msgs: { m1: true }, anexos: { v1: 'm1' } },
      },
    },
  };

  let r = await chamar({ decoded: tokenAdm, body: { pergunta: 'Mais uma pergunta' }, estado });
  assert.equal(r.status, 429); assert.equal(r.corpo.erro, 'limite_pessoa');

  // Teto da casa bloqueia outro ADM mesmo sem uso pessoal (e não consome a cota individual)
  estado.kanban.genie.uso._casa = { h: hora, n: core.TETO_CASA_H };
  r = await chamar({ decoded: tokenEmailAdm, body: { pergunta: 'Pergunta do segundo ADM' }, estado });
  assert.equal(r.status, 429); assert.equal(r.corpo.erro, 'limite_casa');
  assert.equal(estado.kanban.genie.uso.caio.n, 0, 'estorna cota da pessoa quando a casa recusa');

  // GET estado e GET grafico continuam passando mesmo com a cota estourada
  const fetchGet = async (url) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_m2m', expires_in: 3600 });
    if (url.endsWith('/download-visualization')) return binRes(200, PNG_OK);
    return jsonRes(200, { status: 'ASKING_AI', attachments: [] });
  };
  r = await chamar({ method: 'GET', decoded: tokenAdm, query: { acao: 'estado', conversa: 'c1', mensagem: 'm1' }, estado, fetchImpl: fetchGet });
  assert.equal(r.status, 200); assert.equal(r.corpo.status, 'ASKING_AI');
  r = await chamar({ method: 'GET', decoded: tokenAdm, query: { acao: 'grafico', conversa: 'c1', mensagem: 'm1', anexo: 'v1' }, estado, fetchImpl: fetchGet });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'image/png');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(Buffer.isBuffer(r.binario), true);
  assert.equal(estado.kanban.genie.uso.adm1.n, core.LIMITE_PESSOA_H);
});

test('token OAuth M2M é reaproveitado em memória e renovado após 401', async () => {
  core.limparCacheToken();
  let tokenCalls = 0;
  let genieCalls = 0;
  let relogio = 1_000_000;
  const estado = dbBase();

  const fetchImpl = async (url, init) => {
    if (url.endsWith('/oidc/v1/token')) {
      tokenCalls++;
      assert.equal(init.headers.authorization, `Basic ${Buffer.from('cli_falso:segredo_falso_xyz').toString('base64')}`);
      assert.equal(init.body, 'grant_type=client_credentials&scope=all-apis');
      return jsonRes(200, { access_token: `tok_${tokenCalls}`, expires_in: 3600 });
    }
    genieCalls++;
    if (genieCalls === 3) {
      // Simula expiração antecipada no servidor: responde 401 na 3ª chamada
      return jsonRes(401, { error: 'expired' });
    }
    if (genieCalls === 4) {
      assert.equal(init.headers.authorization, 'Bearer tok_2', 'renovou o token após 401');
    } else {
      assert.equal(init.headers.authorization, 'Bearer tok_1');
    }
    return jsonRes(200, { conversation_id: 'c_tok', message_id: `m_${genieCalls}`, status: 'SUBMITTED' });
  };

  // 1ª pergunta: busca tok_1
  let r = await chamar({ body: { pergunta: 'Primeira pergunta' }, estado, fetchImpl, agoraFn: () => relogio });
  assert.equal(r.status, 200);
  assert.equal(tokenCalls, 1);

  // 2ª pergunta (10 s depois): reaproveita tok_1
  relogio += 10_000;
  r = await chamar({ body: { pergunta: 'Segunda pergunta' }, estado, fetchImpl, agoraFn: () => relogio });
  assert.equal(r.status, 200);
  assert.equal(tokenCalls, 1);

  // 3ª pergunta: Genie devolve 401 → renova para tok_2 e repete com sucesso
  r = await chamar({ body: { pergunta: 'Terceira pergunta' }, estado, fetchImpl, agoraFn: () => relogio });
  assert.equal(r.status, 200);
  assert.equal(tokenCalls, 2);
  assert.equal(genieCalls, 4);
});

test('COMPLETED com > 200 linhas (cortado:true), SQL, sugestões e gráfico viz', async () => {
  core.limparCacheToken();
  const estado = dbBase();
  estado.kanban.genie = {
    conversas: {
      adm1: {
        c_big: { ts: '2026-11-27T15:00:00Z', ultima_msg: 'm_big', msgs: { m_big: true } },
      },
    },
  };
  const linhas250 = Array.from({ length: 250 }, (_, i) => [`Item ${i + 1}`, String((i + 1) * 10)]);

  const fetchImpl = async (url) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_big', expires_in: 3600 });
    if (url.endsWith('/messages/m_big')) {
      return jsonRes(200, {
        status: 'COMPLETED',
        attachments: [
          { attachment_id: 'att_txt', text: { content: 'Resumo da consulta com <img src=x onerror=alert(1)>' } },
          { attachment_id: 'att_q', query: { query: 'SELECT nome, valor FROM vendas', description: 'Top vendas' } },
          { attachment_id: 'att_v', viz: { description: 'Gráfico de vendas' } },
          { attachment_id: 'att_sug', suggested_questions: { questions: ['Quebrar por mês', 'Top 5 canais'] } },
        ],
      });
    }
    if (url.endsWith('/attachments/att_q/query-result')) {
      return jsonRes(200, {
        statement_response: {
          status: { state: 'SUCCEEDED' },
          manifest: {
            total_row_count: 250,
            schema: { columns: [{ name: 'nome', type_name: 'STRING' }, { name: 'valor', type_name: 'INT' }] },
          },
          result: { data_array: linhas250 },
        },
      });
    }
    if (url.endsWith('/attachments/att_v/download-visualization')) {
      return binRes(200, PNG_OK);
    }
    throw new Error('URL inesperada: ' + url);
  };

  const r = await chamar({ method: 'GET', query: { acao: 'estado', conversa: 'c_big', mensagem: 'm_big' }, estado, fetchImpl });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.status, 'COMPLETED');
  assert.equal(r.corpo.texto, 'Resumo da consulta com <img src=x onerror=alert(1)>');
  assert.equal(r.corpo.sql, 'SELECT nome, valor FROM vendas');
  assert.equal(r.corpo.descricao, 'Top vendas');
  assert.deepEqual(r.corpo.colunas, [{ nome: 'nome', tipo: 'STRING' }, { nome: 'valor', tipo: 'INT' }]);
  assert.equal(r.corpo.linhas.length, 200);
  assert.equal(r.corpo.cortado, true);
  assert.equal(r.corpo.totalLinhas, 250);
  assert.deepEqual(r.corpo.graficos, [{ anexo: 'att_v', descricao: 'Gráfico de vendas' }]);
  assert.deepEqual(r.corpo.sugestoes, ['Quebrar por mês', 'Top 5 canais']);
  assert.equal(estado.kanban.genie.conversas.adm1.c_big.anexos.att_v, 'm_big');

  // Agora baixa o gráfico registrado
  const g = await chamar({ method: 'GET', query: { acao: 'grafico', conversa: 'c_big', mensagem: 'm_big', anexo: 'att_v' }, estado, fetchImpl });
  assert.equal(g.status, 200);
  assert.deepEqual(g.binario, PNG_OK);

  // Se vier HTML disfarçado de PNG no endpoint de gráfico → recusa 502 genie_resposta
  const fetchHtml = async (url) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_big', expires_in: 3600 });
    return binRes(200, Buffer.from('<html><script>alert(1)</script></html>'));
  };
  const gRuim = await chamar({ method: 'GET', query: { acao: 'grafico', conversa: 'c_big', mensagem: 'm_big', anexo: 'att_v' }, estado, fetchImpl: fetchHtml });
  assert.equal(gRuim.status, 502);
  assert.equal(gRuim.corpo.erro, 'genie_resposta');
});

test('QUERY_RESULT_EXPIRED dispara POST execute-query (SUCCEEDED imediato e RUNNING → EXECUTING_QUERY)', async () => {
  core.limparCacheToken();
  const estado = dbBase();
  estado.kanban.genie = {
    conversas: {
      adm1: { c_exp: { msgs: { m_exp: true } } },
    },
  };
  let execCalls = 0;

  const fetchSucceeded = async (url, init) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_exp', expires_in: 3600 });
    if (url.endsWith('/messages/m_exp')) {
      return jsonRes(200, {
        status: 'QUERY_RESULT_EXPIRED',
        attachments: [{ attachment_id: 'att_exp', query: { query: 'SELECT 1' } }],
      });
    }
    if (url.endsWith('/attachments/att_exp/execute-query') && init.method === 'POST') {
      execCalls++;
      return jsonRes(200, {
        statement_response: {
          status: { state: 'SUCCEEDED' },
          manifest: { total_row_count: 1, schema: { columns: [{ name: 'ok', type_name: 'INT' }] } },
          result: { data_array: [['1']] },
        },
      });
    }
    throw new Error('URL inesperada: ' + url);
  };

  let r = await chamar({ method: 'GET', query: { acao: 'estado', conversa: 'c_exp', mensagem: 'm_exp' }, estado, fetchImpl: fetchSucceeded });
  assert.equal(r.status, 200);
  assert.equal(execCalls, 1);
  assert.equal(r.corpo.status, 'COMPLETED');
  assert.deepEqual(r.corpo.linhas, [['1']]);

  const fetchRunning = async (url, init) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_exp', expires_in: 3600 });
    if (url.endsWith('/messages/m_exp')) {
      return jsonRes(200, {
        status: 'QUERY_RESULT_EXPIRED',
        attachments: [{ attachment_id: 'att_exp', query: { query: 'SELECT 1' } }],
      });
    }
    if (url.endsWith('/attachments/att_exp/execute-query') && init.method === 'POST') {
      execCalls++;
      return jsonRes(200, { statement_response: { status: { state: 'RUNNING' } } });
    }
    throw new Error('URL inesperada: ' + url);
  };
  r = await chamar({ method: 'GET', query: { acao: 'estado', conversa: 'c_exp', mensagem: 'm_exp' }, estado, fetchImpl: fetchRunning });
  assert.equal(r.status, 200);
  assert.equal(execCalls, 2);
  assert.equal(r.corpo.status, 'EXECUTING_QUERY');
});

test('429 do Genie usa backoff curto e devolve 429 genie_ocupado', async () => {
  core.limparCacheToken();
  const delays = [];
  let chamadas = 0;
  const fetch429 = async (url) => {
    if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'tok_429', expires_in: 3600 });
    chamadas++;
    return jsonRes(429, { error: 'too_many_requests' }, { 'retry-after': '1' });
  };
  const r = await chamar({
    body: { pergunta: 'Teste de 429' },
    fetchImpl: fetch429,
    sleepImpl: async (ms) => { delays.push(ms); },
  });
  assert.equal(r.status, 429);
  assert.equal(r.corpo.erro, 'genie_ocupado');
  assert.equal(chamadas, 3, '1 tentativa + 2 retentativas');
  assert.deepEqual(delays, [1000, 1000]);
});

test('logs NUNCA contêm a pergunta, o SQL, os dados, o token, o spaceId ou o host', async () => {
  core.limparCacheToken();
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));

  const perguntaSecreta = 'PerguntaCanarioUltraSecreta991';
  const sqlSecreto = 'SELECT segredo FROM tabela_privada_991';
  const estado = dbBase();

  try {
    // Caso 1: sucesso no POST e GET COMPLETED
    const fetchOk = async (url) => {
      if (url.endsWith('/oidc/v1/token')) return jsonRes(200, { access_token: 'ACCESS_TOKEN_CANARIO', expires_in: 3600 });
      if (url.endsWith('/start-conversation')) return jsonRes(200, { conversation_id: 'c_log', message_id: 'm_log', status: 'SUBMITTED' });
      if (url.endsWith('/messages/m_log')) {
        return jsonRes(200, {
          status: 'COMPLETED',
          attachments: [
            { attachment_id: 'a1', text: { content: 'RespostaCanario991' } },
            { attachment_id: 'a2', query: { query: sqlSecreto } },
          ],
        });
      }
      return jsonRes(200, {
        statement_response: {
          status: { state: 'SUCCEEDED' },
          manifest: { schema: { columns: [{ name: 'ColCanario991', type_name: 'STRING' }] } },
          result: { data_array: [['ValorCanario991']] },
        },
      });
    };
    await chamar({ body: { pergunta: perguntaSecreta }, estado, fetchImpl: fetchOk });
    await chamar({ method: 'GET', query: { acao: 'estado', conversa: 'c_log', mensagem: 'm_log' }, estado, fetchImpl: fetchOk });

    // Caso 2: falha onde fetch lança erro contaminado com URL, pergunta e SQL
    const fetchBoom = async (url) => {
      throw new Error(`falhou ${url} ${perguntaSecreta} ${sqlSecreto} ${SECRETS.clientSecret}`);
    };
    const rErr = await chamar({ body: { pergunta: perguntaSecreta }, estado, fetchImpl: fetchBoom });
    assert.equal(rErr.status, 502);
    assert.equal(rErr.corpo.erro, 'genie_falhou');
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }

  const tudo = logs.join('\n');
  assert.ok(logs.length >= 3);
  for (const proibido of [
    perguntaSecreta,
    sqlSecreto,
    'RespostaCanario991',
    'ColCanario991',
    'ValorCanario991',
    'ACCESS_TOKEN_CANARIO',
    SECRETS.host,
    SECRETS.spaceId,
    SECRETS.clientSecret,
  ]) {
    assert.equal(tudo.includes(proibido), false, `log vazou "${proibido}"`);
  }
});


test('orçamento total (~45 s) e timeoutSeconds 60: chamadas lentas encadeadas devolvem 504 genie_tempo antes de estourar', async () => {
  core.limparCacheToken();
  assert.equal(_CONFIG.timeoutSeconds, 60);
  assert.equal(core.PRAZO_TOTAL_MS, 45000);
  assert.equal(core.TIMEOUT_MS, 12000);

  // Caso A: encadeamento de 4 chamadas próximas do limite (token + mensagem + query-result CLOSED + execute-query)
  // Simula relógio avançando durante cada etapa lenta até ultrapassar 45 s antes do fim da 4ª chamada.
  const estado = dbBase();
  estado.kanban.genie = {
    conversas: { adm1: { c_slow: { msgs: { m_slow: true } } } },
  };
  let relogio = 1_000_000;
  const etapas = [];

  const fetchLentoEncadeado = async (url, init) => {
    assert.ok(init.signal, 'cada fetch recebe AbortSignal');
    if (url.endsWith('/oidc/v1/token')) {
      relogio += 11_500;
      etapas.push(['token', relogio - 1_000_000]);
      return jsonRes(200, { access_token: 'tok_slow', expires_in: 3600 });
    }
    if (url.endsWith('/messages/m_slow')) {
      relogio += 11_500;
      etapas.push(['msg', relogio - 1_000_000]);
      return jsonRes(200, {
        status: 'COMPLETED',
        attachments: [{ attachment_id: 'att_slow', query: { query: 'SELECT 1' } }],
      });
    }
    if (url.endsWith('/attachments/att_slow/query-result')) {
      relogio += 11_500;
      etapas.push(['qr', relogio - 1_000_000]);
      return jsonRes(200, { statement_response: { status: { state: 'CLOSED' } } });
    }
    if (url.endsWith('/attachments/att_slow/execute-query')) {
      // Orçamento restante nesta altura = 45000 - 34500 = 10500 ms (< 12000 ms). Simula estouro desse restante (AbortError).
      relogio += 11_000; // total = 45500 ms (< 60000 ms)
      etapas.push(['exec', relogio - 1_000_000]);
      const ab = new Error('The operation was aborted');
      ab.name = 'AbortError';
      throw ab;
    }
    throw new Error('URL inesperada: ' + url);
  };

  const r = await chamar({
    method: 'GET',
    query: { acao: 'estado', conversa: 'c_slow', mensagem: 'm_slow' },
    estado,
    fetchImpl: fetchLentoEncadeado,
    agoraFn: () => relogio,
  });
  assert.equal(r.status, 504);
  assert.equal(r.corpo.erro, 'genie_tempo');
  assert.ok(etapas.length === 4);
  assert.ok(relogio - 1_000_000 < 60_000, 'encerrou antes de 60 s');

  // Caso B: AbortController real cortando fetch lento quando orçamento total expira
  core.limparCacheToken();
  const t0 = Date.now();
  const fetchPendurado = (url, init) => new Promise((resolve, reject) => {
    if (init.signal.aborted) {
      const e = new Error('aborted'); e.name = 'AbortError'; return reject(e);
    }
    init.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
    }, { once: true });
    setTimeout(() => resolve(jsonRes(200, { access_token: 't', expires_in: 3600 })), 500);
  });
  const rReal = await chamar({
    body: { pergunta: 'Pergunta que trava no OAuth' },
    fetchImpl: fetchPendurado,
    agoraFn: Date.now,
    timeoutMs: 200,
    prazoMs: 70,
  });
  assert.equal(rReal.status, 504);
  assert.equal(rReal.corpo.erro, 'genie_tempo');
  assert.ok(Date.now() - t0 < 350, 'abortou pelo orçamento total real antes do timeout individual');
});
