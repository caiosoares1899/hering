// 💬 Duplicar card copia os comentários com `copiadoDe` (11/11/2026) — exigido pela regra que prende o autor do comentário a quem
// está logado (database.rules.json → card_comments/$cardId/$commentId/uid). A cópia FIEL de comentário de OUTRA pessoa (mesmo id,
// autor e texto na origem) é o que a regra aceita; aqui confere que o navegador grava exatamente isso, e que a regra aceita o que foi gravado.
// Rodar: python3 -m http.server 8953 (na raiz) e `node docs/arezzo/testes/test_duplicar_comentarios.js` (BASE_URL troca o servidor).
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const { check, validate } = require('../../../functions/rules/rulesSim');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const cmAna = {id:'cmA', uid:'ana', author:'Ana', init:'AN', text:'Comentário da Ana', ts:'2026-11-11T10:00:00.000Z'};
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[]}, squads_meta:{site:{label:'Squad Site'}},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}], cards_index:{c1:'k1'}, cards:{k1:{id:'c1',title:'Original',col:'doing'}},
    card_comments:{c1:{cmA:cmAna}}}}},
}});
(async()=>{
  const b = await chromium.launch({executablePath:chrome}); let n=0, f=0;
  const t = (nome,ok,d)=>{ n++; if(!ok) f++; console.log((ok?'✅ ':'❌ ')+nome+(ok?'':' → '+JSON.stringify(d).slice(0,300))); };
  const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
  await p.evaluate(x=>window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
  const antes = await p.evaluate(()=>cards.map(c=>c.id));
  await p.evaluate(()=>_duplicarCardObj(cards.find(c=>c.id==='c1'), {}));
  await p.waitForTimeout(1200);
  const r = await p.evaluate(antes=>{ const novo = cards.find(c=>!antes.includes(c.id)); const cc = (window.__store.kanban.squads.site.dados.card_comments||{});
    return {novo: novo && novo.id, copia: novo && cc[novo.id] && cc[novo.id].cmA}; }, antes);
  t('duplicou o card', !!r.novo, r);
  t('comentário da Ana copiado com o mesmo autor e texto', r.copia && r.copia.uid==='ana' && r.copia.text===cmAna.text, r.copia);
  t('cópia leva copiadoDe = card de origem', r.copia && r.copia.copiadoDe==='c1', r.copia);
  // a regra aceita o que o navegador gravou (Eve gravando comentário da Ana = cópia fiel)
  const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
  const DB = seed(); DB.kanban.squads.site.dados.card_comments = {c1:{cmA:cmAna}};
  const P = 'kanban/squads/site/dados/card_comments/'+r.novo, val = {cmA: r.copia};
  t('regra aceita a cópia gravada pelo navegador', !!r.novo && check(RULES, DB, 'write', P, mk('eve', U.email), val) && validate(RULES, DB, P, mk('eve', U.email), val));
  const semMarca = {cmA: Object.assign({}, r.copia)}; delete semMarca.cmA.copiadoDe;
  t('sem copiadoDe a regra recusaria (é o que o prod antigo faria)', !validate(RULES, DB, P, mk('eve', U.email), semMarca));
  t('sem erro de JS', !errs.length, errs);
  await ctx.close(); await b.close(); console.log(`\n${n} asserções, ${f} falha(s)`); process.exit(f?1:0);
})();
