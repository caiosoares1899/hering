# 🏖️ Modo férias + calendário geral de férias — nota de desenho (R3)

> Junta duas ideias do Backlog ([calendário geral](../quadro/escalados.md#calendario-ferias-digital) e [modo férias](../quadro/escalados.md#modo-ferias)) numa coisa só.
> **Não confundir** com o "Assistente Férias do Caio" (`docs/ASSISTENTE_FERIAS.md`, desligado): não há nada dele para reaproveitar aqui.

## Decisões do Caio (13/11/2026)

| Tema | Decisão |
|---|---|
| Onde fica a agenda | **Radar e Maré**, com um **módulo compartilhado** (como o `mare-gcal`): vista **🏖️ Férias** no 📅 Calendário do Radar (ao lado de Mês, Agenda e Gantt) e no 📅 Calendários do Maré. Não é aba do Gantt. |
| Quem vê / quem grava | **Todo login Google @ciahering.com.br lê.** Cada um grava **só as próprias** férias; o **ADM corrige ou apaga** as de qualquer um. Visualizador externo e outro login não veem. |
| Passagem dos itens | Cada card/Objetivo/Marco: **➡️ passar** para outra pessoa (reatribui com histórico + aviso no sino) ou **✋ manter**. Item mantido mostra o selo 🏖️ "responsável de férias até 28/11". **Não mexe** na contagem de tempo (o ⏸ Pausar card fica de fora). |
| Interruptor | **No próprio cadastro**: em "Minhas férias", o botão **🧳 Preparar minha saída** abre a passagem. Sem período cadastrado não há botão, então o cadastro é obrigatório por construção. |
| Fora do escopo | aprovação, RH, saldo de dias, push de "fulano saiu de férias". |

## Modelo de dados — nó novo

`kanban/ferias{,_dev}/{uid}/{id}` = `{ ini, fim, obs?, em, por }`

| Campo | Formato | Regra |
|---|---|---|
| `{uid}` | uid da pessoa de férias | gravar: a própria pessoa (Google Hering) **ou** ADM (`usuarios/{auth.uid}/role === 'adm'` ou o e-mail do Caio) |
| `{id}` | `^[A-Za-z0-9_-]{1,40}$` (push key) | — |
| `ini`, `fim` | `AAAA-MM-DD` (regex na regra) | obrigatórios. **`fim >= ini` só na tela**: não há precedente de comparação de string nas nossas regras e o simulador não prova o motor real; período invertido só estraga a exibição do próprio autor (não é propriedade de segurança) |
| `obs` | texto ≤ 140 (ex.: "meio período", "cobertura: Ana") | opcional |
| `em` | número (ms) | obrigatório |
| `por` | `=== auth.uid` (quem gravou: a pessoa ou o ADM) | obrigatório |
| outro campo | — | recusado (`$outro: false`) |

- **Leitura:** o nó inteiro (`kanban/ferias`), para quem é Google @ciahering. É pequeno (algumas linhas por pessoa). O visualizador externo (`painel_viewers`) **não** lê.
- **Por que nó próprio e não `usuarios/{uid}`:** `usuarios/{uid}` dá escrita a PO/ADM em qualquer filho (achado da ⭐ favorita, [escalado](../quadro/escalados.md#gantt-favorita-autoria)), e as férias precisam ser **lidas por todos**, enquanto `usuarios` não é. Com nó próprio, a autoria fica estrita: a pessoa grava as dela, o ADM corrige e o PO **não**.
- **"Está de férias"** é **derivado**: `ini <= hoje (São Paulo) <= fim`. Não existe flag de "modo férias" gravada. O selo 🏖️ e o alerta leem o mesmo nó.
- **Backup:** `{ no: 'ferias', diario: true }` em `functions/backup/completo.js` (o `_dev` fica de fora, como os outros).
- **ADM na tela = ADM na regra:** o botão "corrigir" das férias de outra pessoa só aparece para `usuarios/{uid}/role === 'adm'` ou o e-mail do Caio — **não** para quem só está em `config.adm_emails` (Armadilha 9: a escrita falharia).
- **Fronteira:** texto de outra pessoa (`obs`) e nome chegam ao DOM de todos → só por `textContent`/`esc()`, nunca `innerHTML` cru. Nenhuma função nova no servidor.

## Fases (PRs separados, nesta ordem)

| Fase | O quê | Risco | Autor | Depende de |
|---|---|---|---|---|
| **F1** | Nó + regras + backup + `functions/rules/__tests__/feriasRules.test.js` (simulador) | R3 | Claude | — |
| **F2** | Módulo `mare-ferias(-dev).js`: dados (`ouvir`, `ausente(uid, dia)`, `periodoDe(uid)`), "Minhas férias" (criar/editar/excluir; ADM corrige qualquer um) e a vista **🏖️ Férias** (mês com faixas por pessoa + "fora agora" e "próximas"; filtros pessoa, squad e período). Montada no Radar e no Maré. Ajuda + dica. | R2 | Antigravity (contrato) · Claude integra | F1 (formato; o deploy só para usar de verdade) |
| **F3** | **Alerta + selo 🏖️**: ao @mencionar, pôr como responsável ou participante (Maré) e como responsável de Objetivo/Marco ou @menção nas notas (Radar), um aviso "🏖️ Fulana está de férias até 28/11"; selo nos avatares/chips de quem está fora hoje | R1/R2 | Codex | F2 (API do módulo) |
| **F4** | **🧳 Preparar minha saída**, item a item com confirmação: ➡️ passar (escolhe a pessoa) ou ✋ manter. **No Maré**: os cards ativos da squad aberta em que sou responsável ou participante, aplicando com o mesmo caminho do `executarReatribuir()` (`recordHistory` + `runAutoRules('assigned')` + `fbSaveAll`), e um seletor para repetir em cada uma das minhas squads. **No Radar**: meus Objetivos (`responsaveis[]`) e Marcos (`responsavel`). **O Radar não escreve card** (Armadilha 10: schema de card fora do Maré); lá aparece "passar meus cards no Maré →". Aviso `assigned` no sino de quem recebe: **um por pessoa e lote**, não um por card | R2 | Claude | F2 |

Deploy (do Caio, depois do resync): F1 → `firebase deploy --only database` e depois `--only functions:backupGlobalDiario,functions:backupCompletoSemanal`.

## Perguntas que ficam para a F2/F4 (não bloqueiam a F1)
- Na vista do Maré, entram só as pessoas das minhas squads por padrão (com "todo o Digital" no filtro)? Proposta: sim no Maré e todo o Digital no Radar.
- Período máximo de um cadastro: a regra não limita; a tela avisa acima de 45 dias.
