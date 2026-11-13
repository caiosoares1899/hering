# Coordenação dos agentes: versão de 16/10 a 11/11/2026 (arquivo)

> Movido sem edição de `docs/COORDENACAO_AGENTES.md` em 11/11/2026, quando a coordenação foi reorganizada (regra × estado). Aqui ficam a auditoria de 16/10, as confirmações ✅ de deploy, as lições datadas e o texto antigo do §1 ao §7. As regras em vigor estão em [`../COORDENACAO_AGENTES.md`](../COORDENACAO_AGENTES.md); o estado do dia, em [`../QUADRO.md`](../QUADRO.md).

---

# Coordenação de agentes — Claude + Antigravity (Gemini) + Codex

Três agentes trabalham no mesmo repositório (o Codex entrou em 05/11/2026, em piloto de um mês — ver §7). Este arquivo é a **fonte única** de como
dividir o trabalho sem um pisar no outro. **Leia antes de começar qualquer tarefa** e
atualize o "Quadro" no fim quando começar e quando terminar.

- **Claude** — **maestro** dos três (§7): grandes features e correções, `functions/`, regras do banco, segurança, revisão e divisão das tarefas.
- **Antigravity (Gemini)** — volume e rotina: monitoramento do dia a dia, docs, Ajuda/dicas, promoções rotineiras e features/correções de tamanho médio. É o agente pago pelo plano enterprise: **preferir para trabalho em volume**.
- **Codex** — **autor** de features e correções localizadas, com teste. Não revisa, não faz merge nem deploy.
- **O usuário (Caio)** — decide prioridade, valida em dev, **dá o merge de todo PR** e roda
  todo deploy de `functions/` e `database.rules.json` (na máquina dele, conta corporativa).

> Estado em 2026-10-16 (auditoria feita pelo Claude, ver "Auditoria" abaixo).

---

## 1. Quem faz o quê

Regra de decisão, na ordem — a primeira que casar vence. **Esta é a tabela autoritativa** (o §7.2 só dá os papéis e o desempate):

| Se a tarefa… | Quem |
|---|---|
| mexe em segurança, `database.rules.json`, modelo de dados, nó novo no banco ou permissão | **Claude** (nunca delegado) |
| toca módulo compartilhado (`mare-*-dev.js`) ou 3+ páginas | **Claude** |
| é migração, performance/custo do Firebase ou auditoria profunda (`/monitorarbugs` de área inteira) | **Claude** |
| mexe em `functions/` e é **localizada** (1 função, com teste) | **Codex** ou **Claude** — o maestro escolhe |
| mexe no resto de `functions/` | **Claude** |
| é feature nova: com mais de uma tela/fluxo → **Claude**; de tamanho médio (1–2 páginas, sem dado ou permissão novos) | **Claude** · **Antigravity** |
| é bug ou ajuste **localizado** (1 página/função, até ~1 tela de mudança) | **Codex** (tem teste ou verificação objetiva) ou **Antigravity** (rotina/volume) — o maestro escolhe |
| é texto, estilo, Ajuda, dica, CODE_MAP, docs, `BUGS_E_CORRECOES.md` | **Antigravity** |
| é monitoramento diário (checklist da seção 4) | **Antigravity** |
| é promoção rotineira dev → prod (via `promover.js`) | **Antigravity** |
| deu dúvida | **Antigravity e Codex perguntam ao Caio ou escalam ao Claude** — nunca "tenta e vê" |

Escalar é normal, não é falha: ao achar algo grande durante uma tarefa pequena, pare,
registre no "Quadro" (seção 6, coluna *Escalado*) com **como reproduzir** e siga com o resto.

---

## 2. Branches, autoria e PRs

- Branches: `claude/<assunto>`, `antigravity/<assunto>` e `codex/<assunto>` (prefixo identifica o dono).
  Sempre a partir de `origin/main` atualizada.
- Todo commit leva trailer, para sabermos quem fez o quê (hoje os dois saem com a identidade do Caio):
  - `Agent: claude`, `Agent: antigravity` ou `Agent: codex`
