// 📅 Calendário do board: barras de período por semana (estilo Trello), hora do prazo e ✓ nas entregas (inclusive Fim ≠ Prazo).
// Maestro: servir a raiz em BASE_URL; node docs/arezzo/testes/test_calendario_periodo.js
// MAIN_HTML permite provar a falha na versão anterior sem trocar arquivos no disco.
// CAPTURE_DIR grava as 6 capturas (1280 e 390 px × dark, light, vice).
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright')
  ? '/opt/node22/lib/node_modules/playwright'
  : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath);
const fake = require('./fakefb');

function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const arm = fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-'));
  return path.join(chromeRoot, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const chrome = resolveChrome();
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
const captureDir = process.env.CAPTURE_DIR || '';
if (captureDir) fs.mkdirSync(captureDir, { recursive: true });

const user = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', providerData: [{ providerId: 'google.com' }] };

const seed = () => ({
  kanban: {
    usuarios: {
      ana: { uid: 'ana', nome: 'Ana Lima', email: 'ana@ciahering.com.br', init: 'AL', role: 'adm', inscrito: true, squads: { site: true } }
    },
    usuarios_publicos: {
      ana: { uid: 'ana', nome: 'Ana Lima', email: 'ana@ciahering.com.br', init: 'AL', role: 'adm', squads: { site: true } },
      bia: { uid: 'bia', nome: 'Bia Reis', email: 'bia@ciahering.com.br', init: 'BR', role: 'membro', squads: { site: true } },
      caio: { uid: 'caio', nome: 'Caio Souza', email: 'caio@ciahering.com.br', init: 'CS', role: 'po', squads: { site: true } }
    },
    config: { adm_emails: [user.email] },
    squads: {
      site: {
        dados: {
          columns: [
            { id: 'doing', name: 'Em andamento', color: '#38b6ff' },
            { id: 'review', name: 'Revisão', color: '#ff9f43' },
            { id: 'done', name: 'Concluído', color: '#2ecc9c', isDone: true }
          ],
          tags: [
            { id: 't_camp', label: 'Campanha', hex: '#ff5c8a' },
            { id: 't_crm', label: 'CRM', hex: '#14b8a6' },
            { id: 't_midia', label: 'Mídia', hex: '#ffd166' }
          ],
          subtimes: [
            { id: 'st_cria', name: 'Criação', members: ['AL', 'BR'] },
            { id: 'st_perf', name: 'Performance', members: ['CS'] }
          ],
          cards_index: { c_cross: 'k0', c_ov1: 'k1', c_ov2: 'k2', c_dia_hora: 'k3', c_dia_done: 'k4' },
          cards: {
            // Campanha no ar de Qui 12/11 a Qua 18/11 (2 semanas), com ENTREGA (due) antes, em Ter 10/11 às 16:00 (Fim != Prazo!)
            k0: {
              id: 'c_cross',
              title: 'Campanha Alto Verão',
              col: 'doing',
              inicio: '2026-11-12',
              fim: '2026-11-18',
              due: '2026-11-10',
              dueHora: '16:00',
              tags: ['t_camp', 't_crm'],
              owner: 'AL',
              participants: ['BR', 'CS'],
              priority: 'high',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // Sobrepõe c_cross nas semanas 2 e 3 (sem due separado -> só barra de período)
            k1: {
              id: 'c_ov1',
              title: 'Esquenta CRM VIP',
              col: 'review',
              inicio: '2026-11-10',
              fim: '2026-11-16',
              due: '',
              tags: ['t_crm'],
              owner: 'BR',
              priority: 'medium',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 3ª barra concorrente na semana 2, concluída, com tag amarela clara E prazo no dia 13/11 às 11:00
            k2: {
              id: 'c_ov2',
              title: 'Teaser Mídia Paga',
              col: 'done',
              inicio: '2026-11-11',
              fim: '2026-11-13',
              due: '2026-11-13',
              dueHora: '11:00',
              tags: ['t_midia'],
              owner: 'CS',
              priority: 'low',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // Entrega de 1 dia (sem período) em 12/11 às 14:30 (abaixo das 3 barras)
            k3: {
              id: 'c_dia_hora',
              title: 'Subir vitrine home',
              col: 'doing',
              due: '2026-11-12',
              dueHora: '14:30',
              tags: ['t_camp'],
              owner: 'AL',
              priority: 'high',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // Entrega de 1 dia concluída em 20/11 às 10:15
            k4: {
              id: 'c_dia_done',
              title: 'Relatório pós-live',
              col: 'done',
              due: '2026-11-20',
              dueHora: '10:15',
              tags: ['t_crm'],
              owner: 'CS',
              priority: 'medium',
              updatedAt: '2026-11-09T12:00:00.000Z'
            }
          }
        }
      }
    }
  }
});

const CONTRAST_SCAN_SELECTOR = (rootSel) => {
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; };
  const deepRaw = getComputedStyle(document.documentElement).getPropertyValue('--deep').trim();
  const rootBg = deepRaw.startsWith('#') ? hexRgb(deepRaw) : (parse(getComputedStyle(document.body).backgroundColor) || [3, 13, 26, 1]);
  function bgOf(el) {
    const chain = []; let n = el;
    while (n && n.nodeType === 1) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor); if (c && c[3] > 0) chain.push(c); if (c && c[3] >= .999) break; n = n.parentElement; }
    let acc = [rootBg[0], rootBg[1], rootBg[2], 1]; for (let i = chain.length - 1; i >= 0; i--) acc = over(chain[i], acc); return acc;
  }
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; let n = el; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; n = n.parentElement; } return true; };
  const calRoot = document.querySelector(rootSel);
  if (!calRoot) return { baixo: [{ el: 'missing:' + rootSel, r: 0 }], fixas: [] };
  const baixo = [];
  const walker = document.createTreeWalker(calRoot, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = walker.nextNode())) {
    const txt = tn.nodeValue.replace(/\s+/g, ' ').trim();
    if (txt.length < 2) continue;
    const el = tn.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
    if (el.closest('.other-month')) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el); const col = parse(cs.color); if (!col) continue;
    let op = 1, n = el; while (n && n.nodeType === 1) { op *= +getComputedStyle(n).opacity; n = n.parentElement; }
    const bg = bgOf(el);
    const fg = over([col[0], col[1], col[2], col[3] * op], bg);
    const r = ratio(fg, bg);
    const px = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
    const min = (px >= 24 || (px >= 18.6 && bold)) ? 3 : 4.5;
    if (r < min) baixo.push({ t: txt.slice(0, 40), cls: el.className, r: +r.toFixed(2), min });
  }
  const fixas = [];
  calRoot.querySelectorAll('.cal-periodo-bar[style], .cal-event-prazo[style], .cal-bar-av[style]').forEach(el => {
    if (!vis(el)) return;
    const st = el.getAttribute('style') || '';
    if (/(?:^|;)\s*(?:color|background(?:-color)?)\s*:\s*(#fff(?:fff)?\b|#000(?:000)?\b|white|black)/i.test(st)) {
      fixas.push({ cls: el.className, st });
    }
  });
  return { baixo, fixas };
};

