# 🏖️ Assistente Férias do Caio — encerrado em 03/11/2026, guardado para reuso

> **Estado (01/11/2026): DESATIVADO, NÃO APAGADO.** O assistente cobriu o ecossistema Oceano durante as férias do Caio (**16/10 → 03/11/2026**). Com a volta dele, a vitrine do Oceano deixou de mostrá-lo a partir de **03/11/2026**. Todo o código, as funções, as regras do banco, a aba do Painel, o módulo compartilhado e a skill continuam no repositório — este documento é o mapa para **entender, religar e reaproveitar** numa próxima ausência (férias, licença, viagem) ou como base de um suporte guiado permanente.
>
> Leia junto: `docs/PLANTAO_BUGS.md` (o runbook técnico do plantão: fluxo, estados da ficha, deploy, segredos, limites) e `docs/OCEANO.md` (seção "Assistente Férias do Caio & Plantão de Bugs"). Aqui fica o **panorama + o interruptor + o passo a passo de reativar**; lá, o detalhe de cada peça.

## 1. O que é (em uma tela)

Duas coisas que andam juntas, mas são separáveis:

| Parte | O que faz | Quem usa |
|---|---|---|
| **🏖️ Assistente (Oceano)** | Banner/pílula na vitrine + modal com 6 abas: 💬 Perguntar (chat por palavras-chave, sem IA), 🆘 Socorro Rápido (quem resolve o quê), 🚀 Status & Entregas, 📖 Guia & DevTools, 🗺️ Próximos Passos e 🐛 Reportar Bug (+ "Meus chamados") | Qualquer pessoa logada |
| **🛟 Plantão de Bugs** | Recebe o bug reportado, cria a ficha, junta duplicados, avisa os ADMs, deixa o Antigravity buscar o bug sozinho, abre a PR de dev e registra a validação do ADM | ADMs (Painel), Antigravity, servidor |

Premissas de projeto (valem para um próximo uso): **sem TI** no meio, **o mínimo de gente do time**, **tudo documentado**, **dado pessoal nunca sai do Firebase** (o agente de código só recebe o "pacote anônimo": app, arquivo, impacto, descrição e console sanitizados — nunca nome, e-mail, link nem print) e **quem valida o conserto é sempre um ADM**, nunca quem reportou nem o Antigravity.

## 2. O interruptor (como está desligado hoje)

Em `oceano-dev.html` / `oceano.html`, bloco "🏖️ Assistente Férias do Caio":

| O quê | Valor hoje | Efeito |
|---|---|---|
| `const FERIAS_FIM` | `'2026-11-02'` | `feriasAtivo()` é verdadeiro **até essa data (inclusive)**, pelo relógio do navegador (`toLocaleDateString('sv-SE')`). Depois, banner, pílula e modal somem sozinhos — **sem deploy, sem edição de dado** |
| `?ferias=1` na URL | sempre liga | Só para quem abriu assim (teste, demonstração, reuso). Não grava nada |
| `abrirFerias()` / `abrirFeriasCaio()` | guardado por `feriasAtivo()` | Um sino ou link antigo de chamado (`#ferias-bugs`, notificação `nf_bug_*`) não abre o modal; mostra um aviso "o assistente foi encerrado" |

O que **continua ligado** de propósito (não tem nada para o usuário ver, só guarda histórico e deixa o religamento imediato): as funções do servidor (ficam ociosas sem bug novo), as regras do banco (`kanban/plantao`, `kanban/plantao_status`, `kanban/feedback`), a aba **Painel › 🐛 Monitor › 🛟 Plantão de Bugs** (fichas e histórico) e o módulo `mare-plantao(-dev).js`.

Teste do interruptor: `docs/arezzo/testes/test_ferias_encerrado.js` (congela o relógio em 02/11, 03/11 e 10/11 e confere os três estados).

## 3. Inventário completo (onde mora cada peça)

