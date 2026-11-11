Resumo sempre ativo. **Fonte única das regras: `CLAUDE.md` (seção "Release process") e `docs/COORDENACAO_AGENTES.md`.** Em caso de conflito, vale o `CLAUDE.md`.

1. **Dev primeiro.** Mude só o arquivo `-dev`, faça o bump (`node scripts/mare-cli.js bump` ou `"bump"` no `.mare-ship.json`) e abra PR. Prod só depois de **validação explícita do Caio**.
2. **Promoção a prod:** `node .claude/skills/subirproprod/promover.js --status` / `promover.js <alvos>` (preserva os 14 alvos e linhas só-de-prod; nunca cópia cega do `-dev`). Promoção que inclua `functions/`, regras do banco ou mudança grande é do Claude.
3. **Cadência:** bug validado sobe na hora; **feature sobe em lote, 1× por dia, no fim do dia**.
4. **Log:** feature → `CHANGELOG.md` (`mare-cli log --type feature`, sempre com `SÓ DEV` antes de ir a prod — Armadilha 15); bug/correção/achado → `BUGS_E_CORRECOES.md` (`mare-cli log --type bug`).
5. **Promoção a prod também gera:** avisos (Mural + WhatsApp), log no card do Firebase (`ts: new Date().toISOString()` — nunca `Date.now()`) e avaliação de **dica** ("Dica: sim/não, porque…").
6. **Deploy de `functions/` e `database.rules.json`:** só o Caio, com a conta corporativa, depois do resync do clone. Você **não roda** `firebase deploy`; registre em "Pendente de deploy" do Quadro.
7. **Git & Ship em 1 clique:** branch `antigravity/<assunto>` a partir de `origin/main` via `.mare-ship.json` + `node scripts/mare-cli.js ship`; trailer `Agent: antigravity`; **nunca** merge de PR próprio, **nunca** `push --force`.
8. **Quadro e Escopo:** antes de editar qualquer arquivo, confira `docs/COORDENACAO_AGENTES.md` (§6 *Em andamento*). Se outro agente reservou o arquivo, não toque nele. Algo fora do seu escopo → registre em *Escalado para o Claude*.
9. **Sincronização rápida (`/seatualizar`) e navegação (`docs/CODE_SYMBOLS.md`):** no início de cada pedido, faça 1 turno paralelo lendo o Quadro (`COORDENACAO_AGENTES.md` L109–165), `version.json`, topo do `CHANGELOG.md` e `BUGS_E_CORRECOES.md` (ou `node scripts/mare-cli.js brief`). Localize símbolos via `docs/CODE_SYMBOLS.md` + `CODE_MAP_FAST.md`. Valide todo script de console com `check-script` (automático no `ship`).
10. **Fronteira (passo 8 do Release process do `CLAUDE.md`):** mudança que cria ou altera fronteira de confiança passa pelo checklist de `docs/SEGURANCA_FRONTEIRAS.md` e declara `Fronteira:` no PR.
