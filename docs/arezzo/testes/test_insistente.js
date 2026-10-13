// 🫨 Modo insistente (opt-in) do sino — mare-notif-dev.js: padrão DESLIGADO; ligado, o aviso novo treme a tela, e (sem foco) repete o som e pisca o título até a pessoa
// voltar/mexer; respeita Não Perturbe, "reduzir movimento", "só importantes" e não desloca os elementos fixos. Roda o boot real do Maré/Oceano com o Firebase falso.
// Uso:  node docs/arezzo/testes/test_insistente.js      (SUF= testa a prod depois da promoção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const SUF = process.env.SUF === undefined ? '-dev' : process.env.SUF;
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + (JSON.stringify(d === undefined ? null : d) || '').slice(0, 300))); };
const seed = (prefs) => ({ kanban: { usuarios: { ana: Object.assign({ uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AN', role: 'membro', squads: { dev: true } }, prefs ? { notif_prefs: prefs } : {}) }, usuarios_publicos: {}, config: { adm_emails: [] }, squads_meta: {}, squads: { dev: { cards: {} } }, comunicados: {} } });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const abre = async (pagina, prefs, opts) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts || {})); await fake.install(ctx, seed(prefs));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + pagina + SUF + '.html' + (pagina === 'kanban' ? '?squad=dev' : '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__sons = 0; window.__foco = true; document.hasFocus = () => window.__foco; });
    return { ctx, p, errs };
  };
  const insis = (p, o) => p.evaluate(x => MareNotif.insistente(x), o || { tipos: ['assigned'] });

  for (const pagina of ['oceano', 'kanban']) {
    // ── padrão: desligado ──
    let { ctx, p, errs } = await abre(pagina);
    t(`${pagina}: padrão DESLIGADO (só o ding)`, (await p.evaluate(() => MareNotif.insEstado())).on === false);
    t(`${pagina}: desligado → aviso novo não faz nada`, (await insis(p)) === false);
    const sel = pagina === 'kanban' ? '#app-root' : '#app';
    // ── liga e persiste ──
    await p.evaluate(() => MareNotif.insistenteSet({ on: true })); await p.waitForTimeout(300);
    const salvo = await p.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('notif_insistente') || 'null'), fb: window.__store.kanban.usuarios.ana.notif_prefs && window.__store.kanban.usuarios.ana.notif_prefs.insistente }));
    t(`${pagina}: ligar grava no cadastro da pessoa (acompanha a conta) e no aparelho`, salvo.ls && salvo.ls.on === true && salvo.fb && salvo.fb.on === true && salvo.fb.tremer === true && salvo.fb.importantes === true, salvo);
    // ── tremor: o conteúdo mexe, o que é fixo não ──
    const fixo = await p.evaluate(() => { const e = [...document.body.children].find(x => getComputedStyle(x).position === 'fixed' && x.getBoundingClientRect().width > 0 && !/ocean|bwrap|fwrap|drawer/.test(x.className + x.id)); return e ? e.id || e.className : null; });
    const r1 = await p.evaluate(async (s) => {
      const el = document.querySelector(s), fx = [...document.querySelectorAll('body > *')].filter(x => getComputedStyle(x).position === 'fixed' && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().width < 600);
      const antes = fx.map(x => JSON.stringify(x.getBoundingClientRect()));
      const lefts = new Set(); const ret = MareNotif.insistente({ tipos: ['assigned'] });
      const t0 = Date.now(); while (Date.now() - t0 < 800) { lefts.add(Math.round(el.getBoundingClientRect().left)); await new Promise(r => requestAnimationFrame(r)); }
      const depois = fx.map(x => JSON.stringify(x.getBoundingClientRect()));
      return { ret, posicoes: lefts.size, fixosIguais: antes.every((a, i) => a === depois[i]), nFixos: fx.length, posFinal: Math.round(el.getBoundingClientRect().left), estilo: el.style.position };
    }, sel);
    t(`${pagina}: aviso novo com o modo ligado → o conteúdo treme (sai do lugar) e volta ao lugar`, r1.ret === true && r1.posicoes >= 2 && r1.posFinal === 0, r1);
    t(`${pagina}: os elementos fixos (modais, botões flutuantes, gaveta) NÃO se mexem durante o tremor (${r1.nFixos} conferidos)`, r1.fixosIguais === true && r1.nFixos > 0, r1);
    t(`${pagina}: terminado o tremor o estilo inline volta ao que era`, r1.estilo === '' || r1.estilo === 'relative' && pagina === 'kanban', r1.estilo);
    // ── com foco: só o tremor, sem repetir/piscar ──
    const comFoco = await p.evaluate(() => { document.title = 'Original'; window.__foco = true; MareNotif.insistente({ tipos: ['mention'] }); return new Promise(r => setTimeout(() => r(document.title), 1300)); });
    t(`${pagina}: janela COM foco → não pisca o título`, comFoco === 'Original', comFoco);
    // ── sem foco: pisca o título e repete o som ──
    await p.evaluate(() => { window.__foco = false; document.title = 'Original'; window.__sons = 0; MareNotif.insistente({ tipos: ['mention'], titulo: 'Fulano te mencionou' }); });
    await p.waitForTimeout(1300);
    const titulos = await p.evaluate(() => document.title);
    t(`${pagina}: janela SEM foco → o título da aba pisca com o aviso`, /🔔 Fulano te mencionou · Original/.test(titulos) || titulos === 'Original', titulos);
    await p.waitForTimeout(1000);
    const t2 = await p.evaluate(() => document.title);
    t(`${pagina}: …e alterna (volta ao título original)`, titulos !== t2, [titulos, t2]);
    await p.mouse.click(10, 10); await p.waitForTimeout(150);
    const apos = await p.evaluate(() => { const a = document.title; return new Promise(r => setTimeout(() => r([a, document.title]), 1500)); });
    t(`${pagina}: mexer na tela (clique) PARA a insistência — título volta ao original e fica`, apos[0] === 'Original' && apos[1] === 'Original', apos);
    // ── Não Perturbe / só importantes / reduzir movimento ──
    t(`${pagina}: Não Perturbe da página → não escala`, (await insis(p, { tipos: ['assigned'], dnd: true })) === false);
    t(`${pagina}: "só importantes" (padrão) ignora tipo comum (checklist)`, (await insis(p, { tipos: ['checklist'] })) === false);
    await p.evaluate(() => MareNotif.insistenteSet({ importantes: false }));
    t(`${pagina}: sem "só importantes", o tipo comum também escala`, (await insis(p, { tipos: ['checklist'] })) === true);
    await p.evaluate(() => { MareNotif.insistenteParar(); MareNotif.insistenteSet({ importantes: true }); });
    t(`${pagina}: sem erro de JS`, !errs.length, errs);
    await ctx.close();
  }

  // ── repetição do som a cada 30 s (relógio simulado) ──
  { const { ctx, p } = await abre('oceano');
    await p.clock.install(); await p.evaluate(() => { MareNotif.insistenteSet({ on: true, tremer: false }); window.__foco = false; });
    await p.evaluate(() => { window.__tocou = 0; const AC = window.AudioContext; window.AudioContext = function () { window.__tocou++; return new AC(); }; });
    await p.evaluate(() => MareNotif.insistente({ tipos: ['assigned'] }));
    await p.clock.fastForward(30500); const a = await p.evaluate(() => window.__tocou);
    await p.clock.fastForward(30000 * 6); const bq = await p.evaluate(() => window.__tocou);
    t('repete o som a cada 30 s (1ª repetição aos 30 s) e para depois de 5 repetições (não é infinito)', a >= 1 && bq <= 5, { aos30s: a, total: bq });
    await p.evaluate(() => MareNotif.insistenteParar()); await ctx.close(); }

  // ── "reduzir movimento" do sistema → não treme ──
  { const { ctx, p } = await abre('oceano', null, { reducedMotion: 'reduce' });
    await p.evaluate(() => MareNotif.insistenteSet({ on: true }));
    const anim = await p.evaluate(() => { MareNotif.insistente({ tipos: ['assigned'] }); return document.querySelector('#app').getAnimations().length; });
    t('sistema pede menos movimento → a tela NÃO treme', anim === 0, anim); await ctx.close(); }

  // ── a preferência vem da conta (outro aparelho) ──
  { const { ctx, p } = await abre('oceano', { insistente: { on: true, tremer: false, repetir: false, titulo: false, importantes: false } });
    const e = await p.evaluate(() => MareNotif.insEstado());
    t('preferência gravada na conta em outro aparelho é aplicada ao abrir', e.on === true && e.tremer === false && e.importantes === false, e); await ctx.close(); }

  // ── menu no rodapé do sino ──
  { const { ctx, p, errs } = await abre('oceano');
    await p.click('#btn-sino'); await p.waitForTimeout(300);
    const btn = await p.$('.mn-ins-btn'); t('oceano: o rodapé do sino tem o botão "Modo insistente"', !!btn && /desligado/.test(await btn.textContent()));
    await btn.click(); await p.waitForTimeout(200);
    const aberto = await p.evaluate(() => { const m = document.getElementById('mn-ins-menu'); return m && getComputedStyle(m).display === 'block'; });
    t('oceano: o botão abre o menu', !!aberto);
    await p.click('#mn-ins-menu [data-ins="on"]'); await p.waitForTimeout(250);
    const est = await p.evaluate(() => ({ e: MareNotif.insEstado(), lbl: document.querySelector('.mn-ins-lbl').textContent, off: document.getElementById('mn-ins-menu').classList.contains('mn-ins-off'), aberto: getComputedStyle(document.getElementById('mn-ins-menu')).display }));
    t('oceano: marcar "Ligar" liga, atualiza o rótulo e o menu continua aberto', est.e.on === true && /ligado/.test(est.lbl) && !est.off && est.aberto === 'block', est);
    await p.click('#mn-ins-menu [data-ins="tremer"]'); await p.waitForTimeout(150);
    t('oceano: desmarcar "Tremer a tela" grava só esse item', (await p.evaluate(() => MareNotif.insEstado())).tremer === false);
    await p.click('#mn-ins-menu [data-ins-testar]'); await p.waitForTimeout(300);
    t('oceano: "Testar agora" roda sem erro', !errs.length, errs);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('oceano: Esc fecha o menu', await p.evaluate(() => getComputedStyle(document.getElementById('mn-ins-menu')).display === 'none'));
    await ctx.close(); }

  // ── Maré: botão no rodapé do painel de notificações + o aviso novo escala ──
  { const { ctx, p, errs } = await abre('kanban');
    t('Maré: o painel de notificações tem o botão "Modo insistente"', await p.evaluate(() => !!document.querySelector('#ins-toggle-btn .mn-ins-lbl')));
    await p.evaluate(() => MareNotif.insistenteSet({ on: true, importantes: true }));
    const anim = await p.evaluate(() => {
      const n = [{ id: 'n1', type: 'assigned', title: 'Card atribuído a você', sub: '', read: false, ts: new Date().toISOString() }];
      renderNotifs(n); return document.querySelector('#app-root').getAnimations().length;
    });
    t('Maré: aviso importante novo (renderNotifs → badge acende) faz a tela tremer', anim >= 1, anim);
    await p.waitForTimeout(900);
    const anim2 = await p.evaluate(() => { renderNotifs([{ id: 'n2', type: 'checklist', title: 'Checklist', sub: '', read: false, ts: new Date().toISOString() }]); document.getElementById('notif-badge').classList.remove('show'); renderNotifs([{ id: 'n3', type: 'checklist', title: 'Checklist', sub: '', read: false, ts: new Date().toISOString() }]); return document.querySelector('#app-root').getAnimations().length; });
    t('Maré: aviso comum (checklist) não treme com "só importantes"', anim2 === 0, anim2);
    t('Maré: sem erro de JS', !errs.length, errs); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
