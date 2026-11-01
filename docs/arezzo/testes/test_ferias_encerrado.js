// ⏸ Assistente Férias ENCERRADO (01/11/2026): a partir de 03/11/2026 (o Caio voltou) o Oceano não mostra mais o banner, a pílula nem o modal — mas nada foi apagado:
// `?ferias=1` religa só para quem abriu assim. Este teste congela o relógio do navegador em duas datas (último dia de plantão e dia da volta) e confere os dois lados.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_ferias_encerrado.js       (OC=oceano para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const OC = process.env.OC || 'oceano-dev'; let ok = true;
const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = () => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', init: 'EV', role: 'membro', inscrito: true, squads: { dados: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'membro', squads: { dados: true } } }, config: { adm_emails: [] },
  squads: { dados: { dados: { columns: [{ id: 'backlog', name: 'Backlog' }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const abre = async (dia, query) => { const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(c, seed());
    // congela só o "hoje" (toLocaleDateString('sv-SE')) — o resto do relógio segue normal
    await c.addInitScript(d => { const R = Date, fixo = new R(d + 'T12:00:00-03:00').getTime(), delta = fixo - R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + delta); } static now() { return R.now() + delta; } } window.Date = D; }, dia);
    const p = await c.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:8941/${OC}.html${query || ''}`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); return { c, p, erros }; };
  const vis = p => p.evaluate(() => { const h = document.getElementById('ferias-caio-host'); return !!h && h.style.display !== 'none' && h.innerHTML.trim().length > 0; });

  { const { c, p, erros } = await abre('2026-11-02'); t('A. 02/11 (último dia de plantão): o assistente ainda aparece', await vis(p), null); t('A2. sem erro de JS', !erros.length, erros); await c.close(); }
  { const { c, p, erros } = await abre('2026-11-03');
    t('B. 03/11 (o Caio voltou): banner/pílula somem', !(await vis(p)), null);
    t('B2. feriasAtivo() devolve false', (await p.evaluate(() => window.feriasAtivo())) === false, null);
    await p.evaluate(() => abrirFeriasCaio('bugs')); await p.waitForTimeout(300);
    t('B3. link/sino antigo de chamado não abre o modal — só avisa que o assistente foi encerrado', !(await p.evaluate(() => document.getElementById('ferias-ov').classList.contains('open'))) && /encerrado/.test(await p.textContent('#toast')), await p.textContent('#toast'));
    t('B4. sem erro de JS', !erros.length, erros); await c.close(); }
  { const { c, p } = await abre('2026-11-10', '?ferias=1');
    t('C. depois da volta, ?ferias=1 religa o assistente (reuso/demonstração)', await vis(p) && (await p.evaluate(() => window.feriasAtivo())) === true, null);
    await p.evaluate(() => abrirFeriasCaio('chat')); await p.waitForTimeout(300); t('C2. e o modal abre normalmente', await p.evaluate(() => document.getElementById('ferias-ov').classList.contains('open')), null); await c.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + OC + ')' : '\nHÁ FALHAS (' + OC + ')'); process.exit(ok ? 0 : 1); })();
