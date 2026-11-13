// Validação read-only no console do Maré dev, com o Gantt aberto (ADM):
// (() => { const s=document.querySelector('.gantt-fmes'); console.log(s && s.options.length===13 && !s.hasAttribute('data-campo') ? '✅ Mês disponível com 12 meses' : '❌ Abra o Gantt e confira Mês'); console.log(typeof ganttIrMes==='function' && typeof ganttIrPara==='function' ? '✅ Navegação disponível' : '❌ Navegação ausente'); })();
// 📆 Mês — rodada /melhoriauiux de 13/11/2026: rótulo "Hoje" na linha 📌 Datas-chave, rótulo de data de 1 dia CENTRADO na linha
// (estava "torto"), destaque do ADM nas barras dos calendários (cor + ⚠️, vale para todas as squads), filtro "mostrar só" por grupo
// de linhas e o novo nome "Site e App". Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_ui.js (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';   // janela 01/11 – 12/12; hoje = coluna 12
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const USERS = {
  mem: { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'membro' } },
  adm: { uid: 'adm', nome: 'Ana ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm', squads: { [SQ]: true } },
};
const meta = { atualizadoEm: 1, porNome: 'Caio', arquivo: 'x.xlsx', de: '2026-01-01', ate: '2026-12-31' };
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, squads: u.squads }])),
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1' },
      cards: { k1: { id: 'c1', title: 'Card', col: 'doing', owner: 'MM', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-20', fim: '2026-11-30', updatedAt: '2026-10-27T10:00:00.000Z' } } },
    ['gantt_marcos' + SUF]: { m1: { titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-27', cor: 'purple', porUid: 'adm', em: 1 }, m2: { titulo: 'Semana do Cliente', ini: '2026-11-16', fim: '2026-11-20', cor: 'green', porUid: 'adm', em: 1 } } } },
  ['calendarios_gantt' + SUF]: {
    comercial: { meta, linhas: { lancamentos: { rot: 'Lançamentos e datas', ordem: 0 }, site: { rot: 'Site todo (não remarcados)', ordem: 1 }, saldos: { rot: 'Site · Saldos', ordem: 2 }, crm: { rot: 'CRM', ordem: 6 }, app: { rot: 'Ação App', ordem: 7 } },
      barras: { b_a1: { linha: 'site', ini: '2026-11-09', fim: '2026-11-14', txt: 'AÇÃO SITE TESTE' }, b_a2: { linha: 'saldos', ini: '2026-11-10', fim: '2026-11-13', txt: 'OFERTA FICTÍCIA' },
        b_a3: { linha: 'crm', ini: '2026-11-11', fim: '2026-11-12', txt: 'CRM TESTE' }, b_a4: { linha: 'app', ini: '2026-11-12', fim: '2026-11-12', txt: 'APP TESTE' }, b_a5: { linha: 'lancamentos', ini: '2026-11-15', fim: '2026-11-15', txt: 'FERIADO' } } },
    marca: { meta, linhas: { web: { rot: 'Web', ordem: 1 }, redes: { rot: 'Redes sociais', ordem: 2 } },
      barras: { b_w1: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' }, b_r1: { linha: 'redes', ini: '2026-11-10', fim: '2026-11-17', txt: 'CAMPANHA TESTE' } } } },
  ['gantt_destaques' + SUF]: { comercial: { b_a2: { cor: 'red', alerta: true, porNome: 'Ana ADM', em: 1 }, b_a5: { cor: 'blue', alerta: false, porNome: 'Ana ADM', em: 1 } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (quem, vp) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    const u = USERS[quem]; await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  for (const vp of [{width:1280,height:900},{width:390,height:800}]) {
    const {ctx,p,errs}=await abre('mem',vp);
    const sel=p.locator('.gantt-fmes');
    for(const aba of ['cards','marca','comercial','mktplace','outlet']) {
      await p.evaluate(a=>ganttAba(a),aba);
      t(`${vp.width}/${aba}: Mês visível nas cinco abas`,await sel.isVisible());
      const opts=await sel.locator('option').evaluateAll(es=>es.map(e=>[e.value,e.textContent]));
      t('13 opções do ano corrente',opts.length===13 && opts[0][1]==='📆 Mês' && opts[1][1]==='Janeiro 2026' && opts[12][0]==='2026-12');
      await sel.selectOption('2026-03');
      t('Março na régua e dia 01/03 presente',await p.evaluate(()=>[...document.querySelectorAll('.gantt-ruler-months *')].some(e=>e.textContent==='Março 2026' && e.getBoundingClientRect().width>0) && !!document.querySelector('.gantt-day-hd[data-date="2026-03-01"]')));
      t('Navegar por mês não ativa período',await p.evaluate(()=>!_ganttPeriodoAtivo() && !document.getElementById('gantt-footer').textContent.includes('📅 Período')));
      t('Escolha preservada entre renderizações e opções são os mesmos nós',await p.evaluate(()=>{const s=document.querySelector('.gantt-fmes'),o=s.options[1];renderBoard();return s===document.querySelector('.gantt-fmes') && s.options[1]===o && s.value==='2026-03';}));
      for(const delta of [-7,7,0]) {
        await sel.selectOption('2026-03'); await p.evaluate(d=>ganttNav(d),delta);
        t('◀/▶/Hoje limpa escolha',await sel.inputValue()==='');
      }
      await sel.selectOption('2026-03');
      await p.locator('.gantt-fdata input[data-p="de"]').fill('2026-04-01');
      await p.locator('.gantt-fdata input[data-p="de"]').dispatchEvent('change');
      t('De limpa escolha',await sel.inputValue()==='');
      await sel.selectOption('2026-03');
      await p.locator('.gantt-fdata input[data-p="ate"]').fill('2026-04-30');
      await p.locator('.gantt-fdata input[data-p="ate"]').dispatchEvent('change');
      t('Até limpa escolha',await sel.inputValue()==='');
      const periodo=await p.evaluate(()=>JSON.stringify(_ganttPeriodo));
      await sel.selectOption('2026-03');
      t('Mês preserva período já ativo',await p.evaluate(()=>JSON.stringify(_ganttPeriodo))===periodo);
      await p.evaluate(()=>ganttLimpar());
      t('Limpar zera escolha',await sel.inputValue()==='');
      for(const tema of ['', 'light','vice']) {
        await p.evaluate(th=>document.documentElement.dataset.theme=th,tema);
        t('Sem rolagem lateral '+tema,await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
      }
      if(vp.width===390) t('Toque: 44 px e fonte 16 px',await sel.evaluate(e=>e.getBoundingClientRect().height>=44 && getComputedStyle(e).fontSize==='16px'));
    }
    t('Sem erro de JS',errs.length===0,errs); await ctx.close();
  }
  await b.close(); console.log(ok?'TUDO OK':'FALHOU'); process.exit(ok?0:1);
})();
