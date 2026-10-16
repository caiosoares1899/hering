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
             └► ADM: Oceano › 🐛 Reportar Bug › "📋 Copiar pacote anônimo"  → cola no Antigravity com `/plantaobug` (abaixo)
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

## Comando de plantão: `/plantaobug`

No Antigravity do ADM (o repositório já traz a skill em `.claude/skills/plantaobug/SKILL.md`), basta:

```
/plantaobug <cole aqui o pacote anônimo>
```

A skill já contém as regras: edita só o arquivo -dev do pacote; se precisar de mais de uma página, `functions/`, regras ou produção, responde **ESCALAR AO CLAUDE**; entrega o **script de teste** (português, só leitura, funções reais, `console.table` ✅/❌) e **um único comando agrupado** (branch + bump + log + checar + commit + push + PR de dev). Nunca faz merge. Se for reprovado, corrige no mesmo branch (máx. 3 tentativas).

## Status

| PR | Conteúdo | Situação |
|---|---|---|
| 1 — Contenção | Sem Issue pública, sem workflow/daemon, pacote anônimo, linhas vermelhas no `AGENTS.md`, CI reprova workflow que reage a issue/comentário | ✅ em `main` (#1454) |
| 2 — Servidor + validação | `plantaoBugNovo` / `plantaoVigia`, regras de `kanban/plantao` (só ADM), painel de validação no Oceano (v1.45), aviso `plantao_bug`, pausa geral | ✅ em `main` (#1455) e **implantado** (database + functions) em 16/10 — teste ao vivo: aviso chegou para os 3 ADMs; trava "quem reportou não valida" confirmada |
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
