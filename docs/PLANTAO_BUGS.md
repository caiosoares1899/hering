# Plantão de Bugs (férias do Caio, 16/10 → 03/11/2026)

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
             └► ADM: Oceano › 🐛 Reportar Bug › "📋 Copiar pacote anônimo"  → cola no Antigravity com o PROMPT DE PLANTÃO (abaixo)
                  └► Antigravity (sem clique): diagnostica, edita só o arquivo -dev, escreve o SCRIPT DE TESTE
                       └► ADM aprova o comando único (branch + commit + push + PR de dev) — 1 clique
                            └► ADM cola PR + script na ficha (💾), RODA o script no console do dev, e valida: ✅ ou ❌ (+ nota)
                                 ├─ ❌ → volta ao Antigravity com a nota (máx. 3 tentativas; a 3ª escala ao Claude)
                                 └─ ✅ → PR de prod (promover.js) → merge → "🚀 mergeado" → bug Resolvido + sino de quem reportou
   plantaoVigia (servidor): de 3 em 3 h (08–20h) avisa os ADMs de bug parado.   Pausa geral: botão ⏸ ou kanban/config/plantao_ativo = false
```

Quem valida é **sempre um ADM** (papel `adm`) — nunca quem reportou (a tela recusa) e nunca o Antigravity. Sem **PR + script salvos** o botão "Rodei o script e validei" não funciona.

## Estados da ficha (`kanban/plantao/{id}/estado`)

`aguardando` → `em_analise` → `pr_aberto` → `testando` (PR + script salvos) → `validado` → `em_prod` · desvios: `reprovado` (volta a testando com novo PR+script), `escalado` (3 reprovações: Claude assume; o conserto do Claude também passa por validação de ADM), `duplicado` (juntado a outro bug aberto), `cancelado`.

## Prompt de plantão (cole no Antigravity junto com o pacote anônimo)

```
PLANTÃO DE BUG — siga o AGENTS.md (Linhas vermelhas). Pacote abaixo.
Regras:
1. Edite SÓ o arquivo -dev indicado no pacote. Não toque em functions/, database.rules.json, version.json de outras páginas nem em prod.
   Se o conserto exigir mais de uma página, functions/ ou regras do banco: PARE e escreva "ESCALAR AO CLAUDE" com o motivo.
2. Não use terminal até o fim (leia/edite com as ferramentas nativas). Não peça nem registre dados de quem reportou.
3. Entregue, nesta ordem:
   a) resumo do conserto em até 3 linhas;
   b) SCRIPT DE TESTE para o console da página de DEV, em português: SOMENTE LEITURA (não grava no Firebase), chama as funções REAIS da página,
      termina com console.table de ✅/❌ por verificação, e diz exatamente em que página/tela rodar;
   c) UM ÚNICO comando de terminal agrupado: git fetch origin && git checkout -b antigravity/bug-<id-curto> origin/main && git add <arquivos> &&
      git commit (mensagem + trailer "Agent: antigravity") && git push -u origin antigravity/bug-<id-curto> && abrir o PR contra main
      com o título "Plantão: <resumo>". NUNCA fazer merge, NUNCA push na main.
4. Bump de versão do -dev e entrada no BUGS_E_CORRECOES.md (node scripts/mare-cli.js bump / log --type bug).

PACOTE:
<cole aqui o pacote anônimo>
```

## Status

| PR | Conteúdo | Situação |
|---|---|---|
| 1 — Contenção | Sem Issue pública, sem workflow/daemon, pacote anônimo, linhas vermelhas no `AGENTS.md`, CI reprova workflow que reage a issue/comentário | ✅ em `main` (#1454) |
| 2 — Servidor + validação | `plantaoBugNovo` / `plantaoVigia`, regras de `kanban/plantao` (só ADM), painel de validação no Oceano (v1.45), aviso `plantao_bug`, pausa geral | **este PR** — **exige deploy** (abaixo) |
| 3 — Fechamento | Teste ponta a ponta no dev com dados reais, ajustes do que o uso mostrar, revisão do runbook | pendente |

## Deploy do PR 2 (só o Caio roda — Windows)

```
cd C:\caminho\do\hering
git fetch origin <branch-de-trabalho>
git reset --hard origin/<branch-de-trabalho>     # o clone local NÃO atualiza sozinho
firebase deploy --only database --project hering-onboarding --account caio.soares@ciahering.com.br
firebase deploy --only functions:plantaoBugNovo,functions:plantaoVigia,functions:sendPushOnNotification --project hering-onboarding --account caio.soares@ciahering.com.br
```

A página (`oceano-dev.html`, `mare-notif-dev.js`) sai sozinha pelo GitHub Pages ao mergear. Sem o deploy, a tela do ADM funciona mas a ficha precisa ser criada à mão (botão "➕ Criar ficha") e **não há aviso nem vigia**.
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
