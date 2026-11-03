(async () => {
  // 🔎 PROCURAR NO CACHE DESTE NAVEGADOR o card sumido. SOMENTE LEITURA: lê só o IndexedDB DESTE computador, não fala com o Firebase.
  // Rode no console (F12) de kanban.html?squad=midiacriativa em CADA computador de quem mexeu no board em 30/10–31/10 — principalmente de quem NÃO recarregou a página depois.
  const ID = 'c1793384127157_bzg', TIT = 'REGATAS LIVIA';
  const linhas = [];
  const t = (teste, ok, detalhe) => linhas.push({ teste, resultado: ok ? '✅' : '❌', detalhe });
  const existe = indexedDB.databases ? (await indexedDB.databases()).some(d => d.name === 'mare_digital_cache') : true;
  if (!existe) { t('1. Este navegador tem cache do Maré', false, 'sem cache (nunca abriu o Maré aqui, ou o navegador limpou os dados)'); console.table(linhas); return linhas; }
  const db = await new Promise((res, rej) => { const r = indexedDB.open('mare_digital_cache'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let achados = [];
  if (db.objectStoreNames.contains('cards_cache')) {
    const st = db.transaction('cards_cache', 'readonly').objectStore('cards_cache');
    const val = await new Promise((res, rej) => { const q = st.get('cardsCache_v1_' + ACTIVE_SQUAD); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const lista = Object.values((val && val.cardsById) || {});
    t('1. Este navegador tem cache dos cards da squad ' + ACTIVE_SQUAD, !!val, val ? lista.length + ' cards no cache' : 'sem cache desta squad');
    achados = lista.filter(c => c && (c.id === ID || String(c.title || '').includes(TIT)));
  } else t('1. Este navegador tem cache dos cards', false, 'sem a tabela de cache');
  db.close();
  t('2. O card sumido está no cache deste navegador', achados.length > 0, achados.length ? achados.map(c => c.id + ' · ' + String(c.title).slice(0, 60) + ' · desc ' + (c.desc || '').length + ' chars · hist ' + (c.history || []).length).join(' | ') : 'não está');
  console.table(linhas);
  if (achados.length) { const json = JSON.stringify(achados); window._cardsDoCache = achados; console.log('🎯 ENCONTRADO. Copie o texto abaixo e mande ao ADM:'); console.log(json); try { await navigator.clipboard.writeText(json); console.log('📋 (já copiei para a área de transferência)'); } catch (e) { console.log('(copie o texto acima manualmente)'); } }
  return linhas;
})();
