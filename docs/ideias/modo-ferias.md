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
| Entrada pelo menu (Caio, 13/11) | Item **🏖️ Minhas férias** no menu que abre ao clicar no **nome do usuário** no Maré (o mesmo do status, Sonar, Equipe, tema e 🚪 Sair) e no **⋯ Mais** do Radar. Abre "Minhas férias" (cadastro + 🧳 Preparar minha saída). Quem está de férias hoje vê "🏖️ De férias até 28/11" no próprio item. **Entra na F4** (Claude), para não mudar o contrato da F2 com o Antigravity no meio do trabalho. |
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
| **F1** ✅ no ar em 13/11 (#1786) | Nó + regras + backup + `functions/rules/__tests__/feriasRules.test.js` (simulador) | R3 | Claude | — |
| **F2** | Módulo `mare-ferias(-dev).js`: dados (`ouvir`, `ausente(uid, dia)`, `periodoDe(uid)`), "Minhas férias" (criar/editar/excluir; ADM corrige qualquer um) e a vista **🏖️ Férias** (mês com faixas por pessoa + "fora agora" e "próximas"; filtros pessoa, squad e período). Montada no Radar e no Maré. Ajuda + dica. | R2 | Antigravity (contrato) · Claude integra | F1 (formato; o deploy só para usar de verdade) |
| **F3** | **Alerta + selo 🏖️**: ao @mencionar, pôr como responsável ou participante (Maré) e como responsável de Objetivo/Marco ou @menção nas notas (Radar), um aviso "🏖️ Fulana está de férias até 28/11"; selo nos avatares/chips de quem está fora hoje | R1/R2 | Codex | F2 (API do módulo) |
| **F4** | **🧳 Preparar minha saída**, item a item com confirmação: ➡️ passar (escolhe a pessoa) ou ✋ manter. **No Maré**: os cards ativos da squad aberta em que sou responsável ou participante, aplicando com o mesmo caminho do `executarReatribuir()` (`recordHistory` + `runAutoRules('assigned')` + `fbSaveAll`), e um seletor para repetir em cada uma das minhas squads. **No Radar**: meus Objetivos (`responsaveis[]`) e Marcos (`responsavel`). **O Radar não escreve card** (Armadilha 10: schema de card fora do Maré); lá aparece "passar meus cards no Maré →". Aviso `assigned` no sino de quem recebe: **um por pessoa e lote**, não um por card. **Nenhum item vem pré-marcado**: o "Confirmar" fica travado até cada item ter decisão (atalho "manter todos os restantes" só preenche as escolhas, não grava); nada é gravado antes da tela final de confirmação. ⏸ Pausar card: **fora** (decisão de 13/11: "passar ou manter"); entra como 3ª opção só se o Caio pedir | R2 | Claude | F2 |

Deploy (do Caio, depois do resync): F1 → `firebase deploy --only database` e depois `--only functions:backupGlobalDiario,functions:backupCompletoSemanal`.

## Padrões da F2 (propostos pelo Claude; o Caio mandou seguir em 13/11 — muda fácil depois)
- Maré: por padrão, só as pessoas das minhas squads (chip "Todo o Digital"); Radar: todo o Digital.
- Período longo: a regra não limita; a tela **avisa** acima de 45 dias (não bloqueia).

## Prova no banco real (13/11/2026)

Script de console no `kanban-dev.html`, conta do Caio (ADM na regra), nó `ferias_dev`: **11/11 ✅** — lê o calendário; cadastra e edita as próprias; recusa data fora de AAAA-MM-DD, campo extra, `por` de outra pessoa, obs > 140 e apagar o nó inteiro; como ADM, grava e apaga as de outra pessoa; limpeza ok. **Falta:** a mesma rodada com uma conta não-ADM (esperado: "férias de OUTRA pessoa" recusado) — o simulador e a revisão R3 já cobrem esse caso.

## Registro (pós-merge/deploy)
Como a regra do 🔔 Gantt: **sem tag própria**; a F1 entra na entrada de feature do CHANGELOG quando a F2 for ao ar ("Banco: nó novo kanban/ferias(_dev)…"), e a confirmação do deploy sai do *Pendente de deploy* para o histórico.

## Contrato — revisão R3 da F1 (Antigravity, 2ª revisão)

```
Objetivo: 2ª revisão (modelo diferente do Codex) do PR #1786 — regras do nó kanban/ferias(_dev). Tentar REFUTAR: achar um caminho em que alguém grava, apaga ou lê férias que não deveria.
Risco: R3 (só revisão)  ·  Modelo e esforço: Gemini high  ·  Orçamento: 30 min
Contexto: docs/ideias/modo-ferias.md (tabela "Modelo de dados"); docs/SEGURANCA_FRONTEIRAS.md §2–§4; achado anterior em docs/quadro/escalados.md#gantt-favorita-autoria (escrita herdada de nó ancestral).
Arquivos: ler database.rules.json (blocos "ferias" e "ferias_dev"), functions/rules/__tests__/feriasRules.test.js, functions/backup/completo.js · Reservados por outros: os do Quadro
Critérios de aceite: cada hipótese com veredito (confirmado / precisa_validar / rejeitado) e, se confirmado, um caso de teste no feriasRules.test.js que falha hoje
Não fazer: editar database.rules.json, merge, deploy
Prova: saída de `cd functions && node --test rules/__tests__/feriasRules.test.js`
Entrega: comentário no PR #1786 começando com "🔍 Revisão do Antigravity (R3)"
```

## Contrato — F2: módulo `mare-ferias(-dev).js` + vista 🏖️ Férias (Antigravity)

```
Objetivo: agenda geral de férias do Digital, a mesma no Radar (📅 Calendário → vista "🏖️ Férias", ao lado de Mês/Agenda/📊 Gantt) e no Maré (📅 Calendários → visão "🏖️ Férias", ao lado de 👥 Escala), com "Minhas férias" para cadastrar, editar e excluir.
Risco: R2  ·  Modelo e esforço: Gemini high  ·  Orçamento: 1 dia; estourou, para e relata
Contexto:
- Nota de desenho: docs/ideias/modo-ferias.md (decisões do Caio, modelo de dados). Dado: kanban/ferias{,_dev}/{uid}/{id} = { ini, fim, obs?, em, por } — regras no PR #1786 (sufixo _dev nas páginas -dev, como calendarios_gantt_dev).
- Padrão a copiar: mare-gcal-dev.js (fonte única + visualizador montado pelas duas páginas; o Radar baixa o módulo só quando a vista abre, ver _okrGcalMontar/_GCAL_V em okr-dev.html; o Maré carrega com <script src="mare-gcal-dev.js?v=N">). No Maré, a visão entra como changeCalView('ferias') no #cal-ov (precedente: 👥 Escala, kanban-dev.html ~L34392). No Radar, b('ferias','🏖️ Férias') em _okrCalSegHtml + ramo em renderOkrCalendario.
- API mínima do módulo (a F3/F4 dependem dela): MareFerias.ouvir(db, suf, cb) · ausente(quem, diaISO) → {uid,ini,fim,obs}|null · periodoDe(quem) (o atual ou o próximo) · montar(root, {uid, nomeDe(uid), squadsDe(uid), isAdm, gravar, apagar}) → {destruir()}. **`quem` aceita uid OU inicial**: no Maré, responsável (card.owner), participantes e @menções são INICIAIS — o módulo resolve inicial → uid por kanban/usuarios_publicos/{uid}/init (lido pela página; passe um resolvedor `uidDeInit(init)` no init do módulo). Teste: ausente('AB', dia) e ausente(uid, dia) dão o mesmo resultado.
- Vista: mês com uma faixa por pessoa (nome + período), lista "🏖️ Fora agora" e "📆 Próximas" (60 dias); filtros pessoa, squad e período. Maré: por padrão só as pessoas das minhas squads, com chip "Todo o Digital"; Radar: todo o Digital.
- "Minhas férias": criar/editar/excluir os próprios períodos (data de início e fim, obs ≤140). fim < ini → a tela recusa (a regra não confere a ordem). Acima de 45 dias → aviso, não bloqueio. "Hoje" = data de São Paulo (como o resto das páginas).
- ADM na tela = ADM na regra: o "corrigir/apagar de outra pessoa" só aparece para usuarios/{uid}/role === 'adm' ou caio.soares@ciahering.com.br — NÃO para config.adm_emails (Armadilha 9).
- Visualizador externo do Painel e login não-Google não veem a vista (como o 📊 Gantt do Radar: _okrGcalPermitido).
- Botão "🧳 Preparar minha saída" em "Minhas férias": só o lugar (desabilitado, title "em breve"), a ação é a F4.
Arquivos: mare-ferias-dev.js (novo), kanban-dev.html, okr-dev.html, version.json (mare-cli bump), docs/BIBLIOTECA.md (arquivo novo na raiz), Ajuda (HELP_CONTENT do Maré, ajuda do Radar), mare-dicas-dev.js (1 dica, se couber), docs/arezzo/testes/test_ferias_calendario.js (novo) · Reservados por outros: os do Quadro
Critérios de aceite:
- test_ferias_calendario.js (Playwright + fakefb, Maré e Radar, 1280 e 390 px, 3 temas): cadastrar/editar/excluir as próprias; não ver botão de editar nas de outra pessoa (membro e PO); ADM corrige a de outra; fim<ini recusado; "Fora agora" respeita o dia de SP; filtro squad/pessoa; obs com <img src=x onerror=...> aparece como texto (XSS); visualizador externo não vê a vista; sem erro JS; sem overflow horizontal em 390 px
- checar.js e `cd functions && npm test` verdes; mapas regenerados (mare-cli map, scripts/mapa.js)
Não fazer: database.rules.json, functions/, merge, deploy, promoção para prod, alerta de menção (é a F3), passagem de itens (é a F4)
Prova: saída dos testes colada · capturas em docs/capturas/ferias_calendario/ · o que NÃO verificou
Entrega: branch antigravity/ferias-calendario + PR (base main, sem merge) + resumo com Prova, "Fronteira:" (obs e nomes de outras pessoas indo para o DOM → só esc()/textContent) e "Dica:"
```

## Contrato — F3: aviso "🏖️ está de férias" + selo (Codex)

```
Objetivo: ao marcar alguém que está (ou estará) de férias, a pessoa que marca vê na hora "🏖️ Ana Souza está de férias até 28/11" — sem impedir a ação; e quem está fora HOJE ganha um selo 🏖️ discreto onde aparece como responsável.
Risco: R1 (2 páginas -dev, só leitura do nó; nada novo gravado)  ·  Modelo e esforço: GPT high  ·  Orçamento: 3 h; estourou, para e relata
COMEÇA SÓ DEPOIS DO MERGE DA F2 (usa a API do mare-ferias-dev.js). Branch a partir de origin/main com a F2 dentro.
Contexto:
- Nota: docs/ideias/modo-ferias.md (decisões e modelo). Fonte única: MareFerias.ausente(quem, diaISO) e MareFerias.periodoDe(quem) — `quem` aceita uid OU inicial (o Maré usa iniciais em card.owner, participantes e @menções). NÃO ler kanban/ferias direto nas páginas: tudo pelo módulo (que a página já carrega por causa da F2).
- "De férias" para o aviso = período ATUAL ou que COMEÇA nos próximos 7 dias ("🏖️ Ana sai de férias em 02/12 (até 15/12)"). Selo = só quem está fora HOJE (data de São Paulo).
- Aviso: o toast da página (Maré: showToast(msg, duration) ~L30437; Radar: showToast ~L2491), 6 s, uma vez por pessoa por ação (marcar 3 pessoas de férias = 1 toast com os 3 nomes). Não bloqueia nem pede confirmação.
- Pontos de disparo (grep -n pelo nome; números de linha envelhecem):
  Maré (kanban-dev.html): insertMention (@menção em comentário/descrição) · #m-owner (onchange do responsável) · addParticipant · _doBulkAssign (atribuir em lote) · executarReatribuir (🔄 Reatribuir cards).
  Radar (okr-dev.html): _okrMencaoEscolhe (@menção nas anotações) · #okr-m-resp (responsável do Marco) · responsáveis do Objetivo (onde draft.responsaveis ganha uid; ver o _okrRecordHistory "adicionou … como responsável" ~L7495).
- Selo 🏖️ (title "De férias até 28/11"): Maré — no responsável do card no board (onde .minicard-owner / avatar do dono é desenhado) e nos chips de participantes do modal; Radar — no responsável do Marco e nos responsáveis do Objetivo no cartão. Texto do title por textContent/esc() (nome e obs são texto de outra pessoa).
- Quem não tem o módulo carregado (ex.: falhou a rede) segue sem aviso e sem erro (guard `window.MareFerias?.ausente`).
Arquivos: kanban-dev.html, okr-dev.html, version.json (mare-cli bump), Ajuda (1 frase no tópico de Férias que a F2 criou, Maré e Radar), docs/arezzo/testes/test_ferias_aviso.js (novo) · Reservados por outros: os do Quadro
Critérios de aceite:
- test_ferias_aviso.js (Playwright + fakefb; Maré e Radar; 1280 e 390 px): cada ponto de disparo acima mostra o toast para alguém de férias hoje e para quem sai em ≤7 dias; NÃO mostra para quem volta antes de hoje nem para quem sai em 8+ dias; 3 pessoas de férias numa ação = 1 toast; marcar continua funcionando (o card/Marco é salvo); selo aparece só para quem está fora hoje; inicial e uid dão o mesmo resultado; nome com <img src=x onerror=...> vira texto; sem MareFerias carregado não há erro JS
- O teste FALHA no main antes da mudança (rode e cole as falhas) e passa depois
- checar.js e `cd functions && npm test` verdes; mapas regenerados
Não fazer: gravar qualquer coisa nova no banco, mexer no mare-ferias-dev.js (se faltar algo na API, pare e relate), database.rules.json, functions/, merge, deploy, prod
Prova: saída do teste antes/depois · captura de 1 toast e 1 selo em docs/capturas/ferias_aviso/ · o que NÃO verificou
Entrega: branch codex/ferias-aviso + PR (base main, sem merge) + resumo com Prova, "Fronteira:" (nome de outra pessoa no toast/title → só textContent/esc) e "Dica:"
```
