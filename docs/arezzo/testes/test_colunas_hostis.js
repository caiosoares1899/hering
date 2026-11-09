// 🛡️ Coluna com nome/cor HOSTIS vindos do banco (qualquer membro grava `columns`): nada pode virar HTML/atributo. Boot REAL do Maré + Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_colunas_hostis.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'dados';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col) => ({ id, title, col, createdAt: '2026-10-20', desc: 'x', flow: flow(col), updatedAt: '2026-10-26T10:00:00.000Z' });
const NOME = '<img src=x onerror="window.__pwn=1">Hostil', COR = 'red;" onmouseover="window.__pwn=2" x="';
const seed = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AN', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AN', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  squads: { [SQ]: { dados: { cards: { 0: card('c0', 'Card um', 'a'), 1: card('c1', 'Card dois', 'b') }, cards_index: { c0: '0', c1: '1' }, cards_updated_at: { c0: 'x', c1: 'x' },
    columns: [{ id: 'a', name: NOME, color: COR }, { id: 'b', name: 'Fazendo', color: '#ff0000' }, { id: 'c', name: 'Pronto', color: 'var(--accent)' }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500);
  const r = await p.evaluate(() => {
    const dd = document.createElement('div'); document.body.appendChild(dd); const ta = document.createElement('textarea'); document.body.appendChild(ta);
    renderCardMentionDropdown(dd, [cards.find(c => c.id === 'c0')], ta, 0, 0);
    return { pwn: window.__pwn || null, hostis: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /__pwn/.test(a.value))).length, imgOnerror: document.querySelectorAll('img[onerror]').length, cores: columns.map(c => c.color), ddHtml: dd.innerHTML.slice(0, 400), ddImg: dd.querySelectorAll('img').length, ddTxt: dd.innerText };
  });
  t('A. nenhum script rodou (window.__pwn vazio)', !r.pwn, r.pwn);
  t('B. nenhum elemento com atributo injetado (onmouseover/onerror com o payload) pelo board ou pelo dropdown @card:', r.hostis === 0 && r.imgOnerror === 0, r);
  t('C. cor hostil volta ao padrão; hex e var(--x) válidos continuam', r.cores[0] === '#38b6ff' && r.cores[1] === '#ff0000' && r.cores[2] === 'var(--accent)', r.cores);
  t('D. nome da coluna no dropdown de @card: aparece como TEXTO (escapado), sem <img>', r.ddImg === 0 && /Hostil/.test(r.ddTxt) && /</.test(r.ddTxt), r.ddHtml);
  t('E. sem erro de JS nem diálogo', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
