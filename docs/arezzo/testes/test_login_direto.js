// 🔐 Login direto (atalho do iPhone/iPad) — mare-login-dev.js: validação pura (Node) + fluxo ida/volta no Oceano e no Maré (Playwright + fakefb).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const L = require('../../../mare-login-dev.js');
const ORIG = 'http://localhost:8941';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (c) => 'h.' + b64(Object.assign({ iss: 'https://accounts.google.com', aud: L.CLIENT_ID, nonce: 'N1', exp: Math.floor(Date.now() / 1000) + 3600, email: 'ana@ciahering.com.br', name: 'Ana Lúcia' }, c)) + '.s';
(async () => {
  let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const pend = { state: 'S1', nonce: 'N1', ts: Date.now() };
  t('validar: volta correta (state, nonce, aud, iss, exp) entrega o token', L.validar('#id_token=' + jwt() + '&state=S1', pend, Date.now()).ok === true, L.validar('#id_token=' + jwt() + '&state=S1', pend, Date.now()));
  t('validar: state diferente (outra tentativa/aparelho) é recusado', !!L.validar('#id_token=' + jwt() + '&state=XX', pend, Date.now()).erro, 0);
  t('validar: nonce diferente é recusado', !!L.validar('#id_token=' + jwt({ nonce: 'outro' }) + '&state=S1', pend, Date.now()).erro, 0);
  t('validar: token de OUTRO cliente (aud) é recusado', !!L.validar('#id_token=' + jwt({ aud: 'x.apps.googleusercontent.com' }) + '&state=S1', pend, Date.now()).erro, 0);
  t('validar: emissor estranho é recusado', !!L.validar('#id_token=' + jwt({ iss: 'https://evil.example' }) + '&state=S1', pend, Date.now()).erro, 0);
  t('validar: token vencido é recusado', !!L.validar('#id_token=' + jwt({ exp: 1 }) + '&state=S1', pend, Date.now()).erro, 0);
  t('validar: tentativa de mais de 10 min é recusada', !!L.validar('#id_token=' + jwt() + '&state=S1', Object.assign({}, pend, { ts: Date.now() - 11 * 60e3 }), Date.now()).erro, 0);
  t('validar: sem tentativa guardada (abriu o link na mão) é recusado', !!L.validar('#id_token=' + jwt() + '&state=S1', null, Date.now()).erro, 0);
  t('validar: pessoa cancelou no Google (access_denied) vira mensagem amigável', /cancelado/.test(L.validar('#error=access_denied&state=S1', pend, Date.now()).erro), 0);
  t('url do Google: fluxo id_token, cliente do projeto, volta na própria página, domínio sugerido', (() => { const u = new URL(L.urlGoogle('n', 's', 'https://x.github.io/hering/oceano.html')); return u.searchParams.get('response_type') === 'id_token' && u.searchParams.get('client_id') === L.CLIENT_ID && u.searchParams.get('redirect_uri') === 'https://x.github.io/hering/oceano.html' && u.searchParams.get('hd') === 'ciahering.com.br' && /openid/.test(u.searchParams.get('scope')); })(), 0);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const pagina = async (arq, qs, o) => {
    o = o || {}; const ctx = await b.newContext(o.iphone ? { userAgent: UA_IPHONE, viewport: { width: 390, height: 800 } } : { viewport: { width: 1000, height: 800 } }); await fake.install(ctx, o.seed || { kanban: {} });
    if (o.standalone) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
    if (o.init) await ctx.addInitScript(o.init, o.initArg);
    const goog = []; await ctx.route('https://accounts.google.com/**', r => { goog.push(r.request().url()); r.fulfill({ contentType: 'text/html', body: '<h1>google</h1>' }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(ORIG + '/' + arq + (qs || '')); return { ctx, p, errs, goog };
  };
  // ── Oceano ──
  for (const [arq, btnSel, nome] of [['oceano-dev.html', '#btn-login', 'Oceano']]) {
    { const { ctx, p, errs } = await pagina(arq, '', {}); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(500);
      await p.click(btnSel); await p.waitForTimeout(300);
      t(nome + ' no navegador comum: continua no popup (nada muda pra quem já entra bem)', (await p.evaluate(() => window.__popup || 0)) === 1 && p.url().startsWith(ORIG), p.url()); await ctx.close(); }
    { const { ctx, p, goog } = await pagina(arq, '', { iphone: true, standalone: true }); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(500);
      t(nome + ' no atalho do iPhone: MareLogin.usar() é verdadeiro', await p.evaluate(() => MareLogin.usar()), 0);
      await p.click(btnSel); await p.waitForTimeout(700);
      const u = goog[0] ? new URL(goog[0]) : null;
      t(nome + ' no atalho do iPhone: vai direto pro Google (SEM popup), com fluxo id_token e volta na própria página', u && u.searchParams.get('response_type') === 'id_token' && u.searchParams.get('redirect_uri') === ORIG + '/' + arq && !(await p.evaluate(() => window.__popup || 0).catch(() => 0)), goog);
      await ctx.close(); }
    // volta do Google: token válido → signInWithCredential; o fragmento some; a query volta
    const nonce = 'abc123', state = 'st456';
    { const { ctx, p, errs } = await pagina(arq, '#id_token=' + jwt({ nonce }) + '&state=' + state, { iphone: true, standalone: true, init: ([n, s, ret]) => { if (!sessionStorage.__ini) { sessionStorage.__ini = 1; localStorage.setItem('mare_oauth_direto', JSON.stringify({ nonce: n, state: s, ts: Date.now(), ret })); } }, initArg: [nonce, state, '/' + arq + '?x=1'] });
      await p.waitForFunction(() => !!window.__authCb); await p.waitForTimeout(800);
      const cred = await p.evaluate(() => window.__cred || null);
      t(nome + ' na volta: o id_token chega ao Firebase (signInWithCredential)', cred && /^h\./.test(cred.idToken), cred);
      t(nome + ' na volta: o token some da barra de endereço e a query original volta', !/id_token/.test(p.url()) && /\?x=1$/.test(p.url()), p.url());
      t(nome + ' na volta: a tentativa guardada é consumida (não reaproveita)', (await p.evaluate(() => localStorage.getItem('mare_oauth_direto'))) === null, 0);
      t(nome + ' sem erro de JS', !errs.length, errs); await ctx.close(); }
    { const { ctx, p } = await pagina(arq, '#id_token=' + jwt({ nonce: 'errado' }) + '&state=' + state, { init: ([n, s]) => { if (!sessionStorage.__ini) { sessionStorage.__ini = 1; localStorage.setItem('mare_oauth_direto', JSON.stringify({ nonce: n, state: s, ts: Date.now(), ret: '/x' })); } }, initArg: [nonce, state] });
      await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(700);
      t(nome + ' token com nonce errado: NÃO entra e mostra aviso na tela de login', !(await p.evaluate(() => window.__cred || null)) && /confirmar o login/.test(await p.innerText('#login-err')), await p.evaluate(() => window.__cred || null)); await ctx.close(); }
  }
  // ── Maré (kanban-dev) ──
  { const { ctx, p, goog } = await pagina('kanban-dev.html', '?squad=dev&loginDireto=1', {}); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(800);
    await p.evaluate(() => doSignIn(true)); await p.waitForTimeout(700);
    const u = goog[0] ? new URL(goog[0]) : null;
    t('Maré (?loginDireto=1): doSignIn vai direto pro Google (sem popup) com a volta em kanban-dev.html', u && u.searchParams.get('redirect_uri') === ORIG + '/kanban-dev.html' && !(await p.evaluate(() => window.__popup || 0).catch(() => 0)), goog);
    await ctx.close(); }
  { const { ctx, p } = await pagina('kanban-dev.html', '?squad=dev#id_token=' + jwt({ nonce: 'k1' }) + '&state=ks', { init: ([n, s]) => { if (!sessionStorage.__ini) { sessionStorage.__ini = 1; localStorage.setItem('mare_oauth_direto', JSON.stringify({ nonce: n, state: s, ts: Date.now(), ret: '/kanban-dev.html?squad=dev' })); localStorage.setItem('mare_pending_insc', '1'); } sessionStorage.removeItem('mare_login_local'); }, initArg: ['k1', 'ks'] });   // o fake liga "login local" por padrão; aqui queremos o login único de verdade (redireciona pro Oceano)
    await p.waitForFunction(() => !!window.__authCb); await p.waitForTimeout(1200);
    await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(600);   // o Firebase real dispara auth-change NULO antes do signInWithCredential terminar
    t('Maré na volta: o auth-change nulo NÃO manda a pessoa pro Oceano (login único) e jogar o token fora', /kanban-dev\.html/.test(p.url()) && !/oceano/.test(p.url()), p.url());
    t('Maré na volta: id_token entregue ao Firebase e a URL volta a ?squad=dev', !!(await p.evaluate(() => window.__cred)) && /\?squad=dev$/.test(p.url()), p.url()); await ctx.close(); }
  { const { ctx, p } = await pagina('kanban-dev.html', '?squad=dev', {}); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(800);
    await p.evaluate(() => doSignIn()); await p.waitForTimeout(500);
    t('Maré no navegador comum: continua no popup', (await p.evaluate(() => window.__popup || 0)) === 1, 0); await ctx.close(); }
  // ── iPhone no SAFARI COMUM (13/10): link aberto do WhatsApp → o popup do Firebase falhava com "missing initial state" ──
  { const { ctx, p, goog } = await pagina('oceano-dev.html', '', { iphone: true }); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(500);
    t('iPhone no Safari comum (fora do atalho): MareLogin.usar() é verdadeiro', await p.evaluate(() => MareLogin.usar()), 0);
    await p.click('#btn-login'); await p.waitForTimeout(700);
    const u = goog[0] ? new URL(goog[0]) : null;
    t('iPhone no Safari comum: Oceano vai direto pro Google (SEM popup), volta na própria página', u && u.searchParams.get('response_type') === 'id_token' && u.searchParams.get('redirect_uri') === ORIG + '/oceano-dev.html' && !(await p.evaluate(() => window.__popup || 0).catch(() => 0)), goog); await ctx.close(); }
  { const { ctx, p } = await pagina('kanban-dev.html', '?squad=dev&login=local', { iphone: true }); await p.waitForFunction(() => !!window.__authCb);
    t('convidado externo (?login=local) no iPhone continua no popup (o login direto só aceita @ciahering)', !(await p.evaluate(() => MareLogin.usar())), 0); await ctx.close(); }
  // ── Escala e Intake no iPhone: sem redirect URI próprio, a volta do Google é no Oceano (hub) e a pessoa é levada de volta ──
  for (const [arq, qs, btn, nome] of [['escala-dev.html', '?squad=dados', '#btn-google', 'Escala'], ['intake-dev.html', '?squad=dados', '#btn-google', 'Intake']]) {
    { const { ctx, p, goog, errs } = await pagina(arq, qs, { iphone: true }); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(700);
      await p.click(btn); await p.waitForTimeout(700);
      const u = goog[0] ? new URL(goog[0]) : null, pend = JSON.parse((((await ctx.storageState()).origins.find(o => o.origin === ORIG) || { localStorage: [] }).localStorage.find(x => x.name === 'mare_oauth_direto') || { value: 'null' }).value);
      t(nome + ' no iPhone: vai direto pro Google (sem popup) e a volta é no OCEANO (já cadastrado), não na própria página', u && u.searchParams.get('redirect_uri') === ORIG + '/oceano-dev.html' && !(await p.evaluate(() => window.__popup || 0).catch(() => 0)), goog);
      t(nome + ' no iPhone: guarda de onde saiu (hub + ret com a query)', pend && pend.hub === true && pend.ret === '/' + arq + qs, pend);
      t(nome + ' sem erro de JS', !errs.length, errs); await ctx.close(); }
    { const { ctx, p } = await pagina(arq, qs, {}); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(() => window.__authCb(null)); await p.waitForTimeout(700);
      await p.click(btn); await p.waitForTimeout(500);
      t(nome + ' no computador: continua no popup', (await p.evaluate(() => window.__popup || 0)) === 1 && p.url().startsWith(ORIG + '/' + arq), p.url()); await ctx.close(); }
  }
  { // volta pelo hub: o Oceano entrega o token ao Firebase e LEVA a pessoa de volta pra página de origem
    const { ctx, p } = await pagina('oceano-dev.html', '#id_token=' + jwt({ nonce: 'h1' }) + '&state=hs', { iphone: true, init: ([n, s]) => { if (!sessionStorage.__ini) { sessionStorage.__ini = 1; localStorage.setItem('mare_oauth_direto', JSON.stringify({ nonce: n, state: s, ts: Date.now(), ret: '/escala-dev.html?squad=dados', hub: true })); } }, initArg: ['h1', 'hs'] });
    await p.waitForFunction(() => /escala-dev\.html/.test(location.pathname), null, { timeout: 8000 }).catch(() => {});
    t('hub: depois do login o Oceano leva a pessoa de volta pra Escala (mesma query)', /\/escala-dev\.html\?squad=dados$/.test(p.url()), p.url()); await ctx.close(); }
  { const { ctx, p } = await pagina('oceano-dev.html', '#id_token=' + jwt({ nonce: 'h1' }) + '&state=hs', { iphone: true, init: ([n, s]) => { if (!sessionStorage.__ini) { sessionStorage.__ini = 1; localStorage.setItem('mare_oauth_direto', JSON.stringify({ nonce: n, state: s, ts: Date.now(), ret: '//evil.example/x', hub: true })); } }, initArg: ['h1', 'hs'] });
    await p.waitForTimeout(2500);
    t('hub: um "ret" que aponta pra fora da origem (//evil.example) é IGNORADO — fica no Oceano', p.url().startsWith(ORIG + '/oceano-dev.html'), p.url()); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