- **Nunca** dar merge de PR por conta própria. **Nunca** `git push --force` em branch alheia.
- Antes do push: `git fetch origin && git rebase origin/main`.
- Um PR = um assunto. Não misturar feature com refactor.
- **A `main` está protegida (desde 18/10/2026):** não existe push direto — toda mudança entra por PR e o check `checks` (CI) precisa estar verde para o botão de merge liberar; sem force push nem exclusão. O fluxo de vocês não muda (já é branch + PR); se a CI ficar vermelha, corrija na branch, não tente contornar.

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

## 4.1 Revisão automática das PRs do Antigravity (desde 16/10/2026) — ⏸ PAUSADA em 03/11/2026

> **Pausada em 03/11/2026**, junto com o fim do plantão de férias: a tarefa agendada foi **desabilitada** (`enabled:false`, não apagada — o id, o horário e a sessão fixa continuam guardados). Enquanto estiver pausada, **ninguém revisa as PRs `antigravity/*` automaticamente**: quando o Caio chamar o Claude numa conversa e houver PR do Antigravity aberta, a revisão é feita na hora, à mão (regra do `CLAUDE.md`). **Como religar:** pedir ao Claude ("religa a revisão das PRs do Antigravity" — ele reabilita o `trig_017bZw6eQFCHxkAMRb1piCtf` com `update_trigger enabled=true`) ou reabilitar a tarefa agendada no claude.ai. Frequência original: seg–sex, de 2 em 2 h, 8h07–20h07 de Brasília (`CRON_TZ=America/Sao_Paulo 7 8-20/2 * * 1-5`).

Toda PR de branch `antigravity/*` é revisada pelo Claude **antes** de o ADM validar ou o Caio mergear — não depende de alguém lembrar.

- **Como roda:** tarefa agendada (id `trig_017bZw6eQFCHxkAMRb1piCtf`, "Revisão das PRs do Antigravity (seg–sex)") que acorda uma **sessão fixa do Claude já com o repositório anexado** ("Revisor das PRs do Antigravity", `session_01VRKYGhVsGURwSzBsh5LBwC`). **Segunda a sexta, de 2 em 2 h, 8h–20h (Brasília)**; sábado e domingo não rodam (economia de créditos — o Antigravity, na conta Hering, segue todos os dias). A 1ª tentativa com sessão nova a cada disparo falhou (nascia sem GitHub); por isso a sessão é permanente.
- **O que confere (e comenta na própria PR):** escopo (só `-dev`, 1 página; `functions/`, regras do banco ou módulos compartilhados → "ESCALAR AO CLAUDE"), bump de versão coerente, entrada em `BUGS_E_CORRECOES.md`/`CHANGELOG.md` com nomes reais, trailer `Agent:`, as Armadilhas e as linhas vermelhas, e — nos bugs do plantão — o **script de teste** (todo nome usado existe no `-dev`, só leitura) e o título + `## Resumo` da PR. Roda `node scripts/checar.js` (e `npm test` se a PR tocar `functions/`).
- **Formato:** **um** comentário curto por commit, começando com `<!-- revisao-claude:SHA7 -->` e "🔍 Revisão do Claude (commit SHA7)": `✅ Sem achados` ou lista numerada com arquivo:linha. Sem PR nova, não comenta nada.
- **Limites:** nunca faz merge, aprovação formal, push na branch dele nem abre PR; só aponta, não corrige. **Não substitui** a validação do ADM com o script no console (linha vermelha nº 4/5 do `AGENTS.md`).
- **Antigravity:** leia o comentário do Claude na sua PR (via `/seatualizar` ou na página da PR) e corrija **no mesmo branch** com novo commit; item marcado "ESCALAR AO CLAUDE" para a execução e vai para a coluna *Escalado* do Quadro.
- **Operar:** pausar, religar ou mudar a frequência = pedir ao Claude (ou habilitar/desabilitar a tarefa agendada no claude.ai). Custo: checagem vazia é curta; só PR nova gasta mais.

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
| *(nenhum no momento)* | — | — | — |

