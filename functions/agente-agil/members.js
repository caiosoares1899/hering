// functions/agente-agil/members.js
//
// Réplica mínima da lista `members` do cliente (deriva de
// kanban/usuarios_publicos filtrado por squad — ver _applyUsuariosData em
// kanban-dev.html) e da resolução de handle/init pra @menções
// (getMemberHandle/getMemberByHandle/getUidByInit, mesmos nomes e mesma
// lógica de lá). NÃO replica a lógica de colisão-e-renomeação de iniciais
// do cliente (aquilo existe só pra UI ficar bonita quando duas pessoas têm
// a mesma inicial) — aqui só precisamos resolver @handle/INIT -> uid pra
// notificar; se duas contas colidem na mesma inicial, joga fora a
// resolução por segurança, igual o getUidByInit do cliente faz (não
// arrisca notificar a pessoa errada).
//
// Cache em memória por instância "quente" da function (TTL curto) — evita
// baixar usuarios_publicos inteiro toda vez que um output precisa resolver
// uma menção; várias saídas do MESMO envelope reaproveitam a mesma leitura
// via ctx.readMembers (ver board.js).

const CACHE_TTL_MS = 60 * 1000;
let _cache = { ts: 0, squadId: null, members: null };

function deriveInit(nameOrEmail) {
  if (!nameOrEmail) return '';
  const base = String(nameOrEmail).split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!base) return '';
  return base.split(/\s+/).map((w) => w[0] || '').join('').substring(0, 2).toUpperCase();
}

// Deriva @nome.sobrenome do email (nome.sobrenome@ciahering.com.br) ou do
// nome ("Caio Soares" -> caio.soares) — mesmo critério do cliente.
function getMemberHandle(m) {
  if (m.email) {
    const local = m.email.split('@')[0];
    if (local && /^[a-z0-9._-]+$/i.test(local)) return local.toLowerCase();
  }
  const parts = (m.name || m.init || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0] + '.' + parts[parts.length - 1]).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return m.init || '?';
}

function getMemberByHandle(members, handle) {
  return members.find((m) => getMemberHandle(m) === handle.toLowerCase()) || null;
}

function getUidByInit(members, init) {
  if (!init) return null;
  const matches = members.filter((m) => m.init === init);
  if (matches.length > 1) return null; // iniciais duplicadas no squad — não arrisca notificar errado
  return matches[0]?.uid || null;
}

async function readSquadMembers(db, squadId, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && _cache.members && _cache.squadId === squadId && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.members;
  }
  const snap = await db.ref('kanban/usuarios_publicos').get();
  const all = snap.val() || {};
  const members = [];
  Object.entries(all).forEach(([uid, u]) => {
    if (!u) return;
    const inThisSquad = (u.squads && u.squads[squadId] === true) || (!u.squads && (u.inscrito === true || u.inscrito === 'true'));
    if (!inThisSquad) return;
    const init = (u.init && u.init.trim()) ? u.init.trim() : deriveInit(u.nome || u.email || '');
    if (!init) return;
    // role: mesmo fallback do getEffectiveRole() do cliente (kanban-dev.html)
    // — squads_roles[squadId] (papel específico deste squad) senão o campo
    // legado u.role, senão 'membro'. NÃO replica o override de isAdmUser()
    // (allowlist de e-mail fixa, só no cliente) — quem usar `role` aqui pra
    // decidir algo sensível a segurança precisa saber dessa lacuna.
    const role = (u.squads_roles && u.squads_roles[squadId]) || u.role || 'membro';
    members.push({ uid, init, name: u.nome || u.email || '', email: u.email || '', role });
  });
  _cache = { ts: now, squadId, members };
  return members;
}

module.exports = {
  deriveInit,
  getMemberHandle,
  getMemberByHandle,
  getUidByInit,
  readSquadMembers,
  _resetCacheForTests() {
    _cache = { ts: 0, squadId: null, members: null };
  },
};
