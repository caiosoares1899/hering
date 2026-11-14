// Abra 🏖️ Férias no Maré dev ou Radar dev, no tema claro e em toque.
// Somente leitura. Não mostra nomes nem dados pessoais.
(()=>{
  const root=document.querySelector('#cal-ferias .mfer')||document.querySelector('#okr-ferias-host .mfer');
  if(!root){console.table([{teste:'Abra a vista 🏖️ Férias antes de testar',resultado:'❌'}]);return;}
  const linhas=[],toque=matchMedia('(pointer:coarse)').matches;
  const t=(teste,ok,medida)=>linhas.push({teste,resultado:ok?'✅':'❌',medida});
  t('Página sem rolagem horizontal',document.documentElement.scrollWidth<=innerWidth,document.documentElement.scrollWidth-innerWidth);
  t('Conteúdo de férias sem transbordar',root.scrollWidth<=root.clientWidth,root.scrollWidth-root.clientWidth);
  const fontes=[...root.querySelectorAll('input,select')].map(e=>parseFloat(getComputedStyle(e).fontSize));
  t('Campos com pelo menos 16 px no toque',!toque||fontes.every(n=>n>=16),Math.min(...fontes)+' px');
  const pequenos=[...root.querySelectorAll('button,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.width<44||r.height<44);}).length;
  t('Alvos de pelo menos 44 × 44 px no toque',!toque||pequenos===0,pequenos+' abaixo de 44 px');
  const pass=document.getElementById('mfer-pass-ov');
  if(pass){const cortes=[...pass.querySelectorAll('.mfer-item-nm')].filter(e=>e.scrollWidth>e.clientWidth+1).length;t('Títulos de decisão legíveis por inteiro',cortes===0,cortes+' cortados');}
  console.table(linhas);
})();
