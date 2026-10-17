# Coordenação de agentes — Claude + Antigravity (Gemini)

Dois agentes trabalham no mesmo repositório. Este arquivo é a **fonte única** de como
dividir o trabalho sem um pisar no outro. **Leia antes de começar qualquer tarefa** e
atualize o "Quadro" no fim quando começar e quando terminar.

- **Claude** — grandes features e grandes correções.
- **Antigravity (Gemini)** — monitoramento do dia a dia, pequenas features e correções.
- **O usuário (Caio)** — decide prioridade, valida em dev, **dá o merge de todo PR** e roda
  todo deploy de `functions/` e `database.rules.json` (na máquina dele, conta corporativa).

> Estado em 2026-10-16 (auditoria feita pelo Claude, ver "Auditoria" abaixo).

---

## 1. Quem faz o quê

Regra de decisão, na ordem — a primeira que casar vence:

| Se a tarefa… | Quem |
|---|---|
| mexe em `functions/` ou `database.rules.json` | **Claude** |
| cria nó novo no banco, muda modelo de dados ou permissão | **Claude** |
| toca módulo compartilhado (`mare-*-dev.js`) ou 3+ páginas | **Claude** |
| é segurança, migração, performance/custo do Firebase, auditoria profunda (`/monitorarbugs` de área inteira) | **Claude** |
| é feature nova com mais de uma tela/fluxo | **Claude** |
| é bug ou ajuste **localizado** (1 página, até ~1 tela de mudança) | **Antigravity** |
| é texto, estilo, Ajuda, dica, CODE_MAP, docs, `BUGS_E_CORRECOES.md` | **Antigravity** |
| é monitoramento diário (checklist da seção 4) | **Antigravity** |
| é promoção rotineira dev → prod (via `promover.js`) | **Antigravity** |
| deu dúvida | **Antigravity pergunta ao Caio ou escala ao Claude** — nunca "tenta e vê" |

Escalar é normal, não é falha: ao achar algo grande durante uma tarefa pequena, pare,
registre no "Quadro" (seção 6, coluna *Escalado*) com **como reproduzir** e siga com o resto.

---

## 2. Branches, autoria e PRs

- Branches: `claude/<assunto>` e `antigravity/<assunto>` (prefixo identifica o dono).
  Sempre a partir de `origin/main` atualizada.
- Todo commit leva trailer, para sabermos quem fez o quê (hoje os dois saem com a identidade do Caio):
  - `Agent: claude` ou `Agent: antigravity`
- **Nunca** dar merge de PR por conta própria. **Nunca** `git push --force` em branch alheia.
- Antes do push: `git fetch origin && git rebase origin/main`.
- Um PR = um assunto. Não misturar feature com refactor.

## 3. Arquivos "quentes" (onde os dois vão colidir)

Em 24 h (14→15/10) foram editados: `CHANGELOG.md` (42×), `version.json` (36×),
`CODE_MAP.md` (18×), `okr-dev.html` (15×), `painel-dev.html`/`kanban-dev.html` (11× cada).

- `version.json`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `CODE_MAP_FAST.md`: só mexer pelo
  `node scripts/mare-cli.js` (`bump`, `log`, `map`), e **rebase em `origin/main` imediatamente antes do push**.
- Conflito em `version.json`: vale o **maior** número de versão de cada chave; depois conferir
  que o `<div class="version">` da página bate.
- **Regra permanente — Sempre se manter atualizado (`/seatualizar`):** antes de começar qualquer novo pedido (ou após um resync/merge), ambos os agentes devem seguir `.claude/skills/seatualizar/SKILL.md` (conferir este Quadro, `version.json`, topo do `CHANGELOG.md` e `BUGS_E_CORRECOES.md`, `docs/GUIA_DE_CODIGO.md` e `CODE_MAP_FAST.md`) para saber tudo o que o outro mudou e começar sem premissas velhas.
- **Sincronização de documentações (`/atualizardocumentacoes`):** sempre que precisar atualizar o conjunto de documentações (`maredigital.html`, Help Content, `guia-okr.html`, `docs/OCEANO.md`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `CODE_MAP.md`/`CODE_MAP_FAST.md` e `conhecimento`), ambos usam a skill `.claude/skills/atualizardocumentacoes/SKILL.md` (no Antigravity, delegando ao `agente-functions-docs`).
- Antes de editar uma página grande, olhar o Quadro: se o outro agente já declarou aquele
  arquivo, **espere o PR dele ser mergeado** ou combine por ali (não duas branches no mesmo arquivo).
