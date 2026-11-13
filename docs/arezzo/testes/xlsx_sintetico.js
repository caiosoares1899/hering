// Monta um .xlsx SINTÉTICO (zip + XML mínimo) para os testes dos calendários do Gantt.
// As planilhas reais da Hering (preços, promoções) NUNCA entram no repositório: os testes usam isto.
// Usa o "bit 3" (tamanhos zerados no cabeçalho local, como o Excel/Sheets às vezes grava) para
// provar que o leitor do Painel pega os tamanhos do diretório central.
const zlib = require('node:zlib');

const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

function zip(files) {
  const locais = [], central = []; let off = 0;
  for (const [nome, txt] of Object.entries(files)) {
    const dado = Buffer.from(txt, 'utf8'), comp = zlib.deflateRawSync(dado), nm = Buffer.from(nome, 'utf8'), crc = crc32(dado);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(nm.length, 26); // bit 3: crc/tamanhos = 0
    const dd = Buffer.alloc(16); dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(comp.length, 8); dd.writeUInt32LE(dado.length, 12);
    locais.push(lh, nm, comp, dd);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(dado.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nm); off += 30 + nm.length + comp.length + 16;
  }
  const cd = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locais, cd, end]);
}

// abas: [{ nome, oculta, celulas: { 'r,c': valor (número = célula numérica, texto = sharedString) }, merges: [[r1,c1,r2,c2]] }]
function xlsx(abas) {
  const ss = [], idx = new Map(); const si = v => { if (!idx.has(v)) { idx.set(v, ss.length); ss.push(v); } return idx.get(v); };
  const files = {};
  abas.forEach((a, i) => {
    const linhas = new Map();
    for (const [k, v] of Object.entries(a.celulas)) { const [r, c] = k.split(',').map(Number); if (!linhas.has(r)) linhas.set(r, []); linhas.get(r).push([c, v]); }
    const rows = [...linhas.entries()].sort((x, y) => x[0] - y[0]).map(([r, cs]) => `<row r="${r}">` + cs.sort((x, y) => x[0] - y[0]).map(([c, v]) =>
      typeof v === 'number' ? `<c r="${colL(c)}${r}"><v>${v}</v></c>` : `<c r="${colL(c)}${r}" t="s"><v>${si(String(v))}</v></c>`).join('') + '</row>').join('');
    const mg = (a.merges || []).length ? `<mergeCells count="${a.merges.length}">` + a.merges.map(([r1, c1, r2, c2]) => `<mergeCell ref="${colL(c1)}${r1}:${colL(c2)}${r2}"/>`).join('') + '</mergeCells>' : '';
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData>${mg}</worksheet>`;
  });
  files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
    + abas.map((a, i) => `<sheet name="${xe(a.nome)}" sheetId="${i + 1}"${a.oculta ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + abas.map((a, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${i % 2 ? '/xl/' : ''}worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>';
  files['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + ss.map(s => `<si><r><t xml:space="preserve">${xe(s.slice(0, Math.ceil(s.length / 2)))}</t></r><r><t>${xe(s.slice(Math.ceil(s.length / 2)))}</t></r></si>`).join('') + '</sst>';
  return zip(files);
}

// ── Calendário de Marca (aba HERING 2026): col 2 = 01/01, linha 2 = dia do mês, linha 3 = dia da semana.
// O cabeçalho de meses da linha 1 vem 1 coluna adiantado em fevereiro (como na planilha real).
const DOWS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
function marca(ano, linhas, nome, cab1) {
  const cel = {}, merges = [], col = iso => 2 + Math.round((Date.UTC(...iso.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(ano, 0, 1)) / 864e5);
  cel['1,2'] = cab1 !== undefined ? cab1 : `JANEIRO/${ano}`; cel['1,32'] = `FEVEREIRO ${ano}`;   // a aba KIDS real traz a DATA (número de série) em vez de "JANEIRO"
  for (let d = new Date(Date.UTC(ano, 0, 1)); d.getUTCFullYear() === ano; d.setUTCDate(d.getUTCDate() + 1)) {
    const c = col(d.toISOString().slice(0, 10)); cel[`2,${c}`] = d.getUTCDate(); cel[`3,${c}`] = DOWS[d.getUTCDay()];
  }
  linhas.forEach(({ r, rot, barras }) => { cel[`${r},1`] = rot; (barras || []).forEach(([ini, fim, txt]) => { const a = col(ini), b = col(fim); cel[`${r},${a}`] = txt; if (b > a) merges.push([r, a, r, b]); }); });
  return { nome: nome || `HERING ${ano}`, celulas: cel, merges };
}
// ── Calendário Comercial (uma aba por mês, modelo Vertex42): D1 = número de série do dia 1; semana = linha com os
// números dos dias nas colunas D..J (domingo..sábado); rótulo da linha na coluna B.
function comercialMes(nome, ano, mes, semanas, extra) {
  const cel = {}, serial = Math.round((Date.UTC(ano, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 864e5);
  cel['1,4'] = serial; cel['2,4'] = 'Comercial Web Hering'; cel['4,4'] = 'MONTH ' + ano;
  let r = 6; const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay(); const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let dia = 1; let s = 0;
  while (dia <= ult) {
    const colDia = {};
    for (let w = (s === 0 ? primeiro : 0); w < 7 && dia <= ult; w++) { cel[`${r},${4 + w}`] = dia === 1 ? '1' : dia;   // como na planilha real: o dia 1 vem como TEXTO
      colDia[dia] = 4 + w; dia++; }
    (semanas[s] || []).forEach(([dr, rot, dias, txt]) => { if (rot) cel[`${r + dr},2`] = rot; (dias || []).forEach(d => { if (colDia[d]) cel[`${r + dr},${colDia[d]}`] = txt; }); });
    r += 12; s++;
  }
  Object.assign(cel, extra || {});
  return { nome, celulas: cel, merges: [] };
}
// ── Calendário Marketplace (aba "NOVEMBRO 26"): régua longa com um bloco ANTIGO copiado no começo (DEZEMBRO 2023, deve ser ignorado)
// e o bloco do mês no fim (cabeçalho "Novembro 2026" na linha 1). Coluna A: "HERING MARKETPLACE" e os marketplaces, cada rótulo
// MESCLADO sobre as sublinhas dele. linhas: [{ r, rot, ate, barras:[[rLinha, diaIni, diaFim, txt]] }]; sobra: [[r, dia, txt]] = linha fora de mescla.
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function mktMes(nome, ano, mes, linhas, extra) {
  const cel = {}, merges = []; const C0 = 40;   // o mês começa na coluna 40; 2..38 é o bloco antigo
  cel['1,2'] = 'DEZEMBRO 2023'; for (let d = 1; d <= 30; d++) { cel[`2,${1 + d}`] = d; cel[`3,${1 + d}`] = 'SEG'; }
  cel[`1,${C0}`] = `${MESES_PT[mes - 1]} ${ano}`;
  const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let d = 1; d <= ult; d++) { cel[`2,${C0 + d - 1}`] = d; cel[`3,${C0 + d - 1}`] = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()]; }
  cel['7,1'] = 'WEB'; cel[`7,${C0}`] = 'WEB DA MARCA NÃO ENTRA';
  cel['22,1'] = 'HERING MARKETPLACE';
  (linhas || []).forEach(L => {
    cel[`${L.r},1`] = L.rot; if (L.ate > L.r) merges.push([L.r, 1, L.ate, 1]);
    cel[`${L.r},5`] = 'BLOCO ANTIGO NÃO ENTRA';
    (L.barras || []).forEach(([r, d1, d2, txt]) => { const a = C0 + d1 - 1, b = C0 + d2 - 1; cel[`${r},${a}`] = txt; if (b > a) merges.push([r, a, r, b]); });
  });
  Object.assign(cel, (extra && extra.celulas) || {});
  return { nome, oculta: !!(extra && extra.oculta), celulas: cel, merges, C0 };
}
// ── Calendário Outlet (uma planilha por mês): aba "CALENDÁRIO", linha 2 = cabeçalho (DIA DA SEMANA | DIA | AÇÃO PRINCIPAL | AÇÃO SECUNDÁRIA |
// AÇÃO DA MADRUGADA | AÇÕES MÍDIA 02 | META CAPTADO | MARGEM), uma linha por dia. acoes: { 'AÇÃO PRINCIPAL': [[d1, d2, txt]], … }.
// serial: põe datas (número de série) numa 2ª aba — é de onde o leitor tira o mês quando o nome do arquivo não diz.
const DOW_OUT = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
function outletMes(ano, mes, acoes, serial) {
  const cab = ['DIA DA SEMANA', 'DIA', 'AÇÃO PRINCIPAL', 'AÇÃO SECUNDÁRIA', 'AÇÃO DA MADRUGADA', 'AÇÕES MÍDIA 02', 'META CAPTADO', 'MARGEM'];
  const cel = { '1,11': 'CALENDÁRIO MÍDIA' }; cab.forEach((h, i) => { cel[`2,${i + 1}`] = h; });
  const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let d = 1; d <= ult; d++) { const r = 2 + d; cel[`${r},1`] = DOW_OUT[new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()]; cel[`${r},2`] = d; cel[`${r},7`] = 1000 * d; cel[`${r},8`] = 'MARGEM NÃO ENTRA'; }
  for (const [col, lista] of Object.entries(acoes)) { const c = cab.indexOf(col) + 1; lista.forEach(([d1, d2, txt]) => { for (let d = d1; d <= d2; d++) cel[`${2 + d},${c}`] = txt; }); }
  const abas = [{ nome: 'CALENDÁRIO', celulas: cel }, { nome: 'RESUMO AÇÕES', celulas: { '3,1': 'BEMVINDO20', '3,4': 130639.19 } }];
  if (serial) { const c2 = {}; const s0 = Math.round((Date.UTC(ano, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 864e5); for (let d = 0; d < ult; d++) c2[`${4 + d},1`] = s0 + d; abas.push({ nome: 'AÇÕES DIA A DIA', celulas: c2 }); }
  return abas;
}
module.exports = { xlsx, marca, comercialMes, mktMes, outletMes, colL };
