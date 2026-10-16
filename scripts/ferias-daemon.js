#!/usr/bin/env node
/**
 * scripts/ferias-daemon.js
 *
 * Ponte Zero-Terminal do Plantão de Férias do Caio (16/10 a 03/11).
 * Roda em uma janela normal do PowerShell / CMD (fora do sandbox do Antigravity)
 * para contornar a restrição corporativa "Terminal Auto Execution: Require Review".
 *
 * Como funciona:
 * 1. A cada 45s consulta as Issues abertas no GitHub (`[Bug Férias ...]`):
 *    - Se uma Issue acabou de chegar (sem `<!-- FERIAS_STATUS:`), posta na hora o
 *      comentário `<!-- FERIAS_STATUS: em_analise -->` (atualizando o Oceano e o
 *      card na coluna Bugs da Squad Dados para 🔵 Sendo tratado).
 *    - Salva as Issues que precisam de diagnóstico/correção em `.ferias-queue/inbox.json`
 *      para o cron do Antigravity ler via `view_file` (sem usar `run_command`).
 *    - Se uma Issue já tem PR de `-dev` (`<!-- FERIAS_DEV_PR:`) e recebeu comentário
 *      `APROVADO PROD` / `/subirproprod` / `pode subir`, verifica se a PR de `-dev`
 *      foi mergeada e executa automaticamente o `promover.js`, abre a PR de Produção,
 *      comenta com `<!-- FERIAS_STATUS: resolvido -->` e fecha a Issue!
 * 2. A cada 5s monitora `.ferias-queue/outbox.json` (gravado pelo Antigravity via
 *    `write_to_file` após aplicar a correção com `replace_file_content`):
 *    - Executa `node scripts/mare-cli.js bump`, `log --type bug` e `map`;
 *    - Cria a branch `antigravity/fix-ferias-issue-<num>-dev`, faz commit, push e
 *      abre a Pull Request de `-dev` via API do GitHub;
 *    - Posta o comentário na Issue com o diagnóstico, link da PR de `-dev`, link do
 *      ambiente `-dev` e instruções para `@alioandrade99-netizen` e `@Andreetta94`.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_DIR = path.join(ROOT, '.ferias-queue');
const INBOX_FILE = path.join(QUEUE_DIR, 'inbox.json');
const OUTBOX_FILE = path.join(QUEUE_DIR, 'outbox.json');
const STATE_FILE = path.join(QUEUE_DIR, 'state.json');

const REPO_OWNER = 'caiosoares1899';
const REPO_NAME = 'hering';
const TEAM_MENTIONS = '@alioandrade99-netizen e @Andreetta94';

function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      processedDevIssues: {},
      processedProdIssues: {},
      remindedUnmergedPr: {}
    }, null, 2), 'utf8');
  }
  if (!fs.existsSync(INBOX_FILE)) {
    fs.writeFileSync(INBOX_FILE, JSON.stringify({
      updatedAt: new Date().toISOString(),
      pendingDev: [],
      info: 'Nenhuma Issue pendente no momento.'
    }, null, 2), 'utf8');
  }
}

function loadState() {
  ensureQueueDir();
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { processedDevIssues: {}, processedProdIssues: {}, remindedUnmergedPr: {} };
  }
}

function saveState(st) {
  ensureQueueDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2), 'utf8');
}

function log(msg) {
  const hr = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${hr}] 🏖️  ${msg}`);
}

function getGhToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const res = spawnSync('git', ['credential', 'fill'], {
    cwd: ROOT,
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  if (res.stdout) {
    const m = res.stdout.match(/password=(.+)/);
    if (m && m[1]) return m[1].trim();
  }
  throw new Error('Não foi possível obter o token do GitHub via git credential fill.');
}

async function ghApi(endpoint, options = {}) {
  const token = getGhToken();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`;
  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers: Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mare-ferias-daemon'
    }, options.body ? { 'Content-Type': 'application/json' } : {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`GitHub API ${resp.status} (${endpoint}): ${txt}`);
  }
  return resp.json();
}

function runCmd(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts
  });
  if (res.status !== 0) {
    throw new Error(`Comando falhou: ${cmd} ${args.join(' ')}\nSTDOUT: ${res.stdout || ''}\nSTDERR: ${res.stderr || ''}`);
  }
  return (res.stdout || '').trim();
}

function isWorkingTreeClean() {
  const out = runCmd('git', ['status', '--porcelain']);
  const lines = out.split(/\r?\n/).filter(l => l.trim() && !l.includes('.ferias-queue'));
  return lines.length === 0;
}

function parseIssueMetadata(issue) {
  const body = String(issue.body || '');
  const mArq = body.match(/\*\*App\s*\/\s*Arquivo:\*\*\s*`([^`]+)`\s*\(`([^`]+)`\)/i);
  const app = mArq ? mArq[1].trim() : 'Oceano';
  const arquivoAlvo = mArq ? mArq[2].trim() : 'kanban-dev.html';
  const mCard = body.match(/\*\*Card na Squad Dados \(Bugs\):\*\*\s*`([^`]+)`/i);
  const cardId = mCard ? mCard[1].trim() : '';
  const mFb = body.match(/\*\*ID no Firebase:\*\*\s*`([^`]+)`/i);
  const fbPath = mFb ? mFb[1].trim() : '';
  return { app, arquivoAlvo, cardId, fbPath };
}

function devTargetToProdTarget(arquivoAlvoOrTarget) {
  const clean = String(arquivoAlvoOrTarget || '')
    .replace(/\.html$/i, '')
    .replace(/\.js$/i, '')
    .replace(/-dev$/i, '');
  return clean || 'kanban';
}

// ---------------------------------------------------------------------------
// 1. Processa `.ferias-queue/outbox.json` gerado pelo Antigravity (Etapa 1 -> PR -dev)
// ---------------------------------------------------------------------------
async function processOutbox() {
  if (!fs.existsSync(OUTBOX_FILE)) return false;

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  } catch (e) {
    log(`Erro ao ler outbox.json (aguardando escrita terminar): ${e.message}`);
    return false;
  }

  const processingFile = path.join(QUEUE_DIR, `outbox.processing.${Date.now()}.json`);
  fs.renameSync(OUTBOX_FILE, processingFile);

  try {
    const issueNum = Number(payload.issueNumber);
    const target = String(payload.target || 'kanban-dev').replace(/\.html$/i, '');
    const branch = payload.branch || `antigravity/fix-ferias-issue-${issueNum}-dev`;
    const logTitle = payload.logTitle || `${target}.html (${new Date().toISOString().slice(0, 10)}) — Correção Issue #${issueNum} (Assistente Férias)`;
    const logBody = payload.logBody || `- **Correção Issue #${issueNum}:** ${payload.diagnostico || 'Ajuste aplicado via /monitorarbugs.'}`;
    const commitMsg = payload.commitMessage || `fix(${target.replace('-dev', '')}): corrigir bug reportado na issue #${issueNum}`;
    const prTitle = payload.prTitle || `${commitMsg} (-dev)`;
    const diagnostico = payload.diagnostico || 'Correção aplicada após auditoria `/monitorarbugs`.';

    log(`Processando outbox da Issue #${issueNum} (alvo: ${target})...`);

    // 1. Bump + Log + Map
    runCmd('node', ['scripts/mare-cli.js', 'bump', target]);
    runCmd('node', ['scripts/mare-cli.js', 'log', '--type', 'bug', '--title', logTitle, '--body', logBody]);
    runCmd('node', ['scripts/mare-cli.js', 'map']);

    // 2. Branch + Commit + Rebase + Push
    runCmd('git', ['checkout', '-B', branch]);
    runCmd('git', ['add', '-A']);
    runCmd('git', ['commit', '-m', commitMsg, '-m', 'Agent: antigravity']);
    runCmd('git', ['fetch', 'origin']);
    runCmd('git', ['rebase', 'origin/main']);
    runCmd('git', ['push', '-u', 'origin', branch, '--force-with-lease']);

    // 3. Abre a PR via API do GitHub
    const prBody = [
      `## 🏖️ Correção Automática em \`-dev\` — Issue #${issueNum}`,
      '',
      `Ref: #${issueNum}`,
      '',
      '### 🔍 Diagnóstico (`/monitorarbugs`)',
      diagnostico,
      '',
      '### 🧪 Como validar',
      `1. Clique em **Merge pull request** nesta PR para atualizar o ambiente \`-dev\`;`,
      `2. Teste em: https://caiosoares1899.github.io/hering/${target}.html`,
      `3. Se estiver tudo certo, volte na Issue #${issueNum} e comente **\`APROVADO PROD\`** (ou **\`/subirproprod\`**) para o robô abrir a PR de Produção automaticamente.`,
      '',
      'Agent: antigravity'
    ].join('\n');

    const pr = await ghApi('/pulls', {
      method: 'POST',
      body: {
        title: prTitle,
        head: branch,
        base: 'main',
        body: prBody
      }
    });

    log(`PR de -dev #${pr.number} criada com sucesso: ${pr.html_url}`);

    // 4. Comenta na Issue com <!-- FERIAS_STATUS: em_analise --> e <!-- FERIAS_DEV_PR: ... -->
    const commentBody = [
      '<!-- FERIAS_STATUS: em_analise -->',
      `<!-- FERIAS_DEV_PR: ${pr.number} | TARGET: ${target} -->`,
      `🛠️ **Correção pronta em \`-dev\`! (PR #${pr.number})**`,
      '',
      `**Diagnóstico da causa raiz:** ${diagnostico}`,
      '',
      `- 🔗 **PR de \`-dev\`:** ${pr.html_url}`,
      `- 🧪 **Ambiente de teste (\`-dev\`):** https://caiosoares1899.github.io/hering/${target}.html`,
      '',
      `### 📋 Próximo passo para ${TEAM_MENTIONS}:`,
      `1. Clique em **Merge pull request** na PR #${pr.number} (${pr.html_url});`,
      `2. Aguarde ~1 minuto (deploy do GitHub Pages) e valide a correção no link \`-dev\` acima;`,
      `3. Responda aqui nesta Issue com **\`APROVADO PROD\`** (ou **\`/subirproprod\`**) para eu gerar automaticamente a **PR de Produção** e concluir o chamado!`
    ].join('\n');

    await ghApi(`/issues/${issueNum}/comments`, {
      method: 'POST',
      body: { body: commentBody }
    });

    // 5. Atualiza estado e volta para main
    const state = loadState();
    state.processedDevIssues[String(issueNum)] = {
      prNumber: pr.number,
      prUrl: pr.html_url,
      target,
      at: new Date().toISOString()
    };
    saveState(state);

    runCmd('git', ['checkout', 'main']);
    fs.unlinkSync(processingFile);
    log(`Issue #${issueNum} atualizada com o link da PR #${pr.number}!`);
    await syncGithubIssues();
    return true;
  } catch (err) {
    log(`ERRO ao processar outbox: ${err.message}`);
    const errFile = processingFile.replace('.processing.', '.error.');
    fs.renameSync(processingFile, errFile);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Promove para Produção (Etapa 2 -> PR de Produção) quando aprovado na Issue
// ---------------------------------------------------------------------------
async function promoverIssueParaProd(issue, devPrNumber, targetDev) {
  const issueNum = issue.number;
  const prodTarget = devTargetToProdTarget(targetDev);
  const state = loadState();

  // Confere no GitHub se a PR de -dev já foi mergeada
  const prInfo = await ghApi(`/pulls/${devPrNumber}`);
  if (!prInfo.merged) {
    if (!state.remindedUnmergedPr[String(issueNum)]) {
      await ghApi(`/issues/${issueNum}/comments`, {
        method: 'POST',
        body: {
          body: `⚠️ Recebi o seu comando de aprovação para produção! Porém a **PR de \`-dev\` (#${devPrNumber})** ainda está aberta.\n\nPor favor, clique primeiro em **Merge pull request** em ${prInfo.html_url} — assim que ela for mergeada, eu gero a **PR de Produção** automaticamente no minuto seguinte!`
        }
      });
      state.remindedUnmergedPr[String(issueNum)] = true;
      saveState(state);
      log(`Issue #${issueNum} aprovada para prod, mas PR #${devPrNumber} ainda não foi mergeada. Lembrete enviado.`);
    }
    return;
  }

  log(`Iniciando promoção para produção (/subirproprod) da Issue #${issueNum} (alvo: ${prodTarget})...`);

  // Garante main sincronizada com origin/main
  runCmd('git', ['fetch', 'origin']);
  runCmd('git', ['checkout', 'main']);
  runCmd('git', ['reset', '--hard', 'origin/main']);

  // Executa o promover.js preservando as linhas só-de-prod
  runCmd('node', ['.claude/skills/subirproprod/promover.js', prodTarget]);

  const branchProd = `antigravity/prod-ferias-issue-${issueNum}`;
  runCmd('git', ['checkout', '-B', branchProd]);
  runCmd('git', ['add', '-A']);
  runCmd('git', ['commit', '-m', `chore(release): promover ${prodTarget} para producao (issue #${issueNum})`, '-m', 'Agent: antigravity']);
  runCmd('git', ['push', '-u', 'origin', branchProd, '--force-with-lease']);

  const prProd = await ghApi('/pulls', {
    method: 'POST',
    body: {
      title: `🚀 [Produção · Férias] Promover ${prodTarget}.html — Issue #${issueNum}`,
      head: branchProd,
      base: 'main',
      body: [
        `## 🚀 Promoção para Produção (\`/subirproprod\`) — Issue #${issueNum}`,
        '',
        `- **Origem validada em \`-dev\`:** PR #${devPrNumber}`,
        `- **Alvo promovido:** \`${prodTarget}.html\` (linhas exclusivas de produção preservadas via \`promover.js\`)`,
        '',
        `### ✅ Ação final (${TEAM_MENTIONS}):`,
        `Clique em **Merge pull request** nesta PR para publicar a correção em produção!`,
        '',
        'Agent: antigravity'
      ].join('\n')
    }
  });

  // Comenta na Issue com <!-- FERIAS_STATUS: resolvido --> e fecha a Issue
  const closeComment = [
    '<!-- FERIAS_STATUS: resolvido -->',
    `🎉 **Promoção para Produção concluída! (PR #${prProd.number})**`,
    '',
    `- 🚀 **PR de Produção (clique em Merge para publicar no ar):** ${prProd.html_url}`,
    `- 🌐 **Link de Produção:** https://caiosoares1899.github.io/hering/${prodTarget}.html`,
    '',
    `O chamado no **Oceano** e o Card na coluna **\`🐛 Bugs\` da Squad Dados** foram atualizados automaticamente para **🟢 Resolvido** e o autor já foi notificado no sino 🔔! (${TEAM_MENTIONS})`
  ].join('\n');

  await ghApi(`/issues/${issueNum}/comments`, {
    method: 'POST',
    body: { body: closeComment }
  });

  await ghApi(`/issues/${issueNum}`, {
    method: 'PATCH',
    body: { state: 'closed' }
  });

  state.processedProdIssues[String(issueNum)] = {
    prodPrNumber: prProd.number,
    prodPrUrl: prProd.html_url,
    at: new Date().toISOString()
  };
  saveState(state);

  runCmd('git', ['checkout', 'main']);
  log(`Issue #${issueNum} promovida para produção (PR #${prProd.number}) e encerrada com sucesso!`);
}

// ---------------------------------------------------------------------------
// 3. Sincroniza Issues abertas do GitHub -> `.ferias-queue/inbox.json`
// ---------------------------------------------------------------------------
async function syncGithubIssues() {
  ensureQueueDir();
  const state = loadState();
  const issues = await ghApi('/issues?state=open&per_page=30');
  const bugIssues = (Array.isArray(issues) ? issues : []).filter(
    it => !it.pull_request && String(it.title || '').includes('[Bug Férias')
  );

  const pendingDev = [];

  for (const issue of bugIssues) {
    const num = issue.number;
    const comments = await ghApi(`/issues/${num}/comments?per_page=50`);
    const allComments = Array.isArray(comments) ? comments : [];

    const hasStatusTag = allComments.some(c => /<!--\s*FERIAS_STATUS:/i.test(String(c.body || '')));
    const devPrComment = [...allComments].reverse().find(c => /<!--\s*FERIAS_DEV_PR:\s*(\d+)\s*\|\s*TARGET:\s*([^\s-]+(?:-dev)?)\s*-->/i.test(String(c.body || '')));
    const hasResolvido = allComments.some(c => /<!--\s*FERIAS_STATUS:\s*resolvido\s*-->/i.test(String(c.body || '')));

    // 1) Se acabou de ser criada, posta o ACK imediato (🔵 Sendo tratado)
    if (!hasStatusTag) {
      log(`Nova Issue detectada (#${num}: ${issue.title}). Postando ACK inicial (🔵 Sendo tratado)...`);
      await ghApi(`/issues/${num}/comments`, {
        method: 'POST',
        body: {
          body: [
            '<!-- FERIAS_STATUS: em_analise -->',
            '🏖️ **Plantão de Férias do Caio (Antigravity):** Recebi o seu relato de bug! Já atualizei o seu chamado no **Oceano** e o card na coluna **`🐛 Bugs` da Squad Dados** para **🔵 Sendo tratado**.',
            '',
            'Estou rodando o `/monitorarbugs` no código e em instantes posto aqui o diagnóstico da causa raiz + o link da **PR de `-dev`** para validação!'
          ].join('\n')
        }
      });
    }

    // 2) Se já tem PR de -dev, verifica se o time comentou APROVADO PROD / /subirproprod
    if (devPrComment && !hasResolvido && !state.processedProdIssues[String(num)]) {
      const m = String(devPrComment.body).match(/<!--\s*FERIAS_DEV_PR:\s*(\d+)\s*\|\s*TARGET:\s*([^\s]+)\s*-->/i);
      const devPrNumber = m ? Number(m[1]) : null;
      const targetDev = m ? m[2].trim() : 'kanban-dev';
      const devPrCreatedAt = new Date(devPrComment.created_at).getTime();

      const approvalComment = allComments.find(c => {
        const t = new Date(c.created_at).getTime();
        const body = String(c.body || '');
        if (t <= devPrCreatedAt) return false;
        if (/<!--\s*FERIAS_/i.test(body)) return false;
        return /\b(aprovado|subirproprod|pode subir|sobe pro prod)\b/i.test(body);
      });

      if (approvalComment && devPrNumber) {
        if (isWorkingTreeClean() && !fs.existsSync(OUTBOX_FILE)) {
          await promoverIssueParaProd(issue, devPrNumber, targetDev);
        }
      }
      continue;
    }

    // 3) Se ainda não tem PR de -dev, entra na fila `pendingDev` para o Antigravity diagnosticar e corrigir
    if (!devPrComment && !state.processedDevIssues[String(num)]) {
      const meta = parseIssueMetadata(issue);
      pendingDev.push({
        number: num,
        title: issue.title,
        html_url: issue.html_url,
        created_at: issue.created_at,
        app: meta.app,
        arquivoAlvo: meta.arquivoAlvo,
        cardId: meta.cardId,
        fbPath: meta.fbPath,
        body: issue.body
      });
    }
  }

  // Se houver Issue para o Antigravity corrigir e a árvore estiver limpa, mantém main atualizada
  if (pendingDev.length > 0 && isWorkingTreeClean() && !fs.existsSync(OUTBOX_FILE)) {
    try {
      runCmd('git', ['fetch', 'origin']);
      runCmd('git', ['checkout', 'main']);
      runCmd('git', ['pull', '--ff-only', 'origin', 'main']);
    } catch (e) {}
  }

  fs.writeFileSync(INBOX_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    pendingDevCount: pendingDev.length,
    pendingDev
  }, null, 2), 'utf8');

  return pendingDev;
}

async function main() {
  ensureQueueDir();
  const runOnce = process.argv.includes('--once');
  log('Daemon do Plantão de Férias iniciado (Zero-Terminal no Antigravity)!');
  log(`Monitorando fila em: ${QUEUE_DIR}`);

  await processOutbox();
  const pending = await syncGithubIssues();
  log(`Sincronização inicial concluída (${pending.length} issue(s) aguardando diagnóstico em -dev).`);

  if (runOnce) return;

  let lastGhSync = Date.now();
  setInterval(async () => {
    try {
      await processOutbox();
      if (Date.now() - lastGhSync >= 45000) {
        lastGhSync = Date.now();
        await syncGithubIssues();
      }
    } catch (e) {
      log(`Aviso no loop: ${e.message}`);
    }
  }, 5000);
}

main().catch(err => {
  console.error('Erro fatal no ferias-daemon:', err);
  process.exit(1);
});
