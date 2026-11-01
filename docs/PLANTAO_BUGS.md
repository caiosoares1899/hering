# Plantão de Bugs (férias do Caio, 16/10 → 03/11/2026)

> ⏸ **Encerrado em 03/11/2026 e guardado para reuso** — o Oceano deixou de mostrar o Assistente Férias; nada foi apagado. Panorama, interruptor (`FERIAS_FIM` / `?ferias=1`), checklist do dia da volta e passo a passo para religar: **`docs/ASSISTENTE_FERIAS.md`**. Este arquivo continua sendo o runbook técnico (fluxo, estados da ficha, deploy, segredos, limites).

> Runbook vivo. Cada PR do plantão atualiza a seção **Status**. Regras de conduta dos agentes: `AGENTS.md` ("Linhas vermelhas"); divisão de trabalho: `docs/COORDENACAO_AGENTES.md`.

## O problema e as restrições

Com o Caio fora, bugs reportados no Oceano (Assistente Férias) precisam ser analisados, corrigidos e validados **sem TI** (não libera nada), **com o mínimo de gente do time** e **documentado**. Custo: o Antigravity já é pago pela empresa; o servidor roda no plano gratuito do Firebase (e não usa IA nesta fase).

## Decisão (16/10, depois do teste do Antigravity)

O Antigravity corporativo **pede aprovação a cada comando de terminal** (`command(*)` em "Ask permission"; as opções "sempre permitir" ficam bloqueadas) e **para se a janela fechar ou o PC dormir**. Sem ninguém na frente ele não entrega nada. O que ele faz **sem clique**: ler/buscar arquivos, editar/criar arquivos da pasta do projeto. Por isso:

- **O Caio (ou, se ele estiver fora do PC, André/Alisson no computador deles) opera o Antigravity e aprova UM comando por bug** — o comando único e agrupado do fim da tarefa (branch + commit + push + PR). Esse é o limite: **não se contorna** a regra de aprovação (`AGENTS.md`, linha vermelha nº 1).
- O servidor cuida de tudo em volta: ficha do bug, duplicados, aviso aos ADMs, bug parado, registro da validação.

## Fluxo

```
Pessoa (Oceano › Assistente Férias › 🐛 Reportar Bug)
   └► kanban/feedback/{id}  +  card na squad Dados › 🐛 Bugs          (dados da pessoa ficam SÓ aqui)
        └► plantaoBugNovo (servidor): ficha kanban/plantao/{id} · junta duplicados · avisa os ADMs 🔔 (abre o card)
             └► ADM: Painel › 🐛 Monitor › 🛟 Plantão de Bugs › "copiar pacote (modo manual)"  → cola no Antigravity com `/plantaobug` (abaixo)
                  └► Antigravity (sem clique): diagnostica, edita só o arquivo -dev, escreve o SCRIPT DE TESTE
                       └► ADM aprova o comando único (branch + commit + push + PR de dev) — 1 clique
                            └► ADM cola PR + script na ficha (💾), RODA o script no console do dev, e valida: ✅ ou ❌ (+ nota)
                                 ├─ ❌ → volta ao Antigravity com a nota (máx. 3 tentativas; a 3ª escala ao Claude)
                                 └─ ✅ → PR de prod (promover.js) → merge → "🚀 mergeado" → bug Resolvido + sino de quem reportou
   plantaoVigia (servidor): de 3 em 3 h (08–20h) avisa os ADMs de bug parado.   Pausa geral: botão ⏸ ou kanban/config/plantao_ativo = false
```

Quem valida é **sempre um ADM** (papel `adm`) — nunca quem reportou (a tela recusa) e nunca o Antigravity. Sem **PR + script salvos** o botão "Rodei o script e validei" não funciona.

## Onde cada pessoa mexe (layout — v1.48 do Oceano · v5.76 do Painel)

