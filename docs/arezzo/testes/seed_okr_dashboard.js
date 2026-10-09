// seed realista pro Dashboard: 14 Objetivos em 6 gerências, 8 sextas de snapshot
const day=(n)=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
const fridays=[]; { let d=new Date(); while(d.getDay()!==5) d.setDate(d.getDate()-1); for(let i=7;i>=0;i--){ const x=new Date(d); x.setDate(x.getDate()-7*i-7); fridays.push(x.toISOString().slice(0,10)); } }
const G=['crm','tech','cx','dados','prf','geral'];
const ST=['nao_iniciado','no_prazo','risco','atrasado','concluido'];
const objs={};
const titulos=['Fidelidade 2.0','Checkout em 3 passos','NPS acima de 70','Receita por canal','Cobertura de testes','Base ativa no CRM','Reduzir tempo de resposta','Dashboard único de vendas','Migração de plataforma','CAC abaixo da meta','Automação de campanhas','Onboarding de lojistas','Qualidade dos dados','Mix de produtos'];
titulos.forEach((t,i)=>{ const id='o'+i; objs[id]={id,titulo:t,areaId:G[i%G.length],trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:[],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],descricao:'',torre:'digital',
  atingimento: i%3===0 ? {tipo:'porcentagem',inicial:0,meta:100,lancamentos:[{id:'l1',em:fridays[2],valor:20},{id:'l2',em:fridays[5],valor:55},{id:'l3',em:fridays[7],valor:70+i}]} : (i%4===1 ? {tipo:'perene'} : null)}; });
const snaps={};
fridays.forEach((d,k)=>{ const o={}; const rg={total:0,nao_iniciado:0,no_prazo:0,risco:0,atrasado:0,concluido:0};
  titulos.forEach((t,i)=>{ const id='o'+i; if(k<(i%3)) return; const st=ST[(i*7+k*3+ (i%2))%5]; const pct=Math.min(100,Math.round((k+1)/8*100*(0.6+((i*13)%7)/10)));
    const x={titulo:t,areaId:G[i%G.length],torre:'digital',status:st,progressoPct:pct,totalMarcos:5,marcosConcluidos:Math.floor(pct/20)}; if(i%3===0){ x.atingimentoTipo='porcentagem'; x.atingimentoPct=Math.min(100,Math.round(10+k*9+(i%5)*3)); } else if(i%4===1) x.atingimentoTipo='perene';
    o[id]=x; rg.total++; rg[st]++; });
  snaps[d]={date:d,resumoGeral:rg,objetivos:o}; });
module.exports={objs,snaps,fridays};
