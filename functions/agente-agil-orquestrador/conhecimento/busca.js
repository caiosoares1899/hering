// functions/agente-agil-orquestrador/conhecimento/busca.js
//
// Busca por palavra-chave (sem acento/maiúscula) sobre as bases de conhecimento geradas — usada pela ferramenta biblioteca_agil do orquestrador
// e pela ferramenta consultar_ajuda do chat do Radar. Sem embeddings: pontua título (4×) e texto (1×, até 3 ocorrências por termo).
'use strict';

const MAX_RESULTADOS = 5;       // verbetes devolvidos por busca
const MAX_CHARS_VERBETE = 3500; // verbete maior que isso vem cortado (com aviso)

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function tokens(s) {
  return semAcento(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

// Radical simples: "instalar"/"instalo" → "instal", "recorrência"/"recorrente" → "recorren"... (tira as 2 últimas letras de palavras longas).
const radical = (q) => (q.length > 5 ? q.slice(0, q.length - 2) : q);

function pontuar(termos, titulo, texto) {
  const t = semAcento(titulo);
  const x = semAcento(texto);
  let p = 0;
  termos.map(radical).forEach((q) => {
    if (t.includes(q)) p += 4;
    const n = x.split(q).length - 1;
    if (n > 0) p += Math.min(n, 3);
  });
  return p;
}

function cortar(texto) {
  if (texto.length <= MAX_CHARS_VERBETE) return { texto, cortado: false };
  return { texto: `${texto.slice(0, MAX_CHARS_VERBETE)}… [verbete cortado — peça com uma busca mais específica]`, cortado: true };
}

// candidatos = [{grupo, titulo, texto, data?, peso?}] (peso < 1 rebaixa o grupo — as novidades não devem ganhar da Ajuda oficial). Devolve null se a busca não tem nenhum termo útil (só palavras curtas), senão até MAX_RESULTADOS.
function buscar(candidatos, busca, max = MAX_RESULTADOS) {
  const termos = tokens(busca);
  if (!termos.length) return null;
  return candidatos
    .map((c) => ({ c, p: pontuar(termos, c.titulo, c.texto) * (c.peso || 1) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, max)
    .map(({ c }) => {
      const { texto, cortado } = cortar(c.texto);
      return { grupo: c.grupo, titulo: c.titulo, ...(c.data ? { data: c.data } : {}), texto, ...(cortado ? { cortado: true } : {}) };
    });
}

module.exports = { MAX_RESULTADOS, MAX_CHARS_VERBETE, semAcento, tokens, pontuar, cortar, buscar };
