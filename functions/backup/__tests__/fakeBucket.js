// Fake de bucket do Cloud Storage pros testes de backup: file(nome).{save,download,exists}, getFiles({prefix}).
function fakeBucket(inicial) {
  const arquivos = Object.assign({}, inicial || {});
  const file = (nome) => ({
    name: nome,
    save: async (texto) => { arquivos[nome] = texto; },
    download: async () => [Buffer.from(arquivos[nome])],
    exists: async () => [Object.prototype.hasOwnProperty.call(arquivos, nome)],
    metadata: { size: String(Buffer.byteLength(arquivos[nome] || '')) },
  });
  return {
    arquivos,
    file,
    getFiles: async ({ prefix } = {}) => [Object.keys(arquivos).filter((n) => !prefix || n.startsWith(prefix)).map((n) => file(n))],
  };
}
module.exports = { fakeBucket };
