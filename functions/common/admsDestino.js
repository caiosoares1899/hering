// functions/common/admsDestino.js — quem recebe os alarmes "só para ADMs" (backup, monitores de VTEX/GitHub/Firebase).
// ADM no app = `role:'adm'` OU e-mail em `kanban/config/adm_emails` (isAdmUser() do Maré). Antes, cada função olhava só o `role` e quem
// era ADM só pela lista de e-mails nunca recebia o alarme (mesma falha corrigida no guardião em 17/11/2026).
// O e-mail vira uid pelo Firebase Auth, e NÃO pelo `email` de usuarios_publicos: aquela cópia é gravável pela própria pessoa, e bastaria
// escrever o e-mail de um ADM nela para passar a receber os alarmes.
const DEFAULT_ADM_EMAILS = ['caio.soares@ciahering.com.br', 'rafael.passos@ciahering.com.br'];

function authPadrao() {
  try { return require('firebase-admin/auth').getAuth(); } catch (e) { return null; }
}

// Devolve os uids, sem repetir. `auth` é injetável (testes); sem Auth disponível, fica só com o `role`.
async function uidsDosAdms(db, opts) {
  const auth = (opts && 'auth' in opts) ? opts.auth : authPadrao();
  const [pubSnap, admSnap] = await Promise.all([db.ref('kanban/usuarios_publicos').get(), db.ref('kanban/config/adm_emails').get()]);
  const pubs = pubSnap.val() || {};
  const uids = new Set(Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm'));
  const emails = (Array.isArray(admSnap.val()) ? admSnap.val() : DEFAULT_ADM_EMAILS).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  if (auth) {
    await Promise.all([...new Set(emails)].map(async (email) => {
      try { const u = await auth.getUserByEmail(email); if (u && u.uid) uids.add(u.uid); } catch (e) {
        // e-mail sem conta ainda: ignora. Qualquer outra falha (ex.: a function sem permissão no Auth) fica no log, senão o alarme some calado.
        if (!e || e.code !== 'auth/user-not-found') console.warn('[admsDestino] não consegui achar o ADM', email, (e && (e.code || e.message)) || e);
      }
    }));
  }
  return [...uids];
}

module.exports = { uidsDosAdms, DEFAULT_ADM_EMAILS };
