// functions/common/clientIp.js
//
// IP do cliente de um endpoint HTTP PÚBLICO, pra usar como chave de rate limit.
//
// Achado real (/monitorarbugs 2026-10-05, áreas sensíveis): intake/submit.js e
// agente-agil/http.js usavam
//   req.headers['fastly-client-ip'] || req.headers['x-forwarded-for'] || req.ip
// e depois `split(',')[0]` — ou seja, o PRIMEIRO valor de x-forwarded-for, ou um
// cabeçalho `fastly-client-ip`. Os dois são escolhidos pelo CLIENTE: o formulário
// de intake chama `us-central1-<projeto>.cloudfunctions.net/intakeSubmit`
// DIRETO (não passa pelo Firebase Hosting, que é quem poria o Fastly na frente),
// então nada na infra define `fastly-client-ip`, e o Google só ACRESCENTA o IP
// real no fim de x-forwarded-for — tudo à esquerda vem do cliente. Mandar um
// valor diferente a cada requisição dava uma chave de rate limit nova a cada vez:
// o limite de 5 envios/hora do formulário público (sem CAPTCHA) e o de 20
// tentativas/hora de autenticação do endpoint do Agente Ágil eram contornáveis
// com um cabeçalho.
//
// Aqui: ignora `fastly-client-ip`, usa a entrada MAIS À DIREITA de
// x-forwarded-for (a que o Google acrescentou) e pula endereços internos/privados
// (se algum proxy interno vier depois, a pessoa não vira "todo mundo na mesma
// chave"). Sem x-forwarded-for, cai em req.ip.
function isPrivateIp(ip) {
  const s = String(ip).toLowerCase();
  if (/^10\./.test(s) || /^127\./.test(s) || /^192\.168\./.test(s) || /^169\.254\./.test(s)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(s)) return true;
  if (s === '::1' || /^f[cd][0-9a-f]{2}:/.test(s) || /^fe80:/.test(s)) return true;
  return false;
}

function clientIp(req) {
  const raw = req && req.headers ? req.headers['x-forwarded-for'] : '';
  const hops = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isPrivateIp(hops[i])) return hops[i];
  }
  if (hops.length) return hops[hops.length - 1];
  return (req && req.ip) || 'unknown';
}

module.exports = { clientIp, isPrivateIp };
