// functions/backup/restaurarCore.js — lógica PURA da restauração "só o que sumiu" a partir do backup completo (usada pela API da tela do Maré
// e testada sem Firebase). Regra de ouro: **nunca sobrescreve nada que existe hoje** — só traz de volta o que não está mais lá.

// Áreas de `kanban/squads/{squad}/dados` que a tela sabe restaurar (mapas chave→objeto, onde "só o que sumiu" faz sentido). O quadro (cards,
// colunas, tags…) fica de fora de propósito: tem índices derivados (cards_index, cards_archived…) e já tem a 🧯 Restaurar/Comparar própria.
const AREAS = [
  { id: 'card_comments', rotulo: '💬 Comentários dos cards', desc: 'comentários que sumiram de um card (por exclusão ou perda de dados)' },
  { id: 'config', rotulo: '⚙️ Configurações do squad', desc: 'Raias, Ficha Técnica, padrões de card, calendários, modo de impedimento… — só as chaves que não existem mais' },
  { id: 'intake_pending', rotulo: '📥 Pedidos de intake pendentes', desc: 'pedidos que ainda esperavam revisão e sumiram' },
  { id: 'subtimes', rotulo: '👥 Subtimes', desc: 'subtimes (por id) que não existem mais' },
  { id: 'kudos', rotulo: '⭐ Estrelas do Mar (kudos)', desc: 'estrelas que sumiram' },
];
const AREAS_IDS = AREAS.map((a) => a.id);

const ehObjeto = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const filhos = (v) => (Array.isArray(v) ? v.length : ehObjeto(v) ? Object.keys(v).length : 0);

// Lista o que existe no backup e NÃO existe hoje: [{ path, valor }] (path relativo à área, '' = a área inteira sumiu).
//  • objeto × objeto: desce chave a chave; chave ausente hoje → entra INTEIRA (no ponto mais alto que sumiu: um comentário, não o card todo)
//  • array × array de objetos com `id`: entram os elementos cujo id não existe hoje (anexados no fim)
//  • qualquer outra combinação (valor existe hoje, mesmo diferente) → não mexe
function faltantes(atual, backup, prefixo) {
  prefixo = prefixo || '';
  if (backup == null) return [];
  if (atual == null) return [{ path: prefixo, valor: backup }];
  if (ehObjeto(atual) && ehObjeto(backup)) {
    return Object.keys(backup).reduce((acc, k) => acc.concat(faltantes(atual[k], backup[k], prefixo ? `${prefixo}/${k}` : k)), []);
  }
  if (Array.isArray(atual) && Array.isArray(backup)) {
    const ids = new Set(atual.filter((x) => x && x.id != null).map((x) => String(x.id)));
    const novos = backup.filter((x) => x && x.id != null && !ids.has(String(x.id)));
    return novos.map((x, i) => ({ path: prefixo ? `${prefixo}/${atual.length + i}` : String(atual.length + i), valor: x }));
  }
  return [];
}

// Resumo por área pra tela: quanto tem no backup, quanto tem hoje, quantos itens voltariam e exemplos de caminho.
function compararAreas(dadosBackup, atualPorArea) {
  return AREAS.map((a) => {
    const f = faltantes(atualPorArea[a.id], (dadosBackup || {})[a.id]);
    return { id: a.id, rotulo: a.rotulo, desc: a.desc, noBackup: filhos((dadosBackup || {})[a.id]), agora: filhos(atualPorArea[a.id]), faltando: f.length, exemplos: f.slice(0, 5).map((x) => x.path || '(tudo)') };
  });
}

// Comentário que menciona o Agente Ágil dispararia o agente DE NOVO ao ser recriado (o gatilho é `onValueCreated` em card_comments) — a
// idempotência dele (`agente_agil_mencao_processed/{commentId}`) é o que o impede; então, ao restaurar comentários, qualquer um que mencione o
// agente e não tenha o registro de "já processado" ganha um marcador na MESMA gravação (update multi-caminho é atômico).
function marcadoresDeMencao(adicionados, jaProcessados, mencionaAgente, agoraIso) {
  const out = {};
  adicionados.forEach(({ path, valor }) => {
    const partes = path.split('/');
    const comentarios = partes.length === 2 ? [[partes[1], valor]] : partes.length === 1 && ehObjeto(valor) ? Object.keys(valor).map((k) => [k, valor[k]]) : [];
    comentarios.forEach(([id, c]) => { if (c && mencionaAgente(c.text) && !(jaProcessados && jaProcessados[id])) out[`agente_agil_mencao_processed/${id}`] = { at: agoraIso, restaurado: true }; });
  });
  return out;
}

module.exports = { AREAS, AREAS_IDS, faltantes, compararAreas, marcadoresDeMencao, filhos };