- Um agente não revisa/reescreve o código que o outro acabou de mergear sem um bug concreto.

## 4. Rotina diária do Antigravity (monitoramento)

Rodar na `main` atualizada e registrar o resultado em uma linha no Quadro:

1. `cd functions && npm test` → esperado: **0 falhas** (hoje 847 passam, 1 pulado).
2. `node --check` no maior `<script>` de cada página (kanban, painel, okr, oceano, escala, intake, okr-apresentacao, `-dev` e prod).
3. `node .claude/skills/subirproprod/promover.js --status` → o que está pendente dev → prod.
4. `version.json`: dev e prod coerentes com o que está no ar.
5. `conhecimento` do Agente Ágil em dia (o teste do item 1 já cobre).
6. Passar os olhos em `functions:log` / alertas do Painel (monitores VTEX, GitHub, Firebase) quando o Caio trouxer.

Achou algo: **pequeno** → corrige (branch `antigravity/…`) e registra em `BUGS_E_CORRECOES.md`;
**grande** → coluna *Escalado* do Quadro.

## 4.1 Revisão automática das PRs do Antigravity (desde 16/10/2026)

Toda PR de branch `antigravity/*` é revisada pelo Claude **antes** de o ADM validar ou o Caio mergear — não depende de alguém lembrar.

- **Como roda:** tarefa agendada (id `trig_017bZw6eQFCHxkAMRb1piCtf`, "Revisão das PRs do Antigravity (seg–sex)") que acorda uma **sessão fixa do Claude já com o repositório anexado** ("Revisor das PRs do Antigravity", `session_01VRKYGhVsGURwSzBsh5LBwC`). **Segunda a sexta, de 2 em 2 h, 8h–20h (Brasília)**; sábado e domingo não rodam (economia de créditos — o Antigravity, na conta Hering, segue todos os dias). A 1ª tentativa com sessão nova a cada disparo falhou (nascia sem GitHub); por isso a sessão é permanente.
- **O que confere (e comenta na própria PR):** escopo (só `-dev`, 1 página; `functions/`, regras do banco ou módulos compartilhados → "ESCALAR AO CLAUDE"), bump de versão coerente, entrada em `BUGS_E_CORRECOES.md`/`CHANGELOG.md` com nomes reais, trailer `Agent:`, as Armadilhas e as linhas vermelhas, e — nos bugs do plantão — o **script de teste** (todo nome usado existe no `-dev`, só leitura) e o título + `## Resumo` da PR. Roda `node scripts/checar.js` (e `npm test` se a PR tocar `functions/`).
- **Formato:** **um** comentário curto por commit, começando com `<!-- revisao-claude:SHA7 -->` e "🔍 Revisão do Claude (commit SHA7)": `✅ Sem achados` ou lista numerada com arquivo:linha. Sem PR nova, não comenta nada.
- **Limites:** nunca faz merge, aprovação formal, push na branch dele nem abre PR; só aponta, não corrige. **Não substitui** a validação do ADM com o script no console (linha vermelha nº 4/5 do `AGENTS.md`).
- **Antigravity:** leia o comentário do Claude na sua PR (via `/seatualizar` ou na página da PR) e corrija **no mesmo branch** com novo commit; item marcado "ESCALAR AO CLAUDE" para a execução e vai para a coluna *Escalado* do Quadro.
- **Operar:** pausar ou mudar a frequência = pedir ao Claude (ou desabilitar a tarefa agendada no claude.ai). Custo: checagem vazia é curta; só PR nova gasta mais.

