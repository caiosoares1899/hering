// 📊 Visão Gantt do board: régua de 6 semanas, barras Início → Fim (1ª tag), marcos ◆ de Prazo + hora, agrupamento e filtros.
// Maestro: servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_board.js
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

// Datas relativas ao domingo da semana passada (mesma âncora da régua de 6 semanas)
function computeWindowDates() {
  const now = new Date();
  const baseStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  baseStart.setDate(baseStart.getDate() - baseStart.getDay() - 7);
  const isoAt = n => {
    const d = new Date(baseStart.getTime());
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const todayIdx = 7 + now.getDay(); // sempre na 2ª semana (7..13)
  return { isoAt, todayIdx, todayIso: isoAt(todayIdx), winStartIso: isoAt(0), winEndIso: isoAt(41) };
}

const W = computeWindowDates();
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
          cards_index: {
            c_camp_both: 'k0',
            c_clip_left: 'k1',
            c_clip_right: 'k2',
            c_done_both: 'k3',
            c_only_due: 'k4',
            c_sem_tag: 'k5',
            c_sem_datas_1: 'k6',
            c_sem_datas_2: 'k7'
          },
          cards: {
            // 1. Período (col 10..19) + Prazo antes do início (col 7 às 16:00) — Fim ≠ Prazo!
            k0: {
              id: 'c_camp_both',
              title: 'Campanha Alto Verão',
              col: 'doing',
              inicio: W.isoAt(9),
              fim: W.isoAt(18),
              due: W.isoAt(6),
              dueHora: '16:00',
              tags: ['t_camp', 't_crm'],
              owner: 'AL',
              participants: ['BR', 'CS'],
              priority: 'high',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 2. Começa antes da janela de 6 semanas -> canto reto esquerdo + ◂ (col 1..5)
            k1: {
              id: 'c_clip_left',
              title: 'Coleção Cápsula Linho',
              col: 'doing',
              inicio: W.isoAt(-5),
              fim: W.isoAt(4),
              due: '',
              tags: ['t_camp'],
              owner: 'BR',
              priority: 'medium',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 3. Passa do fim da janela de 6 semanas -> canto reto direito + ▸ (col 37..42)
            k2: {
              id: 'c_clip_right',
              title: 'Liquida Fim de Estação',
              col: 'review',
              inicio: W.isoAt(36),
              fim: W.isoAt(50),
              due: '',
              tags: ['t_crm'],
              owner: 'AL',
              priority: 'medium',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 4. Concluído com tag amarela clara (#ffd166 -> ink-dark) + Prazo dentro do período (col 14 às 11:00)
            k3: {
              id: 'c_done_both',
              title: 'Teaser Mídia Paga',
              col: 'done',
              inicio: W.isoAt(11),
              fim: W.isoAt(15),
              due: W.isoAt(13),
              dueHora: '11:00',
              tags: ['t_midia'],
              owner: 'CS',
              priority: 'low',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 5. Só Prazo (sem período) + título longo -> apenas o marco ◆ 14:30 no dia (col 13)
            k4: {
              id: 'c_only_due',
              title: 'Subir vitrine home principal com banners rotativos da campanha nacional',
              col: 'doing',
              inicio: '',
              fim: '',
              due: W.isoAt(12),
              dueHora: '14:30',
              tags: ['t_crm'],
              owner: 'AL',
              priority: 'high',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 6. Card sem tag -> barra neutra (.sem-tag) e grupo "Sem tag" por último
            k5: {
              id: 'c_sem_tag',
              title: 'Ajuste Banner Institucional',
              col: 'doing',
              inicio: W.isoAt(14),
              fim: W.isoAt(20),
              due: '',
              tags: [],
              owner: 'BR',
              priority: 'low',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            // 7 e 8. Sem período e sem due -> fora das linhas, contados no rodapé ("2 cards sem datas não aparecem")
            k6: {
              id: 'c_sem_datas_1',
              title: 'Ideia de backlog 1',
              col: 'doing',
              inicio: '',
              fim: '',
              due: '',
              tags: ['t_camp'],
              owner: 'AL',
              updatedAt: '2026-11-09T12:00:00.000Z'
            },
            k7: {
              id: 'c_sem_datas_2',
              title: 'Ideia com início incompleto',
              col: 'doing',
              inicio: W.isoAt(10),
              fim: '',
              due: '',
              tags: ['t_crm'],
              owner: 'BR',
              updatedAt: '2026-11-09T12:00:00.000Z'
            }
          }
        }
      }
    }
  }
});

const CONTRAST_SCAN_SELECTOR = rootSel => {
  const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
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
  const root = document.querySelector(rootSel);
  if (!root) return { baixo: [{ el: 'missing:' + rootSel, r: 0 }], fixas: [] };
  const baixo = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = walker.nextNode())) {
    const txt = tn.nodeValue.replace(/\s+/g, ' ').trim();
    if (txt.length < 1) continue;
    const el = tn.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
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
  root.querySelectorAll('[style]').forEach(el => {
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
      const isTouch = width === 390;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: isTouch, isMobile: isTouch });
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
      });
      const label = width + 'px';

      // 1. Botão #btn-gantt na toolbar + exclusividade mútua Kanban ↔ Gantt ↔ Timeline
      const toggleRes = await p.evaluate(() => {
        const btnGt = document.getElementById('btn-gantt');
        const btnTl = document.getElementById('btn-timeline');
        if (!btnGt || !btnTl) return { exists: false };

        // Kanban -> Gantt
        btnGt.click();
        const s1 = {
          view: boardView,
          gtOn: btnGt.classList.contains('tb-view-on') && btnGt.getAttribute('aria-pressed') === 'true',
          tlOff: !btnTl.classList.contains('tb-view-on') && btnTl.getAttribute('aria-pressed') === 'false',
          ganttDisp: getComputedStyle(document.getElementById('gantt-view')).display,
          tlDisp: getComputedStyle(document.getElementById('timeline-view')).display,
          boardHidden: document.getElementById('board').classList.contains('board-hidden')
        };

        // Gantt -> Timeline (exclusivos!)
        btnTl.click();
        const s2 = {
          view: boardView,
          tlOn: btnTl.classList.contains('tb-view-on') && btnTl.getAttribute('aria-pressed') === 'true',
          gtOff: !btnGt.classList.contains('tb-view-on') && btnGt.getAttribute('aria-pressed') === 'false',
          ganttDisp: getComputedStyle(document.getElementById('gantt-view')).display,
          tlDisp: getComputedStyle(document.getElementById('timeline-view')).display
        };

        // Timeline -> Gantt
        btnGt.click();
        const s3 = {
          view: boardView,
          gtOn: btnGt.classList.contains('tb-view-on') && btnGt.getAttribute('aria-pressed') === 'true',
          tlOff: !btnTl.classList.contains('tb-view-on') && btnTl.getAttribute('aria-pressed') === 'false'
        };

        // Gantt -> Kanban -> Gantt
        btnGt.click();
        const s4 = {
          view: boardView,
          bothOff: !btnGt.classList.contains('tb-view-on') && !btnTl.classList.contains('tb-view-on'),
          ganttDisp: getComputedStyle(document.getElementById('gantt-view')).display,
          boardHidden: document.getElementById('board').classList.contains('board-hidden')
        };
        btnGt.click();

        return { exists: true, tbId: btnGt.dataset.tbId, s1, s2, s3, s4 };
      });
      check(
        label + ' botão 📊 Gantt alterna Kanban ↔ Gantt ↔ Timeline com exclusividade mútua',
        toggleRes.exists &&
          toggleRes.tbId === 'gantt' &&
          toggleRes.s1.view === 'gantt' && toggleRes.s1.gtOn && toggleRes.s1.tlOff && toggleRes.s1.ganttDisp === 'flex' && toggleRes.s1.tlDisp === 'none' && toggleRes.s1.boardHidden &&
          toggleRes.s2.view === 'timeline' && toggleRes.s2.tlOn && toggleRes.s2.gtOff && toggleRes.s2.ganttDisp === 'none' && toggleRes.s2.tlDisp === 'flex' &&
          toggleRes.s3.view === 'gantt' && toggleRes.s3.gtOn && toggleRes.s3.tlOff &&
          toggleRes.s4.view === 'kanban' && toggleRes.s4.bothOff && toggleRes.s4.ganttDisp === 'none' && !toggleRes.s4.boardHidden,
        toggleRes
      );

      if (!toggleRes.exists) {
        await ctx.close();
        continue;
      }

      // 2. Régua de 6 semanas (42 dias), fins de semana, linha de hoje, barras, cantos ◂/▸, marcos ◆ + hora e rodapé sem datas
      const ganttInfo = await p.evaluate(() => {
        const dayEls = [...document.querySelectorAll('#gantt-view .gantt-day-hd')];
        const wkndCols = dayEls.filter(e => e.classList.contains('is-wknd')).map(e => +e.dataset.col);
        const todayHd = document.querySelector('#gantt-view .gantt-day-hd.is-today');
        const todayLine = document.querySelector('#gantt-view .gantt-today-line');
        const hdRect = todayHd?.getBoundingClientRect();
        const lineRect = todayLine?.getBoundingClientRect();
        const todayAligned = !!(hdRect && lineRect && lineRect.left >= hdRect.left - 1 && lineRect.right <= hdRect.right + 1);

        // c_camp_both: barra 10..19 + marco ◆ 16:00 na col 7 (Fim ≠ Prazo)
        const rowBoth = document.querySelector('#gantt-view .gantt-row[data-id="c_camp_both"]');
        const barBoth = rowBoth?.querySelector('.gantt-bar');
        const marcoBoth = rowBoth?.querySelector('.gantt-marco');
        const d10 = dayEls[9]?.getBoundingClientRect();
        const d19 = dayEls[18]?.getBoundingClientRect();
        const d7 = dayEls[6]?.getBoundingClientRect();
        const barR = barBoth?.getBoundingClientRect();
        const marcoR = marcoBoth?.getBoundingClientRect();

        // c_done_both: barra 12..16 + marco ◆ 11:00 na col 14 (dentro do período, sem sobrepor!)
        const rowDone = document.querySelector('#gantt-view .gantt-row[data-id="c_done_both"]');
        const barDone = rowDone?.querySelector('.gantt-bar');
        const marcoDone = rowDone?.querySelector('.gantt-marco');
        const bdR = barDone?.getBoundingClientRect();
        const mdR = marcoDone?.getBoundingClientRect();
        const doneNoOverlap = !!(bdR && mdR && (bdR.bottom <= mdR.top + 0.5 || mdR.bottom <= bdR.top + 0.5));

        // c_clip_left & c_clip_right
        const barClipL = document.querySelector('#gantt-view .gantt-bar[data-card-id="c_clip_left"]');
        const barClipR = document.querySelector('#gantt-view .gantt-bar[data-card-id="c_clip_right"]');

        // c_only_due: card SÓ com prazo NÃO entra no Gantt (13/11, decisão do Caio: o Gantt é das campanhas com período)
        const rowDueOnly = document.querySelector('#gantt-view .gantt-row[data-id="c_only_due"]');
        const barDueOnly = rowDueOnly?.querySelector('.gantt-bar');
        const marcoDueOnly = rowDueOnly?.querySelector('.gantt-marco');
        const titleEl = rowDueOnly?.querySelector('.gantt-marco-nome'); // 12/11: card só com prazo leva o nome no marco ◆

        // c_sem_tag: barra neutra .sem-tag
        const barSemTag = document.querySelector('#gantt-view .gantt-bar[data-card-id="c_sem_tag"]');

        // Rodapé sem datas + ausência das linhas sem datas
        const semDatasTxt = document.querySelector('#gantt-view .gantt-sem-datas')?.textContent.trim() || '';
        const hasSemDatasRow = !!document.querySelector('#gantt-view .gantt-row[data-id^="c_sem_datas"]');

        return {
          daysLen: dayEls.length,
          firstIso: dayEls[0]?.dataset.date,
          lastIso: dayEls[41]?.dataset.date,
          wkndCount: wkndCols.length,
          todayIso: todayHd?.dataset.date,
          todayAligned,
          barCols: [+(barBoth?.dataset.startCol || 0), +(barBoth?.dataset.endCol || 0)],
          barAligned: !!(barR && d10 && d19 && Math.abs(barR.left - d10.left) <= 6 && Math.abs(barR.right - d19.right) <= 6),
          barBg: barBoth ? getComputedStyle(barBoth).backgroundColor : '',
          barTag: barBoth ? barBoth.style.getPropertyValue('--gantt-tag').trim() : '',
          barTitulo: (cards.find(c => c.id === 'c_camp_both') || {}).title || '',
          colDatas: rowBoth?.querySelector('.gantt-row-title')?.textContent.trim() || '',
          barTxt: barBoth?.querySelector('.gantt-bar-txt')?.textContent.trim() || '',
          barAvs: barBoth ? [...barBoth.querySelectorAll('.cal-bar-av')].map(e => e.textContent.trim()) : [],
          marcoCol: +(marcoBoth?.dataset.dueCol || 0),
          marcoAligned: !!(marcoR && d7 && marcoR.left >= d7.left - 2 && marcoR.left <= d7.right),
          marcoTxt: marcoBoth?.textContent.trim() || '',
          doneChkBar: barDone?.querySelector('.cal-bar-chk')?.textContent.trim() || '',
          doneInkDark: (barDone?.classList.contains('tinted') && getComputedStyle(barDone).color === getComputedStyle(document.querySelector('.gantt-row-title')).color) || false, // 12/11: barra em vidro tingido, texto na cor do tema
          doneNoOverlap,
          clipL: !!(barClipL?.classList.contains('clip-l') && barClipL.textContent.includes('◂') && getComputedStyle(barClipL).borderTopLeftRadius === '0px'),
          clipR: !!(barClipR?.classList.contains('clip-r') && barClipR.textContent.includes('▸') && getComputedStyle(barClipR).borderTopRightRadius === '0px'),
          dueOnlyNoBar: !rowDueOnly && !barDueOnly && !marcoDueOnly,
          titleEllipsis: !titleEl,
          semTagNeutral: !!(barSemTag?.classList.contains('sem-tag') && !/background/.test(barSemTag.getAttribute('style') || '')),
          semDatasTxt,
          hasSemDatasRow
        };
      });

      check(
        label + ' régua de 6 semanas (42 dias do domingo passado, 12 fins de semana e linha vertical de hoje alinhada)',
        ganttInfo.daysLen === 42 &&
          ganttInfo.firstIso === W.winStartIso &&
          ganttInfo.lastIso === W.winEndIso &&
          ganttInfo.wkndCount === 12 &&
          ganttInfo.todayIso === W.todayIso &&
          ganttInfo.todayAligned,
        ganttInfo
      );
      check(
        label + ' barra Início→Fim na cor da 1ª tag com avatares + marco ◆ com dueHora (inclusive Fim ≠ Prazo, sem sobrepor)',
        JSON.stringify(ganttInfo.barCols) === JSON.stringify([10, 19]) &&
          ganttInfo.barAligned &&
          ganttInfo.barBg === 'rgba(255, 92, 138, 0.24)' && ganttInfo.barTag === '#ff5c8a' && ganttInfo.barTxt === ganttInfo.barTitulo && /^\d{2}\/\d{2} → \d{2}\/\d{2}$/.test(ganttInfo.colDatas) &&
          JSON.stringify(ganttInfo.barAvs) === JSON.stringify(['AL', 'BR', 'CS']) &&
          ganttInfo.marcoCol === 7 &&
          ganttInfo.marcoAligned &&
          ganttInfo.marcoTxt.includes('◆') &&
          ganttInfo.marcoTxt.includes('16:00') &&
          ganttInfo.doneChkBar === '✓' &&
          ganttInfo.doneInkDark &&
          ganttInfo.doneNoOverlap,
        ganttInfo
      );
      check(
        label + ' barras que passam da janela têm canto reto + ◂/▸, card só com prazo fica de fora, sem tag é neutro e rodapé conta cards sem período',
        ganttInfo.clipL &&
          ganttInfo.clipR &&
          ganttInfo.dueOnlyNoBar &&
          ganttInfo.titleEllipsis &&
          ganttInfo.semTagNeutral &&
          ganttInfo.semDatasTxt === '3 cards sem período (Início e Fim) não aparecem — prazos ficam no 📅 Calendário e na 🛤️ Timeline' &&
          !ganttInfo.hasSemDatasRow,
        ganttInfo
      );

      // 3. Agrupamento pela 1ª tag ("Sem tag" por último), ordenação intra-grupo e navegação ◀ / Hoje / ▶ + estado vazio
      const grpNav = await p.evaluate(() => {
        const groups = [...document.querySelectorAll('#gantt-view .gantt-grp-hd')].map(e => e.dataset.tagGroup);
        const rows = [...document.querySelectorAll('#gantt-view .gantt-row')].map(e => e.dataset.id);

        ganttNav(28);
        const nextStart = document.querySelector('#gantt-view .gantt-day-hd')?.dataset.date;
        const clipRAfterNext = document.querySelector('#gantt-view .gantt-bar[data-card-id="c_clip_right"]');
        const unclippedOnNext = !!(clipRAfterNext && !clipRAfterNext.classList.contains('clip-r'));

        // Navega 4 janelas para trás (-112 dias) onde não há cards -> estado vazio
        ganttNav(-28 * 5);
        const emptyTxt = document.querySelector('#gantt-view .gantt-empty')?.textContent.trim() || '';

        ganttNav(0);
        const resetStart = document.querySelector('#gantt-view .gantt-day-hd')?.dataset.date;
        return { groups, rows, nextStart, unclippedOnNext, emptyTxt, resetStart };
      });
      check(
        label + ' agrupamento pela 1ª tag ("Sem tag" por último) e ordenação por início||due',
        JSON.stringify(grpNav.groups) === JSON.stringify(['t_camp', 't_crm', 't_midia', '__sem_tag__']) &&
          JSON.stringify(grpNav.rows) === JSON.stringify(['c_clip_left', 'c_camp_both', 'c_clip_right', 'c_done_both', 'c_sem_tag']),
        grpNav
      );
      check(
        label + ' botões ◀ / Hoje / ▶ deslocam 4 semanas (±28 dias) e janela sem cards exibe estado vazio',
        grpNav.nextStart === W.isoAt(28) &&
          grpNav.unclippedOnNext &&
          grpNav.emptyTxt === 'Nenhum card com período nestas 6 semanas — preencha Início e Fim no card (card só com prazo fica no 📅 Calendário e na 🛤️ Timeline)' &&
          grpNav.resetStart === W.winStartIso,
        grpNav
      );

      // 4. 3 temas (dark, light, vice): contraste >= 4.5:1, sem rolagem lateral na página, rolagem interna no 390px, sticky e toque >=44px
      for (const theme of ['', 'light', 'vice']) {
        const themeName = theme || 'dark';
        await p.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
        await p.waitForTimeout(300);
        const layout = await p.evaluate(CONTRAST_SCAN_SELECTOR, '#gantt-view');
        const geom = await p.evaluate(() => {
          const docOverflow = document.documentElement.scrollWidth - window.innerWidth;
          const sc = document.getElementById('gantt-scroll');
          const internalScrollable = sc ? sc.scrollWidth > sc.clientWidth : false;
          let stickyHolds = true;
          if (sc && sc.scrollWidth > sc.clientWidth + 40) {
            const stickyEl = sc.querySelector('.gantt-row .gantt-col-sticky');
            const beforeLeft = stickyEl.getBoundingClientRect().left;
            sc.scrollLeft = 180;
            const afterLeft = stickyEl.getBoundingClientRect().left;
            stickyHolds = Math.abs(afterLeft - beforeLeft) <= 1.5;
            sc.scrollLeft = 0;
          }
          const rowH = document.querySelector('#gantt-view .gantt-row')?.getBoundingClientRect().height || 0;
          const navR = document.querySelector('#gantt-view .gantt-nav-btn')?.getBoundingClientRect();
          return { docOverflow, internalScrollable, stickyHolds, rowH, navH: navR?.height || 0, navW: navR?.width || 0 };
        });
        check(
          `${label}/${themeName} sem rolagem lateral na página e coluna de título sticky funciona`,
          geom.docOverflow <= 1 && geom.stickyHolds && (!isTouch || (geom.internalScrollable && geom.rowH >= 44 && geom.navH >= 44 && geom.navW >= 44)),
          geom
        );
        check(
          `${label}/${themeName} contraste legível (>=4.5) e sem cor fixa inline`,
          layout.baixo.length === 0 && layout.fixas.length === 0,
          layout
        );
        if (captureDir) {
          await p.screenshot({ path: path.join(captureDir, `gantt_${width}_${themeName}.png`) });
        }
      }
      await p.evaluate(() => { document.documentElement.dataset.theme = ''; });

      // 5. Somente leitura: clique abre o card real; Enter e Espaço na linha/barra abrem o card; sem draggable
      await p.locator('#gantt-view .gantt-bar[data-card-id="c_camp_both"]').click();
      if(width<769) await p.getByRole('button',{name:'Abrir card',exact:true}).click();
      await p.waitForFunction(() => document.getElementById('card-ov')?.classList.contains('open'));
      const openedTitle = await p.evaluate(() => document.getElementById('m-title').value);
      check(label + ' clicar na barra do Gantt abre o modal do card', openedTitle === 'Campanha Alto Verão', openedTitle);
      await p.evaluate(() => closeOv('card-ov'));
      // O fechamento anima e devolve o foco: esperar terminar, senão o Enter cai em outro elemento (teste instável).
      await p.waitForFunction(() => !document.getElementById('card-ov')?.classList.contains('open'));
      await p.waitForTimeout(400);

      // Espião para testar Enter e Espaço sem travar no _checkCardLock do fakefb
      await p.evaluate(() => {
        window.__openCardReal = window.openCard;
        window.__openedIds = [];
        window.openCard = id => { window.__openedIds.push(id); };
      });
      await p.locator('#gantt-view .gantt-row[data-id="c_camp_both"]').focus();
      await p.keyboard.press('Enter');
      await p.locator('#gantt-view .gantt-bar[data-card-id="c_sem_tag"]').focus();
      await p.keyboard.press(' ');
      const kbdRes = await p.evaluate(() => {
        const ids = window.__openedIds.slice();
        window.openCard = window.__openCardReal;
        const anyDraggable = !!document.querySelector('#gantt-view [draggable="true"]');
        return { ids, anyDraggable };
      });
      check(
        label + ' Enter na linha e Espaço na barra abrem o card (somente leitura, sem drag)',
        JSON.stringify(kbdRes.ids) === JSON.stringify(['c_camp_both', 'c_sem_tag']) && !kbdRes.anyDraggable,
        kbdRes
      );

      // 6. Filtros do board (inclusive com raiaMode ligado de antes!), 💡 Meus cards, HELP_CONTENT, 120 cards e XSS
      const winIsos = Array.from({ length: 42 }, (_, k) => W.isoAt(k));
      const extraChecks = await p.evaluate(isos => {
        // Com raiaMode='owner' ligado de antes, filtro de owner='CS' DEVE continuar valendo no Gantt (boardView==='kanban')
        raiaMode = 'owner';
        activeFilters.owner = 'CS';
        renderBoard();
        const csRows = [...document.querySelectorAll('#gantt-view .gantt-row')].map(e => e.dataset.id).sort();
        activeFilters.owner = '';
        raiaMode = '';

        activeFilters.priority = 'high';
        renderBoard();
        const highRows = [...document.querySelectorAll('#gantt-view .gantt-row')].map(e => e.dataset.id).sort();
        activeFilters.priority = '';
        renderBoard();

        // 💡 Meus cards (Ana = AL -> c_camp_both, c_clip_right, c_only_due)
        highlightMyCards();
        const pulsed = [...document.querySelectorAll('#gantt-view .gantt-row.card-pulse-highlight')].map(e => e.dataset.id).sort();

        // HELP_CONTENT: tópico "Gantt" e menção em "Timeline"
        const boardHelp = HELP_CONTENT?.board || [];
        const ganttHelp = boardHelp.find(h => h.title === 'Gantt' && h.icon === '📊');
        const tlHelp = boardHelp.find(h => h.title === 'Timeline');
        const helpOk = !!(ganttHelp && ganttHelp.text.includes('6 semanas') && tlHelp && tlHelp.text.includes('📊 Gantt'));

        // Performance com 120+ cards + sanitização XSS
        const snapshotLen = cards.length;
        tags.push({ id: 't_xss', label: '<img src=x onerror=window.__xss=1>', hex: 'red;background:url(javascript:alert(1))' });
        for (let i = 0; i < 120; i++) {
          cards.push({
            id: 'c_perf_' + i,
            title: i === 0 ? '<svg onload=window.__xss=2>Campanha XSS' : ('Card volume #' + i),
            col: i % 3 === 0 ? 'done' : 'doing',
            inicio: isos[i % 30],
            fim: isos[(i % 30) + 5],
            due: i % 2 === 0 ? isos[(i % 35) + 2] : '',
            dueHora: i === 0 ? '<img src=x onerror=window.__xss=3>15:00' : '15:00',
            tags: i === 0 ? ['t_xss'] : ['t_camp'],
            owner: i === 0 ? '<b onmouseover=window.__xss=4>AL</b>' : 'AL'
          });
        }
        const t0 = performance.now();
        renderBoard();
        const dtMs = performance.now() - t0;
        const renderedRows = document.querySelectorAll('#gantt-view .gantt-row').length;
        const hasHandler = !!document.querySelector('#gantt-view [onerror], #gantt-view [onload], #gantt-view [onmouseover]');
        const xssTriggered = !!window.__xss;

        cards.length = snapshotLen;
        tags.pop();
        renderBoard();

        return { csRows, highRows, pulsed, helpOk, dtMs, renderedRows, hasHandler, xssTriggered };
      }, winIsos);

      check(
        label + ' filtros do board (owner mesmo com raia ativa, prioridade) e 💡 Meus cards funcionam no Gantt',
        JSON.stringify(extraChecks.csRows) === JSON.stringify(['c_camp_both', 'c_done_both']) &&
          JSON.stringify(extraChecks.highRows) === JSON.stringify(['c_camp_both']) &&
          JSON.stringify(extraChecks.pulsed) === JSON.stringify(['c_camp_both', 'c_clip_right']),
        extraChecks
      );
      check(
        label + ' HELP_CONTENT documentado, 120+ cards rápidos (<500ms) e blindagem XSS',
        extraChecks.helpOk &&
          extraChecks.renderedRows >= 125 &&
          extraChecks.dtMs < 500 &&
          !extraChecks.hasHandler &&
          !extraChecks.xssTriggered,
        extraChecks
      );

      // Revisão do Claude (#1749): rolagem lateral sobrevive ao redesenho, abre rolado até hoje, sem indicador de coluna.
      await p.evaluate(() => { if (boardView !== 'kanban') { boardView = 'kanban'; _syncBoardViewBtns(); renderBoard(); } });
      await p.waitForTimeout(250);
      const indNoKanban = await p.evaluate(() => { const i = document.getElementById('mobile-col-indicator'); return i ? getComputedStyle(i).display : 'none'; });
      await p.evaluate(() => toggleGanttView());
      await p.waitForTimeout(250);
      const scrollRes = await p.evaluate(async () => {
        const sc = () => document.getElementById('gantt-scroll');
        const hojeVisivel = () => {
          const s = sc(), td = s.querySelector('.gantt-day-hd.is-today'), corner = s.querySelector('.gantt-ruler-corner');
          if (!td) return false;
          const sr = s.getBoundingClientRect(), tr = td.getBoundingClientRect(), cr = corner.getBoundingClientRect();
          return tr.left >= cr.right - 1 && tr.right <= sr.right + 1;
        };
        const abriuHoje = hojeVisivel();
        const max = sc().scrollWidth - sc().clientWidth;
        const alvo = Math.max(1, Math.min(max, sc().scrollLeft === 0 ? 120 : sc().scrollLeft - 40));
        sc().scrollLeft = alvo;
        const antes = sc().scrollLeft;
        renderBoard();
        const depois = sc().scrollLeft;
        ganttNav(28);
        const aposAvancar = sc().scrollLeft;
        ganttNav(0);
        const voltouHoje = hojeVisivel();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const ind = document.getElementById('mobile-col-indicator');
        return { abriuHoje, max, antes, depois, aposAvancar, voltouHoje, indicador: ind ? getComputedStyle(ind).display : 'none' };
      });
      check(label + ' Gantt abre com o dia de hoje visível (e o botão Hoje volta até ele)', scrollRes.abriuHoje && scrollRes.voltouHoje, scrollRes);
      check(label + ' rolagem lateral do Gantt sobrevive ao redesenho (atualização do Firebase)', scrollRes.max <= 0 || (scrollRes.antes > 0 && scrollRes.depois === scrollRes.antes), scrollRes);
      check(label + ' ▶ volta a rolagem ao começo da nova janela', scrollRes.aposAvancar === 0, scrollRes);
      check(label + ' indicador "coluna · n/N" do celular escondido no Gantt' + (width <= 768 ? ' (aparecia no modo colunas)' : ''), scrollRes.indicador === 'none' && (width > 768 || indNoKanban !== 'none'), { ...scrollRes, indNoKanban });

      // 📊 Filtros do Gantt (12/11): atalho dos MESMOS filtros do board.
      await p.evaluate(() => { clearFilters(); if (boardView !== 'gantt') toggleGanttView(); });
      await p.waitForTimeout(200);
      const filtRes = await p.evaluate(() => {
        const fEl = document.getElementById('gantt-filtros');
        const tb = document.querySelector('#gantt-view .gantt-toolbar');
        const out = { existe: !!fEl, depoisDaToolbar: !!(tb && tb.nextElementSibling === fEl) };
        const selOwner = fEl.querySelector('select[data-campo="owner"]');
        out.mesmasOpcoes = selOwner.options.length === document.getElementById('f-owner').options.length;
        const pessoa = [...selOwner.options].map(o => o.value).find(v => v && cards.some(c => !c.archived && (c.owner === v) && (c.due || c.inicio)));
        selOwner.value = pessoa; selOwner.dispatchEvent(new Event('change'));
        const rows = [...document.querySelectorAll('#gantt-view .gantt-row')].map(r => r.dataset.id);
        out.pessoa = pessoa;
        out.drawerSync = document.getElementById('f-owner').value === pessoa && activeFilters.owner === pessoa;
        out.soDaPessoa = rows.length > 0 && rows.every(id => { const c = cards.find(x => x.id === id); return c.owner === pessoa || (c.participants || []).includes(pessoa); });
        out.mesmoNo = document.getElementById('gantt-filtros') === fEl;
        renderBoard();
        out.sobreviveRedesenho = document.getElementById('gantt-filtros') === fEl && fEl.querySelector('select[data-campo="owner"]').value === pessoa;
        out.limparVisivel = !fEl.querySelector('.gantt-flimpa').hidden;
        const selTag = fEl.querySelector('select[data-campo="tag"]');
        const tagV = [...selTag.options].map(o => o.value).find(Boolean);
        selTag.value = tagV; selTag.dispatchEvent(new Event('change'));
        out.tagSync = activeFilters.tag === tagV && document.getElementById('f-tag').value === tagV;
        fEl.querySelector('.gantt-flimpa').click();
        out.limpou = !activeFilters.owner && !activeFilters.tag && fEl.querySelector('.gantt-flimpa').hidden;
        const inp = fEl.querySelector('input[data-p="de"]');
        inp.value = '2027-03-10'; inp.dispatchEvent(new Event('change'));
        const hd = document.querySelector('#gantt-view .gantt-day-hd[data-date="2027-03-10"]');
        const sc = document.getElementById('gantt-scroll');
        out.irPara = !!hd && hd.getBoundingClientRect().right <= sc.getBoundingClientRect().right + 1;
        inp.value = ''; inp.dispatchEvent(new Event('change'));
        // Período De/Até — só cards cujo período ou prazo cruza o intervalo.
        ganttNav(0);
        const cb = cards.find(c => c.id === 'c_camp_both');
        const de = cb.inicio, ate = cb.inicio;
        const inDe = fEl.querySelector('input[data-p="de"]'), inAte = fEl.querySelector('input[data-p="ate"]');
        inDe.value = de; inAte.value = ate; inAte.dispatchEvent(new Event('change'));
        const rowsPer = [...document.querySelectorAll('#gantt-view .gantt-row')].map(r => r.dataset.id);
        const cruza = id => { const c = cards.find(x => x.id === id); const temP = _calCardTemPeriodo(c); const temD = /^\d{4}-\d{2}-\d{2}$/.test(c.due || '');
          return (temP && c.inicio <= ate && c.fim >= de) || (temD && c.due >= de && c.due <= ate); };
        out.periodo = rowsPer.includes('c_camp_both') && rowsPer.every(cruza) && _ganttPeriodo.de === de && _ganttPeriodo.ate === ate
          && /Período/.test(document.getElementById('gantt-footer').textContent) && !fEl.querySelector('.gantt-flimpa').hidden;
        // Invertido de verdade: Até antes do De → troca.
        inDe.value = '2026-12-20'; inAte.value = '2026-12-01'; inAte.dispatchEvent(new Event('change'));
        out.troca = _ganttPeriodo.de === '2026-12-01' && _ganttPeriodo.ate === '2026-12-20';
        fEl.querySelector('.gantt-flimpa').click();
        out.limpaPeriodo = !_ganttPeriodo.de && !_ganttPeriodo.ate && !inDe.value && !inAte.value;
        ganttNav(0);
        out.semRolagemPagina = document.documentElement.scrollWidth - innerWidth <= 1;
        return out;
      });
      check(label + ' barra de filtros do Gantt usa os filtros do board (pessoa/tag sincronizam com 🔭, Limpar, De/Até: ir para e período)',
        filtRes.existe && filtRes.depoisDaToolbar && filtRes.mesmasOpcoes && filtRes.drawerSync && filtRes.soDaPessoa &&
        filtRes.mesmoNo && filtRes.sobreviveRedesenho && filtRes.limparVisivel && filtRes.tagSync && filtRes.limpou && filtRes.irPara && filtRes.periodo && filtRes.troca && filtRes.limpaPeriodo && filtRes.semRolagemPagina,
        filtRes);

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
