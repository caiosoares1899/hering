// functions/common/contaEmpresa.js
//
// 🔐 "Essa pessoa é da empresa?" para as Cloud Functions HTTP — checado no token JÁ verificado (verifyIdToken).
// Antes (até 18/10/2026) as funções só olhavam `email.endsWith('@ciahering.com.br')`. Isso é mais fraco que as regras do banco, que exigem também
// `sign_in_provider == 'google.com'`: se algum dia o login por e-mail/senha (ou outro provedor) for habilitado no projeto, alguém consegue criar
// uma conta com um endereço @ciahering.com.br que NÃO é dela — e o e-mail dela não estaria verificado. Aqui exigimos as três coisas juntas:
// domínio da empresa + e-mail verificado + provedor Google (e Microsoft só quando o modo "só Hering" estiver desligado — ver mareModo.js).
const { MARE_SO_HERING, emailDaEmpresa } = require('./mareModo');

const PROVEDORES = MARE_SO_HERING ? ['google.com'] : ['google.com', 'microsoft.com'];

function contaDaEmpresa(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  const provedor = decoded.firebase && decoded.firebase.sign_in_provider;
  return emailDaEmpresa(decoded.email) && decoded.email_verified === true && PROVEDORES.includes(provedor);
}

module.exports = { contaDaEmpresa };
