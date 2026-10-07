// functions/okr/calendario.js
//
// 📅 Calendário do OKR — parte PURA usada pelo dailyScan (lembretes de véspera e do dia). Espelha, em Node, a lógica que o cliente tem em okr-dev.html
// (`_okrCalOcorrencia`/`_okrCalRecNorm`/`_okrCalOcorrencias`/`_okrCalAbrange`) — mude uma, mude a outra (os casos de teste são os mesmos).
//
// Evento: kanban/okr/calendario/eventos/{id} = {id, titulo, tipo:'reuniao'|'evento'|'lembrete', data:'YYYY-MM-DD', diaInteiro, hi, hf, torre:''|torreId,
//   areaIds:[], objetivoIds:[], local, link, descricao, rec:null|{tipo, unidade:'dia'|'semana'|'mes'|'ano', intervalo, ate}, excecoes:{'YYYY-MM-DD':true},
//   lembrar:{vespera:bool, dia:bool}}. torre '' = agenda GLOBAL (todas as torres); torre preenchida = agenda LOCAL da torre.

const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parse = (s) => { const p = String(s || '').slice(0, 10).split('-').map(Number); return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1); };

const lista = (v) => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);

// k-ésima ocorrência (k=0 é a própria data). Mensal/anual mantêm o DIA e, se o mês não o tem (31, 29/fev), usam o último dia do mês.
function ocorrencia(data, rec, k) {
  const base = parse(data);
  if (!k) return fmt(base);
  const n = rec.intervalo * k;
  if (rec.unidade === 'dia') { base.setDate(base.getDate() + n); return fmt(base); }
  if (rec.unidade === 'semana') { base.setDate(base.getDate() + 7 * n); return fmt(base); }
  const meses = rec.unidade === 'ano' ? 12 * n : n;
  const alvo = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(base.getDate(), ultimo));
  return fmt(alvo);
}

function recNorm(ev) {
  const r = ev && ev.rec;
  if (!r || typeof r !== 'object') return null;
  const n = Math.floor(Number(r.intervalo));
  if (!['dia', 'semana', 'mes', 'ano'].includes(r.unidade) || !(n >= 1)) return null;
  return { tipo: r.tipo || 'personalizada', unidade: r.unidade, intervalo: Math.min(n, 99), ate: /^\d{4}-\d{2}-\d{2}$/.test(r.ate || '') ? r.ate : '' };
}

// Datas 'YYYY-MM-DD' do evento dentro de [de, ate], sem as ocorrências canceladas (excecoes).
function ocorrencias(ev, de, ate) {
  const out = [], ex = (ev && ev.excecoes) || {}, rec = recNorm(ev);
  if (!ev || !/^\d{4}-\d{2}-\d{2}$/.test(ev.data || '')) return out;
  if (!rec) { if (ev.data >= de && ev.data <= ate && !ex[ev.data]) out.push(ev.data); return out; }
  const fim = rec.ate && rec.ate < ate ? rec.ate : ate;
  for (let k = 0; k < 5000; k++) { const dt = ocorrencia(ev.data, rec, k); if (dt > fim) break; if (dt >= de && !ex[dt]) out.push(dt); }
  return out;
}

// O evento diz respeito a este Objetivo? Vínculo explícito vence (vale em qualquer torre); senão, dentro da torre do evento (global = todas), vale o recorte:
// TAGS (Objetivo com alguma das tags) ou GERÊNCIAS (Objetivo numa delas) — um OU o outro. Com algum recorte (Objetivos/tags/gerências) e nenhum acerto = fora.
// Sem nenhum recorte: reunião = a torre toda; evento/lembrete só se vinculado.
function abrange(ev, o) {
  const ids = lista(ev.objetivoIds), tags = lista(ev.tagIds), areas = lista(ev.areaIds);
  if (ids.includes(o.id)) return 'vinculo';
  const torre = o.torre || 'digital';
  if (ev.torre && ev.torre !== torre) return '';
  if (tags.length && lista(o.tagIds).some((t) => tags.includes(t))) return 'tag';
  if (areas.length && areas.includes(o.areaId || 'geral')) return 'gerencia';
  if (ids.length || tags.length || areas.length) return '';
  return ev.tipo === 'reuniao' ? 'torre' : '';
}

// Quem avisar: os responsáveis dos Objetivos ATIVOS que o evento abrange (mesmo critério da pauta). Devolve {uid: [títulos dos Objetivos]}.
function alvosDoEvento(ev, objetivos) {
  const out = {};
  Object.entries(objetivos || {}).forEach(([id, o0]) => {
    const o = o0 && { ...o0, id: o0.id || id };
    if (!o || o.arquivado || !abrange(ev, o)) return;
    lista(o.responsaveis).forEach((uid) => { (out[uid] = out[uid] || []).push(o.titulo || ''); });
  });
  return out;
}

// Convidados (uids) — recebem as mesmas notificações, mesmo sem Objetivo na pauta.
function convidadosDe(ev) { return lista(ev && ev.convidados); }

// Quais lembretes o evento quer (sem o campo = véspera e dia; lembrete só no dia).
function lembretesDe(ev) {
  const l = ev && ev.lembrar && typeof ev.lembrar === 'object' ? ev.lembrar : {};
  const vespera = l.vespera !== undefined ? !!l.vespera : true, dia = l.dia !== undefined ? !!l.dia : true;
  return { vespera: ev && ev.tipo === 'lembrete' ? false : vespera, dia };
}

// "toda semana" / "a cada 2 semanas · até 2026-12-31" — texto curto da repetição (pro agente; o cliente tem a versão completa em _okrCalRecTexto).
function recTexto(ev) {
  const r = recNorm(ev);
  if (!r) return '';
  const un = { dia: 'dias', semana: 'semanas', mes: 'meses', ano: 'anos' }[r.unidade];
  const t = r.intervalo === 1 ? { dia: 'todo dia', semana: 'toda semana', mes: 'todo mês', ano: 'todo ano' }[r.unidade] : `a cada ${r.intervalo} ${un}`;
  return t + (r.ate ? ` · até ${r.ate}` : '');
}

const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function horaTxt(ev) { return ev.diaInteiro ? 'dia todo' : (ev.hi ? ev.hi + (ev.hf ? '–' + ev.hf : '') : ''); }
function agendaNome(ev) {
  const nomes = { digital: 'Digital', comercial: 'Comercial', corporativa: 'Corporativa' };
  return ev.torre ? 'Agenda ' + (nomes[ev.torre] || ev.torre) : 'Agenda global';
}

module.exports = { ocorrencia, recNorm, ocorrencias, abrange, alvosDoEvento, convidadosDe, lembretesDe, horaTxt, agendaNome, recTexto, lista, DOW };
