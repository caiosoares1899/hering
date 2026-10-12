// Dados de exemplo das Metas/Desafios (🐟 "O mar tá pra peixe") — usado por test_metas.js e pelos prints. Datas relativas a hoje (horário de Brasília).
const SP = d => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
exports.add = n => SP(new Date(Date.now() + n * 864e5));
exports.U = (uid, nome, email) => ({ uid, email: email || uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
// papel: papel do usuário 'eve' na squad dev; opts.sem = { marco:true } tira o marco fresco do popup
exports.seed = function (papel, opts) {
  opts = opts || {}; const now = Date.now(), add = exports.add;
  const pubs = {
    eve: { uid: 'eve', nome: 'Eve Souza', init: 'EV', email: 'eve@ciahering.com.br', role: papel === 'adm' ? 'adm' : papel, squads: { dev: true }, squads_roles: { dev: papel === 'adm' ? 'membro' : papel } },
    ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dev: true }, squads_roles: { dev: 'membro' } },
    pau: { uid: 'pau', nome: 'Paulo PO', init: 'PP', email: 'pau@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  };
  const s = { kanban: {
    usuarios: { eve: Object.assign({ inscrito: true }, pubs.eve) }, usuarios_publicos: pubs,
    config: { adm_emails: papel === 'adm' ? ['eve@ciahering.com.br'] : [] },
    metas_squads_dev: {
      dev: {
        a: { titulo: 'Black Friday — Site Hering', emoji: '🛒', tipo: 'meta', fmt: 'brl', alvo: 2000000, inicial: 0, atual: 840000, inicio: add(-3), fim: add(4), ativo: true, global: true, marco: 40, marcoTs: now - 3e6, atualizadoEm: now - 25 * 60e3, atualizadoPor: 'ana', atualizadoNome: 'Ana Lima', lembrete: { modo: 'cada', cada: 1, de: '08:00', ate: '22:00' }, criadoEm: 1, ordem: 1 },
        b: { titulo: 'Camisetas Hering Kids', emoji: '🧒', tipo: 'desafio', fmt: 'num', sufixo: 'camisetas', alvo: 500, inicial: 0, atual: 180, inicio: add(0), fim: add(0), submarca: 'tag_sm_kids_com', ativo: true, global: true, atualizadoEm: now - 5 * 3600e3, atualizadoNome: 'Bruno', lembrete: { modo: 'cada', cada: 1 }, criadoEm: 2, ordem: 2 },
        c: { titulo: 'Marketplace — Mercado Livre', emoji: '📦', tipo: 'desafio', fmt: 'brl', alvo: 300000, inicial: 0, atual: 300000, canal: 'tag_cv_meli1', inicio: add(-2), fim: add(3), ativo: true, marco: 100, marcoTs: now - 3600e3, atualizadoEm: now - 3e5, criadoEm: 3, ordem: 3 },
        d: { titulo: 'Conversão do App', emoji: '📱', tipo: 'desafio', fmt: 'pct', alvo: 4, inicial: 0, atual: 0.9, inicio: add(-3), fim: add(4), ativo: true, atualizadoEm: now - 3600e3, criadoEm: 4, ordem: 4 },
        e: { titulo: 'Meta antiga (inativa)', emoji: '🎯', tipo: 'meta', fmt: 'num', alvo: 10, atual: 1, ativo: false, criadoEm: 5, ordem: 5 },
      },
      dados: { z: { titulo: 'Captação Dados', emoji: '📊', tipo: 'meta', fmt: 'brl', alvo: 100000, inicial: 0, atual: 30000, global: true, ativo: true, criadoEm: 1 }, w: { titulo: 'Interna do Dados (não global)', tipo: 'meta', fmt: 'num', alvo: 5, atual: 1, global: false, ativo: true, criadoEm: 2 } },
      prf: { y: { titulo: 'Mídia paga ROAS', emoji: '💰', tipo: 'meta', fmt: 'num', sufixo: 'ROAS', alvo: 8, inicial: 0, atual: 7.4, global: true, ativo: true, criadoEm: 1 } },
    },
    metas_digital_dev: {
      g: { titulo: 'Black Friday 2026 — Captação do Digital', emoji: '🔥', tipo: 'meta', fmt: 'brl', alvo: 12000000, inicial: 0, atual: 5600000, inicio: add(-3), fim: add(4), ativo: true, marco: 40, marcoTs: now - 9e6, atualizadoEm: now - 40 * 60e3, atualizadoNome: 'Paulo', criadoEm: 1 },
      h: { titulo: 'Dia 27: 1 milhão de peças', emoji: '👕', tipo: 'desafio', fmt: 'num', sufixo: 'peças', alvo: 1000000, inicial: 0, atual: 310000, inicio: add(1), fim: add(1), ativo: true, atualizadoEm: now - 3600e3, criadoEm: 2 },
    },
    metas_log_dev: { a: {} },
  } };
  const pts = []; for (let i = 0; i < 14; i++) pts.push([now - (14 - i) * 3.5 * 3600e3, Math.round(840000 * (i + 1) / 14 * (0.8 + 0.2 * Math.sin(i)))]);
  s.kanban.metas_log_dev.a = Object.fromEntries(pts.map(([t, v], i) => [String(t).padStart(14, '0') + '_x' + i, { v, t, nome: 'Ana' }]));
  if (opts.semMarcoFresco) { delete s.kanban.metas_squads_dev.dev.a.marcoTs; delete s.kanban.metas_squads_dev.dev.c.marcoTs; delete s.kanban.metas_digital_dev.g.marcoTs; }
  return s;
};
