// /monitorarbugs 11–12/11: boot real, Firebase falso, relógio fixo.
// Maestro: servidor na raiz :8961; node docs/arezzo/testes/test_monitorarbugs_1112.js
// Sem o fix, os dois testes de troca de torre devolvem pv='marcos'/'atencao'.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';
const U = { uid:'teste_mb', email:'teste_mb@ciahering.com.br', displayName:'Teste', providerData:[{providerId:'google.com'}] };
(async () => {
  const b = await chromium.launch({ executablePath:chrome });
  try {
    const ctx = await b.newContext();
    await fake.install(ctx, { kanban:{ usuarios:{ [U.uid]:{nome:'Teste',email:U.email,inscrito:true} }, okr:{objetivos:{},marcos:{},tags:{}}, config:{adm_emails:[U.email]} } });
    // Exercita também o modo multitorre já existente, hoje desligado por MARE_SO_HERING.
    // Só muda a flag no HTML servido; a função sob teste fica intacta.
    await ctx.route('**/okr-dev.html?*', async route => {
      const res = await route.fetch(), src = await res.text();
      assert.ok(src.includes('const OKR_SO_DIGITAL = !!MARE_SO_HERING;'));
      await route.fulfill({ response:res, body:src.replace('const OKR_SO_DIGITAL = !!MARE_SO_HERING;', 'const OKR_SO_DIGITAL = false;') });
    });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
    await p.goto(base+'/okr-dev.html?torre=digital');
    await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(u => window.__authCb(u), U);
    await p.waitForTimeout(1200);
    for (const pv of ['marcos','atencao']) {
      const r = await p.evaluate(k => {
        _okrEntrarTorre('digital',false); _okrPraVoce(k);
        const antes = _okrFilter.pv;
        _okrEntrarTorre('digital',false); const mesma = _okrFilter.pv;
        _okrEntrarTorre('comercial',false); const outra = _okrFilter.pv;
        return {antes,mesma,outra};
      },pv);
      assert.equal(r.antes,pv); assert.equal(r.mesma,pv,'mesma torre preserva o recorte');
      assert.equal(r.outra,'','troca de torre limpa '+pv);
      console.log('✅ '+pv+': mesma torre preserva; outra torre limpa');
    }
    await ctx.close();
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