## 5. Release, deploy e avisos

- **Dev primeiro; validação explícita do Caio antes de prod** (já é regra do `CLAUDE.md`).
- **Cadência:** bug validado sobe na hora; **feature sobe em lote, 1× por dia, no fim do dia**.
  Cada promoção força todo mundo a recarregar (`CHECK_INTERVAL_MS`). Em 15/10 houve 3 promoções de
  feature (13:19, 17:52, 20:55) — evitar.
- **Quem promove:** rotina (só HTML/módulos) → Antigravity, com `promover.js`; qualquer promoção
  que inclua `functions/`, regras do banco ou mudança grande → Claude. O executante confere:
  `promover.js --status` limpo, testes de `functions/` e `node --check`.
- **Deploy de functions/regras:** só o Caio, com a conta corporativa
  (`--account caio.soares@ciahering.com.br --project hering-onboarding`), **sempre depois do resync**
  do clone. Os agentes **acrescentam a linha em "Pendente de deploy"** (Quadro) e não rodam `firebase deploy`.
  Se o `conhecimento/*.json` do Agente Ágil mudou (Ajuda/CHANGELOG de prod), reentra no deploy das 5 funções.
- Avisos (Mural/WhatsApp) e log do card: só na promoção para prod, como já definido no `CLAUDE.md`.
- **Dica** (regra 7): toda feature nova visível avalia e diz "dica: sim/não, porque…".

## 6. Quadro (atualizar sempre)

### Em andamento
| Agente | Branch | Arquivos que vai tocar | Desde |
|---|---|---|---|
| — | — | — | — |

### Para amanhã (18/10/2026) — combinado com o Caio
| O quê | Dono | Onde está o desenho |
|---|---|---|
| 🎨 **Corrigir o tema claro do Painel e do Radar** (toast invisível, abas/botões com cor fixa, status como texto, aba ativa, dia de hoje do calendário) + ajustes menores no Vice City; só nos `-dev` | Claude | `docs/ideias/tema-claro-painel-radar-2026-10-17.md` — script de auditoria: `docs/arezzo/testes/auditoria_temas.js` |

### Backlog (combinado para depois das férias do Caio, a partir de 04/11/2026)
| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 👕 Camiseta Brasil que "ganha forma" conforme a meta da Black Friday (Oceano, enchimento + peças nos marcos de 20 %, modo telão) | Claude | `docs/ideias/camiseta-brasil-black-friday.md` — depende da arte oficial; Black Friday = 27/11 |
| 🔬 Dossiê de concorrência do Antigravity (34 ideias): triagem em 4 levas — Radar (🧊 deriva, notas→Próximo Passo), Escala→Kanban, Digest do Painel, fluxo do Maré; Meus Pedidos e sino com adiar ficam com o Claude | Caio escolhe a ordem; Claude/Antigravity conforme a triagem | `docs/ideias/dossie-concorrencia-2026-10.md` — **nada roda antes de 04/11** |

### Escalado para o Claude
| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| — | — | — | — |

