// 🏢 Diretoria por pessoa (16/11/2026): escolha no 1º acesso do Maré (janela própria ou na inscrição), etiqueta na 👥 Equipe,
// seletor + filtro no Painel → Usuários (só ADM com role 'adm', igual à regra). Boot real + Firebase falso.
// Uso: node docs/arezzo/testes/test_diretoria.js   (sobe o próprio servidor) · CAPTURE=1 guarda prints em docs/capturas/diretoria
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const PW = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(PW);
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
const CAP = process.env.CAPTURE ? path.join(ROOT, 'docs/capturas/diretoria') : ''; if (CAP) fs.mkdirSync(CAP, { recursive: true });
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const G = [{ providerId: 'google.com' }];
const AU = { ana: { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Teste', providerData: G },
  conv: { uid: 'conv', email: 'conv@ciahering.com.br', displayName: 'Con Vidado', providerData: G },
  ext: { uid: 'ext', email: 'freela@gmail.com', displayName: 'Free Lancer', providerData: G },
  adm: { uid: 'adm1', email: 'adm@ciahering.com.br', displayName: 'Adm Teste', providerData: G },
  lst: { uid: 'lst', email: 'lista@ciahering.com.br', displayName: 'So Lista', providerData: G } };
const pessoa = (uid, nome, init, role, extra) => Object.assign({ uid, nome, email: AU[uid] ? AU[uid].email : uid + '@ciahering.com.br', init, role, inscrito: true, squads: { site: true } }, extra || {});
const seed = (extraUsers) => { const us = Object.assign({
  ana: pessoa('ana', 'Ana Teste', 'AT', 'membro'), bia: pessoa('bia', 'Bia <b>Outra</b>', 'BO', 'membro', { diretoria: 'rh' }),
  conv: pessoa('conv', 'Con Vidado', 'CV', 'convidado'), ext: pessoa('ext', 'Free Lancer', 'FL', 'convidado'),
  adm1: pessoa('adm1', 'Adm Teste', 'AD', 'adm'), lst: pessoa('lst', 'So Lista', 'SL', 'membro') }, extraUsers || {});
  const pub = {}; Object.entries(us).forEach(([k, u]) => { pub[k] = { nome: u.nome, init: u.init, role: u.role, inscrito: true, squads: u.squads, diretoria: u.__semEspelho ? undefined : u.diretoria }; delete u.__semEspelho; });
  return { kanban: { usuarios: us, usuarios_publicos: pub, config: { adm_emails: ['adm@ciahering.com.br', 'lista@ciahering.com.br'] }, squads_meta: {},
    squads: { site: { externos: { 'freela@gmail,com': true }, dados: { columns: [{ id: 'todo', name: 'A fazer' }], cards: {}, cards_index: {} } } } } }; };
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0;
const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  async function abrir(pagina, quem, { w = 1280, h = 860, tema = '', extra } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800 });
    await fake.install(ctx, seed(extra));
    await ctx.addInitScript(tm => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); ['ana', 'conv', 'ext', 'adm1', 'lst', 'novo'].forEach(u => localStorage.setItem('bvmd_' + u, '1')); if (tm) localStorage.setItem('mare_theme', tm); } catch (e) {} }, tema);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + pagina + (pagina.startsWith('kanban') ? '.html?squad=site' : '.html')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(u => window.__authCb(u), quem); return { ctx, p, errs };
  }
  const db = (p, c) => p.evaluate(c => c.split('/').reduce((o, k) => o == null ? o : o[k], window.__store), c);
  const aberta = p => p.evaluate(() => document.getElementById('dir-ov').classList.contains('open'));
  try {
    // 1) membro Hering sem diretoria: janela aparece, escolhe RH, grava fonte + espelho, etiqueta na Equipe
    { const { ctx, p, errs } = await abrir('kanban-dev', AU.ana);
      await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
      await p.waitForFunction(() => document.getElementById('dir-ov').classList.contains('open'), null, { timeout: 15000 }).catch(() => {});
      t('membro sem diretoria: a janela "Qual é a sua diretoria?" abre sozinha', await aberta(p), '');
      const ops = await p.evaluate(() => [...document.querySelectorAll('#dir-ops .dir-op')].map(b => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height })));
      t('4 opções (Digital, RH, Marca, Tecnologia), alvo ≥ 44 px', ops.map(o => o.t).join('|') === '💻 Digital|🤝 RH|🎨 Marca|🛠️ Tecnologia' && ops.every(o => o.h >= 44), ops);
      t('Confirmar desabilitado até escolher', await p.evaluate(() => document.getElementById('dir-ok').disabled), '');
      if (CAP) await p.screenshot({ path: path.join(CAP, 'mare-janela-1280.png') });
      await p.click('#dir-ops .dir-op[data-dir="rh"]'); await p.click('#dir-ok'); await p.waitForTimeout(500);
      t('confirmar grava usuarios/ana/diretoria = rh', await db(p, 'kanban/usuarios/ana/diretoria') === 'rh', await db(p, 'kanban/usuarios/ana/diretoria'));
      t('…e o espelho usuarios_publicos/ana/diretoria = rh', await db(p, 'kanban/usuarios_publicos/ana/diretoria') === 'rh', await db(p, 'kanban/usuarios_publicos/ana/diretoria'));
      t('janela fecha depois de salvar', !(await aberta(p)), '');
      await p.evaluate(() => openTeamList()); await p.waitForTimeout(900);
      const eq = await p.evaluate(() => [...document.querySelectorAll('#team-list .dir-pill')].map(x => x.textContent.trim()));
      t('👥 Equipe mostra a etiqueta de diretoria (Ana 🤝 RH e Bia 🤝 RH)', eq.filter(x => x === '🤝 RH').length === 2, eq);
      const pill = await p.evaluate(() => { const x = document.querySelector('#team-list .dir-pill'); const cs = getComputedStyle(x); return { bg: cs.backgroundColor, borda: cs.borderTopStyle }; });
      t('etiqueta é de contorno neutro (sem fundo colorido, ≠ pílula de subtime)', pill.bg === 'rgba(0, 0, 0, 0)' && pill.borda === 'solid', pill);
      if (CAP) await p.screenshot({ path: path.join(CAP, 'mare-equipe-1280.png') });
      t('sem erro de JS', !errs.length, errs);
      await ctx.close(); }
    // F5 com a diretoria já no banco (o fakefb regrava o seed a cada carregamento, então o "depois" é um seed com o campo)
    { const { ctx, p } = await abrir('kanban-dev', AU.ana, { extra: { ana: pessoa('ana', 'Ana Teste', 'AT', 'membro', { diretoria: 'rh', __semEspelho: true }) } });
      await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); await p.waitForTimeout(9000);
      t('quem já tem diretoria: não é perguntado', !(await aberta(p)), '');
      await p.evaluate(() => mostrarInscricao(window._currentUser, { init: 'AT', role: 'membro' }, {})); await p.waitForTimeout(200);
      t('quem já tem diretoria: a inscrição (qualquer caminho) NÃO pede de novo', await p.evaluate(() => getComputedStyle(document.getElementById('insc-dir-wrap')).display === 'none'), '');
      await p.evaluate(() => closeOv('insc-ov'));
      t('login reespelha a diretoria em usuarios_publicos (update à parte)', await db(p, 'kanban/usuarios_publicos/ana/diretoria') === 'rh', await db(p, 'kanban/usuarios_publicos/ana/diretoria'));
      await ctx.close(); }
    // 2) "Agora não" e Esc: não reabre na mesma sessão
    { const { ctx, p } = await abrir('kanban-dev', AU.ana);
      await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
      await p.waitForFunction(() => document.getElementById('dir-ov').classList.contains('open'), null, { timeout: 15000 }).catch(() => {});
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      t('Esc fecha como "Agora não" (nada gravado)', !(await aberta(p)) && (await db(p, 'kanban/usuarios/ana/diretoria')) == null, '');
      await p.evaluate(u => _dirTalvezPerguntar(window._currentUser, { role: 'membro' }), null); await p.waitForTimeout(200);
      t('na mesma sessão, não pergunta de novo', !(await aberta(p)), '');
      await ctx.close(); }
    // 3) convidado e externo: nunca perguntados
    for (const [quem, nome] of [[AU.conv, 'convidado @ciahering'], [AU.ext, 'externo (gmail)']]) {
      const { ctx, p } = await abrir('kanban-dev', quem); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); await p.waitForTimeout(9000);
      t(nome + ': não é perguntado', !(await aberta(p)), ''); await ctx.close(); }
    // 4) pessoa nova: a diretoria vem NA inscrição (obrigatória), sem 2ª janela depois
    { const { ctx, p } = await abrir('kanban-dev', { uid: 'novo', email: 'novo@ciahering.com.br', displayName: 'Nova Pessoa', providerData: G }, { extra: {} });
      await p.waitForTimeout(3500);
      const insc = await p.evaluate(() => ({ aberta: document.getElementById('insc-ov').classList.contains('open'), dir: getComputedStyle(document.getElementById('insc-dir-wrap')).display !== 'none' }));
      t('pessoa nova: a inscrição pede a diretoria', insc.aberta && insc.dir, insc);
      await p.evaluate(() => { document.getElementById('insc-init').value = 'NP'; }); await p.evaluate(() => confirmarInscricao()); await p.waitForTimeout(500);
      t('sem escolher, a inscrição não confirma', await p.evaluate(() => document.getElementById('insc-ov').classList.contains('open')), '');
      if (CAP) await p.screenshot({ path: path.join(CAP, 'mare-inscricao-1280.png') });
      await p.click('#insc-dir-ops .dir-op[data-dir="marca"]'); await p.evaluate(() => confirmarInscricao()); await p.waitForTimeout(1200);
      t('inscrição grava a diretoria (marca) na fonte e no espelho', await db(p, 'kanban/usuarios/novo/diretoria') === 'marca' && await db(p, 'kanban/usuarios_publicos/novo/diretoria') === 'marca', [await db(p, 'kanban/usuarios/novo/diretoria'), await db(p, 'kanban/usuarios_publicos/novo/diretoria')]);
      await p.waitForTimeout(8000);
      t('pessoa nova: nenhuma 2ª janela de diretoria depois da inscrição', !(await aberta(p)), '');
      await ctx.close(); }
    // 5) celular + temas: janela cabe, sem rolagem lateral
    for (const tema of ['', 'light', 'vice', 'blackfriday']) {
      const { ctx, p } = await abrir('kanban-dev', AU.ana, { w: 390, h: 800, tema });
      await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); _dirAbrir(); }); await p.waitForTimeout(300);
      const m = await p.evaluate(() => { const pn = document.querySelector('#dir-ov .panel').getBoundingClientRect(); return { dentro: pn.left >= 0 && pn.right <= innerWidth, lat: document.documentElement.scrollWidth <= innerWidth + 1 }; });
      t('390 px · ' + (tema || 'dark') + ': janela dentro da tela e sem rolagem lateral', m.dentro && m.lat, m);
      if (CAP && (tema === '' || tema === 'light')) await p.screenshot({ path: path.join(CAP, 'mare-janela-390-' + (tema || 'dark') + '.png') });
      await ctx.close(); }
    // 6) Painel → Usuários: seletor e filtro; só ADM com role adm edita (igual à regra)
    { const { ctx, p, errs } = await abrir('painel-dev', AU.adm); await p.waitForTimeout(2500);
      await p.evaluate(() => openGlobalUsersModal()); await p.waitForTimeout(1500);
      const sels = await p.evaluate(() => [...document.querySelectorAll('#global-users-list select[aria-label^="Diretoria"]')].map(s => ({ l: s.getAttribute('aria-label'), v: s.value, dis: s.disabled })));
      t('Painel: um seletor de diretoria por pessoa, habilitado pro ADM (role adm)', sels.length >= 6 && sels.every(s => !s.dis), sels);
      t('Painel: Bia aparece como RH; quem não tem aparece "Não informada" (vazio, nunca Digital)', sels.find(s => /Bia/.test(s.l)).v === 'rh' && sels.find(s => /Ana/.test(s.l)).v === '', sels);
      await p.evaluate(() => _guSetFilter('diretoria', '__nao')); await p.waitForTimeout(200);
      const nao = await p.evaluate(() => [...document.querySelectorAll('#global-users-list select[aria-label^="Diretoria"]')].map(s => s.getAttribute('aria-label')));
      t('filtro "Não informada" esconde quem já tem (Bia)', nao.length >= 1 && !nao.some(x => /Bia/.test(x)), nao);
      await p.evaluate(() => _guSetFilter('diretoria', '')); await p.waitForTimeout(200);
      await p.evaluate(async () => { const s = [...document.querySelectorAll('#global-users-list select[aria-label^="Diretoria"]')].find(x => /Ana/.test(x.getAttribute('aria-label'))); s.value = 'tecnologia'; await setGlobalUserDiretoria('ana', 'tecnologia', s); });
      t('ADM troca a da Ana → tecnologia (fonte + espelho)', await db(p, 'kanban/usuarios/ana/diretoria') === 'tecnologia' && await db(p, 'kanban/usuarios_publicos/ana/diretoria') === 'tecnologia', '');
      await p.evaluate(async () => { await setGlobalUserDiretoria('ana', 'comercial', null); });
      t('valor fora das 4 é ignorado', await db(p, 'kanban/usuarios/ana/diretoria') === 'tecnologia', '');
      await p.evaluate(() => { delete window.__store.kanban.usuarios.bia; });
      await p.evaluate(async () => { await setGlobalUserDiretoria('bia', 'marca', null); });
      t('usuário apagado no meio não renasce', (await db(p, 'kanban/usuarios/bia')) == null, await db(p, 'kanban/usuarios/bia'));
      if (CAP) await p.screenshot({ path: path.join(CAP, 'painel-usuarios-1280.png') });
      t('Painel: sem erro de JS', !errs.length, errs);
      await ctx.close(); }
    // "todo mundo começa como Digital": botão do ADM preenche só quem é da Hering e ainda não tem (externo fora; quem tem não muda)
    { const { ctx, p } = await abrir('painel-dev', AU.adm); await p.waitForTimeout(2500);
      await p.evaluate(() => openGlobalUsersModal()); await p.waitForTimeout(1500);
      const txt = await p.evaluate(() => (document.getElementById('gu-dir-digital') || {}).textContent || '');
      t('Painel: botão "Marcar N sem diretoria como Digital" (4 da Hering sem diretoria; Bia já é RH; externo fora)', /Marcar 4 sem diretoria como Digital/.test(txt), txt);
      p.once('dialog', d => d.accept());
      await p.evaluate(() => { window.uiConfirm = async () => true; }); await p.evaluate(() => _guPreencherDigital()); await p.waitForTimeout(800);
      const r = await p.evaluate(() => ['ana', 'adm1', 'conv', 'lst', 'bia', 'ext'].map(u => u + ':' + ((window.__store.kanban.usuarios[u] || {}).diretoria || '-') + '/' + ((window.__store.kanban.usuarios_publicos[u] || {}).diretoria || '-')).join(' '));
      t('preenche Digital na fonte e no espelho; Bia continua RH; externo (gmail) sem diretoria', r === 'ana:digital/digital adm1:digital/digital conv:digital/digital lst:digital/digital bia:rh/rh ext:-/-', r);
      t('depois de preencher, o botão some', await p.evaluate(() => !document.getElementById('gu-dir-digital')), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir('painel-dev', AU.lst); await p.waitForTimeout(2500);
      await p.evaluate(() => openGlobalUsersModal()); await p.waitForTimeout(1500);
      const sels = await p.evaluate(() => [...document.querySelectorAll('#global-users-list select[aria-label^="Diretoria"]')].map(s => s.disabled));
      t('Painel: ADM só pela lista de e-mails (sem role adm) vê o seletor travado, com o motivo', sels.length > 0 && sels.every(Boolean), sels);
      t('…e não vê o botão de preencher Digital', await p.evaluate(() => !document.getElementById('gu-dir-digital')), '');
      await ctx.close(); }
    // 17/11 (/monitorarbugs): cadastro com diretoria e cópia da 👥 Equipe vazia (3 pessoas reais). O Painel aponta e recopia;
    // quem nem tem cópia fica de fora (não cria registro pela metade); falha da cópia não vira mais "sucesso" calado.
    { const extra = { cris: pessoa('cris', 'Cris Espelho', 'CE', 'membro', { diretoria: 'digital', __semEspelho: true }),
        dani: pessoa('dani', 'Dani Sem Copia', 'DS', 'membro', { diretoria: 'marca' }) };
      const { ctx, p, errs } = await abrir('painel-dev', AU.adm, { extra }); await p.waitForTimeout(2500);
      await p.evaluate(() => { delete window.__store.kanban.usuarios_publicos.dani; window.__toasts = []; const o = window.showToast; window.showToast = (m, ...r) => { window.__toasts.push(String(m)); return o && o(m, ...r); }; });
      await p.evaluate(() => openGlobalUsersModal()); await p.waitForTimeout(1500);
      const txt = await p.evaluate(() => (document.getElementById('gu-dir-espelho') || {}).textContent || '');
      t('Painel: "Corrigir a etiqueta de 1 na Equipe" (Cris diverge; Dani sem cópia fica de fora)', /Corrigir a etiqueta de 1 na Equipe/.test(txt), txt);
      await p.evaluate(() => _guCorrigirEspelho()); await p.waitForTimeout(600);
      t('…recopia digital na cópia da Cris', await db(p, 'kanban/usuarios_publicos/cris/diretoria') === 'digital', await db(p, 'kanban/usuarios_publicos/cris/diretoria'));
      t('…não cria cópia pela metade pra Dani', (await db(p, 'kanban/usuarios_publicos/dani')) == null, await db(p, 'kanban/usuarios_publicos/dani'));
      t('…e o botão some', await p.evaluate(() => !document.getElementById('gu-dir-espelho')), '');
      await p.evaluate(() => { window.__denySet = (pth) => /usuarios_publicos\//.test(pth); window.__toasts = []; });
      await p.evaluate(async () => { await setGlobalUserDiretoria('ana', 'rh', null); });
      const ts = await p.evaluate(() => window.__toasts.join(' | '));
      t('seletor: cópia negada → aviso, não "registrada" calado', /etiqueta da 👥 Equipe não gravou/.test(ts) && await db(p, 'kanban/usuarios/ana/diretoria') === 'rh', ts);
      await p.waitForTimeout(800);
      t('…e o botão de corrigir volta a aparecer (Ana diverge)', await p.evaluate(() => /Corrigir a etiqueta de 1/.test((document.getElementById('gu-dir-espelho') || {}).textContent || '')), '');
      await p.evaluate(() => { window.__toasts = []; window.uiConfirm = async () => true; }); await p.evaluate(() => _guPreencherDigital()); await p.waitForTimeout(800);
      const tb = await p.evaluate(() => window.__toasts.join(' | '));
      t('em massa: cópia negada entra no aviso ("sem etiqueta na Equipe")', /sem etiqueta na Equipe/.test(tb), tb);
      t('Painel (espelho): sem erro de JS', !errs.length, errs);
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
