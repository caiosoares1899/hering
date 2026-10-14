// Radar — ✏️ editar o próprio comentário do Marco (okr-dev). Servir a raiz do repo: python3 -m http.server 8941 ; BASE=... node test_comentario_marco.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const BASE=process.env.BASE||'http://localhost:8941/okr-dev.html';
let falhas=0; const ok=(n,c,d)=>{ if(!c) falhas++; console.log(c?'✅':'❌',n,c?'':(d===undefined?'':String(d).slice(0,400))); };
const obj=(id,extra)=>({id,titulo:'Obj '+id,areaId:'geral',trimestres:['2026-Q4'],pilar:'',descricao:'d',responsaveis:[],indicadores:['i'],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],tagIds:[],cardLinks:[],history:[],torre:'digital',ordem:0,...extra});
const seed=()=>({kanban:{okr:{objetivos:{o1:obj('o1')},marcos:{m1:{id:'m1',objetivoId:'o1',nome:'Marco A',responsavel:'',prazo:'2026-12-01',progresso:'no_prazo',descricao:'desc',checklist:[],tags:[],participantes:[],history:[]}},
  marco_comments:{m1:{cA:{id:'cA',uid:'ana',author:'Ana ADM',text:'meu comentário',ts:'2026-10-13T10:00:00.000Z'},cB:{id:'cB',uid:'bia',author:'Bia',text:'da Bia',ts:'2026-10-13T11:00:00.000Z'}}},snapshots:{},tags:{}},
  usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},bia:{uid:'bia',nome:'Bia',email:'bia@ciahering.com.br',inscrito:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto(BASE+'?torre=digital'); await page.waitForFunction(()=>!!window.__authCb);
 await page.evaluate(()=>window.__authCb({uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana ADM',photoURL:'',providerData:[{providerId:'google.com'}]})); await page.waitForTimeout(1400);
 await page.evaluate(()=>{ window.__t=[]; const t=showToast; window.showToast=m=>{ window.__t.push(m); try{t(m);}catch(e){} }; });
 const com=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__store.kanban.okr.marco_comments.m1)));
 const abre=async()=>{ await page.evaluate(()=>openOkrMarco('m1','o1')); await page.waitForTimeout(500); };
 await abre();
 ok('1a. ✏️ aparece só no comentário da própria pessoa', await page.evaluate(()=>{ const bs=[...document.querySelectorAll('#okr-marco-body .okr-comment')]; return bs.length===2 && !!bs[0].querySelector('[title="Editar comentário"]') && !bs[1].querySelector('[title="Editar comentário"]'); }));
 // edita e salva com Enter
 await page.evaluate(()=>{ document.getElementById('okr-m-descricao').value='descrição em andamento'; });   // texto pendente no Marco não pode sumir
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.waitForTimeout(200);
 ok('1b. abre campo de edição com o texto atual', await page.evaluate(()=>document.getElementById('okr-comment-edit-inp')?.value==='meu comentário'));
 ok('1c. o que estava digitado no Marco continua lá', await page.evaluate(()=>document.getElementById('okr-m-descricao').value==='descrição em andamento'));
 await page.fill('#okr-comment-edit-inp','comentário corrigido'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
 let c=await com();
 ok('1d. grava o texto novo + editadoEm', c.cA.text==='comentário corrigido' && /^\d{4}-\d\d-\d\dT/.test(c.cA.editadoEm||''), JSON.stringify(c.cA));
 ok('1e. autor/uid/ts não mudam e o comentário alheio fica intacto', c.cA.uid==='ana' && c.cA.author==='Ana ADM' && c.cA.ts==='2026-10-13T10:00:00.000Z' && c.cB.text==='da Bia' && !c.cB.editadoEm);
 ok('1f. a lista mostra o novo texto + "editado" e sai do modo edição', await page.evaluate(()=>{ const t=document.querySelector('#okr-marco-body .okr-comment').textContent; return /comentário corrigido/.test(t) && /editado/.test(t) && !document.getElementById('okr-comment-edit-inp'); }));
 ok('1g. descrição pendente do Marco sobreviveu ao salvar', await page.evaluate(()=>document.getElementById('okr-m-descricao').value==='descrição em andamento'));
 // cancelar (Esc e botão) não grava
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.fill('#okr-comment-edit-inp','NÃO GRAVAR'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
 c=await com(); ok('2a. Esc cancela sem gravar', c.cA.text==='comentário corrigido' && !(await page.evaluate(()=>document.getElementById('okr-comment-edit-inp'))));
 ok('2b. Esc no campo NÃO fecha o modal do Marco', await page.evaluate(()=>document.getElementById('okr-marco-ov').classList.contains('open')));
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.fill('#okr-comment-edit-inp','NÃO GRAVAR'); await page.click('#okr-marco-body button:has-text("Cancelar")'); await page.waitForTimeout(200);
 c=await com(); ok('2c. botão Cancelar não grava', c.cA.text==='comentário corrigido');
 // sem mudança → não marca "editado" de novo
 const ed0=c.cA.editadoEm; await page.waitForTimeout(30);
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
 c=await com(); ok('3a. salvar sem mudar nada não regrava', c.cA.editadoEm===ed0);
 // vazio
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.fill('#okr-comment-edit-inp','   '); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
 c=await com(); ok('3b. vazio é recusado (avisa) e mantém o texto', c.cA.text==='comentário corrigido' && (await page.evaluate(()=>window.__t)).some(t=>/não pode ficar vazio/.test(t)));
 await page.keyboard.press('Escape');
 // comentário apagado por outra pessoa durante a edição
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.fill('#okr-comment-edit-inp','texto novo');
 await page.evaluate(()=>window._remove(window._ref(window._db,'kanban/okr/marco_comments/m1/cA'))); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
 c=await com(); ok('4a. comentário apagado por outra pessoa não ressuscita (e avisa)', !c.cA && (await page.evaluate(()=>window.__t)).some(t=>/não existe mais/.test(t)), JSON.stringify(c));
 // falha de gravação
 await page.evaluate(()=>window._set(window._ref(window._db,'kanban/okr/marco_comments/m1/cA'),{id:'cA',uid:'ana',author:'Ana ADM',text:'volta',ts:'2026-10-13T10:00:00.000Z'}));
 await page.evaluate(()=>{ closeOkrMarco(); }); await abre();
 await page.evaluate(()=>{ window.__denySet=p=>/marco_comments/.test(p); });
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.fill('#okr-comment-edit-inp','vai falhar'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
 ok('5a. gravação negada: avisa e mantém o campo aberto pra tentar de novo', (await page.evaluate(()=>window.__t)).some(t=>/Não consegui salvar o comentário/.test(t)) && await page.evaluate(()=>!!document.getElementById('okr-comment-edit-inp')));
 await page.evaluate(()=>{ window.__denySet=null; }); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
 c=await com(); ok('5b. tentar de novo depois da falha grava', c.cA.text==='vai falhar', JSON.stringify(c.cA));
 // fechar o Marco e reabrir limpa o modo edição
 await page.click('#okr-marco-body [title="Editar comentário"]'); await page.evaluate(()=>{ closeOkrMarco(); }); await abre();
 ok('6a. reabrir o Marco não volta em modo edição', await page.evaluate(()=>!document.getElementById('okr-comment-edit-inp')));
 // outra pessoa (Bia): contexto novo, logada como ela
 await ctx.close();
 const ctx2=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx2,seed()); const pg=await ctx2.newPage(); const errs2=[]; pg.on('pageerror',e=>errs2.push(e.message));
 await pg.goto(BASE+'?torre=digital'); await pg.waitForFunction(()=>!!window.__authCb);
 await pg.evaluate(()=>window.__authCb({uid:'bia',email:'bia@ciahering.com.br',displayName:'Bia',photoURL:'',providerData:[{providerId:'google.com'}]})); await pg.waitForTimeout(1400);
 await pg.evaluate(()=>{ window.__t=[]; const t=showToast; window.showToast=m=>{ window.__t.push(m); try{t(m);}catch(e){} }; });
 await pg.evaluate(()=>openOkrMarco('m1','o1')); await pg.waitForTimeout(500);
 ok('7a. a Bia só tem ✏️ no comentário dela', await pg.evaluate(()=>{ const bs=[...document.querySelectorAll('#okr-marco-body .okr-comment')]; return bs.length===2 && !bs[0].querySelector('[title="Editar comentário"]') && !!bs[1].querySelector('[title="Editar comentário"]'); }));
 ok('7b. chamar a edição do comentário alheio na marra não grava', await pg.evaluate(async()=>{ _okrComentEditId='cA'; renderOkrMarcoBody(); const antes=JSON.stringify(window.__store.kanban.okr.marco_comments.m1.cA); await _okrCommentEditSave(); return JSON.stringify(window.__store.kanban.okr.marco_comments.m1.cA)===antes && !document.getElementById('okr-comment-edit-inp'); }));
 // XSS
 await pg.click('#okr-marco-body [title="Editar comentário"]'); await pg.fill('#okr-comment-edit-inp','<img src=x onerror=window.__xss=1> "aspas"'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
 ok('8a. HTML no texto é escapado', await pg.evaluate(()=>!window.__xss && document.querySelector('#okr-marco-body').textContent.includes('<img src=x')));
 ok('9. sem erros de JS', errs.length===0 && errs2.length===0, errs.concat(errs2).join('|'));
 await b.close(); console.log(falhas?('\n❌ '+falhas+' falha(s)'):'\nTUDO OK'); process.exit(falhas?1:0);
})();