- **Oceano** = só o que a pessoa comum vê: o aviso do assistente **abre minimizado** (uma linha, com ✕ para dispensar; reaparece só quando há novidade num chamado dela), a aba 🐛 Reportar Bug (formulário + **Meus chamados**), e nada de pacote, PR, script ou comando do agente.
- **Painel › 🐛 Monitor › 🛟 Plantão de Bugs** = todo o controle de ADM: fichas, PR + script de teste, validar/reprovar, 🚀 em produção, ✉️ avisar quem reportou, pausa geral, "Antigravity buscou há X min".
- O código mora em `mare-plantao-dev.js` (módulo compartilhado: card na Squad Dados, aviso ao autor, pacote anônimo, tela do ADM). As fichas ganharam `app`, `autorUid` e `autorNome` (para o ADM ver quem reportou sem abrir o Oceano) — **exige `firebase deploy --only database` e redeploy de `plantaoBugNovo`**.

**Comentário de correção no card (16/10):** ao validar (✅), o módulo comenta no card da Squad Dados: PR (número e título), "O que mudou" (seção `## Resumo` da PR — o Antigravity deve preenchê-la), quem validou, a nota do ADM e o resultado do teste. O servidor guarda `prTitulo`/`prResumo` na ficha ao receber a PR (exige deploy de `database` + `plantaoGithubWebhook`); sem eles o comentário sai com PR, validador e nota. Validar de novo atualiza o mesmo comentário.

## Estados da ficha (`kanban/plantao/{id}/estado`)

`aguardando` → `em_analise` → `pr_aberto` → `testando` (PR + script salvos) → `validado` → `em_prod` · desvios: `reprovado` (volta a testando com novo PR+script), `escalado` (3 reprovações: Claude assume; o conserto do Claude também passa por validação de ADM), `duplicado` (juntado a outro bug aberto), `cancelado`.

## Comando de plantão: `/plantaobug`

No Antigravity do ADM (o repositório já traz a skill em `.claude/skills/plantaobug/SKILL.md`), basta:

O botão **copiar pacote (modo manual)** da ficha (Painel › Monitor) já copia o pacote com o comando na frente — é só colar no Antigravity:

```
/plantaobug em kanban-dev.html — Bug reportado no Oceano (Maré Digital · 🟡 Dá pra contornar): <descrição…>
```

A skill já contém as regras: edita só o arquivo -dev do pacote; se precisar de mais de uma página, `functions/`, regras ou produção, responde **ESCALAR AO CLAUDE**; entrega o **script de teste** (português, só leitura, funções reais, `console.table` ✅/❌) e **um único comando agrupado** (branch + bump + log + checar + commit + push + PR de dev). Nunca faz merge. Se for reprovado, corrige no mesmo branch (máx. 3 tentativas).

## Modo automático (PR 4) — o Antigravity busca o bug sozinho

Teste de 16/10 no Antigravity corporativo: **`read_url_content`, `schedule` e `write_to_file` rodam sem pedir aprovação** (o alarme acordou sozinho); só `run_command` pede. Então ninguém *empurra* um bug para dentro dele, mas ele *busca*:

```
Oceano (bug) ─► ficha ─► [Antigravity, a cada 30 min]  GET plantaoProximo?k=CHAVE  ─► recebe o pacote anônimo
                          ├─ lê o código, edita o arquivo -dev, escreve o script de teste   (sem clique)
                          └─ PARA no comando único de git ─► Caio/ADM aprova (1 clique) ─► PR no GitHub
GitHub ─► webhook assinado ─► plantaoGithubWebhook: grava link da PR + script na ficha e avisa os ADMs 🔔
ADM: abre a PR, roda o script no dev, ✅/❌ no painel 🛟  (❌ → o Antigravity recebe de novo, com a nota, e corrige no MESMO branch)
```