### Backlog (combinado para depois das férias do Caio, a partir de 04/11/2026)
| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🪟 **Acabamento "vidro lapidado"** (`--specular` por tema + curvas `--ease-*`, GUIA_UI_UX 2.4 e 2.5 regra 6): contrato pronto para o Antigravity (10/11/2026); depois, **diagrama `.arq` interativo + rodapé/mapa** nas abas institucionais do Oceano, junto com o O4 da consultoria | Antigravity (acabamento) · Claude (diagrama/rodapé, com o O4) | `docs/GUIA_UI_UX.md` §2.4, §2.5 e §6.2 |
| 🏝️ **Ilha Dinâmica**: fase 0 (protótipo) e 1a (`mare-timer`) entregues; **1º teste real no Maré dev** (10/11/2026, aguardando o Caio testar); depois Oceano (lobby + host) | Claude | `docs/ideias/ilha-dinamica.md` · `docs/demo/ilha-dinamica-prototipo.html` |
| 🧭 **Plano da consultoria** (Radar, Travessia e lobby em sprints): **guardado em 10/11/2026** a pedido do Caio. Feito: E1–E3, período padronizado (R0) e o Sonar (que substituiu o O2). Próximo, quando voltar: T4 (cartão "próxima ação" da Travessia); em aberto a pergunta do T8 (aba fechada nos 8 s) | Claude | `docs/ideias/consultoria-oceano-2026-11-09.md` · `docs/ideias/cronograma-oceano.html` |
| 👕 Camiseta Brasil que "ganha forma" conforme a meta da Black Friday (Oceano, enchimento + peças nos marcos de 20 %, modo telão) | Claude | `docs/ideias/camiseta-brasil-black-friday.md` — depende da arte oficial; Black Friday = 27/11 |
| 🔬 Dossiê de concorrência do Antigravity (34 ideias): triagem em 4 levas — Radar (🧊 deriva, notas→Próximo Passo), Escala→Kanban, Digest do Painel, fluxo do Maré; Meus Pedidos e sino com adiar ficam com o Claude | Caio escolhe a ordem; Claude/Antigravity conforme a triagem | `docs/ideias/dossie-concorrencia-2026-10.md` — **nada roda antes de 04/11** |
| 🎨 Tema claro do Painel e do Radar (toast invisível, abas/botões com cor fixa, aba ativa, dia de hoje do calendário) — combinado para 18/10, **sem PR que prove que foi feito** | Claude (ou Antigravity: 1 página por vez) | `docs/ideias/tema-claro-painel-radar-2026-10-17.md` · `docs/arezzo/testes/auditoria_temas.js` |
| 🧪 Ferramentas de teste visual: `perf_apresentacao.js` com `CENARIO=` (medir só um cenário; hoje cada rodada mede 5) e variantes em paralelo; caminho do Chrome de `~/hering-tools` como padrão nas suítes da apresentação (as antigas têm caminho de Linux fixo); **contact sheet** 3×2 (3 temas × desktop/celular numa imagem só) no harness do GUIA §12.3 | Claude | sessão de 09/11/2026 (rodada de movimento da apresentação levou ~30 min, 2/3 em medição) |
| 🎬 Gerador de vídeo/GIF de release em Marine Glass: um HTML local em `scripts/` com `window.seek(t)` (cada quadro é função do tempo) + JSON `{titulo, entregas, metricas}` + Playwright/FFmpeg → 9:16 (WhatsApp) e 16:9 (Mural/OKR). Fora das páginas publicadas. **Sem Remotion:** a licença gratuita é só para indivíduos e equipes de até 3 pessoas, então empresa precisa de licença paga; o `seek(t)` próprio + Playwright + FFmpeg basta. Números e entregas vêm do `CHANGELOG.md`/dados, nunca inventados, e passam por validação antes de renderizar. Revisão por contact sheet antes de enviar | Caio decide se vale | dossiê do Antigravity de 09/11 + artigo de @e1genqq lido na íntegra |
| 🔧 Atualizar `firebase-functions` (^5 → atual): o deploy de 18/10 avisou que a versão nova traz breaking changes — fazer com calma e com testes, sem prazo | Claude | aviso do `firebase deploy` de 18/10/2026 |

