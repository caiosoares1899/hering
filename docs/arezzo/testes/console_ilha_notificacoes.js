// Abra a Ilha → Notificações no Maré dev. Só leitura; não envia nem remove avisos.
(() => {
  const slot=document.getElementById('ilha-sino-slot');
  if(!slot){ console.warn('Abra a Ilha Dinâmica e escolha Notificações antes de rodar.'); return []; }
  const testes=[
    ['Sino original dentro da Ilha',!!slot.querySelector('#notif-panel')],
    ['Sem painel ou lista duplicados',document.querySelectorAll('#notif-panel').length===1&&document.querySelectorAll('#notif-list').length===1],
    ['Limpeza, som, push, Não Perturbe e insistente presentes',!!slot.querySelector('.notif-ft .notif-mark-all')&&['notif-sound-toggle','notif-perm-row','dnd-toggle-btn','ins-toggle-btn'].every(id=>!!slot.querySelector('#'+id))],
    ['Lista sem corte nos oito primeiros',slot.querySelectorAll('.notif-item').length===_ilha.notifs.length],
    ['Painel sem rolagem lateral',document.getElementById('ilha-painel').scrollWidth<=document.getElementById('ilha-painel').clientWidth+1]
  ].map(([teste,ok])=>({teste,resultado:ok?'✅':'❌'}));
  console.table(testes);
  console.log('Não Perturbe:',isDndActive()?'ligado':'desligado','| Som:',isNotifSoundMuted()?'desligado':'ligado');
  return testes;
})();
