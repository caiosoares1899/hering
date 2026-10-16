// functions/plantao/webhook.js — 🔗 o GitHub avisa o servidor quando o Antigravity abre (ou atualiza) a PR do bug (16/10/2026).
// Ele só consegue LER URLs; quem registra "PR aberta + script de teste" na ficha do plantão é o webhook do GitHub, assinado (HMAC-SHA256 com o segredo
// PLANTAO_WEBHOOK_SECRET — sem assinatura válida nada é gravado). Só aceita: pull_request do NOSSO repositório, branch `antigravity/bug-<id>` (sem fork),
// aberta por quem está na lista abaixo. O script de teste vem do corpo da PR ("## Script de teste" + bloco de código) e vai pra ficha como TEXTO que o ADM lê e
// cola no console — nunca é executado por aqui. Mexer na PR depois de validada (novo push) DESFAZ a validação: o ADM testa de novo.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');
const crypto = require('crypto');
const { idDeBranch, limpaSegredo } = require('./agente');
const { avisarAdms, cardIdDoBug } = require('./plantao');

const PLANTAO_WEBHOOK_SECRET = defineSecret('PLANTAO_WEBHOOK_SECRET');
const REPO = 'caiosoares1899/hering';
const AUTORES = ['caiosoares1899', 'Andreetta94', 'alioandrade99-netizen'];      // quem abre PR com o clique de aprovação (Caio e os ADMs colaboradores)
const ACOES = ['opened', 'reopened', 'synchronize', 'edited', 'ready_for_review'];
const FIM = ['em_prod', 'duplicado', 'cancelado'];

function assinaturaOk(rawBody, header, segredoBruto) {
  const segredo = limpaSegredo(segredoBruto);
  if (!segredo || !/^sha256=[0-9a-f]{64}$/.test(String(header || ''))) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', segredo).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(String(header)));
}
// Primeiro bloco de código depois do título "## Script de teste" (aceita ```js / ```javascript / ``` simples).
function extrairScript(body) {
  const m = /^#{1,4}\s*script de teste[^\n]*\n([\s\S]*)/im.exec(String(body || ''));
  if (!m) return null;
  const c = /```[a-z]*\n([\s\S]*?)```/i.exec(m[1]);
  const s = c ? c[1].trim() : '';
  return s.length >= 20 ? s.slice(0, 20000) : null;
}

// Pura (db injetado). `p` = payload do evento. Devolve { ok, motivo? , estado? }.
async function processarPR({ db, evento, p, agora = new Date() }) {
  if (evento !== 'pull_request') return { ok: false, motivo: 'evento_ignorado' };
  const pr = p && p.pull_request;
  if (!pr || !ACOES.includes(p.action)) return { ok: false, motivo: 'acao_ignorada' };
  if (!p.repository || p.repository.full_name !== REPO || !pr.head || !pr.head.repo || pr.head.repo.full_name !== REPO) return { ok: false, motivo: 'repo_invalido' };
  const id = idDeBranch(pr.head.ref);
  if (!id) return { ok: false, motivo: 'branch_ignorado' };
  const quem = (p.sender && p.sender.login) || '';
  if (!AUTORES.includes(quem) || !AUTORES.includes((pr.user && pr.user.login) || '')) return { ok: false, motivo: 'autor_nao_permitido' };
  if ((await db.ref('kanban/config/plantao_ativo').get()).val() === false) return { ok: false, motivo: 'desligado' };
  const ref = db.ref(`kanban/plantao/${id}`);
  const f = (await ref.get()).val();
  if (!f) return { ok: false, motivo: 'sem_ficha' };
  if (FIM.includes(f.estado)) return { ok: false, motivo: 'ficha_encerrada' };
  const url = String(pr.html_url || '');
  if (!new RegExp(`^https://github\\.com/${REPO}/pull/[0-9]+$`).test(url)) return { ok: false, motivo: 'url_invalida' };
  const sha = String((pr.head && pr.head.sha) || '').slice(0, 40);
  const script = extrairScript(pr.body) || f.scriptTeste || null;       // PR editada sem o bloco não apaga o script que já estava salvo
  const patch = { prUrl: url, prSha: sha, atualizadoEm: agora.getTime() };
  if (script) patch.scriptTeste = script;
  patch.estado = script ? 'testando' : 'pr_aberto';
  if (['reprovado', 'validado', 'escalado'].includes(f.estado) || f.prSha !== sha) {     // nova tentativa / push depois da validação: o veredito antigo não vale mais
    ['resultadoTeste', 'notaTeste', 'validadoPor', 'validadoPorUid', 'validadoEm'].forEach((c) => { patch[c] = null; });
  }
  const mudou = f.prSha !== sha || f.prUrl !== url || f.estado !== patch.estado;
  if (!mudou) return { ok: true, estado: f.estado, semMudanca: true };
  await ref.update(patch);
  const avisados = await avisarAdms(db, { id: `plantao_pr_${id}_${sha.slice(0, 7)}`, title: script ? '🧪 PR do plantão pronta para testar' : '🔧 PR do plantão aberta (sem script de teste)',
    sub: `${f.impacto || ''} — ${String(f.resumo || '').slice(0, 140)}`, cardId: f.cardId || cardIdDoBug(id), agora });
  return { ok: true, estado: patch.estado, avisados, comScript: !!script };
}

exports.plantaoGithubWebhook = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: [PLANTAO_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('método não permitido'); return; }
    if (!assinaturaOk(req.rawBody || Buffer.from(''), req.get('x-hub-signature-256'), PLANTAO_WEBHOOK_SECRET.value())) { res.status(401).send('assinatura inválida'); return; }
    try {
      const r = await processarPR({ db: getDatabase(), evento: req.get('x-github-event'), p: req.body });
      console.log('[plantaoGithubWebhook]', JSON.stringify(r));
      res.status(200).json(r);
    } catch (e) { console.error('[plantaoGithubWebhook]', e); res.status(500).send('erro no servidor'); }
  }
);
Object.assign(exports, { processarPR, extrairScript, assinaturaOk, AUTORES, REPO });