let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? '✅' : '❌'} ${name}${pass ? '' : ' ' + JSON.stringify(detail)}`);
  if (!pass) failures++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [1280, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 });
      await fake.install(ctx, seed());
      if (process.env.MAIN_HTML) {
        await ctx.route('**/kanban-dev.html?*', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(process.env.MAIN_HTML, 'utf8') }));
      }
      const p = await ctx.newPage();
      p.setDefaultTimeout(10000);
      const errors = [];
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(base + '/kanban-dev.html?squad=site');
      await p.waitForFunction(() => !!window.__authCb);
      await p.evaluate(u => window.__authCb(u), user);
      await p.waitForTimeout(2200);
      await p.evaluate(() => {
        document.querySelectorAll('.ov.open').forEach(e => e.classList.remove('open'));
        openCal();
        calYear = 2026;
        calMonth = 10; // Novembro (0-indexed)
        renderCal();
      });
      await p.waitForTimeout(250);
      const label = width + 'px';

      // 1. Card com início+fim (12..18/11) E due separado (10/11 às 16:00):
      //    vira 2 barras semanais nos dias do período (sem repetir .cal-event-prazo em 12..18/11)
      //    E mantém a entrega .cal-event-prazo no dia do due (10/11 com 16:00)!
      const crossInfo = await p.evaluate(() => {
        const bars = [...document.querySelectorAll('#cal-grid .cal-periodo-bar[data-card-id="c_cross"]')];
        const prazosCross = [...document.querySelectorAll('#cal-grid .cal-event-prazo[data-card-id="c_cross"]')];
        const prazosOv1 = [...document.querySelectorAll('#cal-grid .cal-event-prazo[data-card-id="c_ov1"]')];
        const dueDay10 = document.querySelector('#cal-grid .cal-day[data-date="2026-11-10"] .cal-event-prazo[data-card-id="c_cross"]');
        const dueDay13Done = document.querySelector('#cal-grid .cal-day[data-date="2026-11-13"] .cal-event-prazo[data-card-id="c_ov2"]');
        return {
          count: bars.length,
          prazosCrossCount: prazosCross.length,
          prazosOv1Count: prazosOv1.length,
          due10Hora: dueDay10?.querySelector('.cal-prazo-hora')?.textContent.trim() || '',
          due10Ico: dueDay10?.querySelector('.cal-prazo-ico')?.textContent.trim() || '',
          due13Hora: dueDay13Done?.querySelector('.cal-prazo-hora')?.textContent.trim() || '',
          due13Ico: dueDay13Done?.querySelector('.cal-prazo-ico')?.textContent.trim() || '',
          segs: bars.map(b => ({
            col: b.style.gridColumn,
            contL: b.classList.contains('cont-l'),
            contR: b.classList.contains('cont-r'),
            bg: getComputedStyle(b).backgroundColor,
            avs: [...b.querySelectorAll('.cal-bar-av')].map(a => a.textContent.trim()),
            avAtRight: (() => {
              const br = b.getBoundingClientRect();
              const ar = b.querySelector('.cal-bar-avs')?.getBoundingClientRect();
              return ar ? (br.right - ar.right <= 12 && ar.left >= br.left) : false;
            })()
          }))
        };
      });
      check(
        label + ' card 12/11..18/11 vira 2 barras semanais (Qui..Sáb e Dom..Qua) sem repetir nos dias do período',
        crossInfo.count === 2 &&
          crossInfo.prazosOv1Count === 0 &&
          crossInfo.segs[0]?.col.replace(/\s+/g, '') === '5/8' &&
          crossInfo.segs[0]?.contR === true &&
          crossInfo.segs[0]?.contL === false &&
          crossInfo.segs[1]?.col.replace(/\s+/g, '') === '1/5' &&
          crossInfo.segs[1]?.contL === true &&
          crossInfo.segs[1]?.contR === false,
        crossInfo
      );
      check(
        label + ' Fim != Prazo: card com período + due mantém entrega no dia do due (10/11 às 16:00 e 13/11 ✓ às 11:00)',
        crossInfo.prazosCrossCount === 1 &&
          crossInfo.due10Ico === '📎' &&
          crossInfo.due10Hora === '16:00' &&
          crossInfo.due13Ico === '✓' &&
          crossInfo.due13Hora === '11:00',
        crossInfo
      );

      // 2. Cor da 1ª tag (#ff5c8a -> rgb(255, 92, 138)) e avatares do owner + participantes na ponta
      check(
        label + ' barra usa a cor da 1ª tag e traz avatares (AL, BR, CS) na ponta direita',
        crossInfo.segs.length === 2 &&
          crossInfo.segs.every(s => s.bg === 'rgb(255, 92, 138)' && s.avAtRight && JSON.stringify(s.avs) === JSON.stringify(['AL', 'BR', 'CS'])),
        crossInfo.segs
      );

      // 3. Empilhamento sem sobreposição (3 barras concorrentes na semana 2 + entregas nos dias 10, 12 e 13 + números dos dias)
      const overlapCheck = await p.evaluate(() => {
        const weeks = [...document.querySelectorAll('#cal-grid .cal-week')];
        const overlaps = [];
        const inter = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
        weeks.forEach((w, wi) => {
          const bars = [...w.querySelectorAll('.cal-periodo-bar')].map(el => ({ kind: 'bar:' + el.dataset.cardId, r: el.getBoundingClientRect() }));
          const nums = [...w.querySelectorAll('.cal-day-num')].map(el => ({ kind: 'num:' + el.textContent.trim(), r: el.getBoundingClientRect() }));
          const evs = [...w.querySelectorAll('.cal-event')].map(el => ({ kind: 'ev:' + el.textContent.trim().slice(0, 15), r: el.getBoundingClientRect() }));
          for (let i = 0; i < bars.length; i++) {
            for (let j = i + 1; j < bars.length; j++) {
              if (inter(bars[i].r, bars[j].r)) overlaps.push([wi, bars[i].kind, bars[j].kind]);
            }
            for (const n of nums) if (inter(bars[i].r, n.r)) overlaps.push([wi, bars[i].kind, n.kind]);
            for (const e of evs) if (inter(bars[i].r, e.r)) overlaps.push([wi, bars[i].kind, e.kind]);
          }
        });
        const w2Bars = [...(weeks[1]?.querySelectorAll('.cal-periodo-bar') || [])];
        return { week2BarCount: w2Bars.length, overlaps };
      });
      check(
        label + ' 3 barras concorrentes na mesma semana empilham sem sobrepor números nem entregas do dia',
        overlapCheck.week2BarCount === 3 && overlapCheck.overlaps.length === 0,
        overlapCheck
      );

      // 4. Entrega de 1 dia (sem período) continua no dia, com hora quando houver e ✓ se concluída
      const oneDayCheck = await p.evaluate(() => {
        const d12 = document.querySelector('#cal-grid .cal-day[data-date="2026-11-12"]');
        const d20 = document.querySelector('#cal-grid .cal-day[data-date="2026-11-20"]');
        const p12 = d12?.querySelector('.cal-event-prazo[data-card-id="c_dia_hora"]');
        const p20 = d20?.querySelector('.cal-event-prazo[data-card-id="c_dia_done"]');
        const barDone = document.querySelector('#cal-grid .cal-periodo-bar[data-card-id="c_ov2"]');
        return {
          p12Txt: p12?.textContent.trim() || '',
          p12Hora: p12?.querySelector('.cal-prazo-hora')?.textContent.trim() || '',
          p12Ico: p12?.querySelector('.cal-prazo-ico')?.textContent.trim() || '',
          p20Txt: p20?.textContent.trim() || '',
          p20Hora: p20?.querySelector('.cal-prazo-hora')?.textContent.trim() || '',
          p20Ico: p20?.querySelector('.cal-prazo-ico')?.textContent.trim() || '',
          barDoneChk: barDone?.querySelector('.cal-bar-chk')?.textContent.trim() || ''
        };
      });
      check(
        label + ' entrega de 1 dia permanece no dia com hora (14:30 / 10:15) e ✓ quando concluída',
        oneDayCheck.p12Txt.includes('Subir vitrine home') &&
          oneDayCheck.p12Hora === '14:30' &&
          oneDayCheck.p12Ico === '📎' &&
          oneDayCheck.p20Txt.includes('Relatório pós-live') &&
          oneDayCheck.p20Hora === '10:15' &&
          oneDayCheck.p20Ico === '✓' &&
          oneDayCheck.barDoneChk === '✓',
        oneDayCheck
      );

      // 5. 3 temas (dark, light, vice): contraste >= 4.5:1, sem rolagem lateral e capturas
      for (const theme of ['', 'light', 'vice']) {
        const themeName = theme || 'dark';
        await p.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
        await p.waitForTimeout(300);
        const layout = await p.evaluate(CONTRAST_SCAN_SELECTOR, '#cal-ov .cal-panel');
        const scroll = await p.evaluate(() => {
          const doc = document.documentElement.scrollWidth - window.innerWidth;
          const panel = document.querySelector('#cal-ov .cal-panel');
          const grid = document.getElementById('cal-grid');
          return {
            doc,
            panel: panel ? panel.scrollWidth - panel.clientWidth : 999,
            grid: grid ? grid.scrollWidth - grid.clientWidth : 999
          };
        });
        check(
          `${label}/${themeName} sem rolagem lateral`,
          scroll.doc <= 1 && scroll.panel <= 1 && scroll.grid <= 1,
          scroll
        );
        check(
          `${label}/${themeName} contraste legível (>=4.5) e sem cor fixa inline`,
          layout.baixo.length === 0 && layout.fixas.length === 0,
          layout
        );
        if (captureDir) {
          await p.screenshot({ path: path.join(captureDir, `cal_${width}_${themeName}.png`) });
        }
      }
      await p.evaluate(() => { document.documentElement.dataset.theme = ''; });

      // 6. Popover do dia (openCalDayPopover): barra de período tem background da 1ª tag, role="button", tabindex="0", contraste legível no claro e Enter abre o card
      await p.evaluate(() => {
        document.documentElement.dataset.theme = 'light';
        document.querySelector('#cal-grid .cal-day[data-date="2026-11-12"]').click();
      });
      await p.waitForTimeout(300);
      const popCheck = await p.evaluate((scanFnSrc) => {
        const scan = eval('(' + scanFnSrc + ')');
        const bar = document.querySelector('#cal-day-pop-body .cal-periodo-bar[data-card-id="c_cross"]');
        const contrast = scan('#cal-day-pop-ov');
        return {
          open: document.getElementById('cal-day-pop-ov').classList.contains('open'),
          bg: bar ? getComputedStyle(bar).backgroundColor : '',
          role: bar?.getAttribute('role') || '',
          tabIndex: bar?.getAttribute('tabindex') || '',
          baixo: contrast.baixo
        };
      }, CONTRAST_SCAN_SELECTOR.toString());
      check(
        label + ' popover do dia exibe barra de período com fundo da tag, role=button, tabindex=0 e contraste no claro',
        popCheck.open &&
          popCheck.bg === 'rgb(255, 92, 138)' &&
          popCheck.role === 'button' &&
          popCheck.tabIndex === '0' &&
          popCheck.baixo.length === 0,
        popCheck
      );
      await p.locator('#cal-day-pop-body .cal-periodo-bar[data-card-id="c_cross"]').focus();
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.getElementById('card-ov').classList.contains('open'));
      const popOpenedTitle = await p.evaluate(() => document.getElementById('m-title').value);
      check(label + ' Enter na barra de período do popover abre o card', popOpenedTitle === 'Campanha Alto Verão', popOpenedTitle);
      await p.evaluate(() => {
        document.documentElement.dataset.theme = '';
        closeOv('card-ov');
        openCal();
        calYear = 2026;
        calMonth = 10;
        renderCal();
      });

      // 7. Clique direto na barra do calendário abre o card correspondente
      await p.locator('#cal-grid .cal-periodo-bar[data-card-id="c_cross"]').first().click();
      await p.waitForFunction(() => document.getElementById('card-ov').classList.contains('open'));
      const openedTitle = await p.evaluate(() => document.getElementById('m-title').value);
      check(label + ' clicar na barra de período abre o modal do card', openedTitle === 'Campanha Alto Verão', openedTitle);
      await p.evaluate(() => {
        closeOv('card-ov');
        openCal();
        calYear = 2026;
        calMonth = 10;
        renderCal();
      });

      // 8. Filtros do board + filtros do calendário valem para barras e entregas (inclusive due de card com período)
      const filterRes = await p.evaluate(() => {
        // Filtro do BOARD por prioridade 'high' -> c_cross (2 segmentos + 1 prazo no dia 10) e c_dia_hora (1 prazo no dia 12)
        activeFilters.priority = 'high';
        renderBoard();
        const highBars = [...document.querySelectorAll('#cal-grid .cal-periodo-bar')].map(e => e.dataset.cardId);
        const highPrazos = [...document.querySelectorAll('#cal-grid .cal-event-prazo')].map(e => e.dataset.cardId).sort();

        // Filtro do BOARD por texto 'Teaser' -> só c_ov2 (1 barra + 1 prazo no dia 13)
        activeFilters.priority = '';
        activeFilters.texto = 'Teaser';
        renderBoard();
        const txtBars = [...document.querySelectorAll('#cal-grid .cal-periodo-bar')].map(e => e.dataset.cardId);
        const txtPrazos = [...document.querySelectorAll('#cal-grid .cal-event-prazo')].map(e => e.dataset.cardId);
        activeFilters.texto = '';
        renderBoard();

        // Filtro próprio do CALENDÁRIO por subtime Performance (CS) -> c_cross (CS participante), c_ov2 (CS owner), c_dia_done (CS owner)
        const subSel = document.getElementById('cal-f-subteam');
        subSel.value = 'st_perf';
        renderCal();
        const subBars = [...new Set([...document.querySelectorAll('#cal-grid .cal-periodo-bar')].map(e => e.dataset.cardId))].sort();
        const subPrazos = [...document.querySelectorAll('#cal-grid .cal-event-prazo')].map(e => e.dataset.cardId).sort();
        subSel.value = '';
        renderCal();

        return { highBars, highPrazos, txtBars, txtPrazos, subBars, subPrazos };
      });
      check(
        label + ' filtros do board (prioridade, busca) e filtros do calendário valem',
        JSON.stringify(filterRes.highBars) === JSON.stringify(['c_cross', 'c_cross']) &&
          JSON.stringify(filterRes.highPrazos) === JSON.stringify(['c_cross', 'c_dia_hora']) &&
          JSON.stringify(filterRes.txtBars) === JSON.stringify(['c_ov2']) &&
          JSON.stringify(filterRes.txtPrazos) === JSON.stringify(['c_ov2']) &&
          JSON.stringify(filterRes.subBars) === JSON.stringify(['c_cross', 'c_ov2']) &&
          JSON.stringify(filterRes.subPrazos) === JSON.stringify(['c_cross', 'c_dia_done', 'c_ov2']),
        filterRes
      );

      // 9. Sanitização contra XSS em título, hora, owner e cor de tag
      const xssSafe = await p.evaluate(() => {
        tags.push({ id: 't_xss', label: 'XSS', hex: 'red;background:url(javascript:alert(1))' });
        cards.push({
          id: 'c_xss',
          title: '<img src=x onerror=window.__xss=1>',
          col: 'doing',
          inicio: '2026-11-03',
          fim: '2026-11-05',
          tags: ['t_xss'],
          owner: '<svg onload=window.__xss=2>',
          dueHora: '<b onmouseover=window.__xss=3>12:00</b>'
        });
        cards.push({
          id: 'c_xss_dia',
          title: '<svg onload=window.__xss=4>',
          col: 'doing',
          due: '2026-11-06',
          dueHora: '<img src=x onerror=window.__xss=5>'
        });
        renderCal();
        document.querySelector('#cal-grid .cal-day[data-date="2026-11-04"]').click();
        const hasHandler = !!document.querySelector('#cal-grid [onerror], #cal-grid [onload], #cal-grid [onmouseover], #cal-day-pop-ov [onerror], #cal-day-pop-ov [onload], #cal-day-pop-ov [onmouseover]');
        closeOv('cal-day-pop-ov');
        return !window.__xss && !hasHandler;
      });
      check(label + ' campos vindos do banco entram sem HTML/CSS executável no calendário e no popover', xssSafe);

      check(label + ' sem erro de JavaScript', errors.length === 0, errors);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`${failures} falha(s)`);
  process.exitCode = failures ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