**Peças (todas em `functions/plantao/`):**
- `plantaoProximo` (GET, chave na URL): entrega o próximo bug (🔴 → 🟠 → resto; mais antigo primeiro) como texto puro — cabeçalho, branch, instruções e **pacote anônimo**; ou `SEM_BUG_PENDENTE`. **Lease de 3 h** por bug (não repete enquanto alguém trabalha), no máximo **3 entregas** (depois: escalado ao Claude), teto de 120 requisições/hora. O texto do relato vai marcado como DADO, nunca instrução.
- `plantaoGithubWebhook` (POST, assinado com HMAC-SHA256): só aceita `pull_request` do nosso repositório, branch `antigravity/bug-<id>` (sem fork), aberta por Caio/André/Alisson. Lê o script do corpo da PR (`## Script de teste` + bloco de código). **Novo push depois de validada desfaz a validação.**
- `plantaoVigia`: agora também avisa se o Antigravity **parou de buscar** (> 2 h) com bug esperando (1×/dia; só depois do modo ser usado pela 1ª vez).
- Painel › 🐛 Monitor › 🛟 Plantão de Bugs (ADM): o cabeçalho mostra "🤖 Antigravity buscou há X min".

### ✋ Aviso de aprovação no celular (18/10/2026)

O clique de aprovação só existe dentro do app do Antigravity — **o push avisa, mas não aprova**: ao receber, o Caio abre o Antigravity e clica.

- **Antes do comando que pede aprovação**, o Antigravity chama `plantaoProximo?k=CHAVE&aguardando=<id>&etapa=ship` (`read_url_content`, sem aprovação; o texto entregue por `plantaoProximo` já instrui isso). O servidor manda a notificação **✋ Antigravity aguarda a sua aprovação** (tipo `plantao_bug`, sino + push, respeitando o 🔕 Não Perturbe e o interruptor da Central de Notificações). `etapa`: `ship` (comando único de git), `comando` (outro comando de terminal), `outro`; `&nota=` opcional (≤ 80 caracteres). Idempotente: 1 aviso por bug/entrega/etapa (sem id de bug, 1 por janela de 10 min). A ficha ganha `aprovacaoPedidaEm`/`aprovacaoEntrega`.
- **Rede de segurança — `plantaoTravado`** (a cada 10 min, 08–20h de Brasília, respeita `plantao_ativo`): bug em `em_analise` pego há 20 min+ (até 6 h) sem PR e sem aviso de aprovação → **🤖 Antigravity pegou o bug e ainda não abriu a PR**. Cobre o caso de ele travar num pedido de permissão *antes* de conseguir avisar.
- **Quem recebe:** todos os ADMs; para restringir, `kanban/config/plantao_aprovadores/{uid} = true` (só esses ADMs recebem). Sem esse nó, todos.
- **Deploy** (resync do clone antes): `firebase deploy --only functions:plantaoProximo,functions:plantaoTravado --project hering-onboarding --account caio.soares@ciahering.com.br` — não precisa de `--only database` (`plantao_aprovadores` é lido por função, e `kanban/config` já é regra existente). A tarefa agendada do Antigravity **não precisa mudar**: o aviso vem da instrução entregue com o bug.

### Ligar (uma vez, só o Caio — Windows)

1. **Duas chaves** (textos aleatórios longos; guarde só no cofre do Firebase e no passo 4):
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})      # rode 2 vezes: uma para cada chave
   firebase functions:secrets:set PLANTAO_AGENTE_KEY --project hering-onboarding --account caio.soares@ciahering.com.br
   firebase functions:secrets:set PLANTAO_WEBHOOK_SECRET --project hering-onboarding --account caio.soares@ciahering.com.br
   ```
2. **Deploy** (depois do resync do clone):
   ```powershell
   firebase deploy --only database --project hering-onboarding --account caio.soares@ciahering.com.br
   firebase deploy --only functions:plantaoProximo,functions:plantaoGithubWebhook,functions:plantaoVigia --project hering-onboarding --account caio.soares@ciahering.com.br
   ```
   O deploy imprime a **Function URL** de cada função (algo como `https://plantaoproximo-xxxx-uc.a.run.app`). Teste no navegador: `<URL do plantaoProximo>?k=<CHAVE>` → deve mostrar `SEM_BUG_PENDENTE`; sem `?k=` ou com chave errada → "chave inválida".
