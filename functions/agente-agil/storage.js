// functions/agente-agil/storage.js
//
// Único arquivo que sabe COMO e ONDE o Agente Ágil guarda arquivo no
// Cloud Storage (relatórios HTML + imagens extraídas). Mesmo papel que
// board.js cumpre pro Realtime Database, mas pro Storage.
//
// O link devolvido pro card é uma SIGNED URL, não um getDownloadURL()
// com token: getDownloadURL() nunca expira e, na prática, vira um link
// público permanente pra quem tiver a URL (o token não é revalidado
// contra login nem Storage Rules a cada acesso — é uma capability, não
// uma checagem de auth de verdade). Signed URL tem o mesmo problema de
// fundo (é bearer token também), mas pelo menos expira — e a expiração
// aqui foi escolhida pra ficar logo depois da janela de retenção dos
// arquivos (ver storage-lifecycle.json), então quando o link "morre" o
// arquivo já não existe mais de qualquer forma.
//
// Path dos relatórios: relatorios/{squad}/{cardId}/{data-YYYY-MM-DD}/...
// — SEM sobrepor dados_diarios/**, que é o path já usado pelo upload de
// PDF do painel.html (cliente autenticado, direto pelo browser).

const { getStorage } = require('firebase-admin/storage');

const SIGNED_URL_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias — retenção é 2, com 1 dia de folga

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function reportBasePath(squad, cardId, date = todayStr()) {
  return `relatorios/${squad}/${cardId}/${date}`;
}

async function uploadAndSign(path, buffer, contentType) {
  const file = getStorage().bucket().file(path);
  await file.save(buffer, { contentType, resumable: false });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + SIGNED_URL_EXPIRY_MS });
  return url;
}

module.exports = { reportBasePath, uploadAndSign, SIGNED_URL_EXPIRY_MS };