### 3.1 Front-end
- **`oceano-dev.html` / `oceano.html`** — CSS `.ferias-*` (bloco "ASSISTENTE FÉRIAS DO CAIO"), host `#ferias-caio-host` (banner/pílula), modal `#ferias-ov` e as funções `ferias*` (`feriasRenderBanner`, `feriasRenderModal`, `abrirFerias`, `feriasEnviarPergunta`, `feriasEnviarBug`…). O conhecimento do chat é a lista `FERIAS_KB` (+ `FERIAS_SUGS`, as sugestões); as abas Status/Próximos Passos/Guia têm texto próprio com datas — **todo texto com "16/10", "03/11" ou "Pós-03/11" precisa ser revisto ao reutilizar** (`grep -n "03/11\|16/10" oceano-dev.html` acha ~22 pontos).
- **`mare-plantao-dev.js` / `mare-plantao.js`** (módulo compartilhado, usado por `oceano` e `painel`): cria o card do bug na squad **Dados › 🐛 Bugs**, avisa quem reportou, monta o **pacote anônimo** (`feriasMontarPacoteAnonimo`), e é a tela do ADM no Painel (fichas, PR + script de teste, validar/reprovar, 🚀 em produção, pausa geral, "Antigravity buscou há X min"). Ao validar (✅), comenta a correção no card (PR, "O que mudou", quem validou, nota).
- **`painel-dev.html` / `painel.html`** — aba **🐛 Monitor › 🛟 Plantão de Bugs** (monta o módulo acima).
- **Sino** — tipos `plantao_bug` (push, para ADMs; entrada em `MareNotif.TIPOS` e no `PUSH_TYPES` de `functions/index.js`) e `ferias_bug_status` (aviso a quem reportou, ids `nf_bug_*`).
- **Skill `/plantaobug`** — `.claude/skills/plantaobug/SKILL.md` (procedimento do Antigravity para UM bug a partir do pacote anônimo) e as linhas vermelhas do `AGENTS.md`.

### 3.2 Servidor (`functions/plantao/`, registradas em `functions/index.js`)
| Função | O que faz |
|---|---|
| `plantaoBugNovo` (RTDB, ao criar `kanban/feedback/{id}` de origem `assistente_ferias`) | cria a ficha em `kanban/plantao/{id}`, junta duplicados (mesmo arquivo + descrição ≥ 50% parecida, 14 dias), avisa os ADMs |
| `plantaoVigia` (a cada 3 h, 08–20h Brasília) | avisa os ADMs de bug **parado** e se o Antigravity parou de buscar (> 2 h) com bug esperando |
| `plantaoTravado` (a cada 10 min, 08–20h) | o Antigravity pegou o bug há 20+ min e a PR não abriu → avisa os aprovadores |
| `plantaoProximo` (GET com chave) | o Antigravity **busca** o próximo bug (🔴 → 🟠 → resto, mais antigo primeiro) como texto puro; lease de 3 h; também recebe o aviso de "vou pedir aprovação" (`?aguardando=<id>&etapa=ship`) |
| `plantaoGithubWebhook` (POST assinado HMAC-SHA256) | quando a PR `antigravity/bug-<id>` abre, grava PR + script de teste na ficha e avisa os ADMs |

Segredos (cofre do Firebase, **nunca** no repositório): `PLANTAO_AGENTE_KEY` e `PLANTAO_WEBHOOK_SECRET`. Testes: `functions/plantao/__tests__/*.test.js`.

### 3.3 Dados (Realtime Database) e regras
`kanban/feedback/{id}` (o relato; gravável por qualquer `@ciahering`) · `kanban/plantao/{id}` (a ficha — **só ADM** lê/escreve) · `kanban/plantao_status` (batimento do Antigravity) · `kanban/config/plantao_ativo` (`false` = pausa geral; ausente = ligado) · `kanban/config/plantao_aprovadores/{uid}` (ADMs que recebem o aviso de aprovação; vazio = todos). Backup: `feedback` e `plantao` (as fichas — o histórico do plantão) entram no **backup completo semanal** (`NOS_GLOBAIS` de `functions/backup/completo.js`; `plantao` foi acrescentado em 01/11/2026 — antes não tinha cópia); `plantao_status` é só batimento e fica em `EXCLUIDOS`.

### 3.4 Estados da ficha
`aguardando → em_analise → pr_aberto → testando → validado → em_prod` · desvios: `reprovado` (volta a `testando`), `escalado` (3 reprovações → Claude), `duplicado`, `cancelado`. Detalhe em `docs/PLANTAO_BUGS.md`.

## 4. Checklist do dia da volta (03/11/2026)

Nada abaixo é obrigatório para o Oceano parar de mostrar o assistente (isso já é automático), mas evita ruído e custo:

1. **Fichas abertas:** abra Painel › 🐛 Monitor › 🛟 Plantão de Bugs e resolva, cancele ou valide o que ficou em aberto (o que ficar parado continua gerando aviso de "bug parado" aos ADMs).
2. **Pausar o plantão:** no mesmo painel, botão **⏸ Pausar** (grava `kanban/config/plantao_ativo = false`; `plantaoVigia`, `plantaoTravado`, `plantaoProximo` e o webhook passam a sair sem fazer nada).
3. **Antigravity:** remover (ou pausar) a **tarefa agendada de 30 min** que chama `plantaoProximo`. Sem ela o batimento para sozinho; com a pausa do passo 2 ela só recebe `SEM_BUG_PENDENTE`.
4. **Webhook do GitHub (opcional):** Settings → Webhooks → desmarcar *Active* (reativar é um clique). Com o passo 2 ele já recusa tudo (`desligado`).
5. **Comunicar:** o texto de "o Caio voltou" (Mural/WhatsApp) já pode mencionar que o assistente se despediu; o canal de bug volta a ser o de sempre (card "Melhorias Maré Digital", "Fale com o ADM" no Maré, ADM da squad).
6. **Funções ociosas:** podem ficar publicadas (custo praticamente zero sem bug) — **não** apague as funções nem os segredos se a ideia é reaproveitar. Se um dia quiser remover do servidor: comente os `exports.plantao*` em `functions/index.js` (como já foi feito com `spotifySync`) e faça o deploy confirmando a remoção.

