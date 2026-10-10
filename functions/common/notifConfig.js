// functions/common/notifConfig.js
//
// 🔔 Central de Notificações do Painel (2026-10-10): interruptores por TIPO de notificação, gravados pelo ADM em
// kanban/notif_config/{tipo} = {sino?: boolean, push?: boolean, por, em}. Ausente = comportamento padrão.
//   • push: `true` força o push (mesmo fora do PUSH_TYPES), `false` bloqueia (mesmo dentro); ausente = vale o PUSH_TYPES.
//   • sino: só as páginas leem (escondem do sino) — a função não depende dele.
// A leitura nunca derruba o push: sem permissão/erro/valor estranho = padrão.

const TIPO_OK = /^[a-z0-9_]{1,40}$/;     // o tipo vem do banco: só entra em db.ref() se for uma chave simples

async function lerConfigTipo(db, tipo) {
  if (typeof tipo !== 'string' || !TIPO_OK.test(tipo)) return {};
  try {
    const snap = await db.ref(`kanban/notif_config/${tipo}`).get();
    const v = snap.val();
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

// `padrao` = o tipo está no PUSH_TYPES? Devolve se este tipo PODE virar push agora.
function pushPermitido(cfg, padrao) {
  return cfg && typeof cfg.push === 'boolean' ? cfg.push : !!padrao;
}

module.exports = { lerConfigTipo, pushPermitido, TIPO_OK };
