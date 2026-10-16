---
trigger: always_on
description: Regras essenciais de release e de trabalho conjunto (Claude + Antigravity) do Maré Digital / Radar / Oceano — resumo; o detalhe está no CLAUDE.md
---

Resumo sempre ativo. **Fonte única das regras: `CLAUDE.md` (seção "Release process") e `docs/COORDENACAO_AGENTES.md`.** Em caso de conflito, vale o `CLAUDE.md`.

1. **Dev primeiro.** Mude só o arquivo `-dev`, faça o bump (`node scripts/mare-cli.js bump`) e abra PR. Prod só depois de **validação explícita do Caio**.
2. **Promoção a prod:** `node .claude/skills/subirproprod/promover.js --status` / `promover.js <alvos>` (preserva as linhas só-de-prod; nunca cópia cega do `-dev`). Promoção que inclua `functions/`, regras do banco ou mudança grande é do Claude.
3. **Cadência:** bug validado sobe na hora; **feature sobe em lote, 1× por dia, no fim do dia**.
4. **Log:** feature → `CHANGELOG.md` (`mare-cli log --type feature`); bug/correção/achado → `BUGS_E_CORRECOES.md` (`mare-cli log --type bug`). Skills de resumo leem os dois.
5. **Promoção a prod também gera:** avisos (Mural + WhatsApp) e o log no card do Firebase (script de console, `ts: new Date().toISOString()` — nunca `Date.now()`), e a avaliação de **dica** (regra 7: dizer "dica: sim/não, porque…").
6. **Deploy de `functions/` e `database.rules.json`:** só o Caio, com a conta corporativa, depois do resync do clone. Você **não roda** `firebase deploy`; registre em "Pendente de deploy" do quadro.
7. **Git:** branch `antigravity/<assunto>` a partir da `main` atual; `git fetch origin && git rebase origin/main` antes do push; trailer `Agent: antigravity`; **nunca** merge de PR próprio, **nunca** `push --force`.
8. **Antes de editar uma página grande,** veja o quadro em `docs/COORDENACAO_AGENTES.md`: se o Claude já declarou o arquivo, espere o PR dele ser mergeado. Algo grande demais? **Escale** (coluna "Escalado para o Claude") em vez de tentar.
9. **Sempre se manter atualizado (`/seatualizar`):** antes de iniciar qualquer novo pedido ou após um resync, execute `.claude/skills/seatualizar/SKILL.md` para ler o que o outro agente mudou (`COORDENACAO_AGENTES.md`, `version.json`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `GUIA_DE_CODIGO.md`). Para atualizar o pacote de documentações, use `/atualizardocumentacoes` (`.claude/skills/atualizardocumentacoes/SKILL.md`) e para logs de cards/scripts de teste de console acione o subagente `agente-logs-testes`.