3. **Webhook do GitHub** (repositório → Settings → Webhooks → Add webhook): *Payload URL* = a URL do `plantaoGithubWebhook`; *Content type* = `application/json`; *Secret* = o `PLANTAO_WEBHOOK_SECRET`; *Events* = "Let me select" → só **Pull requests**; Active. Em *Recent Deliveries* a 1ª entrega (ping) deve dar 200 ou 401/ignorado — o que importa é abrir uma PR de teste depois.
4. **Tarefa agendada no Antigravity** (peça para ele criar com `schedule`, a cada 30 minutos — substitua `<URL>` e `<CHAVE>`):
   ```
   Plantão de bugs. Use read_url_content em <URL do plantaoProximo>?k=<CHAVE>
   - Se a resposta for SEM_BUG_PENDENTE: não faça nada.
   - Se começar com PLANTAO_BUG: siga a skill plantaobug (.claude/skills/plantaobug/SKILL.md) para ESSE bug, no modo automático, até o comando único de git; então PARE e espere a minha aprovação.
   Não use terminal antes do comando único e nunca tente aprovar nada por conta própria.
   ```
   A chave fica **só** nessa tarefa (nunca em arquivo do repositório, issue, PR, commit ou resposta; é a exceção prevista na linha vermelha nº 6 do `AGENTS.md`). Digite-a direto no Antigravity, nunca em outro chat. Vazou? Troque o secret (`firebase functions:secrets:set PLANTAO_AGENTE_KEY`) e refaça o deploy de `plantaoProximo`.
5. O Antigravity precisa estar **aberto e o PC acordado** — o vigia avisa os ADMs quando ele para de buscar.

**Limites:** a rede da empresa pode bloquear `*.run.app` (teste o passo 2 pelo Antigravity: peça `read_url_content` na URL com a chave); se bloquear, o plantão volta a ser "colar o pacote".

## Status

