// functions/common/mareModo.js
//
// 🏢 MODO "SÓ HERING" (2026-10-08) — o Maré passou a atender só a Hering. Interruptor ÚNICO do lado do servidor
// (os HTML têm o espelho `MARE_SO_HERING` em cada página; lista completa e como religar em docs/arezzo/MARE_SO_HERING.md):
//   true  → só @ciahering.com.br (Google) é "empresa"; o OKR tem uma torre só (Digital): Objetivos/eventos/avisos de outras
//           torres ficam invisíveis pro Agente Ágil, pro scan diário e pro push do Mural (os dados NÃO são apagados);
//   false → o comportamento de 2026-10-01..07: @ciahering (Google) + @arezzo.com.br (Microsoft) e 3 torres
//           (Digital, Comercial, Corporativa).
// Mudou aqui? Faça `firebase deploy --only functions:<nome>` das funções que importam este arquivo (ver o doc).
// (A variável de ambiente MARE_MODO_TESTE=varias-torres existe SÓ pros testes que cobrem o comportamento das 3 torres/Arezzo — em produção ela não
// existe e vale `true`. Pra religar de verdade, troque o `true` abaixo e leia docs/arezzo/MARE_SO_HERING.md.)
const MARE_SO_HERING = process.env.MARE_MODO_TESTE === 'varias-torres' ? false : true;

const DOMINIOS_EMPRESA = MARE_SO_HERING ? ['ciahering.com.br'] : ['ciahering.com.br', 'arezzo.com.br'];
const TORRES_TODAS = ['digital', 'comercial', 'corporativa'];
const TORRES_ATIVAS = MARE_SO_HERING ? ['digital'] : TORRES_TODAS;

// O e-mail é de uma conta da empresa? (mesma regra de TRUSTED_DOMAINS nos HTML)
const emailDaEmpresa = (email) => {
  const e = String(email || '').toLowerCase();
  return DOMINIOS_EMPRESA.some((d) => e.endsWith('@' + d));
};

// O registro (Objetivo, evento…) pertence a uma torre ativa? Lê o campo CRU `torre` (sem o campo = Digital): no modo "só Hering" o que é de
// outra torre é tratado como inexistente — NÃO como Digital (por isso não usar torreDe(), que normaliza torre desconhecida pra Digital).
// (torre desconhecida/corrompida continua valendo como Digital, igual a torreDe() — só some o que é de uma das OUTRAS torres de verdade.)
const torreAtiva = (torre) => !torre || TORRES_ATIVAS.includes(torre) || !TORRES_TODAS.includes(torre);

module.exports = { MARE_SO_HERING, DOMINIOS_EMPRESA, TORRES_ATIVAS, TORRES_TODAS, emailDaEmpresa, torreAtiva };
