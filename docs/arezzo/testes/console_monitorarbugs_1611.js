// Cole no Maré dev ou Radar dev. Só usa dados fictícios num iframe; não acessa o Firebase.
(async () => {
  const quadro = document.createElement('iframe'); quadro.hidden = true;
  document.body.appendChild(quadro);
  try {
    const w = quadro.contentWindow;
    for (const nome of ['mare-ferias-dev.js', 'mare-gcal-dev.js']) {
      await new Promise((ok, erro) => {
        const s = w.document.createElement('script');
        s.src = new URL(nome, location.href).href;
        s.onload = ok; s.onerror = erro; w.document.head.appendChild(s);
      });
    }
    const linhas = await w.eval('(' + (async function () {

 const r=[]; document.body.innerHTML='<div id=ferias></div><div id=gantt></div>';
 window._db={}; window._ref=(_,p)=>p; window.__ouvintes={}; window.__gravacoes=[];
 window._onValue=(p,cb)=>{window.__ouvintes[p]=cb;return ()=>{};};
 window._set=async(p,v)=>window.__gravacoes.push({p,v});
 const api=MareFerias.montar(document.getElementById('ferias'),{uid:'teste',suf:'_dev',pessoas:[{uid:'teste',nome:'Pessoa fictícia'}]});
 const emitir=window.__ouvintes['kanban/ferias_dev'];
 emitir({val:()=>({teste:{periodo:{ini:'2026-12-01',fim:'2026-12-10'}}})});
 api.abrirMinhas(); document.querySelector('[data-act="edit"]').click();
 emitir({val:()=>({})});
 document.querySelector('[data-act="salvar"]').click();
 await new Promise(r=>setTimeout(r,30));
 r.push({teste:'Férias: período apagado não deve ser recriado',passou:!window.__gravacoes.length,gravacoes:window.__gravacoes});
 api.destruir();
 const g=MareGCal.montar(document.getElementById('gantt'),{aba:'digital'});
 const dia=document.querySelector('.mgc-dhd[data-dia]'); const iso=dia.dataset.dia; dia.click();
 const aberto=!!document.querySelector('.mgc-diapop');
 document.querySelector('.mgc-btn[data-nav="28"]').click();
 document.querySelector('.mgc-btn[data-nav="28"]').click();
 const fechado=!document.querySelector('.mgc-diapop');
 document.querySelector('.mgc-btn[data-nav="0"]').click();
 r.push({teste:'Gantt: voltar a Hoje não deve reabrir dia antigo',passou:aberto&&fechado&&!document.querySelector('.mgc-diapop'),aberto,fechado,reabriu:!!document.querySelector('.mgc-diapop'),iso});
 g.destruir(); 
      return r.map(x => ({ teste: x.teste, resultado: x.passou ? '✅' : '❌', detalhe: x.gravacoes ? x.gravacoes.length + ' escrita(s) simulada(s)' : 'Popup reabriu: ' + x.reabriu }));
    }).toString() + ')()');
    window._resultadosTeste = linhas;
    console.table(linhas);
    return linhas;
  } finally { quadro.remove(); }
})();
