// functions/agente-agil-orquestrador/tools/notificarEspecialistaExterno.js
//
// notificar_especialista_externo — "encaminha de volta" pro especialista
// externo (Databricks, etc.) quando algo relevante acontece no card. Pedido
// direto do usuário (2026-08-31), testando com o card real que já tinha
// histórico de comentários do especialista "databricks" (uid
// 'especialista:databricks', ver detectaMencao.js/intakeTrigger.js pro
// resto do fluxo de ENTRADA — este arquivo é o caminho inverso, de SAÍDA).
//
// Identificação de qual especialista notificar: decisão explícita do
// usuário — o MODELO escolhe pelo histórico de comentários do card (ele já
// demonstrou em produção saber ler e diferenciar `uid:'especialista:X'` de
// comentário humano/automação, ver canário real 2026-08-27 no mesmo card),
// em vez de um campo novo persistido tipo `card.especialistaOrigem`. Mais
// simples, sem migração, sem exigir gravar esse campo em mais 2 lugares
// (intakeTrigger.js e mentionTrigger.js) — se no futuro isso se mostrar
// insuficiente (ex.: card sem nenhum comentário do especialista ainda, mas
// que "deveria" ser notificado), reconsiderar então.
//
// Rollout: decisão explícita do usuário — REAL direto (não dryRun fictício
// por padrão), mas restrito a squads em NOTIFICAR_ESPECIALISTA_SQUADS
// (squadScope.js), hoje só 'dev'. Diferente do resto do roadmap (que
// sempre passou por "modo sombra" antes de escrita real): aqui o risco é
// baixo e contido — o Cloud Function só chama uma URL que o PRÓPRIO
// usuário (ADM) cadastrou em painel.html, não um efeito no board.
//
// Falha de rede/timeout/HTTP não-2xx NUNCA lança exceção pro loop acima —
// sempre volta {ok:false, error, message} pro modelo poder reagir (avisar
// no comentário final que a notificação falhou, por exemplo), mesmo
// padrão de erro tratado que as outras ferramentas reais já seguem
// (ex.: criar_card com ficha_tecnica_obrigatoria).

const { z } = require('zod');

const WEBHOOK_TIMEOUT_MS = 8000;

const notificarEspecialistaExternoSchema = z.object({
  especialista: z.string().min(1),
  mensagem: z.string().min(1),
});

function makeFakeNotificarEspecialistaExternoHandler() {
  return async function fakeNotificarEspecialistaExternoHandler(input) {
    return { ok: true, simulated: true, tool: 'notificar_especialista_externo', wouldHaveExecuted: input };
  };
}

function makeRealNotificarEspecialistaExternoHandler({ db, squadId, cardId, dryRun = true }) {
  return async function realNotificarEspecialistaExternoHandler(input) {
    const snap = await db.ref(`kanban/config/agentesExternos/${input.especialista}`).get();
    const config = snap.val();
    const webhookUrl = config && typeof config.webhookUrl === 'string' ? config.webhookUrl.trim() : '';

    if (!webhookUrl) {
      return {
        ok: false,
        error: 'webhook_nao_configurado',
        message: `Não existe um webhook de retorno configurado pro especialista "${input.especialista}" — peça pra um ADM cadastrar em Painel → Configurações → 🔌 Agentes Externos, se fizer sentido avisar ele.`,
      };
    }

    // Achado real (/monitorarbugs 2026-09-03, "no agente ágil orquestrador"):
    // `kanban/config/agentesExternos/{id}` é um registro GLOBAL, compartilhado
    // por todos os squads — o campo `squads[squadId]===true` é o toggle que o
    // ADM usa em painel.html pra dizer "esse especialista vale NESTE squad"
    // (mesmo campo que agenteMarcador.js já respeita via agentesExternosDoSquad()
    // no gatilho determinístico "📎 cc"). Esta ferramenta, chamada pelo LLM,
    // nunca checava esse campo — só existência de webhookUrl — então um
    // especialista com webhook cadastrado mas desabilitado NESTE squad (ex.:
    // habilitado só em 'dados') ainda recebia o POST de verdade se o modelo,
    // rodando em 'dev', identificasse o id certo no histórico de comentários
    // do card (uid `especialista:{id}` não é validado contra o registro na
    // hora de escrever o comentário — só na hora de notificar). O toggle por
    // squad deixava de ser um limite de segurança de verdade nesse caminho.
    if (!config.squads || config.squads[squadId] !== true) {
      return {
        ok: false,
        error: 'especialista_nao_habilitado_neste_squad',
        message: `O especialista "${input.especialista}" não está habilitado neste squad — peça pra um ADM marcar o squad em Painel → Configurações → 🔌 Agentes Externos, se fizer sentido avisar ele daqui.`,
      };
    }

    // Mesma validação de esquema que painel-dev.html já faz ao salvar —
    // defesa em profundidade (o campo já devia estar bem-formado, mas
    // nunca fazer uma requisição de saída pra um esquema que não seja
    // http(s), mesmo que isso exigisse um bypass da validação do painel).
    if (!/^https?:\/\//i.test(webhookUrl)) {
      return {
        ok: false,
        error: 'webhook_url_invalida',
        message: `O webhook cadastrado pra "${input.especialista}" não é uma URL http(s) válida — avise um ADM pra corrigir o cadastro.`,
      };
    }

    const payload = {
      especialista: input.especialista,
      squadId,
      cardId: cardId || null,
      mensagem: input.mensagem,
      ts: new Date().toISOString(),
    };

    if (dryRun) {
      return { ok: true, dryRun: true, tool: 'notificar_especialista_externo', wouldHaveExecuted: payload };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        return {
          ok: false,
          error: 'webhook_http_error',
          status: resp.status,
          message: `O webhook de "${input.especialista}" respondeu HTTP ${resp.status} — a mensagem pode não ter sido processada do lado deles.`,
        };
      }
      return {
        ok: true,
        dryRun: false,
        tool: 'notificar_especialista_externo',
        message: `Mensagem enviada com sucesso pro webhook de "${input.especialista}".`,
      };
    } catch (err) {
      const timedOut = err.name === 'AbortError';
      return {
        ok: false,
        error: timedOut ? 'webhook_timeout' : 'webhook_falhou',
        message: timedOut
          ? `O webhook de "${input.especialista}" não respondeu em ${WEBHOOK_TIMEOUT_MS / 1000}s — a mensagem pode não ter chegado.`
          : `Falha ao chamar o webhook de "${input.especialista}": ${err.message}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

module.exports = {
  notificarEspecialistaExternoSchema,
  makeFakeNotificarEspecialistaExternoHandler,
  makeRealNotificarEspecialistaExternoHandler,
  WEBHOOK_TIMEOUT_MS,
};