### Pendências do Antigravity (achadas pelo Claude em 16/10)
| O que | Detalhe | Status |
|---|---|---|
| Nomes/versões inventados no `BUGS_E_CORRECOES.md` | As entradas de 15/10 citam `radar.html`, `radar-dev.html` (v2.0.90–v2.0.95) e `maredigital-dev.html`, que **não existem**. O Radar é `okr.html`/`okr-dev.html` (v2.89) e o portal é `maredigital.html`. Corrigir as 4 ocorrências e conferir os nomes reais com `ls` antes de escrever. | ✅ Corrigido em 16/10 (`antigravity/pendencias-coordenacao-16-10`) |
| `mare-cli.js log --type bug` insere no lugar errado | A entrada entra no topo do arquivo, **antes** da seção "Armadilhas", e sem data no título. Deve entrar logo abaixo de "## 🐛 Histórico de Bugs e Correções", com `AAAA-MM-DD · <área> — <título>`. | ✅ Corrigido em 16/10 (`antigravity/pendencias-coordenacao-16-10`) |
| Papéis de `mare-cli.js` × `promover.js` + 5 skills lendo `BUGS_E_CORRECOES.md` | Documentar em 1 parágrafo a divisão sem sobreposição (`mare-cli.js`: status/bump/log/map; `promover.js`: promoção dev→prod) e atualizar `gerarokr`, `resumosemanal`, `atualizarcodemap`, `atualizarhelpcontent`, `otimizaçãoderotina`. | ✅ Concluído em 16/10 (`antigravity/pendencias-coordenacao-16-10`) |
| Script de teste do bug `getDue` (16/10) usava `fmtDate`, que não existe | O script entregue na ficha quebrou no console do ADM (`ReferenceError: fmtDate is not defined`); o Claude refez o script. Daqui para frente: conferir por `grep` que todo nome usado existe no arquivo `-dev` e partir do código/scripts já existentes (regra no `AGENTS.md`, linha vermelha 4, e em `.claude/skills/plantaobug/SKILL.md`; vale para o subagente `agente-logs-testes`). | ⏳ Avisar o Antigravity |

### Pendente de deploy (só o Caio roda)
| Quem adicionou | O que mudou | Comando | Data |
|---|---|---|---|
| Claude | **Plantão: comentário de correção no card** — ficha ganha `prTitulo`/`prResumo` (regras) e o webhook da PR passa a gravá-los. | `firebase deploy --only database` e `firebase deploy --only functions:plantaoGithubWebhook` (depois do resync; `--project hering-onboarding --account caio.soares@ciahering.com.br`) | 16/10 |
| Claude | **Plantão automático (PR4):** 2 secrets (`PLANTAO_AGENTE_KEY`, `PLANTAO_WEBHOOK_SECRET`), `--only database` (nós `plantao_status` e campos novos da ficha), `--only functions:plantaoProximo,functions:plantaoGithubWebhook,functions:plantaoVigia`, webhook no GitHub e a tarefa agendada do Antigravity — passo a passo em `docs/PLANTAO_BUGS.md` ("Modo automático"). | ver o runbook | 16/10 |
| Claude | **Plantão (PR2) — functions ✅ implantadas e confirmadas em 16/10 (aviso chegou aos ADMs); confirmar também o `--only database`:** regras do nó `kanban/plantao` (só ADM) + funções `plantaoBugNovo`/`plantaoVigia` + `sendPushOnNotification` (tipo `plantao_bug`). **Antes: confirmar que André e Alisson têm `role: adm`** (ver `docs/PLANTAO_BUGS.md`). | `firebase deploy --only database ...` e `firebase deploy --only functions:plantaoBugNovo,functions:plantaoVigia,functions:sendPushOnNotification ...` (depois do resync do clone) | 16/10 |
| Claude | Regras do banco: `kanban/okr` com regra por filho (comentário do Marco só pelo autor; Data Studio só ADM/PO/Organizador/Gestor OKR). **Antes: rodar o script de checagem (só leitura) no console do Radar e conferir as listas 1 e 2.** | `firebase deploy --only database --project hering-onboarding --account caio.soares@ciahering.com.br` (depois do resync do clone) | 16/10 |

---

## Auditoria de 16/10 (o que o Antigravity fez, por Claude)

**Volume:** ~46 commits (20+ PRs) entre 14/10 tarde e 15/10 noite; 4 promoções a prod.

**Entregas**
- Radar: aba 📈 Data Studio (iframe Looker Studio, com lista de hosts permitidos), apagar comentário do Marco
  (próprio; ADM apaga de qualquer pessoa), promover próximo passo → progresso → marco (tela + Agente Ágil),
  limites de caracteres no Agente, anotações de reunião/calendário, apresentação ao vivo (controle de ADM,
  hotfix de sincronização, 7 achados do `/monitorarbugs`, títulos longos).
