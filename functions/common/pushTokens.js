// functions/common/pushTokens.js
//
// O que fazer com cada resposta do FCM (sendEachForMulticast) — 2026-10-13, /monitorarbugs "ninguém recebe mais push".
//
// Antes, sendPushOnNotification APAGAVA o token sempre que o código da falha continha 'invalid-argument'. Só que o FCM v1 usa INVALID_ARGUMENT
// tanto pra "este token não é válido" quanto pra "a MENSAGEM está errada" (payload inválido, grande demais, chave reservada…). O firebase-admin
// mapeia os dois pro mesmo código `messaging/invalid-argument`. Resultado: UMA mensagem malformada (ex.: um tipo novo de notificação com um campo
// fora do padrão) fazia o FCM recusar TODOS os tokens daquele envio, a função apagava todos os fcm_tokens da pessoa — e mesmo depois de corrigida a
// mensagem ninguém mais recebia push até reativar as notificações em cada aparelho. Agora só apaga quando o token é o culpado de verdade.

// 'registration-token-not-registered' = o FCM garante que o token morreu (desinstalou, revogou, expirou) → apaga.
// 'invalid-argument' / 'invalid-registration-token' = só apaga se a mensagem de erro fala do TOKEN ("registration token…"); erro de payload não apaga.
function tokenMorto(err) {
  const code = String((err && err.code) || '');
  const msg = String((err && err.message) || '');
  if (code.includes('registration-token-not-registered')) return true;
  if (code.includes('invalid-registration-token')) return true;
  if (code.includes('invalid-argument')) return /registration token|not a valid FCM|token is not/i.test(msg);
  return false;
}

// Resumo pro log (a função só registrava "N ok, M falhas", sem dizer POR QUÊ — impossível diagnosticar sem reproduzir). [{codigo, qtd, exemplo}]
function resumirFalhas(responses) {
  const por = {};
  (responses || []).forEach((r) => {
    if (r && !r.success) {
      const code = String((r.error && r.error.code) || 'sem-codigo');
      const p = por[code] || (por[code] = { codigo: code, qtd: 0, exemplo: String((r.error && r.error.message) || '').slice(0, 160) });
      p.qtd++;
    }
  });
  return Object.values(por);
}

// Todas as falhas do envio têm o MESMO código e nenhuma é "token morto" → problema na mensagem/credencial/projeto, não nos tokens. Merece console.error.
function falhaGeral(responses) {
  const r = responses || [];
  if (!r.length || !r.every((x) => x && !x.success)) return false;
  return r.every((x) => !tokenMorto(x.error));
}

module.exports = { tokenMorto, resumirFalhas, falhaGeral };
