// 🐙 Polvo · Pergunte aos dados (oceano-dev.html): controle ADM, polling, gráfico pronto PNG, tabela cortada,
// SQL recolhido, sugestões, + Nova conversa, erro/rascunho, timeout 10 min, XSS e responsividade nos 3 temas.
// Roda: BASE_URL=http://127.0.0.1:8957 node docs/arezzo/testes/test_oceano_genie.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const home = require('node:os').homedir();
const fake = require('./fakefb.js');

const base = process.env.BASE_URL || 'http://127.0.0.1:8957';
const OUT = path.join(__dirname, '../../capturas/genie');
fs.mkdirSync(OUT, { recursive: true });

// PNG 40x24 válido gerado em memória para validar o pipeline binário ?acao=grafico -> blob: -> <img>
function makeTestPng() {
  const w = 160, h = 64;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const o = 1 + x * 4;
      const bar = (x > 16 && x < 44 && y > 24) || (x > 60 && x < 88 && y > 14) || (x > 104 && x < 132 && y > 8);
      row[o] = bar ? 29 : 245;
      row[o + 1] = bar ? 160 : 250;
      row[o + 2] = bar ? 220 : 255;
      row[o + 3] = 255;
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const TEST_PNG = makeTestPng();

const U = (uid, nome) => ({
  uid,
  email: uid + '@ciahering.com.br',
  displayName: nome,
  photoURL: '',
  providerData: [{ providerId: 'google.com' }],
});

const seed = () => ({
  kanban: {
    usuarios: {
      ana: { uid: 'ana', nome: 'Ana Silva', email: 'ana@ciahering.com.br', init: 'AS', role: 'adm', squads: { dados: true } },
      eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', init: 'ES', role: 'membro', squads: { dev: true } },
    },
    config: { adm_emails: ['ana@ciahering.com.br'] },
  },
});

let ok = true, total = 0;
const t = (nome, cond, det) => {
  total++;
  if (!cond) ok = false;
  console.log((cond ? '✅ ' : '❌ ') + nome + (cond ? '' : '  ← ' + String(JSON.stringify(det)).slice(0, 350)));
};

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});

  async function openPage(user, { w = 1280, h = 900, tema = 'abrolhos', ls = {}, genieHandler, clock = false } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await fake.install(ctx, seed(), { oceano: true });
    await ctx.addInitScript(({ tema, ls }) => {
      localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off', tema }));
      for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v);
    }, { tema, ls });
    if (genieHandler) {
      await ctx.route('https://us-central1-hering-onboarding.cloudfunctions.net/oceanoGenie**', async route => {
        if (route.request().method() === 'OPTIONS') {
          return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Authorization, Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          });
        }
        return genieHandler(route);
      });
    }
    const p = await ctx.newPage();
    const errs = [];
    const dialogs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
    if (clock) await p.clock.install();
    await p.goto(base + '/oceano-dev.html');
    await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(1000);
    return { ctx, p, errs, dialogs };
  }

  // 1) Membro comum NÃO vê o Polvo nem restaura aberto
  {
    const { ctx, p, errs } = await openPage(U('eve', 'Eve Souza'), { ls: { oceano_polvo_aberto: '1' } });
    const r = await p.evaluate(() => ({
      btn: !!document.querySelector('#rail [data-rail="polvo"]'),
      on: document.getElementById('polvo').classList.contains('on'),
      ls: localStorage.getItem('oceano_polvo_aberto'),
    }));
    t('membro comum não vê item Polvo no #rail nem restaura painel mesmo com localStorage marcado', !r.btn && !r.on && r.ls === null, r);
    t('sem erro de JS (membro)', !errs.length, errs);
    await ctx.close();
  }

  // 2) Fluxo completo ADM: Sonar, envio, polling traduzido, gráfico PNG, tabela cortada, SQL recolhido, sugestão e Nova conversa
  {
    const calls = [];
    let pollN = 0;
    const handler = async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const auth = req.headers()['authorization'] || '';
      if (!auth.startsWith('Bearer fake-id-token-ana')) {
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 401, contentType: 'application/json', body: JSON.stringify({ erro: 'sem_token' }) });
      }
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        calls.push({ m: 'POST', body });
        const cid = body.conversa || ('conv_' + calls.filter(c => c.m === 'POST').length);
        const mid = 'msg_' + calls.filter(c => c.m === 'POST').length;
        pollN = 0;
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ conversa: cid, mensagem: mid, status: 'SUBMITTED' }),
        });
      }
      const acao = u.searchParams.get('acao');
      calls.push({ m: 'GET', acao, q: Object.fromEntries(u.searchParams.entries()) });
      if (acao === 'grafico') {
        return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*',  'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff' },
          body: TEST_PNG,
        });
      }
      pollN++;
      if (pollN === 1) {
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ conversa: u.searchParams.get('conversa'), mensagem: u.searchParams.get('mensagem'), status: 'FILTERING_CONTEXT' }),
        });
      }
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversa: u.searchParams.get('conversa'),
          mensagem: u.searchParams.get('mensagem'),
          status: 'COMPLETED',
          texto: 'Os pedidos do período cresceram 14,2% na comparação mensal, com pico na semana 3.',
          descricao: 'Agrega pedidos por semana e calcula ticket médio.',
          sql: 'SELECT semana, pedidos, ticket FROM resumo_pedidos ORDER BY semana DESC',
          colunas: [
            { nome: 'Semana', tipo: 'STRING' },
            { nome: 'Pedidos', tipo: 'INT' },
            { nome: 'Ticket médio', tipo: 'DOUBLE' },
          ],
          linhas: [
            ['2026-W47', '1240', '289.10'],
            ['2026-W46', '1085', null],
          ],
          cortado: true,
          totalLinhas: 342,
          graficos: [{ anexo: 'att_viz_1', descricao: 'Evolução semanal dos pedidos' }],
          sugestoes: ['Quebrar por categoria'],
        }),
      });
    };

    const { ctx, p, errs } = await openPage(U('ana', 'Ana Silva'), { genieHandler: handler });
    t('ADM vê o botão Polvo no menu lateral', await p.evaluate(() => !!document.querySelector('#rail [data-rail="polvo"]')), null);

    await p.click('#rail [data-rail="polvo"]');
    await p.waitForTimeout(200);
    t('clicar em Polvo abre a vista ampla #polvo com estado vazio e exemplos', await p.evaluate(() => document.getElementById('polvo').classList.contains('on') && document.querySelectorAll('.polvo-exemplos .polvo-chip').length >= 2), null);

    await p.fill('#polvo-in', 'Como evoluíram os pedidos neste mês?');
    await p.click('#polvo-enviar');
    await p.waitForTimeout(200);
    t('durante consulta: botão bloqueado e estado traduzido em português', await p.evaluate(() => document.getElementById('polvo-enviar').disabled && /Enviando pergunta/.test(document.getElementById('polvo-wrap').textContent)), null);

    await p.waitForTimeout(3300);
    t('1º polling traduz FILTERING_CONTEXT', await p.evaluate(() => /Entendendo a pergunta/.test(document.getElementById('polvo-wrap').textContent)), null);

    await p.waitForTimeout(3400);
    await p.waitForFunction(() => {
      const im = document.querySelector('#polvo-wrap .polvo-viz-img');
      return !!im && !im.hidden && im.src.startsWith('blob:') && im.complete && im.naturalWidth > 0;
    }, null, { timeout: 5000 });
    const done = await p.evaluate(() => {
      const w = document.getElementById('polvo-wrap');
      const img = w.querySelector('.polvo-viz-img');
      const det = w.querySelector('details.polvo-sql');
      const cort = w.querySelector('.polvo-cortado');
      const numCell = w.querySelector('.polvo-tab td.num');
      const nullCell = w.querySelector('.polvo-tab td.nulo');
      return {
        txtOk: /cresceram 14,2%/.test(w.textContent),
        imgBlob: !!(img && !img.hidden && img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0),
        cortOk: !!(cort && /Mostrando as primeiras 2 linhas de 342/.test(cort.textContent)),
        sqlClosed: !!(det && det.open === false),
        numOk: !!(numCell && getComputedStyle(numCell).textAlign === 'right'),
        nullOk: !!(nullCell && nullCell.textContent === '—'),
      };
    });
    t('COMPLETED exibe análise, gráfico PNG pronto (blob:), tabela cortada e SQL recolhido por padrão', done.txtOk && done.imgBlob && done.cortOk && done.sqlClosed && done.numOk && done.nullOk, done);

    // Lightbox ⛶ Ampliar + Esc
    await p.click('.polvo-viz-ac button');
    await p.waitForTimeout(150);
    t('botão Ampliar abre o modal do gráfico com blob:', await p.evaluate(() => document.getElementById('polvo-zoom').classList.contains('open') && document.getElementById('polvo-zoom-img').src.startsWith('blob:')), null);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    t('Esc fecha apenas o zoom mantendo #polvo aberto', await p.evaluate(() => !document.getElementById('polvo-zoom').classList.contains('open') && document.getElementById('polvo').classList.contains('on')), null);

    // Abrir SQL
    await p.click('details.polvo-sql summary');
    t('clicar no summary expande o SQL', await p.evaluate(() => document.querySelector('details.polvo-sql').open === true && /SELECT semana/.test(document.querySelector('.polvo-sql-pre').textContent)), null);

    // Sugestão envia na mesma conversa
    await p.click('.polvo-sugs .polvo-chip');
    await p.waitForTimeout(300);
    const secondPost = calls.filter(c => c.m === 'POST')[1];
    t('chip de sugestão envia pergunta de seguimento na mesma conversa', !!(secondPost && secondPost.body.conversa === 'conv_1' && secondPost.body.pergunta === 'Quebrar por categoria'), secondPost);
    const firstImgOkAfterFollowUp = await p.evaluate(() => {
      const im = document.querySelector('#polvo-wrap .polvo-viz-img');
      return !!im && !im.hidden && im.src.startsWith('blob:') && im.complete && im.naturalWidth > 0;
    });
    t('gráfico da 1ª resposta permanece íntegro após pergunta de seguimento', firstImgOkAfterFollowUp, null);

    // Aguardar completar e testar + Nova conversa
    await p.waitForTimeout(6600);
    await p.click('#polvo-nova');
    await p.waitForTimeout(150);
    await p.fill('#polvo-in', 'Nova pergunta após limpar');
    await p.click('#polvo-enviar');
    await p.waitForTimeout(200);
    const thirdPost = calls.filter(c => c.m === 'POST')[2];
    t('+ Nova conversa limpa histórico e próximo POST não envia conversa antiga', !!(thirdPost && !thirdPost.body.conversa), thirdPost);
    t('sem erro de JS (fluxo completo)', !errs.length, errs);
    await ctx.close();
  }

  // 3) Erro 429 preserva rascunho + FAILED exibe tentativa + Timeout 10 min ('demorou')
  {
    let modo = 'ocupado';
    const handler = async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        if (modo === 'ocupado') {
          return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 429, contentType: 'application/json', body: JSON.stringify({ erro: 'genie_ocupado' }) });
        }
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify({ conversa: 'c_err', mensagem: 'm_1', status: 'SUBMITTED' }) });
      }
      if (modo === 'failed') {
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify({ conversa: 'c_err', mensagem: 'm_1', status: 'FAILED' }) });
      }
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify({ conversa: 'c_err', mensagem: 'm_1', status: 'EXECUTING_QUERY' }) });
    };

    const { ctx, p, errs } = await openPage(U('ana', 'Ana Silva'), { genieHandler: handler, clock: true });
    await p.click('#rail [data-rail="polvo"]');
    await p.waitForSelector('#polvo.on', { timeout: 5000 });

    await p.fill('#polvo-in', 'Meu rascunho importante');
    await p.click('#polvo-enviar');
    await p.waitForSelector('#polvo-erro:not([hidden])', { timeout: 5000 });
    const r429 = await p.evaluate(() => ({
      err: !document.getElementById('polvo-erro').hidden && document.getElementById('polvo-erro').dataset.codigo === 'genie_ocupado',
      draft: document.getElementById('polvo-in').value,
    }));
    t('erro 429 genie_ocupado mostra aviso inline e preserva rascunho digitado', r429.err && r429.draft === 'Meu rascunho importante', r429);

    modo = 'failed';
    await p.click('#polvo-enviar');
    await p.waitForSelector('.polvo-status', { timeout: 5000 });
    await p.clock.fastForward(3100);
    await p.waitForSelector('.polvo-falha button', { timeout: 5000 });
    t('status FAILED exibe erro no cartão com botão Tentar novamente', await p.evaluate(() => /não conseguiu concluir/.test(document.getElementById('polvo-wrap').textContent) && !!document.querySelector('.polvo-falha button')), null);

    modo = 'lento';
    await p.click('.polvo-falha button');
    await p.waitForFunction(() => document.querySelectorAll('.polvo-status').length >= 1, null, { timeout: 5000 });
    await p.clock.fastForward(601000);
    await p.waitForFunction(() => /10 minutos/.test(document.getElementById('polvo-wrap').textContent) && !document.getElementById('polvo-enviar').disabled, null, { timeout: 5000 });
    t('após 10 min sem resposta final encerra polling e exibe estado "demorou"', true, null);
    t('sem erro de JS (erros/timeout)', !errs.length, errs);
    await ctx.close();
  }

  // 4) Prova XSS + Responsividade + 3 Temas + Capturas (1280x900 e 390x800)
  {
    const XSS = '<img src=x onerror=alert(1)>';
    const handler = async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (req.method() === 'POST') {
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify({ conversa: 'c_xss', mensagem: 'm_xss', status: 'SUBMITTED' }) });
      }
      if (u.searchParams.get('acao') === 'grafico') {
        return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*',  'Content-Type': 'image/png' }, body: TEST_PNG });
      }
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversa: 'c_xss',
          mensagem: 'm_xss',
          status: 'COMPLETED',
          texto: 'Análise com texto literal ' + XSS + ' — crescimento consistente nas semanas avaliadas.',
          descricao: 'Descrição SQL ' + XSS,
          sql: 'SELECT * FROM exemplo -- ' + XSS,
          colunas: [
            { nome: 'Canal ' + XSS, tipo: 'STRING' },
            { nome: 'Pedidos', tipo: 'INT' },
            { nome: 'Ticket', tipo: 'DOUBLE' },
            { nome: 'Margem', tipo: 'DOUBLE' },
            { nome: 'Conversão', tipo: 'DOUBLE' },
            { nome: 'Share', tipo: 'DOUBLE' },
            { nome: 'Sessões', tipo: 'INT' },
            { nome: 'UF', tipo: 'STRING' },
          ],
          linhas: [
            ['Site ' + XSS, '1240', '289.10', '42.5', '2.4', '58.0', '51600', 'SC'],
            ['App Oficial', '910', '312.40', '45.1', '3.1', '42.0', '29350', 'SP'],
          ],
          cortado: false,
          totalLinhas: 2,
          graficos: [{ anexo: 'viz_xss', descricao: 'Gráfico ' + XSS }],
          sugestoes: ['Detalhar ' + XSS],
        }),
      });
    };

    const temas = [['abrolhos', 'abrolhos'], ['lencois', 'light'], ['entardecer', 'sunset']];
    for (const [temaPref, slug] of temas) {
      for (const [vw, vh, pre] of [[1280, 900, 'pc'], [390, 800, 'cel']]) {
        const { ctx, p, errs, dialogs } = await openPage(U('ana', 'Ana Silva'), { w: vw, h: vh, tema: temaPref, genieHandler: handler });
        await p.click('#rail [data-rail="polvo"]');
        await p.waitForTimeout(150);
        await p.fill('#polvo-in', 'Quais canais tiveram melhor desempenho?');
        await p.click('#polvo-enviar');
        await p.waitForTimeout(3400);
        await p.waitForFunction(() => {
          const im = document.querySelector('#polvo-wrap .polvo-viz-img');
          return !!im && !im.hidden && im.src.startsWith('blob:') && im.complete && im.naturalWidth > 0;
        }, null, { timeout: 5000 });

        const check = await p.evaluate((xss) => {
          const onerrs = document.querySelectorAll('#polvo [onerror], #polvo script, #polvo iframe').length;
          const feedTxt = document.getElementById('polvo-wrap').textContent || '';
          const sx = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          const polvo = document.getElementById('polvo');
          const psx = polvo.scrollWidth > polvo.clientWidth + 1;
          return { onerrs, hasLiteral: feedTxt.includes(xss), sx, psx };
        }, XSS);

        t(`[${pre} · ${slug}] XSS neutralizado (textContent literal, zero [onerror]/dialog) e sem overflow horizontal`,
          check.onerrs === 0 && check.hasLiteral && !check.sx && !check.psx && dialogs.length === 0 && errs.length === 0,
          { check, dialogs, errs });
        await p.screenshot({ path: path.join(OUT, `${pre}_${slug}_polvo.png`) });
        await ctx.close();
      }
    }
  }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações do Polvo concluídas');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