- Maré: submarca "Geral". Metas: popup personalizado, gráfico interativo, Meta Global na home do Oceano.
- Painel: monitores de status do GitHub/Pages e dos 6 serviços do Firebase (funções `githubStatus` e `firebaseStatus`, já no ar).
- Infra do time: `AGENTS.md`, `.agents/`, `scripts/mare-cli.js`, `.claude/skills/subirproprod/promover.js`,
  `CODE_MAP_FAST.md`, `BUGS_E_CORRECOES.md`, CHANGELOG enxugado (histórico jul–set em `docs/changelog-archive-2026-07-a-09.md`).

**Saúde da `main`:** `functions/` 847 passam / 0 falham / 1 pulado; sintaxe OK nas 13 páginas;
`version.json` dev = prod (kanban 8.30.865, painel 5.75, okr 2.89, oceano 1.36, escala 1.10).

**Achados (e o que fazer)**
1. **Três cópias do processo de release** (`CLAUDE.md`, `AGENTS.md`, `.agents/rules/release-process.md`) já divergindo
   (o `AGENTS.md` cita `CODE_MAP_FAST`/`BUGS_E_CORRECOES`; o `CLAUDE.md` não). → `CLAUDE.md` é a fonte; as outras viram ponteiro + o que é só do Antigravity. *(Claude — concluído)*
2. **Duas ferramentas de versão/promoção** (`mare-cli.js` e `promover.js`) sobrepostas. → documentar quem faz o quê (`mare-cli`: bump/log/map; `promover.js`: promoção) num parágrafo só. *(Antigravity — ✅ concluído em 16/10)*
3. **Skills desatualizadas pela separação CHANGELOG × BUGS:** 5 skills ainda leem só o `CHANGELOG.md`
   (`gerarokr`, `resumosemanal`, `atualizarcodemap`, `atualizarhelpcontent`, `otimizaçãoderotina`), que agora só tem
   features — correções ficam fora do resumo semanal. → fazê-las ler também `BUGS_E_CORRECOES.md`. *(Antigravity — ✅ concluído em 16/10)*
4. **Cadência de promoção** (seção 5): 3 promoções de feature num dia. → lote diário.
5. **Armadilha nº 4** cita o domínio errado do Pages (`caiofsoares…`; o certo é `caiosoares1899.github.io`). *(Antigravity — ✅ concluído em 16/10)*
6. **Autoria ilegível:** commits dele saem como `Caio Soares` sem trailer. → trailer `Agent:` (seção 2).
7. **Permissões só na tela:** editar/apagar comentário do Marco "só o autor" e a config do Data Studio são restrições de UI;
   as regras do banco deixam **qualquer conta @ciahering** escrever em `kanban/okr`. → endurecer regras (autor em
   `marco_comments`, papel em `datastudio`). Exige `firebase deploy --only database`. *(Claude — concluído)*
9. **Documentação com fatos inventados:** `BUGS_E_CORRECOES.md` cita arquivos e versões que não existem (ver "Pendências do Antigravity"). Regra: nome de arquivo e versão só depois de `ls`/`grep` — nunca de memória. *(Antigravity — ✅ concluído em 16/10)*
10. **`mare-cli.js log` insere a entrada no lugar errado** (ver "Pendências do Antigravity"). *(Antigravity — ✅ concluído em 16/10)*
8. **Deploy das 5 funções do Agente Ágil:** o `conhecimento/*.json` mudou várias vezes depois do último deploy. → o Caio
   faz **um** deploy no fim, a partir da `main` atual (com resync). Entra em "Pendente de deploy".

**Ordem sugerida:** (1) mergear este plano → (2) itens 1, 5 e 3/2 em paralelo (Claude: item 1; Antigravity: 5, 3, 2)
→ (3) item 7 (Claude) → (4) deploy do item 8 (Caio) → (5) rotina da seção 4 todo dia.
