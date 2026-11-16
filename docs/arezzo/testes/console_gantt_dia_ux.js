// 📅 Validação do popup do dia (Gantt · 🧭 Digital) — /melhoriauiux de 16/11/2026. SÓ LEITURA.
// Como usar: no kanban-dev.html (📊 Gantt → 🧭 Digital · dia a dia) OU no okr-dev.html (Calendário → 📊 Gantt → 🧭 Digital),
// toque num dia que tenha ações e cole isto no console (F12).
(() => {
  const d = document.querySelector('.mgc-diapop');
  const r = [];
  const ok = (teste, passou, detalhe) => r.push({ teste, resultado: passou ? '✅' : '❌', detalhe: detalhe || '' });
  ok('popup do dia aberto', !!d, d ? '' : 'toque num dia da 🧭 Digital antes');
  if (d) {
    const its = [...d.querySelectorAll('.mgc-dia-it')], lin = [...d.querySelectorAll('.mgc-dia-lrot')].map(x => x.textContent);
    ok('módulo mare-gcal v9', (window.MareGCal || {}).v === 9, 'v=' + (window.MareGCal || {}).v);
    ok('cabeçalho com data e total', /\d{2}\/\d{2}/.test(d.querySelector('.mgc-dia-tit b')?.textContent || ''), d.querySelector('.mgc-dia-tit span')?.textContent);
    ok('cada calendário com título e total', d.querySelectorAll('.mgc-dia-fonte .mgc-dia-n').length === d.querySelectorAll('.mgc-dia-grp').length, d.querySelectorAll('.mgc-dia-grp').length + ' calendário(s)');
    ok('cada linha aparece uma vez por calendário', [...d.querySelectorAll('.mgc-dia-grp')].every(g => { const l = [...g.querySelectorAll('.mgc-dia-lrot')].map(x => x.textContent); return new Set(l).size === l.length; }), lin.join(' · '));
    ok('toda ação tem o "quando"', its.every(li => (li.querySelector('.mgc-dia-q')?.textContent || '').length > 0), its.length + ' ação(ões)');
    ok('⚠️ das ações importantes aparece', [...d.querySelectorAll('.mgc-dia-it.is-alerta')].every(li => /⚠️/.test(li.textContent)), d.querySelectorAll('.is-alerta').length + ' importante(s)');
    const pos = new Set(its.map(li => { const a = li.getBoundingClientRect(), b = li.querySelector('.mgc-dia-q').getBoundingClientRect(); return innerWidth > 768 ? Math.round(b.right - a.right) + '/' + Math.round(b.top - a.top) : Math.round(b.left - a.left); }));
    ok('"quando" sempre no mesmo lugar', pos.size <= 1, [...pos].join(' | '));
    ok('sem rolagem lateral', d.scrollWidth <= d.clientWidth + 1);
  }
  console.table(r);
})();
