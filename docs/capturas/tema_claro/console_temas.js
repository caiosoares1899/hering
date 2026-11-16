// Painel dev ou Radar dev, em Lençóis/Vice City. Só leitura; não grava nem troca o tema.
(() => {
  const temaTesteAtual=document.documentElement.dataset.theme;
  if(!['light','vice'].includes(temaTesteAtual)){console.info('Escolha Lençóis ou Vice City antes de rodar.');return [];}
  const temaTesteRoot=getComputedStyle(document.documentElement);
  const temaTesteRGBA=temaTesteCor=>{
    if(temaTesteCor.trim().startsWith('#')){const temaTesteHex=temaTesteCor.trim().slice(1);return [0,2,4].map(temaTesteI=>parseInt(temaTesteHex.slice(temaTesteI,temaTesteI+2),16)).concat(1);}
    const temaTestePartes=(temaTesteCor.match(/[\d.]+/g)||[]).map(Number);return temaTestePartes.slice(0,3).concat(temaTestePartes[3]??1);
  };
  const temaTesteLum=temaTesteC=>temaTesteC.slice(0,3).map(temaTesteV=>{temaTesteV/=255;return temaTesteV<=.04045?temaTesteV/12.92:((temaTesteV+.055)/1.055)**2.4;}).reduce((temaTesteS,temaTesteV,temaTesteI)=>temaTesteS+temaTesteV*[.2126,.7152,.0722][temaTesteI],0);
  const temaTesteMix=(temaTesteA,temaTesteB)=>temaTesteA.slice(0,3).map((temaTesteV,temaTesteI)=>temaTesteV*temaTesteA[3]+temaTesteB[temaTesteI]*(1-temaTesteA[3])).concat(1);
  const temaTesteToast=document.querySelector('.toast'),temaTesteFundo=temaTesteRGBA(temaTesteRoot.getPropertyValue('--deep'));
  const temaTesteCS=temaTesteToast?getComputedStyle(temaTesteToast):null;
  const temaTesteBG=temaTesteCS?temaTesteMix(temaTesteRGBA(temaTesteCS.backgroundColor),temaTesteFundo):temaTesteFundo;
  const temaTesteFG=temaTesteCS?temaTesteMix(temaTesteRGBA(temaTesteCS.color),temaTesteBG):temaTesteFundo;
  const temaTesteL1=temaTesteLum(temaTesteFG),temaTesteL2=temaTesteLum(temaTesteBG),temaTesteRatio=(Math.max(temaTesteL1,temaTesteL2)+.05)/(Math.min(temaTesteL1,temaTesteL2)+.05);
  const temaTesteSelo=document.querySelector('.hd-title span[style*="var(--teal)"]');
  const temaTesteRows=[
    ['Toast tem cores com contraste ≥ 4,5:1',!!temaTesteCS&&temaTesteRatio>=4.5],
    ['Texto auxiliar não fica translúcido demais (no Vice, as cores de identidade foram mantidas por decisão do Caio, 16/11)',temaTesteAtual==='vice'||temaTesteRGBA(temaTesteRoot.getPropertyValue('--txt3'))[3]>=.9],
    ['Selo do título segue o tema',!!temaTesteSelo&&temaTesteRGBA(getComputedStyle(temaTesteSelo).color).slice(0,3).every((temaTesteV,temaTesteI)=>temaTesteV===temaTesteRGBA(temaTesteRoot.getPropertyValue(temaTesteAtual==='light'?'--txt':'--teal'))[temaTesteI])],
    ['Placeholders seguem a cor de leitura do tema',temaTesteAtual==='vice'||[...document.querySelectorAll('input[placeholder],textarea[placeholder]')].filter(temaTesteEl=>temaTesteEl.offsetWidth&&temaTesteEl.offsetHeight).every(temaTesteEl=>temaTesteRGBA(getComputedStyle(temaTesteEl,'::placeholder').color)[3]>=.9)]
  ].map(([teste,temaTesteOk])=>({teste,resultado:temaTesteOk?'✅':'❌'}));
  window._resultadosTeste=temaTesteRows;console.table(temaTesteRows);
  console.info('A auditoria automatizada mede também o fundo renderizado, a rolagem e os três temas. Este roteiro não substitui essa medição.');
  return temaTesteRows;
})();
