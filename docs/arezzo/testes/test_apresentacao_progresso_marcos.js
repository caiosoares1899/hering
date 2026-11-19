const assert = require('node:assert/strict');
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const { seed } = require('./seed_apresentacao.js');
const base = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  try{
    for(const width of [1280,390]){
      const dados=seed(), okr=dados.kanban.okr;
      okr.marcos={};
      for(let i=0;i<6;i++) okr.marcos['prova'+i]={id:'prova'+i,objetivoId:'o3',nome:'Marco de teste '+(i+1),progresso:i<3?'concluido':'no_prazo'};
      const ctx=await browser.newContext({viewport:{width,height:900}});
      await fake.install(ctx,dados);
      const p=await ctx.newPage();
      await p.goto(base + '/okr-apresentacao.slide.html');
      await p.waitForFunction(()=>!!window.__authCb);
      await p.evaluate(()=>window.__authCb({uid:'ana',email:'ana@ciahering.com.br',providerData:[{providerId:'google.com'}]}));
      await p.waitForFunction(()=>document.querySelectorAll('.slide').length>1);
      await p.evaluate(()=>window._okrOpenDetail('o3'));
      const progresso=p.locator('.d2-right .d2-marcos-progresso');
      assert.equal(await progresso.locator('strong').textContent(),'50%');
      assert.match(await progresso.textContent(),/3 de 6 marcos concluídos/);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if(width===1280){
        const medidas=await p.evaluate(()=>{
          const primeira=document.querySelector('.d2-marco-row').getBoundingClientRect();
          const cabecalho=document.querySelector('.d2-table-header').getBoundingClientRect();
          return {distancia:primeira.top-cabecalho.bottom, altura:primeira.height};
        });
        assert.ok(medidas.altura>0 && medidas.distancia>=0 && medidas.distancia<12);
      }
      if(process.env.CAPTURA_MARCOS) await p.screenshot({path:process.env.CAPTURA_MARCOS+'-'+width+'.png'});
      await p.evaluate(()=>window._okrToggleColapsarConcluidos());
      assert.equal(await progresso.locator('strong').textContent(),'50%');
      await p.evaluate(()=>window._okrOpenDetail('o1'));
      assert.match(await progresso.textContent(),/Sem marcos/);
      await ctx.close();
      console.log(width+' px: percentual, posição, colapso e estado vazio ✓');
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
