// functions/agente-agil/outputs/checklistItem.js
//
// Marca um item do checklist como feito/pendente — cria o item (e o grupo,
// se precisar) em vez de falhar quando ainda não existe, porque o Agente
// Ágil costuma reportar como feito um passo que ele mesmo deveria ter
// deixado registrado antes. Igual ao resto do board, o texto é a única
// "chave" do item — não existe id estável em card.checklist (ver getCL()
// no cliente, kanban-dev.html).
//
// Escolha deliberada pela clareza: quando `grupo` não vem no payload, o
// item novo cai num grupo PRÓPRIO do agente ("🤖 Processo automatizado"),
// não no grupo genérico "Checklist" do humano — quem abre o card depois
// enxerga na hora quais itens nasceram de automação, sem precisar ler
// texto nenhum. `grupo` no payload mira num grupo já existente (por
// título, case-insensitive) ou nomeia um novo.
//
// checklistGroups e checklist são dois arrays independentes no card — cada
// um ganha sua PRÓPRIA transaction (granular, nunca reescreve o card
// inteiro). Histórico e a notificação de "checklist concluída" só podem
// ser decididos depois que a transaction do checklist commitar de verdade
// (o transform pode rodar mais de uma vez em retry) — por isso usam o
// hook `after`, que recebe o valor já commitado.

const notify = require('../notifications');

const AGENT_GROUP_ID = 'agente-agil';
const AGENT_GROUP_TITLE = '🤖 Processo automatizado';
const HIST_CAP = 50;

function slugifyGroup(title) {
  return (
    String(title)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40) || AGENT_GROUP_ID
  );
}

function resolveGroup(groupTitleInput, currentGroups) {
  if (!groupTitleInput) return { id: AGENT_GROUP_ID, title: AGENT_GROUP_TITLE };
  const existing = (currentGroups || []).find((g) => g && g.title && g.title.toLowerCase() === groupTitleInput.toLowerCase());
  if (existing) return { id: existing.id, title: existing.title };
  return { id: slugifyGroup(groupTitleInput), title: groupTitleInput };
}

// Título de grupo não é chave única — o botão "+ grupo" da UI cria grupo
// novo com título placeholder "Checklist" até alguém renomear, então é
// normal um card ter DOIS grupos com o mesmo título (ex.: o "Checklist"
// original vazio + um "Checklist" novo com os itens de verdade).
// resolveGroup() acima escolhe só UM id (o primeiro por título) — bom o
// bastante pra decidir onde CRIAR um item novo, mas ruim pra decidir se um
// item já existe: se a busca olhasse só pra esse id, um item que mora no
// OUTRO grupo do mesmo título seria tratado como inexistente, e o agente
// criaria um duplicado em vez de achar o item certo. Por isso a busca por
// item existente considera TODOS os grupos cujo título bate, não só o
// primeiro.
function matchingGroupIds(groupTitleInput, currentGroups, resolvedGroupId) {
  if (!groupTitleInput) return new Set([resolvedGroupId]);
  const ids = (currentGroups || [])
    .filter((g) => g && g.title && g.title.toLowerCase() === groupTitleInput.toLowerCase())
    .map((g) => g.id);
  return new Set(ids.length ? ids : [resolvedGroupId]);
}

async function build(out, ctx) {
  const card = await ctx.readCard();
  const group = resolveGroup(out.grupo, card.checklistGroups);
  const candidateGroupIds = matchingGroupIds(out.grupo, card.checklistGroups, group.id);
  const nowISO = new Date().toISOString();

  const groupsStep = {
    kind: 'transaction',
    path: `${ctx.cardPath}/checklistGroups`,
    transform(current) {
      const groups = Array.isArray(current) ? current.slice() : [];
      if (!groups.some((g) => g && g.id === group.id)) groups.push({ id: group.id, title: group.title });
      return groups;
    },
  };

  let wasCreated = false;
  let noChange = false;

  const checklistStep = {
    kind: 'transaction',
    path: `${ctx.cardPath}/checklist`,
    transform(current) {
      const list = Array.isArray(current) ? current.slice() : [];
      const idx = list.findIndex((it) => it && it.t === out.item && candidateGroupIds.has(it.grp || 'default'));
      if (idx >= 0) {
        wasCreated = false;
        noChange = !!list[idx].done === !!out.done;
        list[idx] = { ...list[idx], done: !!out.done };
      } else {
        wasCreated = true;
        noChange = false;
        list.push({ t: out.item, done: !!out.done, grp: group.id });
      }
      return list;
    },
    after: async (result) => {
      if (noChange) return []; // nada mudou de fato — não polui histórico
      const finalChecklist = (result && result.snapshot && result.snapshot.val()) || [];
      const what = wasCreated
        ? out.done
          ? `criou e concluiu "${out.item}" no checklist`
          : `criou "${out.item}" no checklist`
        : out.done
          ? `marcou "${out.item}" como concluído no checklist`
          : `reabriu "${out.item}" no checklist`;
      const steps = [
        {
          kind: 'transaction',
          path: `${ctx.cardPath}/history`,
          transform(current) {
            const history = Array.isArray(current) ? current.slice() : [];
            history.push({ who: ctx.actor.who, what, at: nowISO });
            return history.length > HIST_CAP ? history.slice(-HIST_CAP) : history;
          },
        },
      ];
      const allDone = finalChecklist.length > 0 && finalChecklist.every((i) => i && i.done);
      if (out.done && allDone) {
        const members = await ctx.readMembers();
        const notifStep = await notify.buildOwnerNotifStep(ctx.db, {
          squadId: ctx.squadId,
          card,
          members,
          type: 'checklist',
          title: 'Checklist concluída!',
          cardId: ctx.cardId,
          dryRun: ctx.dryRun,
        });
        if (notifStep) steps.push(notifStep);
      }
      return steps;
    },
  };

  return [groupsStep, checklistStep];
}

module.exports = { build };
