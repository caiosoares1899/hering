// Regressões confirmadas: deve falhar até o Claude corrigir os módulos compartilhados.
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
(async () => {
  const pasta = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || path.join(pasta, fs.readdirSync(pasta).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const p = await b.newPage();
    const raiz = path.resolve(__dirname, '../../..');
    await p.route('http://auditoria.local/**', route => {
      const nome = new URL(route.request().url()).pathname.slice(1);
      if (['mare-ferias-dev.js', 'mare-gcal-dev.js'].includes(nome)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(raiz, nome), 'utf8') });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
    });
    await p.goto('http://auditoria.local/okr-dev.html');
    const linhas = await p.evaluate(fs.readFileSync(path.join(__dirname, 'console_monitorarbugs_1611.js'), 'utf8'));
    console.table(linhas);
    if (linhas.some(x => x.resultado === '❌')) process.exitCode = 1;
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
