// 🎬 Códigos de console pro brainstorm — rodar em kanban-dev.html?squad=dev (Console do navegador, já logado como ADM/PO).
// Cada bloco é independente; cole um de cada vez. Tudo só mexe na squad "dev".
// Marcas de limpeza: intake = chave "demo_…"; escala = ts 424242 (as regras do banco não aceitam campo extra no dia da escala).

// ═══ 1) INTAKE — cai na caixa de Intake pra aprovar e virar card ═══
(async () => {
  if (typeof ACTIVE_SQUAD === 'undefined' || ACTIVE_SQUAD !== 'dev') return alert('Abra a squad dev (kanban-dev.html?squad=dev) e rode de novo.');
  const id = 'demo_' + Date.now(), d = new Date(); d.setDate(d.getDate() + 7);
  const prazo = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await window._set(window._ref(window._db, 'kanban/squads/dev/dados/intake_pending/' + id), {
    id, demo: true, status: 'pending', createdAt: new Date().toISOString(), prazo,
    titulo: 'Landing page + banners da Black Friday — Hering Kids',
    descricao: 'Precisamos de uma landing exclusiva da coleção Kids pra Black Friday (27/11) e 3 banners (home, categoria e carrinho).\n\n• Mensagem: "Até 50% OFF + frete grátis acima de R$ 199"\n• Formatos: 1920x600 (desktop) e 750x900 (mobile)\n• Referência: campanha do Dia das Crianças\n• Aprovação final com o time de Marketing até 20/11.',
    demandante: 'Marina Duarte', squadDemandante: 'Marketing de Campanhas', contato: 'marina.demo@exemplo.com',
  });
  if (typeof openIntakePanel === 'function') openIntakePanel();
  console.log('✅ Intake de demonstração criado:', id);
})();

// ═══ 2) POPUP "O mar tá pra peixe" — troque o 60 por 20, 40, 60, 80 ou 100 (100 = 🏆 meta batida) ═══
(() => {
  const marco = 60;
  MareMetas.mostrarPeixes({ id: 'demo', escopo: 'digital', emoji: '🔥', titulo: 'Black Friday — captação do Digital', fmt: 'brl', alvo: 2000000, inicial: 0, atual: 2000000 * marco / 100 }, marco);
})();

// ═══ 3) ESCALA FAKE na squad dev (esta semana + 3 próximas) — usa as pessoas inscritas na squad ═══
(async () => {
  if (typeof ACTIVE_SQUAD === 'undefined' || ACTIVE_SQUAD !== 'dev') return alert('Abra a squad dev (kanban-dev.html?squad=dev) e rode de novo.');
  const pessoas = members.filter(m => m.uid);
  if (!pessoas.length) return alert('Nenhuma pessoa inscrita na squad dev.');
  const me = window._currentUser.uid, hoje = new Date(MareMetas.hojeSP() + 'T12:00:00');
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const SENTINELA = 424242; let ok = 0, falhas = 0;
  for (let p = 0; p < pessoas.length; p++) {
    const upd = {};
    for (let i = 0; i < 28; i++) {
      const dia = new Date(seg); dia.setDate(seg.getDate() + i);
      const dsem = dia.getDay(), semana = Math.floor(i / 7), base = { por: me, ts: SENTINELA };
      let e;
      if (dsem === 0 || dsem === 6) e = { t: 'folga' };                                   // fim de semana: folga
      else if (dsem === ((p + semana) % 5) + 1) e = { t: 'folga' };                       // 1 folga na semana, rotativa
      else if (dsem === 5 && (p + semana) % pessoas.length === 0) e = { t: 'plant', i: '08:00', f: '20:00', n: 'plantão Black Friday' };   // 1 plantão por semana, rotativo
      else e = { t: 'trab', i: p % 2 ? '10:00' : '09:00', f: p % 2 ? '19:00' : '18:00' };
      upd[iso(dia) + '/dev/' + pessoas[p].uid] = Object.assign(e, base);
    }
    try { await window._update(window._ref(window._db, 'kanban/escala'), upd); ok++; } catch (err) { falhas++; }   // sem permissão pra outra pessoa? grava só a sua
  }
  console.log('✅ Escala de demonstração: ' + ok + ' pessoa(s) gravada(s)' + (falhas ? ', ' + falhas + ' sem permissão' : '') + '. Veja em 📅 Calendários (👥 Escala) ou em escala-dev.html?squad=dev');
})();

// ═══ 4) LIMPAR O INTAKE de demonstração (pedidos "demo_…" + cards criados a partir deles) ═══
(async () => {
  if (typeof ACTIVE_SQUAD === 'undefined' || ACTIVE_SQUAD !== 'dev') return alert('Abra a squad dev (kanban-dev.html?squad=dev) e rode de novo.');
  const ref = window._ref(window._db, 'kanban/squads/dev/dados/intake_pending'), v = (await window._get(ref)).val() || {};
  const ids = Object.keys(v).filter(k => k.startsWith('demo_'));
  for (const k of ids) await window._remove(window._ref(window._db, 'kanban/squads/dev/dados/intake_pending/' + k));
  const cs = cards.filter(c => c.intakeId && String(c.intakeId).startsWith('demo_'));
  if (cs.length) { const idsC = new Set(cs.map(c => c.id)); cards = cards.filter(c => !idsC.has(c.id)); const flags = {}; idsC.forEach(i => { flags['cards_deleted_intentionally/' + i] = true; }); fbSaveAll(flags, []); renderBoard(); }
  console.log('🧹 Intake limpo: ' + ids.length + ' pedido(s) e ' + cs.length + ' card(s) removidos.');
})();

// ═══ 5) LIMPAR O POPUP (se ainda estiver na tela) ═══
document.querySelectorAll('.mm-fish-ov').forEach(x => x.remove());

// ═══ 6) LIMPAR A ESCALA de demonstração da squad dev (só o que foi criado pelo código 3) ═══
(async () => {
  if (typeof ACTIVE_SQUAD === 'undefined' || ACTIVE_SQUAD !== 'dev') return alert('Abra a squad dev (kanban-dev.html?squad=dev) e rode de novo.');
  const todos = (await window._get(window._ref(window._db, 'kanban/escala'))).val() || {}, upd = {}; let n = 0;
  Object.keys(todos).forEach(d => { const sq = todos[d] && todos[d].dev; if (sq) Object.keys(sq).forEach(u => { if (sq[u] && sq[u].ts === 424242) { upd[d + '/dev/' + u] = null; n++; } }); });
  if (n) await window._update(window._ref(window._db, 'kanban/escala'), upd);
  console.log('🧹 Escala limpa: ' + n + ' dia(s) removidos.');
})();