## 5. Como religar numa próxima ausência (passo a passo)

1. **Datas:** em `oceano-dev.html` mude `FERIAS_FIM` para o último dia da ausência e troque os textos de data (`grep -n "03/11\|16/10" oceano-dev.html`: banner, cabeçalho do modal, `FERIAS_KB`, abas Status/Próximos Passos). Se quiser início programado, acrescente `FERIAS_INICIO` e compare em `feriasAtivo()`.
2. **Conteúdo:** revise `FERIAS_KB` (respostas), a aba 🆘 Socorro Rápido (quem resolve cada coisa **naquela época** — nomes e papéis mudam) e a de Próximos Passos. O que o assistente diz tem que ser verdade na data.
3. **Teste local:** `?ferias=1` na URL mostra o assistente a qualquer data; rode `test_ferias_encerrado.js`, `test_ferias_pacote_anonimo.js`, `test_plantao_validacao.js` e `test_ferias_card_contrato.js` (os três últimos já abrem a página com `?ferias=1`).
4. **Promover** pelo fluxo normal (`/subirproprod`: `oceano` e, se mexeu no módulo, `mare-plantao` + `painel`).
5. **Servidor** (só o Caio, resync antes — ver `CLAUDE.md`): confirmar que as funções estão publicadas (`firebase functions:list --project hering-onboarding | grep plantao`); se não estiverem, `firebase deploy --only database` e `firebase deploy --only functions:plantaoBugNovo,functions:plantaoVigia,functions:plantaoTravado,functions:plantaoProximo,functions:plantaoGithubWebhook,functions:sendPushOnNotification`. Segredos: `firebase functions:secrets:set PLANTAO_AGENTE_KEY` e `PLANTAO_WEBHOOK_SECRET` (rotacione — a chave anterior deve ser considerada encerrada).
6. **Religar a pausa:** Painel › 🛟 Plantão de Bugs › **▶ Retomar** (apaga `plantao_ativo`).
7. **Webhook do GitHub** (reativar ou recriar; *Payload URL* = URL do `plantaoGithubWebhook`, *Secret* = `PLANTAO_WEBHOOK_SECRET`, evento só *Pull requests*) e a **tarefa de 30 min do Antigravity** — texto pronto na seção "Ligar (uma vez, só o Caio)" de `docs/PLANTAO_BUGS.md`.
8. **ADMs:** conferir que quem vai validar tem `role === 'adm'` em `usuarios_publicos` (as regras só reconhecem esse papel) e quem recebe o aviso de aprovação (`plantao_aprovadores`).

## 6. Segurança e limites conhecidos (não esquecer ao religar)
- Linhas vermelhas do `AGENTS.md`: nada de Issue pública, workflow que reaja a issue/comentário, nem daemon que aperte "Run" no Antigravity; a CI reprova isso.
- `kanban/feedback` e `kanban/config/plantao_ativo` são graváveis por qualquer conta `@ciahering` (nós compartilhados com outros usos) — o pior caso é forjar um status de chamado ou pausar avisos; a **validação** (`kanban/plantao`) é só de ADM.
- A rede da empresa pode bloquear `*.run.app` (as URLs das funções): teste `plantaoProximo` pelo Antigravity antes de contar com o modo automático; senão o plantão volta a ser "copiar o pacote e colar `/plantaobug`".
- O Antigravity corporativo pede aprovação a cada comando de terminal: o plantão é "1 clique de ADM por bug" (comando único e agrupado), não é autônomo.
- Triagem sem IA (duplicado por similaridade de texto). Se os relatos vierem confusos, dá para acrescentar uma chamada barata do Agente Ágil que reescreve o pacote com passos de reprodução.

## 7. Histórico
- **16/10/2026** — PR 1 (contenção), PR 2 (servidor + validação), PR 3 (`/plantaobug`), PR 4 (modo automático).
- **17–18/10/2026** — aviso minimizado no Oceano, centralização do controle de ADM no Painel, aviso de aprovação no celular e `plantaoTravado`.
- **01/11/2026** — encerrado: `FERIAS_FIM` → `2026-11-02` (ativo até 02/11, inclusive), `abrirFerias()` guardado por `feriasAtivo()`, testes das páginas passam a abrir com `?ferias=1`, este documento criado.