> Rodada `codex/radar-uiux` (09/11) encerrada em 10/11: o Codex parou sem entregar (sem navegador nem git no sandbox, ~86 mil tokens; log em `~/hering-logs/delegacoes/2026-11-09-codex-radar-uiux.*`). O `prefers-reduced-motion` do Radar (linha abaixo) entra nos itens do Radar do plano da consultoria. Lição: não delegar ao Codex o que precisa de navegador.

### Escalado para o Claude
| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Claude | `okr-dev.html` não tem bloco `@media (prefers-reduced-motion: reduce)`: o `okrPulse` infinito do "digitando…" do Agente (`.okr-agente-typing`) roda mesmo com movimento reduzido. Entra na rodada `codex/radar-uiux` (o arquivo está reservado). | `grep -c prefers-reduced-motion okr-dev.html` → 0 | 09/11/2026 |
| Claude | `docs/arezzo/testes/test_apresentacao_live.js` falha também na `main`: "fora da sincronização, o slide do apresentador NÃO puxa a pessoa" (a pessoa fica "Acompanhando ✓" e vai junto para `ger:digital:tech`). Pode ser o teste (ordem de eventos do Firebase falso) ou o código do `liveSeguindo`: investigar antes de mexer no ao vivo. | rodar a suíte na `main` (2/2 vezes falha) | 09/11/2026 |
| Antigravity | `database.rules.json` (`travessia/humor/$uid/$dia` e `humor_comp`, L344/L365/L386): `.validate` aceita float entre `1` e `5` (ex.: `1.5`), sem exigir inteiro. O front (`travessia-dev.html`) já foi blindado com `faceDe()`, mas vale exigir `% 1 === 0` na regra. | gravar `{n: 1.5, ts: ServerValue.TIMESTAMP}` em `travessia/humor_comp/{uid}/{dia}` | 11/11/2026 |
| Antigravity | **Segurança (`database.rules.json` · `/auditoriaseguranca` de `painel-dev.html`):** 5 achados de regras RTDB confirmados por simulador (**✅ C1/C2 tratados pelo Claude em 11/11/2026 — PR das regras de papel; faltam C3, C4, D7/D8**) (`functions/rules/rulesSim.js`) e escalados sem editar `database.rules.json`: **(C1 · Alta)** escalada PO→ADM em `kanban/usuarios/$uid` (`L816–819`: `@ciahering` com `role === 'po'` consegue gravar `role: 'adm'` no próprio `$uid` ou rebaixar ADM, destravando `config/adm_emails/.write` `L789`, `painel_viewers/.write` `L779` e `config/agente_agil_orquestrador/.write` `L791`); **(C2 · Média)** auto-promoção em `kanban/usuarios/$uid` (`L816–832`: `auth.uid === $uid` aceita campos arbitrários sem `.validate`, permitindo gravar `gestorOkr: true` e `torre: 'geral'`, o que destrava `okr/datastudio/.write` `L199`); **(C3 · Alta)** leitura ampla concedida a `painel_viewers` externos nos nós-pai `kanban/painel_viewers` (`L778`: expõe lista completa de e-mails/nomes de todos os convidados), `kanban/painel` (`L172`: expõe `painel/config/backup_cfg` com chaves EmailJS), `kanban/config` (`L788`: expõe `adm_emails` e `webhookUrl` de `agentesExternos`), `kanban/feedback` (`L30`) e `kanban/squads/$sq/error_logs` (`L61`); **(C4 · Média)** `kanban/feedback/.write` (`L31`) na raiz permite a externo de 1 squad sobrescrever/apagar todo o nó; **(D7/D8 · Média)** `kanban/comunicados/.write` (`L26`) aceita qualquer `@ciahering` (não só ADM) e faltam regras para `campanhas_dev`/`feedback_dev`. ⚠️ **Aviso explícito do Caio:** ao apertar `database.rules.json` (especialmente C3/C1), **cuidado redobrado para NÃO bloquear os autorizados externos de entrar no Maré Digital** (`squads/$sq/externos` + `usuarios/$uid/squads` + `mare-login.js`) nem quebrar o `_check` de `painel_viewers` no boot do `painel.html` (`L10477`, que hoje lê `kanban/painel_viewers` inteiro — exigir migração coordenada para leitura por chave `$emailKey` antes de fechar o nó-pai). | `rulesSim.js` em `database.rules.json` (`L26,30-31,61,172,199,778-779,788-791,816-832`) | 11/11/2026 |

