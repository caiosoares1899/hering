// Chromium com Firebase simulado. CAPTURAS aponta para o diretório de evidências, se desejado.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(),'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const root = path.resolve(__dirname,'../../..');
const DAY = 86400000;
const add = (date, days) => new Date(Date.parse(date)+days*DAY).toISOString().slice(0,10);
const days = (first, last) => Array.from({length:(Date.parse(last)-Date.parse(first))/DAY+1}, (_,i)=>add(first,i));
const columns = [
  {id:'todo',name:'A fazer'}, {id:'progress',name:'Em progresso'}, {id:'validation',name:'Validação'},
  {id:'done',name:'Concluído'}, {id:'cancel',name:'Cancelado'},
];
const stamp = day=>day+'T15:00:00.000Z';
const card = (id, day, from='validation')=>({
  id, col:'done', title:'Item fictício', archived:false, createdAt:'2026-11-01',
  flow:{doneAt:stamp(day),log:[{from,to:'done',at:stamp(day)}]},
});
const user = {uid:'piloto',email:'piloto@ciahering.com.br',displayName:'Pessoa Teste',providerData:[{providerId:'google.com'}]};
const history = days('2026-11-30','2027-01-10').map(day=>card(day,day));
const dev = {columns,cards:[...history,{id:'pendente',title:'A planejar',col:'todo'}]};
const seed = {kanban:{
  usuarios:{piloto:{...user,inscrito:true,init:'PT',role:'adm',squads:{dev:true,omnichannel:true}}},
  usuarios_publicos:{piloto:{init:'PT',nome:'Pessoa Teste',role:'adm',squads:{dev:true,omnichannel:true}}},
  config:{adm_emails:[user.email]},
  squads:{dev:{dados:dev},omnichannel:{dados:{columns,cards:[]}}},
}};
function executable(){
  if(process.env.CHROME) return process.env.CHROME;
  const chrome=path.join(os.homedir(),'hering-tools/chrome');
  if(!fs.existsSync(chrome)) return undefined;
  const folder=fs.readdirSync(chrome).find(name=>name.startsWith('mac_arm-'));
  return folder && path.join(chrome,folder,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const check=(label,fn)=>{fn(); console.log('✅ '+label);};
const status='#flow-forecast-status';
const checkMessage=async (page,re)=>assert.match(await page.locator(status).textContent(),re);
const clickCalculate=async (page,n)=>{
  await page.getByLabel('Itens a concluir').fill(String(n));
  await page.getByRole('button',{name:'Calcular',exact:true}).click();
};

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:executable(),headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Pacific/Auckland'});
    await ctx.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await fake.install(ctx,seed);
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.clock.setFixedTime(new Date('2027-01-11T13:00:00Z'));
    await page.goto('http://127.0.0.1:'+server.address().port+'/painel-dev.html');
    await page.waitForFunction(()=>!!window.__authCb);
    await page.evaluate(u=>window.__authCb(u),user);
    await page.waitForFunction(()=>!!squadData.dev?.forecastHasColumns);
    await page.evaluate(()=>swPtab('fluxo'));

    const proofs=await page.evaluate(({columns})=>{
      const mk = (id, at, from='validation', extra={})=>({
        id,col:'done',...extra,flow:{doneAt:at,log:[{from,to:'done',at}],...extra.flow},
      });
      const data={columns,cards:[]};
      const at='2026-12-03T02:59:59Z'; // 02/12, 23h59 em São Paulo, embora o navegador esteja em Auckland.
      data.cards=[
        mk('archived',at,'validation',{archived:true}),
        mk('moved-twice','2026-12-03T03:00:00Z','validation',{flow:{
          log:[{from:'progress',to:'done',at},{from:'validation',to:'done',at:'2026-12-03T03:00:00Z'}],
        }}),
        mk('imported-moved',at,'validation',{flow:{imported:true}}),
        mk('validation',at,'progress',{col:'validation'}),
        mk('cancelled',at,'progress',{col:'cancel'}),
        mk('reset',at,'validation',{flow:{resetAt:at}}),
        mk('aggregate',at,'validation',{childCardIds:['child']}),
        mk('created',at,'—'),
        mk('imported',at,'validation',{flow:{imported:true,log:[]}}),
        mk('legacy',at,'validation',{flow:{log:[]}}),
        mk('ongoing',at,'validation',{continuo:true}),
        mk('archived',at),
        mk('today','2027-01-11T03:00:00Z'),
        mk('before-start','2026-11-22T12:00:00Z'),
        mk('bf','2026-11-27T12:00:00Z'),
        mk('natal','2026-12-25T12:00:00Z'),
      ];
      const sample=_forecastSample(data,'2027-01-11');
      const base=_forecastSample(squadData.dev,'2027-01-11');
      const earliest=Array.from({length:75},(_,i)=>_forecastDay('2026-11-18',i))
        .find(day=>_forecastSample(squadData.dev,day).state==='ready');
      const choose=(today,override={})=>_forecastSample({...squadData.dev,...override},today);
      const shifted=choose('2027-01-11',{cards:squadData.dev.cards
        .filter(c=>c.flow?.doneAt && c.flow.doneAt<'2026-12-11')
        .flatMap(c=>[c,{...c,id:c.id+'-2'}])});
      const low=choose('2027-01-11',{cards:[]});
      const cut=choose('2027-01-11',{flowBaseline:{at:'2026-12-03T03:00:00Z'}});
      const exactCut=_forecastSample({...data,flowBaseline:{at:'2026-12-03T03:00:00Z'}},'2027-01-11');
      const long=choose('2027-03-03');
      const dist=_forecastDistributions(base);
      const carnival=base.future.map((day,i)=>({day,counts:dist[i]})).filter(x=>x.day>='2027-02-08');
      const draws=[];
      for(let a=0;a<3;a++) for(let b=0;b<3;b++) for(let c=0;c<3;c++) draws.push(a/3,b/3,c/3);
      const enumerated=n=>{let i=0;return _forecastRun([[0,1,2],[0,1,2],[0,1,2]],n,()=>draws[i++],27);};
      const simulate=()=>_forecastRun(dist,5,_forecastRandom('test'));
      return {sample,base,earliest,shifted,low,cut,exactCut,long,carnival,enumerated:enumerated(2),three:enumerated(3),
        stable:[simulate(),simulate()],
        states:[
          choose('2026-11-18').state, choose('2026-11-25').state, choose('2026-11-30').state, choose('2027-01-02').state,
          choose('2027-01-07').state, choose('2027-01-08').state,
          choose('2027-01-11',{columns:[]}).state,
          choose('2027-01-11',{columns:[...columns,{id:'duplicate',name:'Concluído'}]}).state,
          _forecastSample(null,'2027-01-11').state, choose('2027-01-11',{flowBaseline:{at:'inválido'}}).state,
        ],
        scope:SQUADS.map(s=>s.id), localDay:_forecastCivil(Date.parse(at)),
      };
    },{columns});
    check('Última entrada Validação → Concluído, arquivados e fuso de São Paulo',()=>{
      assert.equal(proofs.localDay,'2026-12-02');
      assert.equal(proofs.sample.deliveries,3);
      assert.equal(proofs.sample.archived,1);
      assert.equal(proofs.sample.buckets[3][0],2);
      assert.equal(proofs.sample.buckets[4][0],1);
      assert.ok(proofs.sample.buckets.flat().includes(0));
    });
    check('Corte, limite de 56 dias e períodos fora do treino',()=>{
      assert.equal(proofs.cut.days,27);
      assert.equal(proofs.exactCut.deliveries,0);
      assert.equal(proofs.long.days,53);
      assert.equal(proofs.base.days,31);
      assert.equal(proofs.base.deliveries,31);
    });
    check('Mensagens distintas para cobertura, coluna, dados, período e ritmo',()=>{
      assert.deepEqual(proofs.states,['blocked','blocked','blocked','blocked','days','weekdays','column','column','data','data']);
      assert.equal(proofs.low.state,'deliveries');
      assert.equal(proofs.shifted.state,'rhythm');
      assert.equal(proofs.shifted.ratio,0);
      assert.equal(proofs.base.ratio,1);
    });
    check('Primeira data-base calculada e Carnaval com três dias a zero',()=>{
      assert.equal(proofs.earliest,'2027-01-11');
      assert.deepEqual(proofs.carnival,days('2027-02-08','2027-02-10').map(day=>({day,counts:[0]})));
    });
    check('Exemplo da nota: P50 no 2º dia, P85 no 3º e 3 itens sem P85',()=>{
      assert.deepEqual(proofs.enumerated,{p50:1,p85:2});
      assert.deepEqual(proofs.three,{p50:2,p85:null});
      assert.deepEqual(proofs.stable[0],proofs.stable[1]);
    });

    await page.evaluate(()=>{
      const pilot={id:'dados',label:'<img src=x onerror=alert(1)>',color:'#38b6ff'};
      SQUADS.push(pilot);
      _renderFlowForecast();
    });
    const options=page.locator('#flow-forecast-squad option');
    assert.deepEqual(await options.allTextContents(),['Dev Sandbox','<img src=x onerror=alert(1)>']);
    assert.equal(await options.locator('img').count(),0);
    await page.evaluate(()=>{ SQUADS.pop(); _renderFlowForecast(); });
    console.log('✅ Lista contém apenas pilotos visíveis e trata nomes de squad como texto');

    assert.equal(await page.locator('#flow-forecast-squad').inputValue(),'dev');
    const logBefore=await page.evaluate(()=>window.__log.length);
    await clickCalculate(page,5);
    await checkMessage(page,/85% de chance de concluir 5 itens até 16\/01/);
    const result=await page.locator(status).textContent();
    assert.match(await page.locator('#flow-forecast-median').textContent(),/P50.*16\/01/);
    assert.match(await page.locator('#flow-forecast-sample').textContent(),/11\/01\/2027.*31 entregas/);
    for(const window of [7,14,30]){
      await page.locator('.flow-win-btn[data-win="'+window+'"]').click();
      assert.equal(await page.locator(status).textContent(),result);
    }
    await clickCalculate(page,5);
    assert.equal(await page.locator(status).textContent(),result);
    assert.deepEqual(await page.evaluate(start=>window.__log.slice(start),logBefore),[]);
    console.log('✅ Cálculo e seletor 7/14/30 mantêm a previsão com zero leituras e gravações do Firebase');

    await clickCalculate(page,150);
    await checkMessage(page,/nos próximos 30 dias/);
    assert.ok(await page.locator('#flow-forecast-details').isHidden());
    assert.ok(await page.locator('#flow-forecast-badge').isHidden());
    for(const [day,re] of [
      ['2026-11-18',/pausa na Black Friday/],['2027-01-07',/28 dias/],['2027-01-08',/quatro ocorrências/],
    ]){
      await page.clock.setFixedTime(new Date(day+'T13:00:00Z'));
      await clickCalculate(page,1);
      await checkMessage(page,re);
    }

    await page.clock.setFixedTime(new Date('2027-01-11T23:59:00-03:00'));
    await clickCalculate(page,5);
    await checkMessage(page,/85% de chance/);
    await page.clock.setFixedTime(new Date('2027-01-12T00:00:00-03:00'));
    const beforeStale=await page.evaluate(()=>window.__log.length);
    await clickCalculate(page,5);
    await checkMessage(page,/Atualize o Painel/);
    assert.ok(await page.locator('#flow-forecast-details').isHidden());
    assert.ok(await page.locator('#flow-forecast-badge').isHidden());
    assert.deepEqual(await page.evaluate(start=>window.__log.slice(start),beforeStale),[]);
    await page.evaluate(()=>_pollSquadDados('dev',true));
    await page.waitForFunction(()=>_squadDadosAt.dev===Date.now() && !_squadDadosInflight.dev);
    await clickCalculate(page,5);
    await checkMessage(page,/85% de chance/);
    console.log('✅ Virada da meia-noite em São Paulo recusa dados do dia anterior sem buscar; atualizar libera o cálculo');

    await page.evaluate(()=>{
      window.__denyGet=p=>p.endsWith('/dev/dados/columns');
      _pollSquadDados('dev',true);
    });
    await page.waitForFunction(()=>_squadDadosFailed.has('dev'));
    await clickCalculate(page,5);
    await checkMessage(page,/Atualize o Painel/);
    await page.evaluate(()=>{window.__denyGet=null;_pollSquadDados('dev',true);});
    await page.waitForFunction(()=>!_squadDadosFailed.has('dev') && !_squadDadosInflight.dev);
    assert.doesNotMatch(await page.locator(status).textContent(),/Atualize o Painel/);
    await clickCalculate(page,5);
    await checkMessage(page,/85% de chance/);
    await page.evaluate(()=>setFilter('omnichannel'));
    assert.ok(await page.locator('#flow-forecast').isHidden());
    await page.evaluate(()=>setFilter('all'));
    await clickCalculate(page,5);
    console.log('✅ Falha real do carregador simulado, recuperação e restrição ao piloto');

    await page.locator('#flow-forecast-details summary').click();
    for(const width of [1280,390]){
      await page.setViewportSize({width,height:900});
      for(const theme of ['abrolhos','light','vice']){
        await page.evaluate(theme=>{
          if(theme==='abrolhos') document.documentElement.removeAttribute('data-theme');
          else document.documentElement.dataset.theme=theme;
        },theme);
        const layout=await page.locator('#flow-forecast').evaluate(section=>{
          const box=section.getBoundingClientRect();
          const controls=[...section.querySelectorAll('input,select,button,summary')];
          return { overflow:section.scrollWidth>section.clientWidth,
            outOfViewport:box.left<0||box.right>innerWidth,
            heights:controls.map(el=>el.getBoundingClientRect().height),
            status:section.querySelector('[role=status]').textContent,
            badge:section.querySelector('#flow-forecast-badge').getBoundingClientRect().width };
        });
        assert.ok(!layout.overflow && !layout.outOfViewport,JSON.stringify(layout));
        assert.ok(layout.heights.every(h=>h>=44),JSON.stringify(layout));
        assert.match(layout.status,/Estimativa em teste\s+Pelo ritmo recente.*85%/);
        assert.ok(layout.badge>0);
        if(process.env.CAPTURAS){
          fs.mkdirSync(process.env.CAPTURAS,{recursive:true});
          await page.locator('#flow-forecast').evaluate(el=>el.scrollIntoView({block:'center'}));
          await page.screenshot({path:path.join(process.env.CAPTURAS,'monte-carlo-'+width+'-'+theme+'.png'),animations:'disabled'});
        }
        console.log('✅ '+width+' px · '+theme+' · sem corte e alvos ≥ 44 px');
      }
    }
    const count=page.getByLabel('Itens a concluir');
    await page.locator('#flow-forecast-squad').focus();
    await page.keyboard.press('Tab');
    assert.ok(await count.evaluate(el=>el.matches(':focus-visible') && getComputedStyle(el).outlineWidth==='2px'));
    assert.deepEqual(errors,[]);
    console.log('✅ Foco visível, anúncio com role=status e nenhum erro de página');
  }finally{await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>server.close());