| PR | Conteúdo | Situação |
|---|---|---|
| 1 — Contenção | Sem Issue pública, sem workflow/daemon, pacote anônimo, linhas vermelhas no `AGENTS.md`, CI reprova workflow que reage a issue/comentário | ✅ em `main` (#1454) |
| 2 — Servidor + validação | `plantaoBugNovo` / `plantaoVigia`, regras de `kanban/plantao` (só ADM), painel de validação no Oceano (v1.45), aviso `plantao_bug`, pausa geral | ✅ em `main` (#1455) e **implantado** (database + functions) em 16/10 — teste ao vivo: aviso chegou para os 3 ADMs; trava "quem reportou não valida" confirmada |
| 4 — Modo automático | `plantaoProximo`, `plantaoGithubWebhook`, vigia do Antigravity, batimento no Oceano (v1.47) — **exige as 2 chaves, deploy e o webhook** (seção acima) | **este PR** |
| 3 — Comando `/plantaobug` | Skill que reduz o plantão a colar o pacote; passo de validação documentado | **este PR** |
| Em uso | Primeiro bug real passando pelo fluxo inteiro; ajustes do que o uso mostrar | pendente (depende de aparecer bug) |

## Deploy do PR 2 (só o Caio roda — Windows)

```
cd C:\caminho\do\hering
git fetch origin <branch-de-trabalho>
git reset --hard origin/<branch-de-trabalho>     # o clone local NÃO atualiza sozinho
firebase deploy --only database --project hering-onboarding --account caio.soares@ciahering.com.br
firebase deploy --only functions:plantaoBugNovo,functions:plantaoVigia,functions:sendPushOnNotification --project hering-onboarding --account caio.soares@ciahering.com.br
```

As páginas (`oceano-dev.html`, `painel-dev.html`, `mare-plantao-dev.js`, `mare-notif-dev.js`) saem sozinha pelo GitHub Pages ao mergear. Sem o deploy, a tela do ADM funciona mas a ficha precisa ser criada à mão (botão "➕ Criar ficha") e **não há aviso nem vigia**.
**Antes do deploy das regras:** confira no Oceano (console, logado como você) se André e Alisson têm `role === 'adm'` — as regras só reconhecem esse papel (não leem a lista `adm_emails`):
`const sn = await window._get(window._ref(window._db,'kanban/usuarios_publicos')); console.table(Object.entries(sn.val()||{}).filter(([u,v])=>v&&v.role==='adm').map(([u,v])=>({uid:u,nome:v.nome||'',email:v.email||''})))`

## O que mudou no PR 1 (e por quê)

| Antes | Problema | Agora |
|---|---|---|
| Botão "Abrir Issue no GitHub" com nome + e-mail de quem reportou | Repositório público: o dado pessoal ficava exposto (a issue #1445 precisa ser excluída pelo Caio) | Nada vai ao GitHub; o relato fica no Firebase |
| Workflow disparava em `issues`/`issue_comment` com permissão de escrita e promovia a prod com "aprovado" | Qualquer pessoa na internet podia acionar o robô e promover | Workflow removido; a CI reprova qualquer um com esse tipo de gatilho |
| `ferias-daemon.js` apertava o "Run" do Antigravity | Contornava o controle corporativo de aprovação de terminal | Removido; regra nº 1 do `AGENTS.md` |
| Página lia comentários públicos da Issue e aceitava `FERIAS_STATUS` de qualquer autor | Qualquer pessoa mudava o status do chamado | Removido; status vem do Firebase |
| Prompt do `/monitorarbugs` com o nome do autor, link e print | Dado pessoal indo para o agente e para logs | **Pacote anônimo** (`feriasMontarPacoteAnonimo`): app, arquivo, impacto, descrição e console sanitizados |

## O que mudou no PR 2

- **Servidor** (`functions/plantao/plantao.js`): ficha por bug, duplicado (mesmo arquivo-alvo + descrição ≥ 50% parecida com bug aberto nos últimos 14 dias — sem IA), aviso aos ADMs só com o essencial (impacto, app, resumo — **sem autor/e-mail**), vigia de bug parado (🔴 2h · 🟠 6h · demais 24h; em análise/PR/teste/escalado 24h), 1 aviso por bug por dia.
- **Regras** (`database.rules.json`, nó `kanban/plantao`): só ADM lê/escreve; estado só da lista; PR só de `caiosoares1899/hering`; `validadoPorUid` tem que ser quem está gravando; campo desconhecido é recusado.
- **Oceano**: painel do plantão por bug (só ADM), banner com pausa geral, e **o painel de "atualizar status" deixou de aparecer para qualquer pessoa** (antes o botão era exibido justamente para quem NÃO era ADM/PO, e `?adm=1` na URL liberava).
- **Sino**: tipo `plantao_bug` (catálogo da Central de Notificações, push permitido); clicar abre o card do bug na squad Dados.

## Limites conhecidos (o que este PR NÃO resolve)

- `kanban/feedback` continua gravável por qualquer conta `@ciahering` (o Maré usa o mesmo nó para "Fale com o ADM"). Quem quiser forjar o `status` de um bug consegue pelo console; a validação do plantão, **não** (nó `kanban/plantao` só ADM). Endurecer o `feedback` exige separar os dois usos — fica para depois do plantão.
- `kanban/config/plantao_ativo` (pausa) é gravável por qualquer conta `@ciahering` (o nó `config` é aberto). O efeito é só pausar avisos.
- Triagem sem IA: se os relatos vierem confusos, dá para acrescentar uma chamada barata do Agente Ágil que reescreve o pacote com passos de reprodução.
- Dúvida em aberto: custo real do Agente Ágil por bug (não usado nesta fase).

## Passos manuais do Caio

1. Excluir a issue #1445 (nome e e-mail em repositório público): na página da issue, barra lateral → **Delete issue**.
2. Fazer o deploy acima depois do merge.
3. (Opcional) Em Settings do Antigravity, ver se a regra `command(*)` é sua e editável; se for, liberar só comandos inofensivos (`node scripts/checar.js`, `node --test`) — nunca `git push` livre. Se for da empresa, não mexer.
