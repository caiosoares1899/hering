// functions/agente-agil/outputs/agentStatus.js
//
// Marca o status do agente no card — o campo por trás do badge "🤖 na
// fila"/"em execução"/"aguardando validação" na UI (card.agentStatus,
// card.executorType, restaurados nesta mesma sessão de trabalho).
//
// Escolha deliberada: status em si NÃO vira entrada de card.history. Um
// card que o agente está processando pode passar por
// queued -> running -> awaiting_validation -> done em minutos, e logar
// cada transição no histórico (lido por humano, pensado pra decisões tipo
// "quem mexeu nisso e quando") seria ruído, não clareza. Só duas coisas
// ficam registradas: erro (status:'error', porque isso É acionável por
// humano) e a vez em que o agente de fato ASSUME a execução de um card
// (executorType human -> agent, ou uma troca explícita) — isso é um fato
// real sobre "quem está tocando esse card" que vale a pena auditar.
//
// agentStatus é escalar -> update() direto. executorType, quando não vem
// explícito no payload, depende do valor ATUAL do card (só promove
// 'human'/vazio para 'agent'; se já for 'agent'/'hybrid', não mexe) — por
// isso usa transaction, pra não decidir com base num valor já
// desatualizado se um humano mudou isso ao mesmo tempo.

const EXECUTOR_LABEL = { human: 'humano', agent: 'agente', hybrid: 'híbrido' };
const HIST_CAP = 50;

async function build(out, ctx) {
  const nowISO = new Date().toISOString();
  const steps = [{ kind: 'update', path: ctx.cardPath, data: { agentStatus: out.status } }];

  let changeMsg = null;
  steps.push({
    kind: 'transaction',
    path: `${ctx.cardPath}/executorType`,
    transform(current) {
      changeMsg = null;
      if (out.executorType) {
        if (current !== out.executorType) {
          changeMsg = `alterou o tipo de execução: ${EXECUTOR_LABEL[current] || '—'} → ${EXECUTOR_LABEL[out.executorType]}`;
        }
        return out.executorType;
      }
      if (current === 'human' || current == null) {
        changeMsg = `${ctx.actor.who} assumiu a execução deste card`;
        return 'agent';
      }
      return current;
    },
    after: async () => {
      const entries = [];
      if (changeMsg) entries.push(changeMsg);
      if (out.status === 'error') entries.push('a execução automatizada deste card falhou');
      if (!entries.length) return [];
      return [
        {
          kind: 'transaction',
          path: `${ctx.cardPath}/history`,
          transform(current) {
            const history = Array.isArray(current) ? current.slice() : [];
            entries.forEach((what) => history.push({ who: ctx.actor.who, what, at: nowISO, init: ctx.actor.init }));
            return history.length > HIST_CAP ? history.slice(-HIST_CAP) : history;
          },
        },
      ];
    },
  });

  return steps;
}

module.exports = { build };