### Pendente de deploy (só o Caio roda)

> ✅ **11/11/2026:** o Caio publicou as 5 funções do Agente Ágil com o conhecimento da promoção #1735 (programa de boas-vindas · kanban v8.30.947 · okr v2.116 · travessia; tags `kanban-v8.30.947` e `okr-v2.116`).

> ✅ **11/11/2026:** o Caio publicou `agenteAgilMencao` e `agenteAgilMencaoDados` (marcador "analisando" da Ilha, PR #1699, tag `agente-agil-v3`).
>
> ✅ **Promoção #1678 (10/11/2026):** o Caio publicou as 5 funções do Agente Ágil com o conhecimento regenerado (Sonar, período padronizado, modal do card).
>
> ✅ **Tudo o que estava listado até 10/11/2026 foi publicado pelo Caio** (em 10/11: as 5 funções do Agente Ágil com o conhecimento regenerado na promoção #1662; e o `okrAgenteChat` com o período padronizado do #1667).
>
> Antes disso: **tudo o que estava listado até 09/11/2026 foi publicado pelo Caio** (confirmação dele em 07/11 e em 09/11, incluindo a regra do Guardião 'Resolvido por' da auditoria de 09/11 — o gatilho do chat do Agente Ágil no Painel, `agenteAgilPainelChat`/`agenteAgilPainelChatDev` com 1 GiB, foi no ar em 09/11; e as 5 funções da promoção #1650 — `criarCard` com várias submarcas + conhecimento — também em 09/11), além de: regras e funções de 21/10 a 06/11 — Travessia, Timer (`timersVigia`), backup do plantão, VTEX, Guardião (`cardsEspelhar`/`cardsGuardiao`/`guardiaoStatus`), Mini painel (`oceanoResumo`), cobrança e agenda do Radar (`okrDailyScan`/`okrAgenteChat`), origem externa do Agente Ágil, conhecimento regenerado, `functions:delete` do plantão e as regras do Agente Ágil no Painel (#1633). O detalhe de cada linha está no histórico do git deste arquivo.

> ✅ **12/11/2026:** o Caio publicou a regra da cultura da Travessia (#1722: `encontros/at`, `avaliacoes/atitudes`, `ciclos/cultura`) e as 5 funções do Agente Ágil com o conhecimento da promoção #1728.
>
> ✅ **11/11/2026:** o Caio publicou tudo da promoção #1713 (conhecimento do Agente Ágil, regra do autor do comentário e papéis C1/C2).

| Quem adicionou | O que mudou | Comando | Data |
|---|---|---|---|

## 7. Três agentes (desde 05/11/2026)

> Decisões do Caio em 05/11/2026: (1) **Claude é o maestro**; (2) **Codex só como autor** — a revisão dos PRs é do **Caio e do Claude**; (3) cada agente gasta do **próprio plano** (Claude e Codex em plano pessoal; Antigravity no plano enterprise, então **usar mais o Antigravity** para trabalho em volume); (4) delegação por CLI aprovada; (5) não precisa consultar a TI sobre o Codex. O Codex está em **piloto de um mês** (até ~05/12/2026): no fim se decide se fica e com que escopo (§7.6).

### 7.1 Canais entre os agentes (verificados no Mac do Caio em 05/11/2026)
O que existe de verdade — **não há "sala de chat" compartilhada**; cada janela do VS Code tem sua sessão isolada:
- **GitHub é o barramento** (assíncrono, fonte da verdade): este Quadro, PRs, comentários de revisão e o histórico do git.
- **Delegação por CLI** (síncrona, pontual): qualquer agente pode chamar outro como ferramenta de shell.
  - Codex: `codex exec` (binário embutido na extensão do VS Code: `~/.vscode/extensions/openai.chatgpt-*/bin/macos-aarch64/codex`; opções úteis: `-s <sandbox>`, `-C <pasta>`, `-o <arquivo>` para a última resposta, `--json`, `--ephemeral`). `codex review` revisa código; `codex queue --thread … --message …` enfileira mensagem numa sessão existente.
  - Antigravity: `~/.gemini/bin/agy -p "<prompt>"` (`--output-format json`, `--json-schema`, `--conversation <id>`; há também `agy acp`).
  - Claude: `claude -p` e, entre sessões do Claude, `SendMessage`/`ListAgents`.
  - Os dois canais (`codex exec` e `agy -p`) foram testados sem interface em 05/11/2026 e respondem.
- **Invocações seguras (flags obrigatórias; testadas em 05/11/2026 num worktree descartável):**
  - **Codex:** `codex exec -s workspace-write -C ~/hering-codex --ephemeral -o <arquivo-da-resposta> "<contrato>"`. Nunca `-s danger-full-access`. Verificado: edita e faz commit — **no worktree o commit só funciona com o `.git` do clone principal gravável** (`-c 'sandbox_workspace_write.writable_roots=["~/hering/.git"]'`, testado em 07/11/2026); sem isso ele edita e o maestro commita. **Atalho: `scripts/delegar.sh <assunto> <contrato.md>`** (worktree, flags, log e resposta em `~/hering-logs/delegacoes/`, em segundo plano). **Push e PR: o maestro faz** depois de ler o diff (não verificado dentro do sandbox).
  - **Antigravity:** dentro do worktree dele, `agy -p "<contrato>" --sandbox --mode accept-edits --output-format text`. Nunca `--dangerously-skip-permissions`. Verificado: **edita arquivos, mas comando de shell (commit, `npm test`, `checar.js`) é negado em modo sem interface**; então, nas delegações ao `agy`, o maestro roda os testes, faz o commit e abre o PR. (Regra `permissions.allow` do `settings.json` sugerida pela mensagem de erro: sintaxe não verificada.)
  - **Decisão do Caio (07/11/2026): o Antigravity é acionado por mensagem do Caio, não por `agy -p`.** O maestro escreve o contrato (§7.3) **pronto para colar** num bloco só; o Caio cola na janela do Antigravity (que lá roda teste, commit e PR com aprovação dele); o maestro revisa o PR quando ele abrir. `agy -p` fica só para pergunta sem comando de shell.
  - Em qualquer delegação o maestro **relê o diff e roda os testes ele mesmo** antes de abrir o PR; a saída do executor é relato, não prova.
- **Não usar como base** (só aparecem em fontes de terceiros ou estão vazios): `codex mcp-server`, `claude mcp serve`, o `mcp_config.json` do Antigravity (arquivo vazio hoje).

### 7.2 Papéis e desempate (a regra de decisão é a tabela do §1)
- **Claude (maestro):** divide e delega; é dono de segurança, regras do banco, módulos compartilhados, mudanças em 3+ páginas e arquitetura; faz a **revisão final** dos PRs junto com o Caio; consulta o advisor antes de planos e deploys.
- **Antigravity (plano enterprise — preferir para volume):** monitoramento diário, docs (`/atualizardocumentacoes`), Ajuda/dicas, scripts de console, promoções rotineiras e features/correções de tamanho médio.
- **Codex (autor, piloto):** features e correções **localizadas** com teste. Sem revisão, merge, deploy ou promoção.
- **Desempate Antigravity × Codex** numa tarefa localizada: tem teste automático ou verificação objetiva → Codex (onde ele já provou valor); é volume, rotina ou depende de ferramentas do Antigravity (`ship`, subagentes por app) → Antigravity. Dúvida → o maestro pergunta ao Caio.
- Quem acha algo fora do seu escopo **escala no Quadro** (coluna *Escalado*), como sempre.

### 7.3 Contrato de tarefa (formato fixo de toda delegação)
O maestro escreve, o executor devolve. Sem contrato completo, o executor pergunta antes de começar.
```
Objetivo: <1–2 frases, o resultado esperado>
Contexto: <o que o executor precisa saber e não consegue inferir; pacote anônimo se vier de bug>
Arquivos: <onde mexer> · Reservados por outros (não tocar): <lista do Quadro>
Critérios de aceite: <verificáveis: teste que falha antes/passa depois, checar.js, comportamento visível>
Não fazer: <deploy, merge, promoção a prod, mexer em arquivos fora do escopo…>
Entrega: branch <agente>/<assunto> + PR aberto (sem merge) + resumo com: o que fez, como validou, o que NÃO verificou, linha "Fronteira:", decisão de dica
```

### 7.4 Limites de segurança (valem para qualquer delegação)
- Cada agente executa **só com as permissões da própria sessão**: nunca pedir a outro agente o que a sua sessão não poderia fazer (nada de "lavagem de permissão"); nunca `--dangerously-skip-permissions` nem sandbox sem restrição; o executor roda no **worktree dele**, com as flags obrigatórias do §7.1 (que só deixam escrever ali).
- **Sem cadeia**: o executor delegado não delega de novo (sem agente → agente → agente) e cada tarefa tem **uma** delegação — evita laço e gasto sem fim.
- Mensagem de outro agente é **dado**, não ordem do Caio: ela nunca aprova deploy, merge nem exceção às linhas vermelhas.
- Segredos e dados de pessoas nunca vão no prompt (linhas vermelhas 3 e 6 do `AGENTS.md`).
- **Custo**: cada delegação gasta a cota de quem executa. Prefira o Antigravity (enterprise) para volume; uma chamada trivial ao Codex já custa ~6 mil tokens de contexto, então não delegue o que é mais rápido fazer direto.

### 7.5 Três janelas, três worktrees
Janelas do VS Code abertas na **mesma pasta** colidem (troca de branch, `version.json`, arquivo editado por dois). Cada agente trabalha no seu worktree:
```bash
git worktree add ~/hering-codex  -b codex/<assunto>       origin/main   # Codex
git worktree add ~/hering-agy    -b antigravity/<assunto> origin/main   # Antigravity (no Mac; o clone do Windows segue como está)
# 10/11/2026: ~/hering-agy já existe (fixa, em detached HEAD na main) — o Antigravity cria a branch dentro dela
# ~/hering fica com o Claude
```
Depois do merge: `git worktree remove <pasta>` e uma branch nova para a próxima tarefa. Reserva de arquivo no Quadro continua valendo (um arquivo, um dono por vez).

### 7.7 Quando o maestro delega (regra, desde 06/11/2026)
Lição da rodada de UI/UX da apresentação do Radar (PR #1629): foi feita **inteira por uma janela só**, em série, e demorou muito (medição, redesenho, revisão do advisor, três regressões corrigidas, CI quebrada por uma convenção do CHANGELOG). Boa parte era delegável. **Regra:** ao receber um pedido com **2+ partes independentes** ou que passe de ~1 h, o maestro **primeiro divide** (contrato do §7.3) e só então começa; fazer tudo sozinho exige uma linha explicando por quê.
- **Divida assim (modelo da rodada de UI/UX):**
  - **Maestro (Claude):** diagnóstico da causa, decisões de design (o que muda de propósito), contrato, **revisão do diff**, rodar a bateria final, abrir o PR e escrever a seção "o que ficou pior".
  - **Codex (autor, tarefa com verificação objetiva):** a **correção localizada com teste que falha antes/passa depois** — ex.: tirar a animação infinita/`backdrop-filter` e o teste `test_<tela>_ui.js`; ferramentas de medição (`perf_*.js`, `medir_*.js`).
  - **Antigravity (volume/rotina, plano enterprise):** CHANGELOG/BUGS/GUIA/skill, capturas antes × depois em `docs/capturas/`, Ajuda e dica, script de console, rascunho do texto do PR.
- **PRs pequenos:** uma rodada vira **dois PRs** quando mistura **correção** (ex.: fps — rápida, validável, sobe na hora) com **redesenho** (entra no lote do dia). A correção não espera o redesenho.
- **Antes de abrir qualquer PR** o maestro roda a bateria da CI inteira (`checar.js` + `cd functions && npm test` quando tocar CHANGELOG/Ajuda/páginas) — CI vermelha por algo que a máquina local já mostraria é retrabalho de todo mundo.
- **Medido (07/11/2026, Agente Ágil no Painel):** 40 min, 96 chamadas; **só 7 min foram comando, 32 min foram eu gerando arquivo grande em série** (função, regras, gaveta, 5 testes) — delegar uma parte de quatro não encurta nada se o resto continua numa fila só. **Regra de tempo:** (1) pedido com 3+ arquivos grandes independentes → no **mesmo turno** disparo em paralelo (Codex via `codex exec` em background, `Agent` fork em worktree) e escrevo só a parte que depende de decisão minha; (2) teste grande é do Codex/fork, não meu; (3) mais de ~15 min sem resposta ao Caio → status de uma linha e **entrego o que já está pronto** (um PR por camada) em vez de segurar tudo; (4) advisor 1× no fim, não a cada camada.
- **Não delegue** o que é mais rápido direto (um ajuste de CSS, uma linha) — o custo de contrato + revisão passa o ganho (§7.4).

### 7.6 Piloto do Codex (um mês) e métricas
- **Semana 1:** identidades novas (`codex/…`, `Agent: codex`), worktrees, revisão cruzada (Caio + Claude revisam; Codex não).
- **Semanas 2–3:** delegação por CLI pelo maestro, uma tarefa por dia no máximo, sempre com contrato (§7.3).
- **Semana 4:** decidir se o Codex fica, com que escopo, e se vale a "auto-divisão" (o maestro atribuir sozinho as tarefas do Quadro).
- **Medir por tarefa:** nota na rubrica (arquivo certo, teste que pega o bug, escopo mínimo, registros, honestidade do relatório), retrabalho (quantas correções), tempo, tokens e colisões. Os dois testes de 05/11 (prompt do agente de OKR e esqueleto de carregamento do Oceano) tiraram **25/26 e 26/26**; esse é o patamar de referência.

---

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

---

## Confirmações de deploy depois da reorganização (12/11/2026 em diante)

- ✅ **12/11/2026:** o Caio publicou as 5 funções do Agente Ágil com o conhecimento da promoção #1742 (kanban v8.30.948, tag `kanban-v8.30.948`; bugfix #1741 + apresentação alternada).

## Confirmação de deploy — 13/11/2026

Caio confirmou o merge da #1768 e todos os deploys pendentes do Gantt: regras de calendários, histórico/cópias e destaques (incluindo Marketplace/Outlet), backups e conhecimento do Agente Ágil. Pendências removidas do Quadro na tarefa do botão Mês.
- ✅ **13/11/2026:** o Caio publicou as 5 funções do Agente Ágil com o conhecimento da promoção do lote Gantt (#1770; tags `kanban-v8.30.969`, `painel-v5.113`).

## Confirmação de deploy — 13/11/2026 (🏖️ Férias F1)

Caio confirmou o merge da #1786 e o deploy das regras (`--only database`: nó `kanban/ferias(_dev)` e, de carona, as regras de `gantt_inscritos(_dev)` que já estavam na main) e das funções `backupGlobalDiario` e `backupCompletoSemanal`. Revisões R3: Codex (D1, sem defeito) e Antigravity (8 hipóteses rejeitadas; motor real = validar no dev).
