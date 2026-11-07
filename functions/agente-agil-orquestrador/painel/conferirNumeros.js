// functions/agente-agil-orquestrador/painel/conferirNumeros.js
//
// Trava de conferência do Agente Ágil no Painel (docs/AGENTE_AGIL_PAINEL.md, princípio 2): todo número que o TEXTO da resposta cita precisa existir no
// resultado de alguma ferramenta (ou na pergunta da própria pessoa). É guarda, não garantia: pega o modelo "arredondando de cabeça" ou inventando.
//   • Aceita o formato pt-BR do texto ("4,3", "1.234", "70%") e o formato JSON das ferramentas (4.3, 1234); também lê números dentro de strings já formatadas.
//   • Arredondamento: se o texto diz "4,3" e a ferramenta devolveu 4.27, confere (compara na casa decimal que o texto usou).
//   • Ignora o que não é "dado": datas (06/11, 2026-11-06), horas (14:02), anos, numeração de lista ("1.", "2)") e ordinais ("1ª").
const ANO = /^(19|20)\d{2}$/;

function normalizar(tok) {
  // "1.234,5" → 1234.5 · "4,3" → 4.3 · "1.234" (milhar) → 1234 · "4.3" (decimal vindo de JSON) → 4.3
  let s = String(tok);
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return { valor: v, casas: (s.split('.')[1] || '').length };
}

// Remove do texto o que parece data/hora/ordinal/numeração antes de procurar números.
function limpar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b\d+\s*[ªº]/g, ' ')
    .replace(/^\s*\d+[.)]\s+/gm, ' ');
}

function numerosDe(texto) {
  const out = [];
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
  let m;
  const t = limpar(texto);
  while ((m = re.exec(t))) {
    if (ANO.test(m[0])) continue;
    const n = normalizar(m[0]);
    if (Number.isFinite(n.valor)) out.push({ raw: m[0], valor: n.valor, casas: n.casas });
  }
  return out;
}

function coletar(v, saida) {
  if (v == null) return;
  if (typeof v === 'number') { if (Number.isFinite(v)) saida.push({ valor: v }); return; }
  if (typeof v === 'string') { numerosDe(v).forEach((n) => saida.push({ valor: n.valor })); return; }
  if (Array.isArray(v)) { v.forEach((x) => coletar(x, saida)); return; }
  if (typeof v === 'object') Object.values(v).forEach((x) => coletar(x, saida));
}

// conferir(texto, saidasDasFerramentas[], perguntaDaPessoa) → { ok, naoConferidos: [raw…] }
function conferir(texto, saidas, pergunta) {
  const fonte = [];
  coletar(saidas, fonte);
  if (pergunta) numerosDe(pergunta).forEach((n) => fonte.push({ valor: n.valor }));
  const naoConferidos = [];
  for (const n of numerosDe(texto)) {
    const tol = 0.5 * Math.pow(10, -n.casas) + 1e-9;   // "4,3" aceita 4.25…4.35
    const achou = fonte.some((f) => Math.abs(f.valor - n.valor) <= tol);
    if (!achou && !naoConferidos.includes(n.raw)) naoConferidos.push(n.raw);
  }
  return { ok: naoConferidos.length === 0, naoConferidos };
}

module.exports = { conferir, numerosDe, normalizar };
